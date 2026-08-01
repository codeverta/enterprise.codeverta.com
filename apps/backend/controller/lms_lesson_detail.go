package controller

import (
	"errors"
	"fmt"
	"gin-template/model"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func (ctrl *LMSController) GetLessonDetail(c *gin.Context) {
	lessonID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	userID, role, ok := currentLMSUser(c)
	if !ok {
		return
	}

	db := lmsDB(c, ctrl.DB).WithContext(c)
	lesson, module, course, ok := ctrl.loadLessonContext(c, db, lessonID)
	if !ok {
		return
	}
	if !ctrl.requireLearningAccess(c, &course.ID) {
		return
	}

	if role < 30 {
		allowed, msg, err := isLessonAccessAllowed(db, userID, course, lesson)
		if err != nil {
			sendInternalError(c, err)
			return
		}
		if !allowed {
			sendError(c, http.StatusForbidden, msg, nil)
			return
		}
	}

	var assets []model.LearningAsset
	if err := db.Where("lesson_id = ?", lesson.ID).Order("sort_order asc, created_at asc").Find(&assets).Error; err != nil {
		sendInternalError(c, err)
		return
	}

	progress := ensureLessonProgress(db, userID, course.ID, module.ID, lesson.ID, false)
	prevLesson, nextLesson := adjacentLessons(db, module.ID, lesson)
	lessonQuizzes, err := lessonQuizPayloads(db, userID, role, lesson.ID)
	if err != nil {
		sendInternalError(c, err)
		return
	}

	sendSuccess(c, gin.H{
		"lesson":          lesson,
		"module":          module,
		"course":          courseWithStats(db, course, userID),
		"assets":          assets,
		"lesson_quizzes":  lessonQuizzes,
		"progress":        progress,
		"previous_lesson": prevLesson,
		"next_lesson":     nextLesson,
	}, "Lesson detail retrieved successfully")
}

func (ctrl *LMSController) ContinueLesson(c *gin.Context) {
	lessonID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	userID, role, ok := currentLMSUser(c)
	if !ok {
		return
	}
	var req struct {
		Status          string  `json:"status"`
		LastPositionSec int     `json:"last_position_sec"`
		ProgressPercent float64 `json:"progress_percent"`
	}
	_ = c.ShouldBindJSON(&req)
	if req.Status == "" {
		req.Status = "completed"
	}

	db := lmsDB(c, ctrl.DB).WithContext(c)
	lesson, module, course, valid := ctrl.loadLessonContext(c, db, lessonID)
	if !valid {
		return
	}
	if !ctrl.requireLearningAccess(c, &course.ID) {
		return
	}

	isCompleted := req.Status == "completed"
	if isCompleted && role < 30 {
		allowed, message, err := canCompleteLesson(db, userID, lesson.ID)
		if err != nil {
			sendInternalError(c, err)
			return
		}
		if !allowed {
			sendError(c, http.StatusForbidden, message, nil)
			return
		}
	}

	now := time.Now()
	updates := map[string]interface{}{
		"status":            req.Status,
		"is_completed":      isCompleted,
		"last_position_sec": req.LastPositionSec,
		"progress_percent":  req.ProgressPercent,
	}
	if isCompleted {
		updates["completed_at"] = &now
		updates["progress_percent"] = 100.0
	}

	progress := ensureLessonProgress(db, userID, course.ID, module.ID, lesson.ID, false)
	if progress.ID == uuid.Nil {
		progress = model.StudentProgress{
			StudentID:       userID,
			CourseID:        course.ID,
			ModuleID:        module.ID,
			LessonID:        lesson.ID,
			Status:          req.Status,
			IsCompleted:     isCompleted,
			LastPositionSec: req.LastPositionSec,
			ProgressPercent: updates["progress_percent"].(float64),
		}
		if isCompleted {
			progress.CompletedAt = &now
		}
		if err := db.Create(&progress).Error; err != nil {
			sendInternalError(c, err)
			return
		}
	} else if err := db.Model(&progress).Updates(updates).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	progress.Status = req.Status
	progress.IsCompleted = isCompleted
	progress.LastPositionSec = req.LastPositionSec
	progress.ProgressPercent = updates["progress_percent"].(float64)
	if isCompleted {
		progress.CompletedAt = &now
	}

	_, nextLesson := adjacentLessons(db, module.ID, lesson)
	sendSuccess(c, gin.H{
		"progress":    progress,
		"next_lesson": nextLesson,
		"is_finished": nextLesson == nil,
		"course_id":   course.ID,
	}, "Lesson progress updated successfully")
}

func (ctrl *LMSController) loadLessonContext(c *gin.Context, db *gorm.DB, lessonID uuid.UUID) (model.Lesson, model.Module, model.Course, bool) {
	var lesson model.Lesson
	if err := db.First(&lesson, "id = ?", lessonID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			sendError(c, http.StatusNotFound, "Lesson not found", nil)
			return lesson, model.Module{}, model.Course{}, false
		}
		sendInternalError(c, err)
		return lesson, model.Module{}, model.Course{}, false
	}
	var module model.Module
	if err := db.First(&module, "id = ?", lesson.ModuleID).Error; err != nil {
		sendInternalError(c, err)
		return lesson, module, model.Course{}, false
	}
	var course model.Course

	// FIX: Hapus Preload("Mentors") dari chain query utama ini
	if err := db.Preload("CourseCategory").First(&course, "id = ?", module.CourseID).Error; err != nil {
		sendInternalError(c, err)
		return lesson, module, course, false
	}

	// FIX: Ambil data Mentors secara terpisah menggunakan Association API agar lolos dari interceptor tenant
	_ = db.Model(&course).Association("Mentors").Find(&course.Mentors)

	return lesson, module, course, true
}
func ensureLessonProgress(db *gorm.DB, studentID, courseID, moduleID, lessonID uuid.UUID, create bool) model.StudentProgress {
	var progress model.StudentProgress
	err := db.First(&progress, "student_id = ? AND lesson_id = ?", studentID, lessonID).Error
	if err == nil || !create {
		return progress
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		progress = model.StudentProgress{
			StudentID:       studentID,
			CourseID:        courseID,
			ModuleID:        moduleID,
			LessonID:        lessonID,
			Status:          "in_progress",
			ProgressPercent: 0,
		}
		_ = db.Create(&progress).Error
	}
	return progress
}

