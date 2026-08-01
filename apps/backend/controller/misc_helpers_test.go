package controller

import (
	"errors"
	"gin-template/common"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestMiscPublicEndpoints(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/status", GetStatus)
	router.GET("/notice", GetNotice)
	router.GET("/about", GetAbout)
	router.POST("/reset", ResetPassword)

	common.OptionMapRWMutex.Lock()
	common.OptionMap = map[string]string{
		"Notice": "Race briefing",
		"About":  "Trail run app",
	}
	common.OptionMapRWMutex.Unlock()

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/status", nil))
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), common.Version) {
		t.Fatalf("status endpoint failed: %d %s", rec.Code, rec.Body.String())
	}

	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/notice", nil))
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "Race briefing") {
		t.Fatalf("notice endpoint failed: %d %s", rec.Code, rec.Body.String())
	}

	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/about", nil))
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "Trail run app") {
		t.Fatalf("about endpoint failed: %d %s", rec.Code, rec.Body.String())
	}

	for _, body := range []string{`{}`, `{"email":"runner@example.com","token":"bad"}`} {
		rec = httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/reset", strings.NewReader(body))
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"success":false`) {
			t.Fatalf("reset bad payload should fail: %d %s", rec.Code, rec.Body.String())
		}
	}
}

func TestResponseHelpers(t *testing.T) {
	cases := []struct {
		name       string
		call       func(*gin.Context)
		wantStatus int
		wantBody   string
	}{
		{
			name:       "sendError",
			call:       func(c *gin.Context) { sendError(c, http.StatusTeapot, "brew failed", gin.H{"field": "bad"}) },
			wantStatus: http.StatusTeapot,
			wantBody:   "brew failed",
		},
		{
			name:       "sendInternalError",
			call:       func(c *gin.Context) { sendInternalError(c, errors.New("db")) },
			wantStatus: http.StatusInternalServerError,
			wantBody:   "Terjadi kesalahan pada server",
		},
		{
			name:       "sendBadRequest",
			call:       func(c *gin.Context) { sendBadRequest(c, "bad request", gin.H{"name": "required"}) },
			wantStatus: http.StatusBadRequest,
			wantBody:   "required",
		},
		{
			name:       "sendUnauthorized",
			call:       func(c *gin.Context) { sendUnauthorized(c, "login required") },
			wantStatus: http.StatusUnauthorized,
			wantBody:   "login required",
		},
		{
			name:       "sendSuccess",
			call:       func(c *gin.Context) { sendSuccess(c, gin.H{"id": 1}, "ok") },
			wantStatus: http.StatusOK,
			wantBody:   `"success":true`,
		},
		{
			name:       "sendSuccessNoData",
			call:       sendSuccessNoData,
			wantStatus: http.StatusOK,
			wantBody:   "Berhasil berhasil",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			gin.SetMode(gin.TestMode)
			rec := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(rec)
			tc.call(ctx)
			if rec.Code != tc.wantStatus || !strings.Contains(rec.Body.String(), tc.wantBody) {
				t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
			}
		})
	}
}

func TestTenantCacheKeyHelper(t *testing.T) {
	if got := getTenantCacheKey("tenant-1"); got != "tenant:tenant-1" {
		t.Fatalf("unexpected tenant cache key: %q", got)
	}
}
