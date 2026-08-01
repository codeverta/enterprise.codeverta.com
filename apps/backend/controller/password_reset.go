package controller

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"gin-template/common"
	"gin-template/model"
	"gin-template/services"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const passwordResetTTL = 30 * time.Minute

type forgotPasswordInput struct {
	Email         string `json:"email" validate:"required,email,max=50"`
	CaptchaID     string `json:"captcha_id" validate:"required"`
	CaptchaAnswer string `json:"captcha_answer" validate:"required"`
}

type resetPasswordInput struct {
	Token           string `json:"token" validate:"required"`
	Password        string `json:"password" validate:"required,min=8,max=20"`
	ConfirmPassword string `json:"confirm_password" validate:"required,min=8,max=20"`
}

func (ac *AuthController) PasswordResetCaptcha(c *gin.Context) {
	challenge, err := services.GenerateCaptcha()
	if err != nil {
		sendInternalError(c, err)
		return
	}
	c.Header("Cache-Control", "no-store, max-age=0")
	c.JSON(http.StatusOK, challenge)
}

func (ac *AuthController) ForgotPassword(c *gin.Context) {
	var input forgotPasswordInput
	if err := c.ShouldBindJSON(&input); err != nil || common.Validate.Struct(input) != nil {
		sendBadRequest(c, "Data permintaan tidak valid", nil)
		return
	}
	if !services.VerifyCaptcha(input.CaptchaID, input.CaptchaAnswer) {
		sendBadRequest(c, "CAPTCHA salah atau sudah kedaluwarsa. Silakan muat ulang CAPTCHA.", nil)
		return
	}
	email := strings.ToLower(strings.TrimSpace(input.Email))
	userQueryDB := ac.DB.WithContext(c).Session(&gorm.Session{NewDB: true}).Set("skip_tenant_scope", true)
	var user model.User
	if err := userQueryDB.Where("LOWER(email) = ?", email).First(&user).Error; err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			zap.L().Error("password reset user lookup failed", zap.Error(err))
		}
		passwordResetNeutralResponse(c)
		return
	}

	rawToken, tokenHash, err := newPasswordResetToken()
	if err != nil {
		sendInternalError(c, err)
		return
	}
	now := time.Now()
	resetToken := model.PasswordResetToken{
		UserID: user.ID, TenantID: user.TenantID, TokenHash: tokenHash,
		ExpiresAt: now.Add(passwordResetTTL), RequestedIP: c.ClientIP(),
	}
	txDB := ac.DB.WithContext(c).Session(&gorm.Session{NewDB: true}).Set("skip_tenant_scope", true)
	if err := txDB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&model.PasswordResetToken{}).
			Where("user_id = ? AND used_at IS NULL", user.ID).Update("used_at", now).Error; err != nil {
			return err
		}
		return tx.Create(&resetToken).Error
	}); err != nil {
		zap.L().Error("create password reset token failed", zap.Error(err), zap.String("user_id", user.ID.String()))
		passwordResetNeutralResponse(c)
		return
	}

	resetLink := passwordResetPageURL() + "?token=" + url.QueryEscape(rawToken)
	if err := queuePasswordResetEmail(txDB, user, resetLink); err != nil {
		zap.L().Error("queue password reset email failed", zap.Error(err), zap.String("user_id", user.ID.String()))
		_ = txDB.Model(&resetToken).Update("used_at", time.Now()).Error
	}
	passwordResetNeutralResponse(c)
}

func (ac *AuthController) ResetPassword(c *gin.Context) {
	var input resetPasswordInput
	if err := c.ShouldBindJSON(&input); err != nil || common.Validate.Struct(input) != nil {
		sendBadRequest(c, "Data password tidak valid", nil)
		return
	}
	if input.Password != input.ConfirmPassword {
		sendBadRequest(c, "Konfirmasi password tidak sama", nil)
		return
	}
	hashedPassword, err := common.Password2Hash(input.Password)
	if err != nil {
		sendInternalError(c, err)
		return
	}
	tokenVersion, _, err := newPasswordResetToken()
	if err != nil {
		sendInternalError(c, err)
		return
	}
	tokenHash := hashResetToken(strings.TrimSpace(input.Token))
	db := ac.DB.WithContext(c).Session(&gorm.Session{NewDB: true}).Set("skip_tenant_scope", true)
	err = db.Transaction(func(tx *gorm.DB) error {
		var resetToken model.PasswordResetToken
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("token_hash = ? AND used_at IS NULL", tokenHash).First(&resetToken).Error; err != nil {
			return err
		}
		if time.Now().After(resetToken.ExpiresAt) {
			return errPasswordResetExpired
		}
		if err := tx.Model(&model.User{}).Where("id = ?", resetToken.UserID).Updates(map[string]interface{}{
			"password": hashedPassword, "token": tokenVersion,
		}).Error; err != nil {
			return err
		}
		now := time.Now()
		return tx.Model(&resetToken).Update("used_at", now).Error
	})
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) || errors.Is(err, errPasswordResetExpired) {
			sendBadRequest(c, "Link reset password tidak valid atau sudah kedaluwarsa", nil)
			return
		}
		sendInternalError(c, err)
		return
	}
	sendSuccess(c, nil, "Password berhasil diubah. Silakan login menggunakan password baru.")
}

var errPasswordResetExpired = errors.New("password reset token expired")

func newPasswordResetToken() (string, string, error) {
	buffer := make([]byte, 32)
	if _, err := rand.Read(buffer); err != nil {
		return "", "", err
	}
	raw := base64.RawURLEncoding.EncodeToString(buffer)
	return raw, hashResetToken(raw), nil
}

func hashResetToken(raw string) string {
	hash := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(hash[:])
}

func passwordResetPageURL() string {
	if configured := strings.TrimSpace(os.Getenv("PASSWORD_RESET_URL")); configured != "" {
		return strings.TrimRight(configured, "/")
	}
	return strings.TrimRight(common.ServerAddress, "/") + "/reset-password"
}

func queuePasswordResetEmail(db *gorm.DB, user model.User, resetLink string) error {
	var template model.EmailTemplate
	if user.TenantID != nil {
		err := db.Where("type = ? AND tenant_id = ?", model.TypePasswordReset, *user.TenantID).First(&template).Error
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
	}
	if template.ID == uuid.Nil {
		if err := db.Where("type = ?", model.TypePasswordReset).First(&template).Error; err != nil {
			return err
		}
	}
	name := strings.TrimSpace(user.DisplayName)
	if name == "" {
		name = user.Email
	}
	return common.QueuePasswordResetEmail(template.FromAddress, user.Email, template.Subject, common.PasswordResetEmailData{
		Name: name, ResetLink: resetLink,
	}, template.TencentTemplateID)
}

func passwordResetNeutralResponse(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Jika email terdaftar, link ubah password akan dikirim."})
}
