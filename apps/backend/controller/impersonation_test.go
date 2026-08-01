package controller

import (
	"context"
	"encoding/json"
	"fmt"
	"gin-template/common"
	"gin-template/middleware"
	"gin-template/model"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func performAuthenticatedJSON(router http.Handler, method, path, body, token string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)
	return recorder
}

func TestImpersonationLifecycleAndRoleBoundary(t *testing.T) {
	db, tenant := setupControllerTestDB(t)
	if err := db.Migrator().CreateTable(&model.ImpersonationSession{}); err != nil {
		t.Fatalf("create impersonation sessions table: %v", err)
	}

	ctx := context.WithValue(context.Background(), common.CtxTenantKey, tenant)
	admin := model.User{
		ID: uuid.New(), Username: "debug-admin", Email: "debug-admin@test.com",
		DisplayName: "Debug Admin", Role: model.RoleAdmin, Status: common.UserStatusEnabled,
		TenantID: &tenant.ID,
	}
	student := model.User{
		ID: uuid.New(), Username: "debug-student", Email: "debug-student@test.com",
		DisplayName: "Debug Student", Role: model.RoleStudent, Status: common.UserStatusEnabled,
		TenantID: &tenant.ID,
	}
	superadmin := model.User{
		ID: uuid.New(), Username: "debug-root", Email: "debug-root@test.com",
		DisplayName: "Debug Root", Role: model.RoleSuperAdmin, Status: common.UserStatusEnabled,
		TenantID: &tenant.ID,
	}
	for _, user := range []*model.User{&admin, &student, &superadmin} {
		if err := db.WithContext(ctx).Create(user).Error; err != nil {
			t.Fatalf("create user %s: %v", user.Username, err)
		}
	}

	adminToken, _, err := generateTokens(&admin)
	if err != nil {
		t.Fatalf("generate admin token: %v", err)
	}

	router := gin.New()
	router.Use(func(c *gin.Context) {
		requestContext := context.WithValue(c.Request.Context(), common.CtxTenantKey, tenant)
		c.Request = c.Request.WithContext(requestContext)
		c.Set("db", db.WithContext(requestContext))
		c.Set(common.CtxTenantKey, tenant)
		c.Next()
	})
	userController := NewUserController(db)
	authController := NewAuthController(db)
	router.POST("/users/:id/impersonate", middleware.AdminAuth(), userController.StartImpersonation)
	router.POST("/auth/refresh-token", authController.RefreshToken)
	router.POST("/auth/impersonation/stop", middleware.UserAuth(), authController.StopImpersonation)
	router.GET("/whoami", middleware.UserAuth(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"id": c.GetString("id"), "role": c.GetInt("role"),
			"impersonator_id": c.GetString("impersonator_id"),
		})
	})

	start := performAuthenticatedJSON(
		router, http.MethodPost, "/users/"+student.ID.String()+"/impersonate",
		`{"reason":"Debug course visibility"}`, adminToken,
	)
	if start.Code != http.StatusOK {
		t.Fatalf("start impersonation status=%d body=%s", start.Code, start.Body.String())
	}
	var startPayload struct {
		Data struct {
			AccessToken  string `json:"access_token"`
			RefreshToken string `json:"refresh_token"`
			User         struct {
				ID   uuid.UUID `json:"id"`
				Role int       `json:"role"`
			} `json:"user"`
			Impersonation struct {
				SessionID uuid.UUID `json:"session_id"`
			} `json:"impersonation"`
		} `json:"data"`
	}
	if err := json.Unmarshal(start.Body.Bytes(), &startPayload); err != nil {
		t.Fatalf("decode start response: %v", err)
	}
	if startPayload.Data.AccessToken == "" || startPayload.Data.User.ID != student.ID || startPayload.Data.User.Role != model.RoleStudent {
		t.Fatalf("unexpected impersonation response: %+v", startPayload.Data)
	}
	refresh := performJSON(
		router,
		http.MethodPost,
		"/auth/refresh-token",
		fmt.Sprintf(`{"refresh_token":%q}`, startPayload.Data.RefreshToken),
	)
	if refresh.Code != http.StatusOK || !strings.Contains(refresh.Body.String(), "access_token") {
		t.Fatalf("refresh impersonation token status=%d body=%s", refresh.Code, refresh.Body.String())
	}

	whoami := performAuthenticatedJSON(router, http.MethodGet, "/whoami", "", startPayload.Data.AccessToken)
	if whoami.Code != http.StatusOK || !strings.Contains(whoami.Body.String(), admin.ID.String()) {
		t.Fatalf("impersonated token not accepted: status=%d body=%s", whoami.Code, whoami.Body.String())
	}

	stop := performAuthenticatedJSON(router, http.MethodPost, "/auth/impersonation/stop", "", startPayload.Data.AccessToken)
	if stop.Code != http.StatusOK {
		t.Fatalf("stop impersonation status=%d body=%s", stop.Code, stop.Body.String())
	}

	revoked := performAuthenticatedJSON(router, http.MethodGet, "/whoami", "", startPayload.Data.AccessToken)
	if revoked.Code != http.StatusUnauthorized {
		t.Fatalf("revoked impersonation token should return 401, got %d body=%s", revoked.Code, revoked.Body.String())
	}

	forbidden := performAuthenticatedJSON(
		router, http.MethodPost, "/users/"+superadmin.ID.String()+"/impersonate",
		`{"reason":"Should be forbidden"}`, adminToken,
	)
	if forbidden.Code != http.StatusForbidden {
		t.Fatalf("admin impersonating superadmin should return 403, got %d body=%s", forbidden.Code, forbidden.Body.String())
	}

	var auditCount int64
	if err := db.Model(&model.AuditLog{}).
		Where("user_id = ? AND record_id = ?", admin.ID, startPayload.Data.Impersonation.SessionID.String()).
		Count(&auditCount).Error; err != nil {
		t.Fatalf("count impersonation audit logs: %v", err)
	}
	if auditCount != 2 {
		t.Fatalf("expected start and stop audit logs, got %d", auditCount)
	}

	t.Logf("impersonation session %s was created, audited, and revoked", fmt.Sprint(startPayload.Data.Impersonation.SessionID))
}
