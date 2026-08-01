package controller

import (
	"context"
	"encoding/json"
	"errors"
	"gin-template/common"
	"gin-template/model"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func setupAIImageControllerTest(t *testing.T) (*gorm.DB, model.Tenant, model.CourseCategory, uuid.UUID, *LMSController, *gin.Engine) {
	t.Helper()
	db, tenant := setupControllerTestDB(t)
	if err := db.AutoMigrate(
		&model.CourseCategory{},
		&model.AIImageGeneration{},
		&model.AIImageDailyQuota{},
	); err != nil {
		t.Fatalf("migrate AI image models: %v", err)
	}
	tenantDB := tenantScopedDB(db, tenant)
	category := model.CourseCategory{
		Name:     "Sains Anak",
		Slug:     "sains-anak",
		IsActive: true,
	}
	if err := tenantDB.Create(&category).Error; err != nil {
		t.Fatalf("create category: %v", err)
	}

	userID := uuid.New()
	ctrl := NewLMSController(tenantDB)
	ctrl.ValidateCourseCoverProvider = func() error { return nil }
	ctrl.ValidateCourseCoverStorage = func() error { return nil }
	router := testRouterWithTenant(tenantDB, tenant)
	router.Use(func(c *gin.Context) {
		c.Set("id", userID.String())
		c.Set("userID", userID)
		c.Set("role", common.RoleAdminUser)
		c.Request = c.Request.WithContext(context.WithValue(c.Request.Context(), common.CtxTenantKey, tenant))
		c.Next()
	})
	router.POST("/generate", ctrl.GenerateCourseCoverAI)
	router.GET("/:id", ctrl.GetCourseCoverAIGeneration)
	router.POST("/:id/approve", ctrl.ApproveCourseCoverAI)
	router.POST("/:id/reject", ctrl.RejectCourseCoverAI)
	router.GET("/quota", ctrl.GetCourseCoverAIQuota)
	return tenantDB, tenant, category, userID, ctrl, router
}

func validAIImagePayload(categoryID uuid.UUID) string {
	return `{
		"title":"Eksperimen Cahaya",
		"short_description":"Anak mengenal cahaya melalui eksperimen aman.",
		"course_category_id":"` + categoryID.String() + `",
		"level":"SD / Elementary",
		"age_range":"7-10 tahun",
		"style":"watercolor lembut"
	}`
}

func TestBuildCourseCoverPromptTextOption(t *testing.T) {
	payload := generateCourseCoverPayload{
		Title:            "Eksperimen Cahaya",
		ShortDescription: "Eksperimen aman untuk anak.",
		Level:            "SD",
		AgeRange:         "7-10 tahun",
	}

	withoutText := buildCourseCoverPrompt(payload, "Sains")
	if !strings.Contains(withoutText, "No text or logos.") {
		t.Fatalf("prompt without text instruction is missing: %q", withoutText)
	}

	payload.IncludeText = true
	withText := buildCourseCoverPrompt(payload, "Sains")
	if !strings.Contains(withText, `Show the exact readable title "Eksperimen Cahaya".`) {
		t.Fatalf("prompt with title instruction is missing: %q", withText)
	}
	if strings.Contains(withText, "Landscape course cover, no text") {
		t.Fatalf("prompt contains conflicting text instruction: %q", withText)
	}
}

func aiImageResponseData(t *testing.T, recorderBody []byte) map[string]interface{} {
	t.Helper()
	var response struct {
		Data map[string]interface{} `json:"data"`
	}
	if err := json.Unmarshal(recorderBody, &response); err != nil {
		t.Fatalf("decode response: %v; body=%s", err, string(recorderBody))
	}
	return response.Data
}

func waitForAIImageStatus(t *testing.T, router *gin.Engine, generationID string, expected model.AIImageGenerationStatus) map[string]interface{} {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		recorder := performJSON(router, http.MethodGet, "/"+generationID, "")
		if recorder.Code != http.StatusOK {
			t.Fatalf("status endpoint=%d body=%s", recorder.Code, recorder.Body.String())
		}
		data := aiImageResponseData(t, recorder.Body.Bytes())
		if data["status"] == string(expected) {
			return data
		}
		time.Sleep(75 * time.Millisecond)
	}
	t.Fatalf("generation %s did not reach status %s", generationID, expected)
	return nil
}

