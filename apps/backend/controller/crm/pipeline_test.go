package crm

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"gin-template/middleware"
	crmmodel "gin-template/model/crm"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestPipelineMoveLostReasonAndForecast(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open("file:crm_pipeline?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := crmmodel.Migrate(db); err != nil {
		t.Fatal(err)
	}
	if err := db.Exec("CREATE TABLE users (id char(36) PRIMARY KEY, display_name varchar(100), first_name varchar(100), last_name varchar(100), email varchar(150), status integer, tenant_id char(36), deleted_at datetime)").Error; err != nil {
		t.Fatal(err)
	}
	middleware.RegisterTenantPlugin(db)
	tenantID, actor := uuid.New(), uuid.New()
	if err := db.Exec("INSERT INTO users (id, display_name, status, tenant_id) VALUES (?, ?, ?, ?)", actor, "Sales Satu", 1, tenantID).Error; err != nil {
		t.Fatal(err)
	}
	scoped := db.Session(&gorm.Session{}).Set("tenant_id", tenantID.String())
	stages, err := ensurePipelineStages(scoped)
	if err != nil {
		t.Fatal(err)
	}
	if len(stages) != 6 || stages[4].StageType != "won" || stages[5].StageType != "lost" {
		t.Fatalf("unexpected default stages: %#v", stages)
	}

	handler := NewController()
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("db", db.Session(&gorm.Session{}).Set("tenant_id", tenantID.String()))
		c.Set("userID", actor)
		c.Next()
	})
	router.POST("/crm/pipeline/opportunities", handler.CreateOpportunity)
	router.POST("/crm/pipeline/opportunities/:id/move", handler.MoveOpportunity)
	router.GET("/crm/pipeline/forecast", handler.SalesForecast)

	createBody := fmt.Sprintf(`{"name":"ERP Enterprise","stage_id":"%s","amount":100000000,"probability":10,"expected_close_date":"2026-09-15T00:00:00Z"}`, stages[0].ID)
	createdResponse := pipelineRequest(router, http.MethodPost, "/crm/pipeline/opportunities", createBody)
	if createdResponse.Code != http.StatusCreated {
		t.Fatalf("create status=%d body=%s", createdResponse.Code, createdResponse.Body.String())
	}
	var created opportunityView
	if err := json.Unmarshal(createdResponse.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}

	withoutReason := pipelineRequest(router, http.MethodPost, fmt.Sprintf("/crm/pipeline/opportunities/%s/move", created.ID), fmt.Sprintf(`{"stage_id":"%s"}`, stages[5].ID))
	if withoutReason.Code != http.StatusBadRequest {
		t.Fatalf("lost without reason status=%d body=%s", withoutReason.Code, withoutReason.Body.String())
	}
	withReason := pipelineRequest(router, http.MethodPost, fmt.Sprintf("/crm/pipeline/opportunities/%s/move", created.ID), fmt.Sprintf(`{"stage_id":"%s","lost_reason":"Kalah harga"}`, stages[5].ID))
	if withReason.Code != http.StatusOK {
		t.Fatalf("lost with reason status=%d body=%s", withReason.Code, withReason.Body.String())
	}

	won := pipelineRequest(router, http.MethodPost, fmt.Sprintf("/crm/pipeline/opportunities/%s/move", created.ID), fmt.Sprintf(`{"stage_id":"%s"}`, stages[4].ID))
	if won.Code != http.StatusOK {
		t.Fatalf("won status=%d body=%s", won.Code, won.Body.String())
	}
	forecast := pipelineRequest(router, http.MethodGet, "/crm/pipeline/forecast?from=2026-09-01&to=2026-09-30", "")
	if forecast.Code != http.StatusOK {
		t.Fatalf("forecast status=%d body=%s", forecast.Code, forecast.Body.String())
	}
	var result struct {
		Periods []forecastBucket `json:"periods"`
		ByRep   []forecastRep    `json:"by_rep"`
	}
	if err := json.Unmarshal(forecast.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if len(result.Periods) != 1 || result.Periods[0].Won != 100000000 || len(result.ByRep) != 1 {
		t.Fatalf("unexpected forecast: %#v", result)
	}
}

func pipelineRequest(router http.Handler, method, path, body string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(method, path, strings.NewReader(body))
	if body != "" {
		request.Header.Set("Content-Type", "application/json")
	}
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	return response
}
