package controller

import (
	"gin-template/model"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type AssignStudentInput struct {
	StudentID uuid.UUID `json:"student_id" binding:"required"`
}

// POST /api/lms/classes/:id/assign
func (ctrl *LMSController) AssignStudentToClass(c *gin.Context) {
	// 1. Validasi Role (Asumsi Anda menyimpan role di context saat login)
	// Pastikan minimal role Mentor (30) atau Admin (99)
	userRole := c.GetInt("user_role")
	if userRole < model.RoleMentor {
		sendError(c, http.StatusForbidden, "Hanya mentor atau admin yang dapat assign partner ke kelas", nil)
		return
	}

	classID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}

	var input AssignStudentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		sendBadRequest(c, "Invalid student ID", nil)
		return
	}

	assignment := model.ClassStudent{
		ClassID:   classID,
		StudentID: input.StudentID,
	}

	// Gunakan lmsDB untuk memastikan isolated tenant
	if err := lmsDB(c, ctrl.DB).WithContext(c).Create(&assignment).Error; err != nil {
		sendInternalError(c, err)
		return
	}

	sendSuccess(c, assignment, "Partner berhasil dimasukkan ke kelas")
}
