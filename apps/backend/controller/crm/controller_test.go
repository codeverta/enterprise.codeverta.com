package crm

import (
	"encoding/json"
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

func TestCreateAndListAreTenantScoped(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open("file:crm_controller?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := crmmodel.Migrate(db); err != nil {
		t.Fatal(err)
	}
	middleware.RegisterTenantPlugin(db)

	tenantA, tenantB := uuid.New(), uuid.New()
	actorID := uuid.New()
	handler := NewController()
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("db", db.Session(&gorm.Session{}).Set("tenant_id", tenantA.String()))
		c.Set("userID", actorID)
		c.Next()
	})
	router.POST("/crm/:resource", handler.Create)
	router.GET("/crm/:resource", handler.List)

	request := httptest.NewRequest(http.MethodPost, "/crm/leads", strings.NewReader(`{"name":"Lead Tenant A","email":"lead@example.com"}`))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusCreated {
		t.Fatalf("create status=%d body=%s", response.Code, response.Body.String())
	}
	var created crmmodel.Lead
	if err := json.Unmarshal(response.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	if created.ID == uuid.Nil {
		t.Fatalf("unexpected created record: %#v", created)
	}
	var stored crmmodel.Lead
	if err := db.Set("tenant_id", tenantA.String()).First(&stored, "id = ?", created.ID).Error; err != nil {
		t.Fatal(err)
	}
	if stored.TenantID != tenantA {
		t.Fatalf("expected tenant %s, got %s", tenantA, stored.TenantID)
	}

	other := crmmodel.Lead{Name: "Lead Tenant B"}
	if err := db.Set("tenant_id", tenantB.String()).Create(&other).Error; err != nil {
		t.Fatal(err)
	}

	response = httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/crm/leads", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("list status=%d body=%s", response.Code, response.Body.String())
	}
	var list struct {
		Data []crmmodel.Lead `json:"data"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &list); err != nil {
		t.Fatal(err)
	}
	if len(list.Data) != 1 || list.Data[0].Name != "Lead Tenant A" {
		t.Fatalf("expected only tenant A data, got %#v", list.Data)
	}
}

func TestUnknownResourceReturnsNotFound(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handler := NewController()
	router := gin.New()
	router.GET("/crm/:resource", handler.List)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/crm/unknown", nil))
	if response.Code != http.StatusNotFound {
		t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
	}
}
