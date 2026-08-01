package controller

import (
	"errors"
	"gin-template/model"
	"gin-template/services"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func (ctrl *LMSController) GetMyProfile(c *gin.Context) {
	userID, _, ok := currentLMSUser(c)
	if !ok {
		return
	}

	db := lmsDB(c, ctrl.DB)
	var user model.User
	if err := db.First(&user, "id = ?", userID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			sendError(c, http.StatusNotFound, "User not found", nil)
			return
		}
		sendInternalError(c, err)
		return
	}

	var profile model.Profile
	err := db.First(&profile, "user_id = ?", userID).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		sendInternalError(c, err)
		return
	}

	sendSuccess(c, gin.H{
		"id":           user.ID,
		"username":     user.Username,
		"display_name": firstNonEmpty(user.DisplayName, displayUserName(user)),
		"email":        user.Email,
		"avatar_url":   profile.AvatarURL,
		"bio":          profile.Bio,
		"headline":     profile.Headline,
		"phone_number": profile.PhoneNumber,
		"mentor_id":    profile.MentorID,
	}, "Profile retrieved successfully")
}

func (ctrl *LMSController) UpdateMyAvatar(c *gin.Context) {
	userID, _, ok := currentLMSUser(c)
	if !ok {
		return
	}

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		sendBadRequest(c, "file is required", nil)
		return
	}
	defer file.Close()

	key, err := services.ProcessAndUploadImage(file, header)
	if err != nil {
		sendBadRequest(c, err.Error(), nil)
		return
	}

	db := lmsDB(c, ctrl.DB)
	var user model.User
	if err := db.First(&user, "id = ?", userID).Error; err != nil {
		sendInternalError(c, err)
		return
	}

	avatarURL := publicCOSURL(key)
	var profile model.Profile
	err = db.First(&profile, "user_id = ?", userID).Error
	switch {
	case errors.Is(err, gorm.ErrRecordNotFound):
		profile = model.Profile{
			UserID:      userID,
			FullName:    displayUserName(user),
			DisplayName: user.DisplayName,
			PhoneNumber: user.PhoneNumber,
			AvatarURL:   avatarURL,
			TenantID:    user.TenantID,
		}
		if err := db.Create(&profile).Error; err != nil {
			sendInternalError(c, err)
			return
		}
	case err != nil:
		sendInternalError(c, err)
		return
	default:
		if err := db.Model(&profile).Update("avatar_url", avatarURL).Error; err != nil {
			sendInternalError(c, err)
			return
		}
	}

	sendSuccess(c, gin.H{"avatar_url": avatarURL}, "Profile photo updated successfully")
}

type updateProfileRequest struct {
	DisplayName string `json:"display_name" binding:"required"`
	Username    string `json:"username" binding:"required"`
	Bio         string `json:"bio"`
	Headline    string `json:"headline"`
	PhoneNumber string `json:"phone_number"`
}

func (ctrl *LMSController) UpdateMyProfile(c *gin.Context) {
	userID, _, ok := currentLMSUser(c)
	if !ok {
		return
	}

	var req updateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		sendBadRequest(c, err.Error(), nil)
		return
	}

	db := lmsDB(c, ctrl.DB)
	var user model.User
	if err := db.First(&user, "id = ?", userID).Error; err != nil {
		sendInternalError(c, err)
		return
	}

	// Clean username
	req.Username = strings.TrimSpace(strings.ToLower(req.Username))
	if req.Username == "" {
		sendBadRequest(c, "Username tidak boleh kosong", nil)
		return
	}

	// Cek keunikan username jika diganti
	if req.Username != user.Username {
		var count int64
		if err := db.Model(&model.User{}).Where("username = ? AND id != ?", req.Username, userID).Count(&count).Error; err != nil {
			sendInternalError(c, err)
			return
		}
		if count > 0 {
			sendBadRequest(c, "Username sudah digunakan", nil)
			return
		}
	}

	// Update User
	if err := db.Model(&user).Updates(map[string]interface{}{
		"display_name": req.DisplayName,
		"username":     req.Username,
	}).Error; err != nil {
		sendInternalError(c, err)
		return
	}

	// Update Profile
	var profile model.Profile
	err := db.First(&profile, "user_id = ?", userID).Error
	switch {
	case errors.Is(err, gorm.ErrRecordNotFound):
		profile = model.Profile{
			UserID:      userID,
			FullName:    req.DisplayName,
			DisplayName: req.DisplayName,
			PhoneNumber: req.PhoneNumber,
			Bio:         req.Bio,
			Headline:    req.Headline,
			TenantID:    user.TenantID,
		}
		if err := db.Create(&profile).Error; err != nil {
			sendInternalError(c, err)
			return
		}
	case err != nil:
		sendInternalError(c, err)
		return
	default:
		if err := db.Model(&profile).Updates(map[string]interface{}{
			"full_name":    req.DisplayName,
			"display_name": req.DisplayName,
			"phone_number": req.PhoneNumber,
			"bio":          req.Bio,
			"headline":     req.Headline,
		}).Error; err != nil {
			sendInternalError(c, err)
			return
		}
	}

	sendSuccess(c, gin.H{
		"username":     user.Username,
		"display_name": user.DisplayName,
		"bio":          profile.Bio,
		"headline":     profile.Headline,
		"phone_number": profile.PhoneNumber,
	}, "Profile updated successfully")
}
