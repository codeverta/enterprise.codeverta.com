package controller

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"gin-template/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func TestReadinessResponseCreateAndAdminList(t *testing.T) {
	router, db, _, _ := setupLMSControllerTest(t)
	ctrl := NewLMSController(db)
	router.POST("/readiness-responses", ctrl.CreateReadinessResponse)
	router.POST("/readiness-responses-gin-tenant-only", func(c *gin.Context) {
		// Production's tenant resolver stores the tenant in Gin context and the
		// scoped DB, but does not copy it into Request.Context.
		c.Request = c.Request.WithContext(context.Background())
		c.Next()
	}, ctrl.CreateReadinessResponse)
	router.GET("/admin/readiness-responses", ctrl.ListReadinessResponses)

	body := `{
		"test_type":"parent",
		"respondent_type":"internal",
		"respondent_name":"Bunda KITA",
		"respondent_email":"bunda@example.com",
		"language":"id",
		"score":82,
		"result_label":"Cukup Siap",
		"profile":{"job":"pengusaha"},
		"answers":[{"question_id":"parent-1","value":4}],
		"result":{"dimension_scores":{"psikologis":80}}
	}`
	createRec := performJSON(router, http.MethodPost, "/readiness-responses", body)
	if createRec.Code != http.StatusOK {
		t.Fatalf("create readiness response status = %d, body = %s", createRec.Code, createRec.Body.String())
	}

	var stored model.ReadinessResponse
	if err := db.First(&stored).Error; err != nil {
		t.Fatalf("load readiness response: %v", err)
	}
	if stored.TestType != model.ReadinessTestParent || stored.RespondentType != "internal" || stored.Score != 82 {
		t.Fatalf("unexpected stored readiness response: %+v", stored)
	}
	if stored.TenantID == nil {
		t.Fatal("readiness response tenant_id must be persisted")
	}
	var profile map[string]interface{}
	if err := json.Unmarshal(stored.Profile, &profile); err != nil || profile["job"] != "pengusaha" {
		t.Fatalf("unexpected stored profile: %s (%v)", stored.Profile, err)
	}

	listRec := performJSON(router, http.MethodGet, "/admin/readiness-responses?test_type=parent&respondent_type=internal", "")
	if listRec.Code != http.StatusOK {
		t.Fatalf("list readiness response status = %d, body = %s", listRec.Code, listRec.Body.String())
	}
	var listPayload struct {
		Data       []model.ReadinessResponse `json:"data"`
		Pagination struct {
			Total int64 `json:"total"`
		} `json:"pagination"`
	}
	if err := json.Unmarshal(listRec.Body.Bytes(), &listPayload); err != nil {
		t.Fatalf("decode readiness response list: %v", err)
	}
	if listPayload.Pagination.Total != 1 || len(listPayload.Data) != 1 {
		t.Fatalf("unexpected readiness response list: %s", listRec.Body.String())
	}

	productionContextRec := performJSON(router, http.MethodPost, "/readiness-responses-gin-tenant-only", body)
	if productionContextRec.Code != http.StatusOK {
		t.Fatalf("create with Gin tenant context status = %d, body = %s", productionContextRec.Code, productionContextRec.Body.String())
	}
}

