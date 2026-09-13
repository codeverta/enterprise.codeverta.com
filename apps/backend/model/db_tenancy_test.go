package model

import (
	"net/http/httptest"
	"testing"

	"gin-template/internal/tenancy"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestGetDBFailsClosedWithoutTenantInStrictMode(t *testing.T) {
	t.Setenv("TENANCY_MODE", "database-per-tenant")
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("GET", "/api/items", nil)
	defer func() {
		if recover() == nil {
			t.Fatal("strict mode silently fell back to global database")
		}
	}()
	_ = GetDB(c)
}

func TestGetDBUsesTypedTenantDatabase(t *testing.T) {
	t.Setenv("TENANCY_MODE", "database-per-tenant")
	db, err := gorm.Open(sqlite.Open("file:"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("GET", "/api/items", nil)
	c.Request = c.Request.WithContext(tenancy.WithScope(c.Request.Context(), tenancy.Context{ID: uuid.New()}, db))
	if got := GetDB(c); got == nil || got.Dialector.Name() != "sqlite" {
		t.Fatal("typed tenant database was not returned")
	}
}
