package controller

import (
	"context"
	"errors"
	"fmt"
	"gin-template/common"
	"gin-template/model"
	"gin-template/services"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
	"unicode"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	adminAIImageDailyLimit = 20
	maxAIImagePromptRunes  = 650
)

var errAIImageQuotaExceeded = errors.New("daily AI image quota exceeded")
var activeAIImageJobs sync.Map

type generateCourseCoverPayload struct {
	Title                string `json:"title"`
	ShortDescription     string `json:"short_description"`
	CourseCategoryID     string `json:"course_category_id"`
	Level                string `json:"level"`
	AgeRange             string `json:"age_range"`
	Style                string `json:"style"`
	IncludeText          bool   `json:"include_text"`
	ReplacesGenerationID string `json:"replaces_generation_id"`
}

type aiImageQuotaView struct {
	Used      int    `json:"used"`
	Limit     int    `json:"limit"`
	Remaining int    `json:"remaining"`
	ResetsAt  string `json:"resets_at"`
}

type aiImageGenerationView struct {
	ID               uuid.UUID                     `json:"id"`
	ImageURL         string                        `json:"image_url"`
	Status           model.AIImageGenerationStatus `json:"status"`
	Prompt           string                        `json:"prompt"`
	Style            string                        `json:"style"`
	IncludeText      bool                          `json:"include_text"`
	ErrorCode        string                        `json:"error_code,omitempty"`
	Quota            aiImageQuotaView              `json:"quota"`
	StyleSuggestions []string                      `json:"style_suggestions"`
}

func (ctrl *LMSController) GetCourseCoverAIQuota(c *gin.Context) {
	userID, role, ok := currentLMSUser(c)
	if !ok {
		return
	}
	if role < common.RoleAdminUser {
		sendError(c, http.StatusForbidden, "Hanya admin yang dapat generate gambar AI", nil)
		return
	}
	tenant, ok := currentAIImageTenant(c)
	if !ok {
		return
	}

	quota, err := currentAIImageQuota(lmsDB(c, ctrl.DB), tenant.ID, userID)
	if err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccess(c, quota, "AI image quota retrieved successfully")
}

func (ctrl *LMSController) GenerateCourseCoverAI(c *gin.Context) {
	userID, role, ok := currentLMSUser(c)
	if !ok {
		return
	}
	if role < common.RoleAdminUser {
		sendError(c, http.StatusForbidden, "Hanya admin yang dapat generate gambar AI", nil)
		return
	}
	tenant, ok := currentAIImageTenant(c)
	if !ok {
		return
	}

	var payload generateCourseCoverPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		sendBadRequest(c, "Data generate gambar tidak valid", nil)
		return
	}
	payload = normalizeCourseCoverPayload(payload)
	fieldErrors := validateCourseCoverPayload(payload)
	if len(fieldErrors) > 0 {
		sendError(c, http.StatusUnprocessableEntity, "Lengkapi konteks course sebelum generate gambar", gin.H{
			"field_errors": fieldErrors,
		})
		return
	}

	db := lmsDB(c, ctrl.DB)
	categoryID, _ := uuid.Parse(payload.CourseCategoryID)
	var category model.CourseCategory
	if err := db.Select("id", "name").First(&category, "id = ?", categoryID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			sendError(c, http.StatusUnprocessableEntity, "Kategori course tidak ditemukan", gin.H{
				"field_errors": gin.H{"course_category_id": "Kategori course tidak valid"},
			})
			return
		}
		sendInternalError(c, err)
		return
	}

	var replacesID *uuid.UUID
	if payload.ReplacesGenerationID != "" {
		parsedID, parseErr := uuid.Parse(payload.ReplacesGenerationID)
		if parseErr != nil {
			sendBadRequest(c, "Generation sebelumnya tidak valid", nil)
			return
		}
		var previous model.AIImageGeneration
		if err := db.Where("id = ? AND user_id = ?", parsedID, userID).First(&previous).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				sendError(c, http.StatusNotFound, "Generation sebelumnya tidak ditemukan", nil)
				return
			}
			sendInternalError(c, err)
			return
		}
		if previous.Status == model.AIImageGenerationApproved {
			sendError(c, http.StatusConflict, "Gambar yang sudah disetujui tidak dapat digantikan", nil)
			return
		}
		replacesID = &parsedID
	}

	prompt := buildCourseCoverPrompt(payload, category.Name)
	validateProvider := ctrl.ValidateCourseCoverProvider
	if validateProvider == nil {
		validateProvider = services.ValidateOpenAIImageConfig
	}
	if err := validateProvider(); err != nil {
		sendError(c, http.StatusServiceUnavailable, "Fitur gambar AI belum dikonfigurasi", gin.H{
			"code": "openai_not_configured",
		})
		return
	}
	validateStorage := ctrl.ValidateCourseCoverStorage
	if validateStorage == nil {
		validateStorage = services.ValidateImageUploadConfig
	}
	if err := validateStorage(); err != nil {
		sendError(c, http.StatusServiceUnavailable, "Storage cover belum dikonfigurasi", gin.H{
			"code": "ai_image_storage_not_configured",
		})
		return
	}

	generation, quota, err := reserveAIImageGeneration(db, tenant.ID, userID, prompt, payload.Style, payload.IncludeText, replacesID)
	if err != nil {
		if errors.Is(err, errAIImageQuotaExceeded) {
			currentQuota, quotaErr := currentAIImageQuota(db, tenant.ID, userID)
			if quotaErr != nil {
				sendInternalError(c, quotaErr)
				return
			}
			sendError(c, http.StatusTooManyRequests, "Quota generate gambar AI hari ini sudah habis", gin.H{
				"code":  "ai_image_quota_exceeded",
				"quota": currentQuota,
			})
			return
		}
		sendInternalError(c, err)
		return
	}

	backgroundDB := backgroundAIImageDB(ctrl.DB, tenant)
	go ctrl.processCourseCoverGeneration(backgroundDB, generation)

	c.JSON(http.StatusAccepted, gin.H{
		"success": true,
		"message": "Course cover generation started",
		"data": aiImageGenerationView{
			ID:               generation.ID,
			Status:           model.AIImageGenerationReserved,
			Prompt:           prompt,
			Style:            payload.Style,
			IncludeText:      payload.IncludeText,
			Quota:            quota,
			StyleSuggestions: courseCoverStyleSuggestions(category.Name, payload.Level, payload.AgeRange),
		},
	})
}

