package adminauth

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestPlatformAdminUsesSeparateSessionAndHost(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := Migrate(db); err != nil {
		t.Fatal(err)
	}
	if err := CreateAdmin(db, "platform@example.test", "a-strong-platform-password"); err != nil {
		t.Fatal(err)
	}
	secret := "platform-secret-0123456789abcdefghijklmnopqrstuvwxyz-ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	service, err := New(db, secret)
	if err != nil {
		t.Fatal(err)
	}
	token, err := service.Login("platform@example.test", "a-strong-platform-password")
	if err != nil {
		t.Fatal(err)
	}
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(RequireHost("admin.example.test"), service.Authenticate())
	router.GET("/api/platform/tenants", func(c *gin.Context) { c.Status(http.StatusNoContent) })

	request := httptest.NewRequest(http.MethodGet, "/api/platform/tenants", nil)
	request.Host = "admin.example.test"
	request.Header.Set("Authorization", "Bearer "+token)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusNoContent {
		t.Fatalf("valid platform session returned %d: %s", response.Code, response.Body.String())
	}

	request = httptest.NewRequest(http.MethodGet, "/api/platform/tenants", nil)
	request.Host = "alpha.erp.example.test"
	request.Header.Set("Authorization", "Bearer "+token)
	response = httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusNotFound {
		t.Fatalf("platform API accepted tenant host: %d", response.Code)
	}
}
