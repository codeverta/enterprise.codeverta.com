package controller

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"gin-template/common"
	"gin-template/model"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const authHandoffLifetime = 2 * time.Minute

type exchangeAuthHandoffRequest struct {
	Token string `json:"token" binding:"required"`
}

func authHandoffHash(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func createAuthHandoff(db *gorm.DB, userID uuid.UUID, tenantID *uuid.UUID) (string, time.Time, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", time.Time{}, err
	}
	token := base64.RawURLEncoding.EncodeToString(raw)
	expiresAt := time.Now().UTC().Add(authHandoffLifetime)
	handoff := model.AuthHandoff{
		UserID:    userID,
		TokenHash: authHandoffHash(token),
		ExpiresAt: expiresAt,
		TenantID:  tenantID,
	}
	if err := db.Create(&handoff).Error; err != nil {
		return "", time.Time{}, err
	}
	return token, expiresAt, nil
}

func cleanAuthUser(user model.User) model.User {
	email := user.Email
	if strings.HasSuffix(strings.ToLower(email), "@trial.kitafuture.local") {
		email = ""
	}
	return model.User{
		ID:          user.ID,
		Email:       email,
		DisplayName: user.DisplayName,
		Role:        user.Role,
		Status:      user.Status,
	}
}

// ExchangeAuthHandoff turns a one-time handoff code into the normal JWT pair.
// The code is locked and consumed transactionally, so refreshes/replays fail.
func (ac *AuthController) ExchangeAuthHandoff(c *gin.Context) {
	var req exchangeAuthHandoffRequest
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Token) == "" {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}

	db := model.GetDB(c)
	if db == nil {
		db = ac.DB
	}

	var user model.User
	err := db.Transaction(func(tx *gorm.DB) error {
		var handoff model.AuthHandoff
		if err := tx.Set("skip_tenant_scope", true).
			Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("token_hash = ? AND used_at IS NULL AND expires_at > ?", authHandoffHash(req.Token), time.Now().UTC()).
			First(&handoff).Error; err != nil {
			return err
		}

		if err := tx.Set("skip_tenant_scope", true).
			Where("id = ? AND status = ?", handoff.UserID, common.UserStatusEnabled).
			First(&user).Error; err != nil {
			return err
		}

		usedAt := time.Now().UTC()
		result := tx.Set("skip_tenant_scope", true).
			Model(&model.AuthHandoff{}).
			Where("id = ? AND used_at IS NULL", handoff.ID).
			Update("used_at", usedAt)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return gorm.ErrRecordNotFound
		}
		return nil
	})
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			sendUnauthorized(c, "Sesi login tidak valid, sudah digunakan, atau kedaluwarsa")
			return
		}
		sendInternalError(c, err)
		return
	}

	accessToken, refreshToken, err := generateTokens(&user)
	if err != nil {
		sendInternalError(c, err)
		return
	}

	sendSuccess(c, gin.H{
		"user":          cleanAuthUser(user),
		"access_token":  accessToken,
		"refresh_token": refreshToken,
	}, "Login successful")
}
