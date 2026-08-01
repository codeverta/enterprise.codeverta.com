package controller

import (
	"encoding/base64"
	"errors"
	"fmt"
	"gin-template/model"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// GetCourseCertificate returns certificate data if the student has completed all lessons in a course.
func (ctrl *LMSController) GetCourseCertificate(c *gin.Context) {
	courseID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	userID, role, ok := currentLMSUser(c)
	if !ok {
		return
	}

	db := lmsDB(c, ctrl.DB).WithContext(c)

	// 1. Ambil data course
	var course model.Course
	if err := db.First(&course, "id = ?", courseID).Error; err != nil {
		sendError(c, http.StatusNotFound, "Course not found", nil)
		return
	}

	certificateUserID := userID
	if role >= 99 && c.Query("student_id") != "" {
		parsedStudentID, err := uuid.Parse(c.Query("student_id"))
		if err != nil {
			sendBadRequest(c, ErrInvalidParameters, nil)
			return
		}
		certificateUserID = parsedStudentID
	}

	// 2. Ambil data user untuk mendapatkan Nama Partner
	studentName := ""
	var user model.User
	if err := db.First(&user, "id = ?", certificateUserID).Error; err == nil {
		if user.FirstName != "" || user.LastName != "" {
			studentName = strings.TrimSpace(user.FirstName + " " + user.LastName)
		} else if user.DisplayName != "" {
			studentName = user.DisplayName
		} else {
			studentName = user.Username
		}
	}

	if studentName == "" {
		if role >= 99 {
			studentName = "Admin Preview"
		} else {
			studentName = "Student"
		}
	}

	// 3. Hitung kelulusan (Mengecek total lesson vs lesson yang diselesaikan)
	var modules []model.Module
	if err := db.Where("course_id = ?", courseID).Find(&modules).Error; err != nil {
		sendInternalError(c, err)
		return
	}

	if len(modules) == 0 {
		sendError(c, http.StatusBadRequest, "Course has no modules", nil)
		return
	}

	moduleIDs := make([]uuid.UUID, len(modules))
	for i, m := range modules {
		moduleIDs[i] = m.ID
	}

	var totalLessons int64
	if err := db.Model(&model.Lesson{}).Where("module_id IN ?", moduleIDs).Count(&totalLessons).Error; err != nil {
		sendInternalError(c, err)
		return
	}

	if totalLessons == 0 {
		sendError(c, http.StatusBadRequest, "Course has no published lessons", nil)
		return
	}

	var completedCount int64
	if err := db.Model(&model.StudentProgress{}).
		Where("student_id = ? AND course_id = ? AND is_completed = ?", certificateUserID, courseID, true).
		Count(&completedCount).Error; err != nil {
		sendInternalError(c, err)
		return
	}

	// 3b. Cek nilai minimum kelulusan jika diatur
	avgScore, err := calculateCourseAverageScore(db, certificateUserID, courseID)
	if err != nil {
		sendInternalError(c, err)
		return
	}

	// Jika parameter query ?check_only=true dikirim dari useEffect frontend, return JSON saja
	if c.Query("check_only") == "true" {
		sendSuccess(c, gin.H{
			"completed":             completedCount >= totalLessons,
			"completed_lessons":     completedCount,
			"total_lessons":         totalLessons,
			"average_score":         avgScore,
			"minimum_passing_grade": course.MinimumPassingGrade,
			"passed":                course.MinimumPassingGrade <= 0 || avgScore >= course.MinimumPassingGrade,
		}, "Status checked")
		return
	}

	// Blokir jika partner belum menyelesaikan seluruh kelas materi
	if role < 99 && completedCount < totalLessons {
		sendError(c, http.StatusForbidden, "Kamu belum menyelesaikan seluruh materi course ini", gin.H{
			"completed_lessons":     completedCount,
			"total_lessons":         totalLessons,
			"average_score":         avgScore,
			"minimum_passing_grade": course.MinimumPassingGrade,
			"passed":                course.MinimumPassingGrade <= 0 || avgScore >= course.MinimumPassingGrade,
		})
		return
	}

	// Blokir jika partner tidak mencapai passing grade minimum
	if role < 99 && course.MinimumPassingGrade > 0 && avgScore < course.MinimumPassingGrade {
		sendError(c, http.StatusForbidden, fmt.Sprintf("Nilai rata-rata kuis Anda (%.2f) kurang dari nilai kelulusan minimum (%.2f)", avgScore, course.MinimumPassingGrade), gin.H{
			"completed_lessons":     completedCount,
			"total_lessons":         totalLessons,
			"average_score":         avgScore,
			"minimum_passing_grade": course.MinimumPassingGrade,
			"passed":                false,
		})
		return
	}

	certificateID := uuid.New()
	certificateURL := ""
	var issuedAt time.Time
	var studentCertificate model.StudentCertificate
	if role < 99 {
		err := db.Where("student_id = ? AND course_id = ?", certificateUserID, courseID).First(&studentCertificate).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			studentCertificate = model.StudentCertificate{
				StudentID: certificateUserID,
				CourseID:  courseID,
				IssuedAt:  time.Now(),
			}
			if err := db.Create(&studentCertificate).Error; err != nil {
				sendInternalError(c, err)
				return
			}
		} else if err != nil {
			sendInternalError(c, err)
			return
		}
		certificateID = studentCertificate.ID
		certificateURL = studentCertificate.CertificateURL
		issuedAt = studentCertificate.IssuedAt
	}
	if issuedAt.IsZero() {
		issuedAt = time.Now()
	}

	var tpl model.CertificateTemplate
	hasCustomTemplate := false
	if err := db.Where("course_id = ? AND is_enabled = ? AND template_url <> ?", courseID, true, "").First(&tpl).Error; err == nil {
		hasCustomTemplate = true
		imageBytes, err := generateCertificateWithTemplate(tpl, studentName, course.Title)
		if err != nil {
			sendInternalError(c, err)
			return
		}
		certificateURL = "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(imageBytes)
		if role < 99 && studentCertificate.CertificateURL != certificateURL {
			_ = db.Model(&studentCertificate).Update("certificate_url", certificateURL).Error
		}
	}

	sendSuccess(c, gin.H{
		"completed":             role >= 99 || completedCount >= totalLessons,
		"completed_lessons":     completedCount,
		"total_lessons":         totalLessons,
		"average_score":         avgScore,
		"minimum_passing_grade": course.MinimumPassingGrade,
		"passed":                course.MinimumPassingGrade <= 0 || avgScore >= course.MinimumPassingGrade,
		"student_name":          studentName,
		"course_title":          course.Title,
		"completion_date":       issuedAt,
		"course_id":             course.ID,
		"certificate_id":        certificateID,
		"certificate_url":       certificateURL,
		"has_custom_template":   hasCustomTemplate,
	}, "Certificate retrieved")
}

