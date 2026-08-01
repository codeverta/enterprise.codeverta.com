package controller

import (
	"context"
	"fmt"
	"gin-template/common"
	"gin-template/model"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupControllerTestDB(t *testing.T) (*gorm.DB, model.Tenant) {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}

	// Migrate individual tables to avoid FK constraint ordering issues
	for _, m := range []interface{}{&model.Tenant{}} {
		if err := db.Migrator().CreateTable(m); err != nil {
			t.Fatalf("create table %T: %v", m, err)
		}
	}
	if err := db.Migrator().CreateTable(&model.User{}); err != nil {
		t.Fatalf("create users table: %v", err)
	}
	if err := db.Migrator().CreateTable(&model.Profile{}); err != nil {
		t.Fatalf("create profiles table: %v", err)
	}
	if err := db.Migrator().CreateTable(&model.SystemSetting{}); err != nil {
		t.Fatalf("create settings table: %v", err)
	}
	if err := db.Migrator().CreateTable(&model.EmailTemplate{}); err != nil {
		t.Fatalf("create email_template table: %v", err)
	}
	if err := db.Migrator().CreateTable(&model.AuditLog{}); err != nil {
		t.Fatalf("create audit_log table: %v", err)
	}

	tenant := model.Tenant{
		ID:       uuid.New(),
		Name:     "Test Tenant",
		Domain:   "test.local",
		IsActive: true,
	}
	if err := db.Create(&tenant).Error; err != nil {
		t.Fatalf("create tenant: %v", err)
	}

	return db, tenant
}

func tenantScopedDB(db *gorm.DB, tenant model.Tenant) *gorm.DB {
	ctx := context.WithValue(context.Background(), common.CtxTenantKey, tenant)
	return db.WithContext(ctx)
}

func testRouter(db *gorm.DB) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("db", db)
		c.Next()
	})
	return router
}

func testRouterWithTenant(db *gorm.DB, tenant model.Tenant) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("db", db)
		c.Set(common.CtxTenantKey, tenant)
		c.Next()
	})
	return router
}

func performJSON(router http.Handler, method string, path string, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	return rec
}
