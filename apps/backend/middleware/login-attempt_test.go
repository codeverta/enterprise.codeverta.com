package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"gin-template/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestRecordLoginAttemptPersistsFailureAndSuccess(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	if err := db.AutoMigrate(&model.LoginAttempt{}, &model.AuditLog{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	RegisterAuditPlugin(db)
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST("/login", RecordLoginAttempt(db, "password"), func(c *gin.Context) {
		if strings.Contains(c.GetHeader("Authorization"), "success") {
			c.Set("id", uuid.MustParse("11111111-1111-1111-1111-111111111111"))
			c.Status(http.StatusOK)
			return
		}
		c.Status(http.StatusUnauthorized)
	})

	request := httptest.NewRequest(http.MethodPost, "/login", strings.NewReader(`{"email":"person@example.com","password":"wrong"}`))
	request.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(httptest.NewRecorder(), request)
	request = httptest.NewRequest(http.MethodPost, "/login", strings.NewReader(`{"email":"person@example.com","password":"correct"}`))
	request.Header.Set("Authorization", "success")
	router.ServeHTTP(httptest.NewRecorder(), request)

	var attempts []model.LoginAttempt
	if err := db.Order("created_at ASC").Find(&attempts).Error; err != nil {
		t.Fatalf("read attempts: %v", err)
	}
	if len(attempts) != 2 {
		t.Fatalf("attempt count = %d, want 2", len(attempts))
	}
	if attempts[0].Success || attempts[0].HTTPStatus != http.StatusUnauthorized {
		t.Errorf("failure not captured: %#v", attempts[0])
	}
	if !attempts[1].Success || attempts[1].UserID == nil {
		t.Errorf("success actor not captured: %#v", attempts[1])
	}
	if attempts[0].AttemptedIdentifier != "person@example.com" {
		t.Errorf("identifier = %q", attempts[0].AttemptedIdentifier)
	}
	var auditCount int64
	if err := db.Model(&model.AuditLog{}).Count(&auditCount).Error; err != nil || auditCount != 0 {
		t.Errorf("login-attempt observability should not recursively create audit logs: count=%d err=%v", auditCount, err)
	}
}
