package controller

import (
	"context"
	"errors"
	"fmt"
	"gin-template/model"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/tencentyun/cos-go-sdk-v5"
	"gorm.io/gorm"
)

// SubmitAssignment handles student file upload for a lesson assignment.
func (ctrl *LMSController) SubmitAssignment(c *gin.Context) {
	lessonID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	userID, _, ok := currentLMSUser(c)
	if !ok {
		return
	}

	db := lmsDB(c, ctrl.DB).WithContext(c)

	// Verify lesson exists and student has access
	lesson, module, course, valid := ctrl.loadLessonContext(c, db, lessonID)
	if !valid {
		return
	}
	if !ctrl.requireLearningAccess(c, &course.ID) {
		return
	}
	_ = lesson
	_ = module

	// Parse multipart form
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		sendBadRequest(c, "File is required", nil)
		return
	}
	defer file.Close()

	note := c.PostForm("note")

	// Validate file type (PDF, DOC, DOCX, etc.)
	allowedTypes := map[string]bool{
		"application/pdf":    true,
		"application/msword": true,
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document": true,
		"application/vnd.ms-excel": true,
		"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": true,
		"image/jpeg": true,
		"image/png":  true,
	}
	contentType := header.Header.Get("Content-Type")
	if !allowedTypes[contentType] {
		sendBadRequest(c, "File type not allowed. Accepted: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG", nil)
		return
	}

	// Upload file to COS
	fileURL, err := uploadAssignmentFile(file, header)
	if err != nil {
		sendInternalError(c, fmt.Errorf("failed to upload file: %w", err))
		return
	}

	// Check if student already has a submission for this lesson
	var existing model.Assignment
	err = db.Where("lesson_id = ? AND student_id = ?", lessonID, userID).First(&existing).Error
	if err == nil {
		// Update existing submission
		existing.FileURL = fileURL
		existing.FileName = header.Filename
		existing.Note = note
		existing.Status = model.AssignmentStatusSubmitted
		existing.Score = nil
		existing.Feedback = ""
		existing.GradedAt = nil
		existing.GradedBy = nil
		if err := db.Save(&existing).Error; err != nil {
			sendInternalError(c, err)
			return
		}
		sendSuccess(c, existing, "Assignment updated successfully")
		return
	}

	// Create new assignment
	assignment := model.Assignment{
		LessonID:  lessonID,
		StudentID: userID,
		FileURL:   fileURL,
		FileName:  header.Filename,
		Note:      note,
		Status:    model.AssignmentStatusSubmitted,
		MaxScore:  100,
	}

	if err := db.Create(&assignment).Error; err != nil {
		sendInternalError(c, err)
		return
	}

	sendSuccess(c, assignment, "Assignment submitted successfully")
}

// GetLessonAssignments returns all assignments for a lesson (mentor/admin sees all, student sees own).
func (ctrl *LMSController) GetLessonAssignments(c *gin.Context) {
	lessonID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	userID, role, ok := currentLMSUser(c)
	if !ok {
		return
	}

	db := lmsDB(c, ctrl.DB).WithContext(c)

	// Verify lesson exists
	var lesson model.Lesson
	if err := db.First(&lesson, "id = ?", lessonID).Error; err != nil {
		sendError(c, http.StatusNotFound, "Lesson not found", nil)
		return
	}
	_ = lesson

	var assignments []model.Assignment
	query := db.Preload("Student").Where("lesson_id = ?", lessonID)

	// Students can only see their own assignments
	if role != 99 && role != 30 { // not admin/mentor
		query = query.Where("student_id = ?", userID)
	}

	if err := query.Order("created_at desc").Find(&assignments).Error; err != nil {
		sendInternalError(c, err)
		return
	}

	sendSuccess(c, assignments, "Assignments retrieved successfully")
}

