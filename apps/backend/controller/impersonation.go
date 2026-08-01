package controller

import (
	"encoding/json"
	"gin-template/common"
	"gin-template/model"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type startImpersonationRequest struct {
	Reason string `json:"reason" binding:"required,max=500"`
}

func writeImpersonationAudit(tx *gorm.DB, c *gin.Context, actorID, targetID, sessionID uuid.UUID, action, reason string) error {
	changes, _ := json.Marshal(gin.H{
		"session_id":     sessionID,
		"target_user_id": targetID,
		"reason":         reason,
	})
	return tx.Set("skip_audit", true).Create(&model.AuditLog{
		UserID:    actorID,
		Action:    action,
		TableName: "impersonation_sessions",
		RecordID:  sessionID.String(),
		Changes:   string(changes),
		IPAddress: c.ClientIP(),
		UserAgent: c.Request.UserAgent(),
	}).Error
}

// StartImpersonation creates a revocable, tenant-scoped debugging session.
func (ctrl *UserController) StartImpersonation(c *gin.Context) {
	actorIDValue, ok := c.Get("userID")
	actorID, validID := actorIDValue.(uuid.UUID)
	actorRole := c.GetInt("role")
	if !ok || !validID || actorID == uuid.Nil || actorRole < common.RoleAdminUser {
		sendError(c, http.StatusForbidden, "Admin access is required", nil)
		return
	}

	targetID, err := uuid.Parse(c.Param("id"))
	if err != nil || targetID == uuid.Nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}
	if targetID == actorID {
		sendBadRequest(c, "You cannot impersonate your own account", nil)
		return
	}

	var request startImpersonationRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		sendBadRequest(c, "A debug reason is required", nil)
		return
	}
	request.Reason = strings.TrimSpace(request.Reason)
	if request.Reason == "" {
		sendBadRequest(c, "A debug reason is required", nil)
		return
	}

	db := model.GetDB(c)
	var target model.User
	if err := db.Select("id", "username", "email", "display_name", "role", "status", "token", "tenant_id").First(&target, "id = ?", targetID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			sendError(c, http.StatusNotFound, ErrUserNotFound, nil)
			return
		}
		sendInternalError(c, err)
		return
	}
	if target.Status != common.UserStatusEnabled {
		sendBadRequest(c, "Only active accounts can be impersonated", nil)
		return
	}
	if target.Role >= actorRole {
		sendError(c, http.StatusForbidden, "You can only impersonate users with a lower role", nil)
		return
	}

	now := time.Now().UTC()
	session := model.ImpersonationSession{
		ID:               uuid.New(),
		ImpersonatorID:   actorID,
		ImpersonatorRole: actorRole,
		TargetUserID:     target.ID,
		TargetRole:       target.Role,
		Reason:           request.Reason,
		ExpiresAt:        now.Add(model.ImpersonationSessionDuration),
	}
	accessToken, refreshToken, err := generateImpersonationTokens(&target, &session)
	if err != nil {
		sendInternalError(c, err)
		return
	}

	if err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&session).Error; err != nil {
			return err
		}
		return writeImpersonationAudit(tx, c, actorID, target.ID, session.ID, "IMPERSONATE_START", request.Reason)
	}); err != nil {
		sendInternalError(c, err)
		return
	}

	sendSuccess(c, gin.H{
		"access_token":  accessToken,
		"refresh_token": refreshToken,
		"user": gin.H{
			"id": target.ID, "username": target.Username, "email": target.Email,
			"display_name": target.DisplayName, "role": target.Role, "status": target.Status,
		},
		"impersonation": gin.H{
			"session_id":      session.ID,
			"impersonator_id": actorID,
			"target_user_id":  target.ID,
			"target_name":     target.DisplayName,
			"target_username": target.Username,
			"target_role":     target.Role,
			"reason":          session.Reason,
			"expires_at":      session.ExpiresAt,
		},
	}, "Impersonation session started")
}

// StopImpersonation revokes the server-side session immediately.
func (ac *AuthController) StopImpersonation(c *gin.Context) {
	sessionID, err := uuid.Parse(c.GetString("impersonation_session_id"))
	actorID, actorErr := uuid.Parse(c.GetString("impersonator_id"))
	targetIDValue, ok := c.Get("userID")
	targetID, validTargetID := targetIDValue.(uuid.UUID)
	if err != nil || actorErr != nil || !ok || !validTargetID {
		sendBadRequest(c, "No active impersonation session", nil)
		return
	}

	db := model.GetDB(c)
	if err := db.Transaction(func(tx *gorm.DB) error {
		now := time.Now().UTC()
		result := tx.Model(&model.ImpersonationSession{}).
			Where("id = ? AND impersonator_id = ? AND target_user_id = ? AND revoked_at IS NULL", sessionID, actorID, targetID).
			Update("revoked_at", &now)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		return writeImpersonationAudit(tx, c, actorID, targetID, sessionID, "IMPERSONATE_STOP", "Session ended by administrator")
	}); err != nil {
		if err == gorm.ErrRecordNotFound {
			sendBadRequest(c, "Impersonation session is already inactive", nil)
			return
		}
		sendInternalError(c, err)
		return
	}

	sendSuccessNoData(c)
}