func adjacentLessons(db *gorm.DB, moduleID uuid.UUID, current model.Lesson) (*model.Lesson, *model.Lesson) {
	var lessons []model.Lesson
	if err := db.Where("module_id = ?", moduleID).Order("sort_order asc, created_at asc").Find(&lessons).Error; err != nil {
		return nil, nil
	}
	var previous *model.Lesson
	var next *model.Lesson
	for index := range lessons {
		if lessons[index].ID != current.ID {
			continue
		}
		if index > 0 {
			item := lessons[index-1]
			previous = &item
		}
		if index < len(lessons)-1 {
			item := lessons[index+1]
			next = &item
		}
		break
	}
	return previous, next
}

func lessonQuizPayloads(db *gorm.DB, studentID uuid.UUID, role int, lessonID uuid.UUID) ([]gin.H, error) {
	query := db.Where("lesson_id = ?", lessonID).Order("sort_order asc, created_at asc")
	if isQuizStaff(role) {
		query = query.Preload("Questions", func(db *gorm.DB) *gorm.DB {
			return db.Order("sort_order asc, created_at asc")
		}).Preload("Questions.Options", func(db *gorm.DB) *gorm.DB {
			return db.Order("sort_order asc, created_at asc")
		})
	}
	if role < 99 {
		now := time.Now()
		query = query.Where("(available_from IS NULL OR available_from <= ?)", now).
			Where("(available_until IS NULL OR available_until >= ?)", now)
	}

	var quizzes []model.Quiz
	if err := query.Find(&quizzes).Error; err != nil {
		return nil, err
	}

	progressByQuiz := map[string]model.QuizProgress{}
	questionCountMap := map[uuid.UUID]int64{}
	if len(quizzes) > 0 {
		quizIDs := make([]uuid.UUID, 0, len(quizzes))
		for _, quiz := range quizzes {
			quizIDs = append(quizIDs, quiz.ID)
		}
		var progress []model.QuizProgress
		if err := db.Where("student_id = ? AND quiz_id IN ?", studentID, quizIDs).Find(&progress).Error; err != nil {
			return nil, err
		}
		for _, item := range progress {
			progressByQuiz[item.QuizID.String()] = item
		}

		type QCount struct {
			QuizID uuid.UUID `gorm:"column:quiz_id"`
			Count  int64     `gorm:"column:cnt"`
		}
		var qCounts []QCount
		_ = db.Model(&model.QuizQuestion{}).
			Select("quiz_id, count(*) as cnt").
			Where("quiz_id IN ?", quizIDs).
			Group("quiz_id").
			Scan(&qCounts).Error
		for _, item := range qCounts {
			questionCountMap[item.QuizID] = item.Count
		}
	}

	items := make([]gin.H, 0, len(quizzes))
	for _, quiz := range quizzes {
		if role < 99 {
			hideQuizCorrectAnswers(&quiz)
		}
		qCount := int64(len(quiz.Questions))
		if !isQuizStaff(role) {
			qCount = questionCountMap[quiz.ID]
		}
		items = append(items, gin.H{
			"quiz":           quiz,
			"question_count": qCount,
			"progress":       progressByQuiz[quiz.ID.String()],
		})
	}
	return items, nil
}