func (ctrl *LMSController) GetCourseCoverAIGeneration(c *gin.Context) {
	userID, role, ok := currentLMSUser(c)
	if !ok {
		return
	}
	if role < common.RoleAdminUser {
		sendError(c, http.StatusForbidden, "Hanya admin yang dapat melihat gambar AI", nil)
		return
	}
	tenant, ok := currentAIImageTenant(c)
	if !ok {
		return
	}
	generationID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}

	db := lmsDB(c, ctrl.DB)
	var generation model.AIImageGeneration
	if err := db.Where("id = ? AND user_id = ?", generationID, userID).First(&generation).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			sendError(c, http.StatusNotFound, "Generation gambar AI tidak ditemukan", nil)
			return
		}
		sendInternalError(c, err)
		return
	}

	if generation.Status == model.AIImageGenerationReserved &&
		(generation.LeaseExpiresAt == nil || generation.LeaseExpiresAt.Before(time.Now())) {
		backgroundDB := backgroundAIImageDB(ctrl.DB, tenant)
		go ctrl.processCourseCoverGeneration(backgroundDB, generation)
	}
	quota, err := currentAIImageQuota(db, tenant.ID, userID)
	if err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccess(c, aiImageGenerationView{
		ID:          generation.ID,
		ImageURL:    generation.ImageURL,
		Status:      generation.Status,
		Prompt:      generation.Prompt,
		Style:       generation.Style,
		IncludeText: generation.IncludeText,
		ErrorCode:   generation.ErrorCode,
		Quota:       quota,
	}, "AI image generation retrieved successfully")
}

func backgroundAIImageDB(db *gorm.DB, tenant model.Tenant) *gorm.DB {
	ctx := context.WithValue(context.Background(), common.CtxTenantKey, tenant)
	return db.Session(&gorm.Session{}).
		Set("tenant_id", tenant.ID.String()).
		WithContext(ctx)
}