func TestGenerateCourseCoverAIApproveAndQuota(t *testing.T) {
	db, _, category, userID, ctrl, router := setupAIImageControllerTest(t)
	ctrl.GenerateCourseCoverImage = func(context.Context, string) ([]byte, string, error) {
		return []byte("generated-image"), "req_test_123", nil
	}
	ctrl.UploadCourseCoverImage = func(image []byte) (string, error) {
		if string(image) != "generated-image" {
			t.Fatalf("unexpected image bytes: %q", string(image))
		}
		return "lms/generated-cover.webp", nil
	}

	recorder := performJSON(router, http.MethodPost, "/generate", validAIImagePayload(category.ID))
	if recorder.Code != http.StatusAccepted {
		t.Fatalf("generate status=%d body=%s", recorder.Code, recorder.Body.String())
	}
	data := aiImageResponseData(t, recorder.Body.Bytes())
	if data["status"] != string(model.AIImageGenerationReserved) {
		t.Fatalf("expected reserved status, got %#v", data["status"])
	}
	prompt, _ := data["prompt"].(string)
	if len([]rune(prompt)) > maxAIImagePromptRunes {
		t.Fatalf("prompt too long: %d", len([]rune(prompt)))
	}
	generationID, err := uuid.Parse(data["id"].(string))
	if err != nil {
		t.Fatalf("parse generation id: %v", err)
	}
	data = waitForAIImageStatus(t, router, generationID.String(), model.AIImageGenerationGenerated)
	if data["image_url"] == "" {
		t.Fatal("expected generated image URL")
	}

	approve := performJSON(router, http.MethodPost, "/"+generationID.String()+"/approve", `{}`)
	if approve.Code != http.StatusOK {
		t.Fatalf("approve status=%d body=%s", approve.Code, approve.Body.String())
	}
	approvedData := aiImageResponseData(t, approve.Body.Bytes())
	if approvedData["status"] != string(model.AIImageGenerationApproved) {
		t.Fatalf("expected approved status, got %#v", approvedData["status"])
	}

	// Approval is idempotent and does not consume another quota.
	approveAgain := performJSON(router, http.MethodPost, "/"+generationID.String()+"/approve", `{}`)
	if approveAgain.Code != http.StatusOK {
		t.Fatalf("second approve status=%d body=%s", approveAgain.Code, approveAgain.Body.String())
	}
	quotaRecorder := performJSON(router, http.MethodGet, "/quota", "")
	quotaData := aiImageResponseData(t, quotaRecorder.Body.Bytes())
	if quotaData["used"] != float64(1) || quotaData["remaining"] != float64(19) {
		t.Fatalf("unexpected quota: %#v", quotaData)
	}

	var generation model.AIImageGeneration
	if err := db.First(&generation, "id = ? AND user_id = ?", generationID, userID).Error; err != nil {
		t.Fatalf("find generation: %v", err)
	}
	if generation.Status != model.AIImageGenerationApproved {
		t.Fatalf("database status=%s", generation.Status)
	}
}

func TestGenerateCourseCoverAIProviderFailureReleasesQuota(t *testing.T) {
	db, _, category, userID, ctrl, router := setupAIImageControllerTest(t)
	ctrl.GenerateCourseCoverImage = func(context.Context, string) ([]byte, string, error) {
		return nil, "", errors.New("provider unavailable")
	}

	recorder := performJSON(router, http.MethodPost, "/generate", validAIImagePayload(category.ID))
	if recorder.Code != http.StatusAccepted {
		t.Fatalf("generate status=%d body=%s", recorder.Code, recorder.Body.String())
	}
	data := aiImageResponseData(t, recorder.Body.Bytes())
	generationID := data["id"].(string)
	waitForAIImageStatus(t, router, generationID, model.AIImageGenerationProviderFailed)
	quotaRecorder := performJSON(router, http.MethodGet, "/quota", "")
	quotaData := aiImageResponseData(t, quotaRecorder.Body.Bytes())
	if quotaData["used"] != float64(0) || quotaData["remaining"] != float64(20) {
		t.Fatalf("provider failure consumed quota: %#v", quotaData)
	}

	var generation model.AIImageGeneration
	if err := db.First(&generation, "user_id = ?", userID).Error; err != nil {
		t.Fatalf("find failed generation: %v", err)
	}
	if generation.Status != model.AIImageGenerationProviderFailed {
		t.Fatalf("expected provider_failed, got %s", generation.Status)
	}
}

