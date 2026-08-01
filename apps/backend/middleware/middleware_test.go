package middleware

import (
	"gin-template/common"
	"gin-template/model"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupMiddlewareTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+strings.ReplaceAll(t.Name(), "/", "_")+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.Exec(`CREATE TABLE users (
		id char(36) PRIMARY KEY,
		username text,
		status int default 1,
		created_at datetime,
		updated_at datetime,
		deleted_at datetime
	)`).Error; err != nil {
		t.Fatalf("create users table: %v", err)
	}
	if err := db.Exec(`INSERT INTO users (id, username, status) VALUES ('00000000-0000-0000-0000-000000000001', 'runner', 1)`).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
	model.DB = db
	return db
}

func middlewareRouter(mw gin.HandlerFunc) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(mw)
	router.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"id":       c.GetString("id"),
			"username": c.GetString("username"),
			"role":     c.GetInt("role"),
		})
	})
	router.POST("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})
	router.OPTIONS("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})
	return router
}

func signedToken(t *testing.T, role int) string {
	t.Helper()
	claims := Claims{
		UserId:   "00000000-0000-0000-0000-000000000001",
		Username: "runner",
		Role:     role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(common.JWTSecret))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	return token
}

func TestAuthMiddlewares(t *testing.T) {
	t.Run("rejects missing token", func(t *testing.T) {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		middlewareRouter(UserAuth()).ServeHTTP(rec, req)
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
		}
	})

	t.Run("rejects invalid format", func(t *testing.T) {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("Authorization", "bad")
		middlewareRouter(UserAuth()).ServeHTTP(rec, req)
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
		}
	})

	t.Run("rejects insufficient role", func(t *testing.T) {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("Authorization", "Bearer "+signedToken(t, common.RoleCommonUser))
		middlewareRouter(AdminAuth()).ServeHTTP(rec, req)
		if rec.Code != http.StatusForbidden {
			t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
		}
	})

	t.Run("sets context for valid root token", func(t *testing.T) {
		db := setupMiddlewareTestDB(t)
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("Authorization", "Bearer "+signedToken(t, common.RoleRootUser))
		router := gin.New()
		router.Use(func(c *gin.Context) { c.Set("db", db); c.Next() })
		router.Use(RootAuth())
		router.GET("/", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{
				"id":       c.GetString("id"),
				"username": c.GetString("username"),
				"role":     c.GetInt("role"),
			})
		})
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "runner") {
			t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
		}
	})

	t.Run("passes options request", func(t *testing.T) {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodOptions, "/", nil)
		middlewareRouter(UserAuth()).ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
		}
	})

	t.Run("passive auth treats bad token as guest", func(t *testing.T) {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("Authorization", "Bearer invalid")
		middlewareRouter(PassiveAuth()).ServeHTTP(rec, req)
		if rec.Code != http.StatusOK || strings.Contains(rec.Body.String(), "runner") {
			t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
		}
	})

	t.Run("passive auth sets valid user", func(t *testing.T) {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("Authorization", "Bearer "+signedToken(t, common.RoleAdminUser))
		middlewareRouter(PassiveAuth()).ServeHTTP(rec, req)
		if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "runner") {
			t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
		}
	})
}

func TestCacheAndBodySizeMiddleware(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	middlewareRouter(Cache()).ServeHTTP(rec, req)
	if rec.Header().Get("Cache-Control") != "max-age=604800" {
		t.Fatalf("missing cache header: %v", rec.Header())
	}

	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/", strings.NewReader("too-large"))
	req.ContentLength = 9
	middlewareRouter(MaxSizeMiddleware(4)).ServeHTTP(rec, req)
	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("expected 413, got %d", rec.Code)
	}

	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/", strings.NewReader("ok"))
	req.ContentLength = 2
	middlewareRouter(MaxSizeMiddleware(4)).ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected ok, got %d", rec.Code)
	}
}

func TestMemoryRateLimiterMiddleware(t *testing.T) {
	common.RedisEnabled = false
	inMemoryRateLimiter = common.InMemoryRateLimiter{}

	router := middlewareRouter(rateLimitFactory(1, 60, "test"))

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("first request status=%d", rec.Code)
	}

	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/", nil)
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("second request status=%d body=%s", rec.Code, rec.Body.String())
	}
	if rec.Header().Get("Retry-After") != "60" {
		t.Fatalf("missing Retry-After header")
	}
}