func canCompleteLesson(db *gorm.DB, studentID uuid.UUID, lessonID uuid.UUID) (bool, string, error) {
	now := time.Now()

	// 1. Load lesson to check attachment
	var lesson model.Lesson
	if err := db.First(&lesson, "id = ?", lessonID).Error; err != nil {
		return false, "", err
	}

	// 2. Check quizzes
	var quizzes []model.Quiz
	if err := db.Where("lesson_id = ?", lessonID).
		Where("(available_from IS NULL OR available_from <= ?)", now).
		Where("(available_until IS NULL OR available_until >= ?)", now).
		Find(&quizzes).Error; err != nil {
		return false, "", err
	}
	for _, quiz := range quizzes {
		var progress model.QuizProgress
		err := db.First(&progress, "student_id = ? AND quiz_id = ?", studentID, quiz.ID).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return false, "Kuis lesson ini belum diselesaikan.", nil
		}
		if err != nil {
			return false, "", err
		}
		if !progress.IsCompleted {
			return false, "Kuis lesson ini belum diselesaikan.", nil
		}
		if !progress.IsPassed {
			return false, "Kuis Anda belum mencapai nilai minimum kelulusan.", nil
		}
	}

	// 3. Check attachment
	if lesson.RequireAttachment {
		var assignment model.Assignment
		err := db.Where("lesson_id = ? AND student_id = ?", lessonID, studentID).First(&assignment).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return false, "Silakan upload tugas (attachment) terlebih dahulu.", nil
		}
		if err != nil {
			return false, "", err
		}
		if assignment.Status != model.AssignmentStatusGraded || assignment.Score == nil {
			return false, "Tugas Anda belum dinilai oleh guru.", nil
		}
		if *assignment.Score < lesson.AttachmentPassingScore {
			return false, fmt.Sprintf("Nilai tugas Anda (%.2f) kurang dari nilai kelulusan minimum (%.2f). Silakan kumpulkan kembali.", *assignment.Score, lesson.AttachmentPassingScore), nil
		}
	}

	return true, "", nil
}

func isLessonAccessAllowed(db *gorm.DB, studentID uuid.UUID, course model.Course, lesson model.Lesson) (bool, string, error) {
	// 0. Check if course is locked in sequential bundles
	if locked, _ := isCourseLockedInBundles(db, studentID, course.ID); locked {
		return false, "Course ini terkunci karena Anda belum menyelesaikan course sebelumnya dalam bundle atau course ini tidak masuk dalam paket langganan anda.", nil
	}

	// If skipping is allowed, access is unconditionally allowed
	if course.AllowSkip {
		return true, "", nil
	}

	// 1. Get all modules of the course sorted
	var modules []model.Module
	if err := db.Where("course_id = ?", course.ID).Order("sort_order asc, created_at asc").Find(&modules).Error; err != nil {
		return false, "", err
	}

	if len(modules) == 0 {
		return true, "", nil
	}

	// 2. Get all lessons of these modules sorted
	var orderedLessons []model.Lesson
	for _, m := range modules {
		var lss []model.Lesson
		if err := db.Where("module_id = ?", m.ID).Order("sort_order asc, created_at asc").Find(&lss).Error; err != nil {
			return false, "", err
		}
		orderedLessons = append(orderedLessons, lss...)
	}

	// 3. Find the index of current lesson
	currentIndex := -1
	for idx, l := range orderedLessons {
		if l.ID == lesson.ID {
			currentIndex = idx
			break
		}
	}

	if currentIndex <= 0 {
		// First lesson is always accessible
		return true, "", nil
	}

	// 4. Get student progress for preceding lessons
	precedingLessonIDs := make([]uuid.UUID, currentIndex)
	for i := 0; i < currentIndex; i++ {
		precedingLessonIDs[i] = orderedLessons[i].ID
	}

	var progressCount int64
	err := db.Model(&model.StudentProgress{}).
		Where("student_id = ? AND lesson_id IN ? AND is_completed = ?", studentID, precedingLessonIDs, true).
		Count(&progressCount).Error
	if err != nil {
		return false, "", err
	}

	if progressCount < int64(currentIndex) {
		return false, "Anda harus menyelesaikan materi sebelumnya terlebih dahulu secara bertahap.", nil
	}

	return true, "", nil
}