func (ctrl *LMSController) processCourseCoverGeneration(db *gorm.DB, generation model.AIImageGeneration) {
	jobKey := generation.ID.String()
	if _, alreadyRunning := activeAIImageJobs.LoadOrStore(jobKey, struct{}{}); alreadyRunning {
		return
	}
	defer activeAIImageJobs.Delete(jobKey)

	now := time.Now()
	leaseExpiresAt := now.Add(4 * time.Minute)
	claim := db.Model(&model.AIImageGeneration{}).
		Where(
			"id = ? AND status = ? AND (lease_expires_at IS NULL OR lease_expires_at < ?)",
			generation.ID,
			model.AIImageGenerationReserved,
			now,
		).
		Updates(map[string]interface{}{
			"processing_started_at": now,
			"lease_expires_at":      leaseExpiresAt,
			"attempt_count":         gorm.Expr("attempt_count + 1"),
		})
	if claim.Error != nil || claim.RowsAffected != 1 {
		return
	}

	if err := db.First(&generation, "id = ?", generation.ID).Error; err != nil {
		return
	}
	releaseWithCode := func(code string) {
		if generation.TenantID == nil {
			common.SysLog(fmt.Sprintf("cannot release AI image quota for generation %s: tenant_id is missing", generation.ID))
			return
		}
		quota, err := currentAIImageQuota(db, *generation.TenantID, generation.UserID)
		if err != nil {
			common.SysLog(fmt.Sprintf("failed to read AI image quota for generation %s: %v", generation.ID, err))
			return
		}
		releaseAIImageReservation(db, generation, code, quota)
	}
	defer func() {
		if recovered := recover(); recovered != nil {
			common.SysLog(fmt.Sprintf("panic processing AI image generation %s: %v", generation.ID, recovered))
			releaseWithCode("processing_panic")
		}
	}()

	generate := ctrl.GenerateCourseCoverImage
	if generate == nil {
		generate = services.GenerateOpenAIImage
	}
	processContext, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()
	imageBytes, providerRequestID, generateErr := generate(processContext, generation.Prompt)
	if generateErr != nil {
		releaseWithCode(providerErrorCode(generateErr))
		return
	}

	upload := ctrl.UploadCourseCoverImage
	if upload == nil {
		upload = services.ProcessAndUploadImageBytes
	}
	objectKey, uploadErr := upload(imageBytes)
	if uploadErr != nil {
		if err := db.Model(&model.AIImageGeneration{}).
			Where("id = ? AND user_id = ? AND status = ?", generation.ID, generation.UserID, model.AIImageGenerationReserved).
			Updates(map[string]interface{}{
				"status":              model.AIImageGenerationStorageFailed,
				"error_code":          "storage_failed",
				"provider_request_id": compactText(providerRequestID, 120),
				"lease_expires_at":    nil,
			}).Error; err != nil {
			common.SysLog(fmt.Sprintf("failed to mark AI image storage failure %s: %v", generation.ID, err))
		}
		return
	}

	imageURL := publicCOSURL(objectKey)
	if err := db.Transaction(func(tx *gorm.DB) error {
		result := tx.Model(&model.AIImageGeneration{}).
			Where("id = ? AND user_id = ? AND status = ?", generation.ID, generation.UserID, model.AIImageGenerationReserved).
			Updates(map[string]interface{}{
				"status":              model.AIImageGenerationGenerated,
				"object_key":          objectKey,
				"image_url":           imageURL,
				"provider_request_id": compactText(providerRequestID, 120),
				"error_code":          "",
				"lease_expires_at":    nil,
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return fmt.Errorf("AI image generation %s is no longer reserved", generation.ID)
		}
		if generation.ReplacesGenerationID != nil {
			if err := tx.Model(&model.AIImageGeneration{}).
				Where("id = ? AND user_id = ? AND status = ?", *generation.ReplacesGenerationID, generation.UserID, model.AIImageGenerationGenerated).
				Update("status", model.AIImageGenerationRejected).Error; err != nil {
				return err
			}
		}
		return nil
	}); err != nil {
		common.SysLog(fmt.Sprintf("failed to finalize AI image generation %s: %v", generation.ID, err))
	}
}

func (ctrl *LMSController) ApproveCourseCoverAI(c *gin.Context) {
	ctrl.updateCourseCoverAIStatus(c, model.AIImageGenerationApproved)
}

func (ctrl *LMSController) RejectCourseCoverAI(c *gin.Context) {
	ctrl.updateCourseCoverAIStatus(c, model.AIImageGenerationRejected)
}

func (ctrl *LMSController) updateCourseCoverAIStatus(c *gin.Context, target model.AIImageGenerationStatus) {
	userID, role, ok := currentLMSUser(c)
	if !ok {
		return
	}
	if role < common.RoleAdminUser {
		sendError(c, http.StatusForbidden, "Hanya admin yang dapat mengelola gambar AI", nil)
		return
	}
	tenant, ok := currentAIImageTenant(c)
	if !ok {
		return
	}
	generationID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}

	db := lmsDB(c, ctrl.DB)
	var generation model.AIImageGeneration
	if err := db.Where("id = ? AND user_id = ?", generationID, userID).First(&generation).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			sendError(c, http.StatusNotFound, "Gambar AI tidak ditemukan", nil)
			return
		}
		sendInternalError(c, err)
		return
	}

	if generation.Status == target {
		quota, err := currentAIImageQuota(db, tenant.ID, userID)
		if err != nil {
			sendInternalError(c, err)
			return
		}
		sendSuccess(c, aiImageGenerationView{
			ID:          generation.ID,
			ImageURL:    generation.ImageURL,
			Status:      generation.Status,
			Prompt:      generation.Prompt,
			Style:       generation.Style,
			IncludeText: generation.IncludeText,
			Quota:       quota,
		}, "AI image status unchanged")
		return
	}
	if generation.Status != model.AIImageGenerationGenerated {
		sendError(c, http.StatusConflict, "Status gambar AI sudah tidak dapat diubah", gin.H{
			"status": generation.Status,
		})
		return
	}

	result := db.Model(&model.AIImageGeneration{}).
		Where("id = ? AND user_id = ? AND status = ?", generation.ID, userID, model.AIImageGenerationGenerated).
		Update("status", target)
	if result.Error != nil {
		sendInternalError(c, result.Error)
		return
	}
	if result.RowsAffected != 1 {
		sendError(c, http.StatusConflict, "Status gambar AI berubah. Muat ulang dan coba lagi.", nil)
		return
	}
	generation.Status = target

	quota, err := currentAIImageQuota(db, tenant.ID, userID)
	if err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccess(c, aiImageGenerationView{
		ID:          generation.ID,
		ImageURL:    generation.ImageURL,
		Status:      generation.Status,
		Prompt:      generation.Prompt,
		Style:       generation.Style,
		IncludeText: generation.IncludeText,
		Quota:       quota,
	}, "AI image status updated successfully")
}