func TestGenerateCourseCoverAIRejectsIncompleteContextBeforeProvider(t *testing.T) {
	_, _, category, _, ctrl, router := setupAIImageControllerTest(t)
	called := false
	ctrl.GenerateCourseCoverImage = func(context.Context, string) ([]byte, string, error) {
		called = true
		return nil, "", nil
	}

	payload := `{"title":"Course","course_category_id":"` + category.ID.String() + `"}`
	recorder := performJSON(router, http.MethodPost, "/generate", payload)
	if recorder.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status=%d body=%s", recorder.Code, recorder.Body.String())
	}
	if called {
		t.Fatal("provider must not be called with incomplete context")
	}
}

func TestGenerateCourseCoverAIEnforcesDailyQuotaBeforeProvider(t *testing.T) {
	db, tenant, category, userID, ctrl, router := setupAIImageControllerTest(t)
	date, _ := quotaDateAndReset(time.Now())
	if err := db.Create(&model.AIImageDailyQuota{
		UserID:    userID,
		QuotaDate: date,
		Used:      adminAIImageDailyLimit,
		TenantID:  &tenant.ID,
	}).Error; err != nil {
		t.Fatalf("seed quota: %v", err)
	}
	called := false
	ctrl.GenerateCourseCoverImage = func(context.Context, string) ([]byte, string, error) {
		called = true
		return nil, "", nil
	}

	recorder := performJSON(router, http.MethodPost, "/generate", validAIImagePayload(category.ID))
	if recorder.Code != http.StatusTooManyRequests {
		t.Fatalf("status=%d body=%s", recorder.Code, recorder.Body.String())
	}
	if called {
		t.Fatal("provider must not be called after quota is exhausted")
	}
}

func TestGenerateCourseCoverAIRejectsMentorRole(t *testing.T) {
	_, _, category, _, ctrl, router := setupAIImageControllerTest(t)
	called := false
	ctrl.GenerateCourseCoverImage = func(context.Context, string) ([]byte, string, error) {
		called = true
		return nil, "", nil
	}
	router.POST("/mentor-generate", func(c *gin.Context) {
		c.Set("role", common.RoleMentor)
		ctrl.GenerateCourseCoverAI(c)
	})

	recorder := performJSON(router, http.MethodPost, "/mentor-generate", validAIImagePayload(category.ID))
	if recorder.Code != http.StatusForbidden {
		t.Fatalf("status=%d body=%s", recorder.Code, recorder.Body.String())
	}
	if called {
		t.Fatal("provider must never be called for a mentor")
	}
}

func TestCourseCoverAIStatusResumesUnleasedJobAfterRefresh(t *testing.T) {
	db, tenant, _, userID, ctrl, router := setupAIImageControllerTest(t)
	date, _ := quotaDateAndReset(time.Now())
	generation := model.AIImageGeneration{
		UserID:    userID,
		Prompt:    "Landscape course cover, no text. Science for children.",
		QuotaDate: date,
		Status:    model.AIImageGenerationReserved,
		TenantID:  &tenant.ID,
	}
	if err := db.Create(&generation).Error; err != nil {
		t.Fatalf("create pending generation: %v", err)
	}
	ctrl.GenerateCourseCoverImage = func(context.Context, string) ([]byte, string, error) {
		return []byte("resumed-image"), "req_resumed", nil
	}
	ctrl.UploadCourseCoverImage = func([]byte) (string, error) {
		return "lms/resumed-cover.webp", nil
	}

	data := waitForAIImageStatus(t, router, generation.ID.String(), model.AIImageGenerationGenerated)
	if data["image_url"] == "" {
		t.Fatal("expected resumed generation image URL")
	}
}
