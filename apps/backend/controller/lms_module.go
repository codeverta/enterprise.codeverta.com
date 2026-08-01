package controller

import (
	"gin-template/model"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func (ctrl *LMSController) ReorderModules(c *gin.Context) {
	var req ReorderModulesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Invalid payload data"})
		return
	}

	courseUUID, err := uuid.Parse(req.CourseID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Invalid course ID"})
		return
	}

	db := lmsDB(c, ctrl.DB)
	allowed, errMsg := ctrl.checkCoursePermission(c, db, courseUUID)
	if !allowed {
		c.JSON(http.StatusForbidden, gin.H{"status": "error", "message": errMsg})
		return
	}

	// Gunakan helper lmsDB yang sudah Anda miliki untuk mempertahankan scope tenant
	tx := db.Begin()

	if tx.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to start database transaction"})
		return
	}

	// Loop dan update sort_order masing-masing modul secara terisolasi
	for _, mod := range req.Modules {
		err := tx.Model(&model.Module{}).
			Where("id = ? AND course_id = ?", mod.ID, req.CourseID).
			Update("sort_order", mod.SortOrder).Error

		if err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to update module sequence: " + err.Error()})
			return
		}
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Transaction commit error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Modules order re-sequenced successfully",
	})
}

func (ctrl *LMSController) CreateModule(c *gin.Context) {
	var module model.Module
	if err := c.ShouldBindJSON(&module); err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}
	db := lmsDB(c, ctrl.DB).WithContext(c)

	allowed, errMsg := ctrl.checkCoursePermission(c, db, module.CourseID)
	if !allowed {
		sendError(c, http.StatusForbidden, errMsg, nil)
		return
	}

	if err := db.Create(&module).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccess(c, module, "Module created successfully")
}

func (ctrl *LMSController) ListModules(c *gin.Context) {
	var modules []model.Module
	query := lmsDB(c, ctrl.DB).Order("sort_order asc, created_at asc").Limit(parseLimit(c))
	if courseID := c.Query("course_id"); courseID != "" {
		parsedCourseID, err := uuid.Parse(courseID)
		if err != nil {
			sendBadRequest(c, ErrInvalidParameters, nil)
			return
		}
		query = query.Where("course_id = ?", parsedCourseID)
	}
	if err := query.Find(&modules).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccess(c, modules, "Modules retrieved successfully")
}