func currentAIImageTenant(c *gin.Context) (model.Tenant, bool) {
	value, exists := c.Get(common.CtxTenantKey)
	tenant, ok := value.(model.Tenant)
	if !exists || !ok || tenant.ID == uuid.Nil {
		sendInternalError(c, fmt.Errorf("tenant context is required"))
		return model.Tenant{}, false
	}
	return tenant, true
}

func normalizeCourseCoverPayload(payload generateCourseCoverPayload) generateCourseCoverPayload {
	payload.Title = compactText(payload.Title, 120)
	payload.ShortDescription = compactText(payload.ShortDescription, 180)
	payload.CourseCategoryID = strings.TrimSpace(payload.CourseCategoryID)
	payload.Level = compactText(payload.Level, 50)
	payload.AgeRange = compactText(payload.AgeRange, 30)
	payload.Style = compactText(payload.Style, 80)
	payload.ReplacesGenerationID = strings.TrimSpace(payload.ReplacesGenerationID)
	return payload
}

func validateCourseCoverPayload(payload generateCourseCoverPayload) map[string]string {
	fieldErrors := map[string]string{}
	if payload.Title == "" {
		fieldErrors["title"] = "Judul course wajib diisi"
	}
	if payload.ShortDescription == "" {
		fieldErrors["short_description"] = "Deskripsi singkat wajib diisi untuk generate AI"
	}
	if _, err := uuid.Parse(payload.CourseCategoryID); err != nil {
		fieldErrors["course_category_id"] = "Kategori course wajib dipilih"
	}
	if payload.Level == "" {
		fieldErrors["level"] = "Level course wajib dipilih untuk generate AI"
	}
	if payload.AgeRange == "" {
		fieldErrors["age_range"] = "Rentang usia wajib diisi untuk generate AI"
	}
	return fieldErrors
}

