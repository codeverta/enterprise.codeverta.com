package controller

import (
	"errors"
	"gin-template/model"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func (ctrl *LMSController) CreateLesson(c *gin.Context) {
	var lesson model.Lesson
	if err := c.ShouldBindJSON(&lesson); err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}
	db := lmsDB(c, ctrl.DB).WithContext(c)

	var module model.Module
	if err := db.Select("course_id").First(&module, "id = ?", lesson.ModuleID).Error; err != nil {
		sendError(c, http.StatusNotFound, "Module not found", nil)
		return
	}

	allowed, errMsg := ctrl.checkCoursePermission(c, db, module.CourseID)
	if !allowed {
		sendError(c, http.StatusForbidden, errMsg, nil)
		return
	}

	if err := db.Create(&lesson).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccess(c, lesson, "Lesson created successfully")
}

func (ctrl *LMSController) ListLessons(c *gin.Context) {
	userID, _, ok := currentLMSUser(c)
	if !ok {
		return
	}
	var lessons []model.Lesson
	query := lmsDB(c, ctrl.DB).Order("sort_order asc, created_at asc").Limit(parseLimit(c))
	if moduleID := c.Query("module_id"); moduleID != "" {
		parsedModuleID, err := uuid.Parse(moduleID)
		if err != nil {
			sendBadRequest(c, ErrInvalidParameters, nil)
			return
		}
		var module model.Module
		err = lmsDB(c, ctrl.DB).Select("id", "course_id").First(&module, "id = ?", parsedModuleID).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			sendError(c, http.StatusNotFound, "Module not found", nil)
			return
		}
		if err != nil {
			sendInternalError(c, err)
			return
		}
		query = query.Where("module_id = ?", parsedModuleID)
	}
	if err := query.Find(&lessons).Error; err != nil {
		sendInternalError(c, err)
		return
	}

	if len(lessons) == 0 {
		sendSuccess(c, lessons, "Lessons retrieved successfully")
		return
	}

	lessonIDs := make([]uuid.UUID, 0, len(lessons))
	for _, lesson := range lessons {
		lessonIDs = append(lessonIDs, lesson.ID)
	}

	var progressItems []model.StudentProgress
	progressByLesson := map[uuid.UUID]model.StudentProgress{}
	if err := lmsDB(c, ctrl.DB).
		Where("student_id = ? AND lesson_id IN ?", userID, lessonIDs).
		Find(&progressItems).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	for _, progress := range progressItems {
		progressByLesson[progress.LessonID] = progress
	}

	items := make([]gin.H, 0, len(lessons))
	for _, lesson := range lessons {
		progress := progressByLesson[lesson.ID]
		items = append(items, gin.H{
			"id":                 lesson.ID,
			"module_id":          lesson.ModuleID,
			"title":              lesson.Title,
			"summary":            lesson.Summary,
			"duration_sec":       lesson.DurationSec,
			"sort_order":         lesson.SortOrder,
			"is_preview":         lesson.IsPreview,
			"is_published":       lesson.IsPublished,
			"require_attachment": lesson.RequireAttachment,
			"created_at":         lesson.CreatedAt,
			"updated_at":         lesson.UpdatedAt,
			"deleted_at":         lesson.DeletedAt,
			"tenant_id":          lesson.TenantID,
			"is_completed":       progress.IsCompleted,
			"progress_status":    progress.Status,
			"progress_percent":   progress.ProgressPercent,
			"completed_at":       progress.CompletedAt,
			"last_position_sec":  progress.LastPositionSec,
			"progress":           progress,
		})
	}
	sendSuccess(c, items, "Lessons retrieved successfully")
}