// GetMyAssignment returns the current student's assignment for a specific lesson.
func (ctrl *LMSController) GetMyAssignment(c *gin.Context) {
	lessonID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	userID, _, ok := currentLMSUser(c)
	if !ok {
		return
	}

	db := lmsDB(c, ctrl.DB).WithContext(c)

	var assignment model.Assignment
	err := db.Where("lesson_id = ? AND student_id = ?", lessonID, userID).First(&assignment).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		sendSuccess(c, nil, "No assignment submitted yet")
		return
	}
	if err != nil {
		sendInternalError(c, err)
		return
	}

	sendSuccess(c, assignment, "Assignment retrieved successfully")
}

// GradeAssignment allows a mentor/admin to grade a student's assignment.
func (ctrl *LMSController) GradeAssignment(c *gin.Context) {
	assignmentID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	userID, role, ok := currentLMSUser(c)
	if !ok {
		return
	}

	// Only admin (99) or mentor (30) can grade
	if role != 99 && role != 30 {
		sendError(c, http.StatusForbidden, "Only mentors and admins can grade assignments", nil)
		return
	}

	var payload struct {
		Score    float64 `json:"score" binding:"required,min=0"`
		Feedback string  `json:"feedback"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}

	db := lmsDB(c, ctrl.DB).WithContext(c)

	var assignment model.Assignment
	if err := db.First(&assignment, "id = ?", assignmentID).Error; err != nil {
		sendError(c, http.StatusNotFound, "Assignment not found", nil)
		return
	}

	// Cap score at max_score
	if payload.Score > assignment.MaxScore {
		payload.Score = assignment.MaxScore
	}

	now := time.Now()
	updates := map[string]interface{}{
		"score":     payload.Score,
		"feedback":  payload.Feedback,
		"status":    model.AssignmentStatusGraded,
		"graded_at": &now,
		"graded_by": &userID,
	}

	if err := db.Model(&assignment).Updates(updates).Error; err != nil {
		sendInternalError(c, err)
		return
	}

	assignment.Score = &payload.Score
	assignment.Feedback = payload.Feedback
	assignment.Status = model.AssignmentStatusGraded
	assignment.GradedAt = &now
	assignment.GradedBy = &userID

	sendSuccess(c, assignment, "Assignment graded successfully")
}

// GetCourseAssignmentSummary returns the accumulated assignment scores for a student in a course.
// GetCourseAssignmentSummary returns the accumulated assignment scores for a student in a course.
func (ctrl *LMSController) GetCourseAssignmentSummary(c *gin.Context) {
	courseID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	userID, _, ok := currentLMSUser(c)
	if !ok {
		return
	}

	db := lmsDB(c, ctrl.DB).WithContext(c)

	// Get all modules in the course
	var modules []model.Module
	if err := db.Where("course_id = ?", courseID).Order("sort_order asc").Find(&modules).Error; err != nil {
		sendInternalError(c, err)
		return
	}

	if len(modules) == 0 {
		sendSuccess(c, gin.H{
			"course_id":       courseID,
			"student_id":      userID,
			"total_lessons":   0,
			"submitted_count": 0,
			"graded_count":    0,
			"total_score":     0,
			"total_max_score": 0,
			"average_score":   0,
			"lessons":         []gin.H{},
		}, "Course assignment summary retrieved successfully")
		return
	}

	moduleIDs := make([]uuid.UUID, len(modules))
	for i, m := range modules {
		moduleIDs[i] = m.ID
	}

	// Get all lessons in those modules
	var lessons []model.Lesson
	if err := db.Where("module_id IN ?", moduleIDs).Find(&lessons).Error; err != nil {
		sendInternalError(c, err)
		return
	}

	if len(lessons) == 0 {
		sendSuccess(c, gin.H{
			"course_id":       courseID,
			"student_id":      userID,
			"total_lessons":   0,
			"submitted_count": 0,
			"graded_count":    0,
			"total_score":     0,
			"total_max_score": 0,
			"average_score":   0,
			"lessons":         []gin.H{},
		}, "Course assignment summary retrieved successfully")
		return
	}

	lessonIDs := make([]uuid.UUID, len(lessons))
	for i, l := range lessons {
		lessonIDs[i] = l.ID
	}

	// Get all assignments for this student in this course
	var assignments []model.Assignment
	if err := db.Where("lesson_id IN ? AND student_id = ?", lessonIDs, userID).
		Preload("Lesson").
		Find(&assignments).Error; err != nil {
		sendInternalError(c, err)
		return
	}

	// Build summary
	var totalScore float64
	var totalMaxScore float64
	var gradedCount int
	var submittedCount int
	var assignmentLessonsCount int // Untuk menghitung materi yang khusus membutuhkan assignment saja

	lessonDetails := make([]gin.H, 0)
	assignmentMap := make(map[uuid.UUID]model.Assignment)
	for _, a := range assignments {
		assignmentMap[a.LessonID] = a
	}

	for _, lesson := range lessons {
		// JIKA require_attachment == false, lewati lesson ini (tidak usah diproses/ditampilkan)
		if !lesson.RequireAttachment {
			continue
		}

		// Hitung increment total materi yang wajib mengumpulkan tugas
		assignmentLessonsCount++

		item := gin.H{
			"lesson_id":    lesson.ID,
			"lesson_title": lesson.Title,
		}

		if a, exists := assignmentMap[lesson.ID]; exists {
			submittedCount++
			item["status"] = a.Status
			item["score"] = a.Score
			item["max_score"] = a.MaxScore
			item["feedback"] = a.Feedback
			item["graded_at"] = a.GradedAt
			if a.Score != nil {
				totalScore += *a.Score
				totalMaxScore += a.MaxScore
				gradedCount++
			}
		} else {
			item["status"] = "not_submitted"
			item["score"] = nil
			item["max_score"] = 100
		}
		lessonDetails = append(lessonDetails, item)
	}

	averageScore := 0.0
	if totalMaxScore > 0 {
		averageScore = totalScore / totalMaxScore * 100
	}

	sendSuccess(c, gin.H{
		"course_id":       courseID,
		"student_id":      userID,
		"total_lessons":   assignmentLessonsCount, // Menampilkan total materi berkategori wajib tugas saja
		"submitted_count": submittedCount,
		"graded_count":    gradedCount,
		"total_score":     totalScore,
		"total_max_score": totalMaxScore,
		"average_score":   averageScore,
		"lessons":         lessonDetails,
	}, "Course assignment summary retrieved successfully")
}

// uploadAssignmentFile uploads a file to COS and returns the object key.
func uploadAssignmentFile(file multipart.File, header *multipart.FileHeader) (string, error) {
	secretID := os.Getenv("COS_SECRET_ID")
	secretKey := os.Getenv("COS_SECRET_KEY")
	rawBucketURL := os.Getenv("COS_BUCKET_URL")

	if secretID == "" || secretKey == "" || rawBucketURL == "" {
		return "", fmt.Errorf("COS configuration is incomplete")
	}

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if ext == "" {
		ext = ".bin"
	}
	objectKey := fmt.Sprintf("lms/assignments/%s%s", uuid.New().String(), ext)

	bucketURL, _ := url.Parse(rawBucketURL)
	client := cos.NewClient(&cos.BaseURL{BucketURL: bucketURL}, &http.Client{
		Transport: &cos.AuthorizationTransport{
			SecretID:  secretID,
			SecretKey: secretKey,
		},
	})

	// Reset file pointer
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return "", fmt.Errorf("failed to reset file: %w", err)
	}

	opt := &cos.ObjectPutOptions{
		ObjectPutHeaderOptions: &cos.ObjectPutHeaderOptions{
			ContentType: header.Header.Get("Content-Type"),
		},
	}

	ctx := context.Background()
	_, err := client.Object.Put(ctx, objectKey, file, opt)
	if err != nil {
		return "", fmt.Errorf("failed to upload to COS: %w", err)
	}

	return objectKey, nil
}
