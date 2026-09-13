package controller

import (
	"context"
	"net/http"
	"testing"

	"gin-template/common"
	coremodel "gin-template/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestSystemSettingsGetAndUpdateAllTabs(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open("file:system_settings_test?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&coremodel.Tenant{}, &coremodel.SystemSetting{}))

	tenant := coremodel.Tenant{ID: uuid.New(), Name: "System Settings Tenant", Domain: "sys.local", IsActive: true}
	require.NoError(t, db.Create(&tenant).Error)

	ctrl := NewSettingController(db, zap.NewNop())
	router := gin.New()
	router.Use(func(ctx *gin.Context) {
		requestContext := context.WithValue(ctx.Request.Context(), common.CtxTenantKey, tenant)
		requestContext = context.WithValue(requestContext, "tenant_id", tenant.ID.String())
		ctx.Request = ctx.Request.WithContext(requestContext)
		ctx.Set("db", db.WithContext(requestContext))
		ctx.Set(common.CtxTenantKey, tenant)
		ctx.Set("role", 99) // admin
		ctx.Next()
	})
	router.GET("/system-settings", ctrl.GetSettings)
	router.PUT("/system-settings", ctrl.UpdateSettings)

	// 1. Initial GET should create default settings
	getResp := performJSON(router, http.MethodGet, "/system-settings", "")
	require.Equal(t, http.StatusOK, getResp.Code)

	// 2. Update settings across tabs
	updateResp := performJSON(router, http.MethodPut, "/system-settings", `{
		"country": "Indonesia",
		"language": "English",
		"time_zone": "Asia/Jakarta",
		"currency": "IDR",
		"date_format": "yyyy-mm-dd",
		"time_format": "HH:mm:ss",
		"number_format": "#,###.##",
		"session_expiry": "24:00",
		"document_share_key_expiry": 30,
		"deny_multiple_sessions": true,
		"allow_login_using_mobile_number": true,
		"allow_login_using_user_name": true,
		"allow_consecutive_login_attempts": 5,
		"enable_password_policy": true,
		"minimum_password_score": 3,
		"email_retry_limit": 5,
		"max_file_size": 25,
		"default_app": "Desk",
		"backup_limit": 5,
		"max_report_rows": 50000,
		"dormant_days": 7
	}`)
	require.Equal(t, http.StatusOK, updateResp.Code)

	var saved coremodel.SystemSetting
	require.NoError(t, db.First(&saved).Error)
	require.Equal(t, "Asia/Jakarta", saved.TimeZone)
	require.Equal(t, "24:00", saved.SessionExpiry)
	require.True(t, saved.DenyMultipleSessions)
	require.Equal(t, 3, saved.MinimumPasswordScore)
	require.Equal(t, 25, saved.MaxFileSize)
	require.Equal(t, "Desk", saved.DefaultApp)
	require.Equal(t, 5, saved.BackupLimit)
	require.Equal(t, 50000, saved.MaxReportRows)
	require.Equal(t, 7, saved.DormantDays)
}