func TestReadinessResponseRejectsInvalidTestType(t *testing.T) {
	router, db, _, _ := setupLMSControllerTest(t)
	ctrl := NewLMSController(db)
	router.POST("/readiness-responses", ctrl.CreateReadinessResponse)

	rec := performJSON(router, http.MethodPost, "/readiness-responses", `{
		"test_type":"unknown",
		"profile":{},
		"answers":[],
		"result":{}
	}`)
	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestReadinessResponseAutosaveAndResume(t *testing.T) {
	router, db, _, _ := setupLMSControllerTest(t)
	ctrl := NewLMSController(db)
	router.POST("/readiness-responses", ctrl.CreateReadinessResponse)
	router.GET("/readiness-responses/:session_id", ctrl.GetReadinessResponseProgress)

	sessionID := uuid.New().String()
	firstDraft := `{
		"session_id":"` + sessionID + `",
		"test_type":"parent",
		"respondent_type":"external",
		"respondent_name":"Orang Tua",
		"respondent_email":"parent@example.com",
		"profile":{"audience":"external"},
		"answers":[{"question_id":"parent-1","value":3}],
		"result":{"dimension_scores":{"psikologis":67}},
		"status":"draft",
		"current_question":0
	}`
	if rec := performJSON(router, http.MethodPost, "/readiness-responses", firstDraft); rec.Code != http.StatusOK {
		t.Fatalf("first autosave status = %d, body = %s", rec.Code, rec.Body.String())
	}

	secondDraft := `{
		"session_id":"` + sessionID + `",
		"test_type":"parent",
		"respondent_type":"external",
		"respondent_name":"Orang Tua",
		"respondent_email":"parent@example.com",
		"profile":{"audience":"external"},
		"answers":[{"question_id":"parent-1","value":3},{"question_id":"parent-2","value":4}],
		"result":{"dimension_scores":{"psikologis":84}},
		"status":"draft",
		"current_question":1
	}`
	if rec := performJSON(router, http.MethodPost, "/readiness-responses", secondDraft); rec.Code != http.StatusOK {
		t.Fatalf("second autosave status = %d, body = %s", rec.Code, rec.Body.String())
	}

	var count int64
	if err := db.Model(&model.ReadinessResponse{}).Count(&count).Error; err != nil || count != 1 {
		t.Fatalf("autosave must update one row, count=%d err=%v", count, err)
	}
	var stored model.ReadinessResponse
	if err := db.First(&stored).Error; err != nil {
		t.Fatalf("load autosaved response: %v", err)
	}
	if stored.Status != "draft" || stored.CurrentQuestion != 1 {
		t.Fatalf("unexpected autosave state: %+v", stored)
	}

	resumeRec := performJSON(router, http.MethodGet, "/readiness-responses/"+sessionID, "")
	if resumeRec.Code != http.StatusOK {
		t.Fatalf("resume status = %d, body = %s", resumeRec.Code, resumeRec.Body.String())
	}
	var resumePayload struct {
		Data model.ReadinessResponse `json:"data"`
	}
	if err := json.Unmarshal(resumeRec.Body.Bytes(), &resumePayload); err != nil {
		t.Fatalf("decode resume payload: %v", err)
	}
	if resumePayload.Data.CurrentQuestion != 1 || resumePayload.Data.Status != "draft" {
		t.Fatalf("unexpected resumed progress: %s", resumeRec.Body.String())
	}
}

func TestReadinessAnalyticsSummarizesCompletedAndDraftResponses(t *testing.T) {
	router, db, _, _ := setupLMSControllerTest(t)
	ctrl := NewLMSController(db)
	router.POST("/readiness-responses", ctrl.CreateReadinessResponse)
	router.GET("/readiness-responses/analytics", ctrl.GetReadinessAnalytics)

	draft := `{
		"session_id":"` + uuid.New().String() + `",
		"test_type":"parent",
		"profile":{},
		"answers":[{"question_id":"parent-1","value":2}],
		"result":{"dimension_scores":{"psikologis":33}},
		"status":"draft",
		"current_question":0
	}`
	completed := `{
		"session_id":"` + uuid.New().String() + `",
		"test_type":"parent",
		"respondent_type":"internal",
		"score":80,
		"result_label":"Cukup Siap",
		"profile":{},
		"answers":[{"question_id":"parent-1","value":4}],
		"result":{"dimension_scores":{"psikologis":80,"waktu":60}},
		"status":"completed",
		"current_question":22
	}`
	for _, body := range []string{draft, completed} {
		if rec := performJSON(router, http.MethodPost, "/readiness-responses", body); rec.Code != http.StatusOK {
			t.Fatalf("seed analytics response status = %d, body = %s", rec.Code, rec.Body.String())
		}
	}

	rec := performJSON(router, http.MethodGet, "/readiness-responses/analytics", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("analytics status = %d, body = %s", rec.Code, rec.Body.String())
	}
	var payload struct {
		Data readinessAnalytics `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode analytics: %v", err)
	}
	if payload.Data.Summary.TotalStarted != 2 ||
		payload.Data.Summary.Completed != 1 ||
		payload.Data.Summary.Drafts != 1 ||
		payload.Data.Summary.CompletionRate != 50 {
		t.Fatalf("unexpected analytics summary: %s", rec.Body.String())
	}
	if len(payload.Data.DimensionScores) != 2 ||
		payload.Data.StrongestDimension == nil ||
		payload.Data.StrongestDimension.Key != "psikologis" {
		t.Fatalf("unexpected dimension analytics: %s", rec.Body.String())
	}
}

func TestReadinessInterpretationCacheKeyTracksTenantModelAndData(t *testing.T) {
	base := readinessInterpretationCacheKey("tenant-a", "deepseek-chat", []byte(`{"completed":10}`))
	if base != readinessInterpretationCacheKey("tenant-a", "deepseek-chat", []byte(`{"completed":10}`)) {
		t.Fatal("identical analytics must produce the same cache key")
	}
	if base == readinessInterpretationCacheKey("tenant-b", "deepseek-chat", []byte(`{"completed":10}`)) {
		t.Fatal("cache key must be isolated by tenant")
	}
	if base == readinessInterpretationCacheKey("tenant-a", "deepseek-reasoner", []byte(`{"completed":10}`)) {
		t.Fatal("cache key must be isolated by model")
	}
	if base == readinessInterpretationCacheKey("tenant-a", "deepseek-chat", []byte(`{"completed":11}`)) {
		t.Fatal("changed analytics must invalidate the cache key")
	}
	if readinessInterpretationCacheTTL != 7*24*time.Hour {
		t.Fatalf("unexpected interpretation cache TTL: %s", readinessInterpretationCacheTTL)
	}
}