func buildCourseCoverPrompt(payload generateCourseCoverPayload, categoryName string) string {
	style := payload.Style
	if style == "" {
		style = "modern educational illustration, bright natural colors"
	}
	textInstruction := "No text or logos."
	if payload.IncludeText {
		textInstruction = fmt.Sprintf(`Show the exact readable title "%s". No other text or logos.`, payload.Title)
	}
	prompt := fmt.Sprintf(
		`Landscape course cover. %s Topic: %s. Summary: %s. Category: %s. Level: %s; ages %s. Style: %s. Friendly, clear focal subject.`,
		textInstruction,
		payload.Title,
		payload.ShortDescription,
		compactText(categoryName, 80),
		payload.Level,
		payload.AgeRange,
		style,
	)
	return compactText(prompt, maxAIImagePromptRunes)
}

func compactText(value string, maxRunes int) string {
	value = strings.Map(func(r rune) rune {
		if unicode.IsControl(r) {
			return ' '
		}
		return r
	}, value)
	value = strings.Join(strings.Fields(value), " ")
	runes := []rune(strings.TrimSpace(value))
	if len(runes) > maxRunes {
		runes = runes[:maxRunes]
	}
	return strings.TrimSpace(string(runes))
}

func courseCoverStyleSuggestions(category, level, ageRange string) []string {
	contextHint := compactText(strings.Join([]string{category, level, ageRange}, " "), 35)
	return []string{
		"Ilustrasi buku anak, bentuk lembut, warna cerah",
		"3D clay ramah anak, pencahayaan studio lembut",
		"Kolase kertas edukatif, tekstur buatan tangan",
		"Editorial minimal modern, fokus objek utama " + contextHint,
	}
}

func quotaLocation() *time.Location {
	name := strings.TrimSpace(os.Getenv("AI_IMAGE_QUOTA_TIMEZONE"))
	if name == "" {
		name = "Asia/Jakarta"
	}
	location, err := time.LoadLocation(name)
	if err != nil {
		return time.FixedZone("WIB", 7*60*60)
	}
	return location
}

func quotaDateAndReset(now time.Time) (string, time.Time) {
	location := quotaLocation()
	localNow := now.In(location)
	date := localNow.Format("2006-01-02")
	reset := time.Date(localNow.Year(), localNow.Month(), localNow.Day()+1, 0, 0, 0, 0, location)
	return date, reset
}

func quotaView(used int, reset time.Time) aiImageQuotaView {
	if used < 0 {
		used = 0
	}
	if used > adminAIImageDailyLimit {
		used = adminAIImageDailyLimit
	}
	return aiImageQuotaView{
		Used:      used,
		Limit:     adminAIImageDailyLimit,
		Remaining: adminAIImageDailyLimit - used,
		ResetsAt:  reset.Format(time.RFC3339),
	}
}

func currentAIImageQuota(db *gorm.DB, tenantID, userID uuid.UUID) (aiImageQuotaView, error) {
	date, reset := quotaDateAndReset(time.Now())
	var quota model.AIImageDailyQuota
	err := db.Where("tenant_id = ? AND user_id = ? AND quota_date = ?", tenantID, userID, date).First(&quota).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return quotaView(0, reset), nil
	}
	if err != nil {
		return aiImageQuotaView{}, err
	}
	return quotaView(quota.Used, reset), nil
}

func reserveAIImageGeneration(db *gorm.DB, tenantID, userID uuid.UUID, prompt, style string, includeText bool, replacesID *uuid.UUID) (model.AIImageGeneration, aiImageQuotaView, error) {
	date, reset := quotaDateAndReset(time.Now())
	var generation model.AIImageGeneration
	var used int

	err := db.Transaction(func(tx *gorm.DB) error {
		candidate := model.AIImageDailyQuota{
			UserID:    userID,
			QuotaDate: date,
			TenantID:  &tenantID,
		}
		if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&candidate).Error; err != nil {
			return err
		}

		var quota model.AIImageDailyQuota
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("tenant_id = ? AND user_id = ? AND quota_date = ?", tenantID, userID, date).
			First(&quota).Error; err != nil {
			return err
		}
		if quota.Used >= adminAIImageDailyLimit {
			return errAIImageQuotaExceeded
		}
		if err := tx.Model(&model.AIImageDailyQuota{}).
			Where("id = ?", quota.ID).
			UpdateColumn("used", gorm.Expr("used + 1")).Error; err != nil {
			return err
		}
		used = quota.Used + 1

		generation = model.AIImageGeneration{
			UserID:               userID,
			Prompt:               prompt,
			Style:                style,
			IncludeText:          includeText,
			QuotaDate:            date,
			Status:               model.AIImageGenerationReserved,
			ReplacesGenerationID: replacesID,
			TenantID:             &tenantID,
		}
		return tx.Create(&generation).Error
	})
	if err != nil {
		return model.AIImageGeneration{}, aiImageQuotaView{}, err
	}
	return generation, quotaView(used, reset), nil
}

