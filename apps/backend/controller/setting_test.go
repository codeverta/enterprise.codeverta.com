package controller

import (
	"context"
	"encoding/json"
	"gin-template/common"
	"gin-template/model"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupSettingTest(t *testing.T) (*gin.Engine, *gorm.DB, model.Tenant) {
	t.Helper()
	common.RedisEnabled = false
	// Stub RDB to prevent nil pointer in GetSettingCacheKey
	if common.RDB == nil {
		oldRDB := common.RDB
		common.RDB = &common.RedisClient{}
		t.Cleanup(func() { common.RDB = oldRDB })
	}
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}

	if err := db.AutoMigrate(&model.Tenant{}, &model.SystemSetting{}); err != nil {
		t.Fatalf("auto-migrate: %v", err)
	}

	tenant := model.Tenant{ID: uuid.New(), Name: "Setting Test Tenant", Domain: "setting.test", IsActive: true}
	if err := db.Create(&tenant).Error; err != nil {
		t.Fatalf("create tenant: %v", err)
	}

	ctrl := NewSettingController(db, common.Logger)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("db", db)
		c.Set(common.CtxTenantKey, tenant)
		c.Request = c.Request.WithContext(context.WithValue(c.Request.Context(), common.CtxTenantKey, tenant))
		c.Next()
	})
	router.GET("/settings", ctrl.GetSettings)
	router.PUT("/settings", ctrl.UpdateSettings)
	return router, db, tenant
}

func TestSettingGetSettings(t *testing.T) {
	router, db, tenant := setupSettingTest(t)

	t.Run("lazy-init settings when none exist", func(t *testing.T) {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/settings", nil)
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
		}

		var body map[string]interface{}
		if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
			t.Fatalf("decode: %v", err)
		}
		if body["app_name"] != tenant.Name {
			t.Fatalf("expected app_name=%s, got %v", tenant.Name, body["app_name"])
		}
		if body["banner_text"] == nil {
			t.Fatal("expected banner_text in response")
		}
	})

	t.Run("returns existing settings", func(t *testing.T) {
		// Call again — should return persisted settings
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/settings", nil)
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
		}

		var body map[string]interface{}
		if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
			t.Fatalf("decode: %v", err)
		}
		if body["app_name"] != tenant.Name {
			t.Fatalf("expected app_name=%s, got %v", tenant.Name, body["app_name"])
		}

		// Verify it was persisted in DB
		var count int64
		db.Model(&model.SystemSetting{}).Count(&count)
		if count != 1 {
			t.Fatalf("expected 1 setting record, got %d", count)
		}
	})
}

func TestSettingUpdateSettings(t *testing.T) {
	router, _, _ := setupSettingTest(t)

	// First GET to lazy-init
	initRec := httptest.NewRecorder()
	initReq := httptest.NewRequest(http.MethodGet, "/settings", nil)
	router.ServeHTTP(initRec, initReq)

	t.Run("update app_name", func(t *testing.T) {
		rec := performJSON(router, http.MethodPut, "/settings", `{"app_name":"Updated App"}`)
		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
		}

		// Verify the change
		getRec := httptest.NewRecorder()
		getReq := httptest.NewRequest(http.MethodGet, "/settings", nil)
		router.ServeHTTP(getRec, getReq)

		var body map[string]interface{}
		if err := json.Unmarshal(getRec.Body.Bytes(), &body); err != nil {
			t.Fatalf("decode: %v", err)
		}
		if body["app_name"] != "Updated App" {
			t.Fatalf("expected app_name=Updated App, got %v", body["app_name"])
		}
	})

	t.Run("update with bad request", func(t *testing.T) {
		rec := performJSON(router, http.MethodPut, "/settings", `bad`)
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 for bad json, got %d", rec.Code)
		}
	})
}
