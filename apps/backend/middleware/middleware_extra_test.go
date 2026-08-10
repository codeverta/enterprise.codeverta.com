package middleware

import (
	"gin-template/model"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestCORSMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(CORS())
	router.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	t.Run("sets CORS headers for allowed origin", func(t *testing.T) {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("Origin", "http://localhost:5173")
		router.ServeHTTP(rec, req)
		if rec.Header().Get("Access-Control-Allow-Origin") == "" {
			t.Fatal("missing Access-Control-Allow-Origin header")
		}
		if rec.Header().Get("Access-Control-Allow-Credentials") == "" {
			t.Fatal("missing Allow-Credentials header")
		}
	})

	t.Run("sets CORS headers for Tauri desktop origins", func(t *testing.T) {
		for _, origin := range []string{"tauri://localhost", "http://tauri.localhost", "https://tauri.localhost"} {
			rec := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			req.Header.Set("Origin", origin)
			router.ServeHTTP(rec, req)
			if got := rec.Header().Get("Access-Control-Allow-Origin"); got != origin {
				t.Errorf("expected CORS header for %s, got %q", origin, got)
			}
		}
	})

	t.Run("sets CORS headers for vercel subdomain", func(t *testing.T) {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("Origin", "https://my-app.vercel.app")
		router.ServeHTTP(rec, req)
		if rec.Header().Get("Access-Control-Allow-Origin") == "" {
			t.Fatal("missing CORS header for vercel.app origin")
		}
	})

	t.Run("sets CORS headers for codeverta subdomain", func(t *testing.T) {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("Origin", "https://app.codeverta.com")
		router.ServeHTTP(rec, req)
		if rec.Header().Get("Access-Control-Allow-Origin") == "" {
			t.Fatal("missing CORS header for codeverta.com origin")
		}
	})

	t.Run("rejects unknown origin", func(t *testing.T) {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("Origin", "https://evil.com")
		router.ServeHTTP(rec, req)
		if rec.Header().Get("Access-Control-Allow-Origin") != "" {
			t.Fatal("expected no CORS header for unknown origin")
		}
	})

	t.Run("handles OPTIONS preflight", func(t *testing.T) {
		for _, origin := range []string{"http://localhost:5173", "http://127.0.0.1:5174"} {
			rec := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodOptions, "/", nil)
			req.Header.Set("Origin", origin)
			req.Header.Set("Access-Control-Request-Method", "POST")
			req.Header.Set("Access-Control-Request-Headers", "content-type,x-tenant-id")
			router.ServeHTTP(rec, req)
			// CORS middleware should handle OPTIONS itself and return 204.
			if rec.Code != http.StatusNoContent {
				t.Errorf("expected 204 preflight for %s, got %d", origin, rec.Code)
			}
			if got := rec.Header().Get("Access-Control-Allow-Origin"); got != origin {
				t.Errorf("expected CORS header for %s, got %q", origin, got)
			}
		}
	})
}

func TestLoginAttemptMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Setup in-memory DB for login-attempt tracking
	db, err := gorm.Open(sqlite.Open("file:login-attempts?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	model.DB = db

	if err := db.AutoMigrate(&model.LoginAttempt{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	recordLoginAttempt := RecordLoginAttempt(db, "password")
	router := gin.New()
	router.Use(recordLoginAttempt)
	router.POST("/login", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	t.Run("records login attempt from request", func(t *testing.T) {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/login", strings.NewReader(`{"email":"test@example.com"}`))
		req.Header.Set("Content-Type", "application/json")
		req.RemoteAddr = "192.168.1.1:12345"
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", rec.Code)
		}

		// Verify the attempt was recorded
		var count int64
		model.DB.Model(&model.LoginAttempt{}).Count(&count)
		if count != 1 {
			t.Fatalf("expected 1 login attempt recorded, got %d", count)
		}
	})
}
