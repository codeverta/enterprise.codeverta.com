package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"gin-template/common"
	"gin-template/internal/tenancy"
	"gin-template/model"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestUserAuthRejectsJWTFromDifferentHostnameTenant(t *testing.T) {
	t.Setenv("TENANCY_MODE", "database-per-tenant")
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open("file:"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.User{}); err != nil {
		t.Fatal(err)
	}
	hostTenantID := uuid.New()
	userID := uuid.New()
	user := model.User{ID: userID, Email: "alpha@example.test", Username: "alpha", Password: "unused", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, Token: "v1", TenantID: &hostTenantID}
	if err := db.Session(&gorm.Session{SkipHooks: true}).Create(&user).Error; err != nil {
		t.Fatal(err)
	}
	wrongTenantID := uuid.New()
	claims := Claims{
		UserId: userID.String(), TenantID: wrongTenantID.String(), Username: user.Username,
		Role: user.Role, TokenVersion: user.Token,
		RegisteredClaims: jwt.RegisteredClaims{Issuer: "gin-template", ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour))},
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(common.JWTSecret))
	if err != nil {
		t.Fatal(err)
	}
	router := gin.New()
	router.Use(func(c *gin.Context) {
		ctx := tenancy.WithScope(c.Request.Context(), tenancy.Context{ID: hostTenantID, Status: tenancy.StatusActive}, db)
		c.Request = c.Request.WithContext(ctx)
		c.Next()
	}, UserAuth())
	router.GET("/api/items", func(c *gin.Context) { c.Status(http.StatusNoContent) })
	request := httptest.NewRequest(http.MethodGet, "/api/items", nil)
	request.Header.Set("Authorization", "Bearer "+token)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusForbidden {
		t.Fatalf("cross-tenant token returned %d: %s", response.Code, response.Body.String())
	}
}