func dayjsFormatBridge(t time.Time) string {
	return fmt.Sprintf("Diberikan pada tanggal %s", t.Format("02 January 2006"))
}

func certificateUserName(user model.User) string {
	if user.DisplayName != "" {
		return user.DisplayName
	}
	fullName := strings.TrimSpace(strings.TrimSpace(user.FirstName) + " " + strings.TrimSpace(user.LastName))
	if fullName != "" {
		return fullName
	}
	if user.Username != "" {
		return user.Username
	}
	return user.Email
}

func calculateCourseAverageScore(db *gorm.DB, studentID, courseID uuid.UUID) (float64, error) {
	// Find all quiz IDs in this course
	var quizIDs []uuid.UUID
	err := db.Model(&model.Quiz{}).
		Joins("JOIN modules ON quizzes.module_id = modules.id").
		Where("modules.course_id = ?", courseID).
		Pluck("quizzes.id", &quizIDs).Error
	if err != nil {
		return 0, err
	}

	if len(quizIDs) == 0 {
		// No quizzes, pass by default (100)
		return 100, nil
	}

	// Fetch student's best score for these quizzes from quiz_progresses
	var progresses []model.QuizProgress
	err = db.Where("student_id = ? AND quiz_id IN ?", studentID, quizIDs).Find(&progresses).Error
	if err != nil {
		return 0, err
	}

	// Map to look up score by quiz ID
	scores := make(map[uuid.UUID]float64)
	for _, p := range progresses {
		scores[p.QuizID] = p.BestScore
	}

	// Sum scores (quizzes not attempted score 0)
	var sum float64
	for _, qID := range quizIDs {
		sum += scores[qID]
	}

	average := sum / float64(len(quizIDs))
	return average, nil
}
