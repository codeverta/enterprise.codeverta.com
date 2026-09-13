package router

import (
	"gin-template/middleware"

	"github.com/gin-gonic/gin"
)

func registerAuthRoutes(rg *gin.RouterGroup, ctrls *controllerList) {
	registerPlatformLegacyRoutes(rg, ctrls)
	registerTenantAuthRoutes(rg, ctrls)
}

func registerPlatformLegacyRoutes(rg *gin.RouterGroup, ctrls *controllerList) {
	// Cross-tenant security observability is reserved for superadmins.
	systemRoute := rg.Group("/system")
	systemRoute.Use(middleware.RootAuth(), middleware.CriticalRateLimit())
	{
		systemRoute.GET("/audit-logs", ctrls.auditLog.GetSystemLogs)
		systemRoute.GET("/login-attempts", ctrls.auditLog.GetLoginAttempts)
	}

	// ========== TENANTS ROUTES ==========
	tenantRoute := rg.Group("/tenants")
	tenantRoute.Use(middleware.RootAuth())
	{
		tenantRoute.GET("", ctrls.tenant.GetAllTenants)
		tenantRoute.POST("", ctrls.tenant.CreateTenant)
		tenantRoute.GET("/:id", ctrls.tenant.GetTenant)
		tenantRoute.PUT("/:id", ctrls.tenant.UpdateTenant)
		tenantRoute.DELETE("/:id", ctrls.tenant.DeleteTenant)
	}

	// ========== REGION ROUTES ==========
	regionRouter := rg.Group("/regions")
	{
		regionRouter.GET("/provinces", ctrls.region.GetProvinces)
		regionRouter.GET("/regencies/:provinceID", ctrls.region.GetRegenciesByProvinceID)
		regionRouter.GET("/districts/:regencyID", ctrls.region.GetDistrictsByRegencyID)
	}

}

func registerTenantAuthRoutes(rg *gin.RouterGroup, ctrls *controllerList) {
	// ========== AUTH ROUTES ==========
	authRoute := rg.Group("/auth")
	{
		authRoute.GET("/google/status", ctrls.auth.GoogleOAuthStatus)
		authRoute.GET("/google/start", middleware.CriticalRateLimit(), ctrls.auth.BeginGoogleOAuth)
		authRoute.GET("/google/callback", middleware.CriticalRateLimit(), ctrls.auth.FinishGoogleOAuth)
		authRoute.POST("/register", middleware.CriticalRateLimit(), ctrls.auth.Register)
		authRoute.POST("/login", middleware.RecordLoginAttempt(ctrls.auth.DB, "password"), middleware.CriticalRateLimit(), ctrls.auth.Login)
		authRoute.GET("/password-reset/captcha", middleware.CriticalRateLimit(), ctrls.auth.PasswordResetCaptcha)
		authRoute.POST("/password-reset/request", middleware.CriticalRateLimit(), ctrls.auth.ForgotPassword)
		authRoute.POST("/password-reset/confirm", middleware.CriticalRateLimit(), ctrls.auth.ResetPassword)
		authRoute.GET("/logout", ctrls.auth.Logout)
		authRoute.POST("/refresh-token", ctrls.auth.RefreshToken)
		authRoute.POST("/handoff/exchange", middleware.CriticalRateLimit(), ctrls.auth.ExchangeAuthHandoff)
		// WebAuthn Login Flow
		authRoute.POST("/webauthn/login/begin", ctrls.auth.BeginLogin)
		authRoute.POST("/webauthn/login/finish", middleware.RecordLoginAttempt(ctrls.auth.DB, "passkey"), ctrls.auth.FinishLogin)
		authRoute.POST("/webauthn/login/discoverable/begin", ctrls.auth.BeginDiscoverableLogin)
		authRoute.POST("/webauthn/login/discoverable/finish", middleware.RecordLoginAttempt(ctrls.auth.DB, "passkey_discoverable"), ctrls.auth.FinishDiscoverableLogin)

		// WebAuthn Registration Flow (Protected)
		authProtected := authRoute.Use(middleware.UserAuth())
		{
			authProtected.POST("/impersonation/stop", ctrls.auth.StopImpersonation)
			authProtected.POST("/webauthn/register/begin", ctrls.auth.BeginRegistration)
			authProtected.POST("/webauthn/register/finish", ctrls.auth.FinishRegistration)
		}
	}
}