func releaseAIImageReservation(db *gorm.DB, generation model.AIImageGeneration, errorCode string, current aiImageQuotaView) aiImageQuotaView {
	used := current.Used
	var err error
	for attempt := 1; attempt <= 4; attempt++ {
		decremented := false
		err = db.Transaction(func(tx *gorm.DB) error {
			result := tx.Model(&model.AIImageGeneration{}).
				Where("id = ? AND user_id = ? AND status = ?", generation.ID, generation.UserID, model.AIImageGenerationReserved).
				Updates(map[string]interface{}{
					"status":           model.AIImageGenerationProviderFailed,
					"error_code":       compactText(errorCode, 80),
					"lease_expires_at": nil,
				})
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected == 0 {
				return nil
			}

			quotaResult := tx.Model(&model.AIImageDailyQuota{}).
				Where("user_id = ? AND quota_date = ? AND used > 0", generation.UserID, generation.QuotaDate).
				UpdateColumn("used", gorm.Expr("used - 1"))
			if quotaResult.Error != nil {
				return quotaResult.Error
			}
			decremented = quotaResult.RowsAffected > 0
			return nil
		})
		if err == nil {
			if decremented && used > 0 {
				used--
			}
			break
		}
		if !isRetryableDBContention(err) {
			break
		}
		time.Sleep(time.Duration(attempt*25) * time.Millisecond)
	}
	if err != nil {
		common.SysLog(fmt.Sprintf("failed to release AI image quota for generation %s: %v", generation.ID, err))
	}
	return quotaView(used, parseQuotaReset(current.ResetsAt))
}

func isRetryableDBContention(err error) bool {
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "database is locked") ||
		strings.Contains(message, "database table is locked") ||
		strings.Contains(message, "deadlock") ||
		strings.Contains(message, "lock wait timeout")
}

func parseQuotaReset(value string) time.Time {
	reset, err := time.Parse(time.RFC3339, value)
	if err == nil {
		return reset
	}
	_, fallback := quotaDateAndReset(time.Now())
	return fallback
}

func providerErrorCode(err error) string {
	if imageErr, ok := services.IsOpenAIImageError(err); ok {
		return imageErr.Code
	}
	return "openai_request_failed"
}

func sendCourseCoverProviderError(c *gin.Context, err error, quota aiImageQuotaView) {
	status := http.StatusBadGateway
	message := "OpenAI gagal membuat gambar. Coba lagi."
	code := providerErrorCode(err)

	if imageErr, ok := services.IsOpenAIImageError(err); ok {
		switch {
		case imageErr.Code == "openai_not_configured":
			status = http.StatusServiceUnavailable
			message = "Fitur gambar AI belum dikonfigurasi"
		case imageErr.Code == "moderation_blocked" || imageErr.StatusCode == http.StatusUnprocessableEntity:
			status = http.StatusUnprocessableEntity
			message = "Konteks atau style ditolak oleh pemeriksaan keamanan. Ubah isinya lalu coba lagi."
		case imageErr.StatusCode == http.StatusTooManyRequests:
			status = http.StatusServiceUnavailable
			message = "Layanan OpenAI sedang sibuk. Coba beberapa saat lagi."
		case imageErr.StatusCode == http.StatusGatewayTimeout:
			status = http.StatusGatewayTimeout
			message = "Generate gambar melewati batas waktu. Coba lagi."
		case imageErr.StatusCode == http.StatusBadRequest:
			status = http.StatusUnprocessableEntity
			message = "OpenAI tidak dapat memproses konteks gambar ini. Periksa data course dan style."
		}
	}
	sendError(c, status, message, gin.H{
		"code":  code,
		"quota": quota,
	})
}
