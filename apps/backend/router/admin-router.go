package router

import (
	"gin-template/controller"
	"gin-template/middleware"

	"github.com/gin-gonic/gin"
)

func registerAdminRoutes(rg *gin.RouterGroup, ctrls *controllerList) {
	authorization := controller.NewAuthorizationController()
	permissionAdmin := rg.Group("/authorization")
	permissionAdmin.Use(middleware.AdminAuth())
	{
		permissionAdmin.GET("/roles", authorization.ListRoles)
		permissionAdmin.POST("/roles", authorization.CreateRole)
		permissionAdmin.GET("/roles/:id", authorization.GetRole)
		permissionAdmin.PUT("/roles/:id", authorization.UpdateRole)
		permissionAdmin.DELETE("/roles/:id", authorization.DeleteRole)
		permissionAdmin.GET("/profiles", authorization.ListProfiles)
		permissionAdmin.POST("/profiles", authorization.CreateProfile)
		permissionAdmin.PUT("/profiles/:id", authorization.UpdateProfile)
		permissionAdmin.DELETE("/profiles/:id", authorization.DeleteProfile)
		permissionAdmin.GET("/users/:id/assignments", authorization.GetAssignments)
		permissionAdmin.PUT("/users/:id/assignments", authorization.SetAssignments)
	}
	permissionSelf := rg.Group("/authorization")
	permissionSelf.Use(middleware.UserAuth())
	permissionSelf.GET("/me", authorization.MyPermissions)
	// User Management
	adminUserRoute := rg.Group("/users")
	adminUserRoute.Use(middleware.AdminAuth())
	{
		adminUserRoute.GET("", ctrls.user.GetAllUsers)
		adminUserRoute.POST("", ctrls.user.CreateUser)
		adminUserRoute.GET("/:id/detail", ctrls.user.GetUserDetail)
		adminUserRoute.PUT("/:id/status", ctrls.user.UpdateUserStatus)
		adminUserRoute.PUT("/:id/approve", ctrls.user.ApproveUser)
		adminUserRoute.PUT("/:id/resend-activation", ctrls.user.ResendUserActivation)
		adminUserRoute.PUT("/:id", ctrls.user.UpdateUser)
		adminUserRoute.POST("/:id/subscription", ctrls.user.AssignUserSubscription)
		adminUserRoute.DELETE("/:id/subscription", ctrls.user.RemoveUserSubscription)
		adminUserRoute.POST("/:id/impersonate", middleware.CriticalRateLimit(), ctrls.user.StartImpersonation)
		adminUserRoute.GET("/:id/erp-settings", ctrls.user.GetERPUserSetting)
		adminUserRoute.PUT("/:id/erp-settings", ctrls.user.SaveERPUserSetting)
		adminUserRoute.DELETE("/:id", ctrls.user.DeleteUser)
	}
	moduleProfiles := rg.Group("/module-profiles")
	moduleProfiles.Use(middleware.AdminAuth())
	{
		moduleProfiles.GET("", ctrls.user.ListModuleProfiles)
		moduleProfiles.POST("", ctrls.user.CreateModuleProfile)
		moduleProfiles.PUT("/:id", ctrls.user.UpdateModuleProfile)
		moduleProfiles.DELETE("/:id", ctrls.user.DeleteModuleProfile)
	}

	// Files Management
	fileRoute := rg.Group("/file")
	fileRoute.Use(middleware.AdminAuth())
	{
		fileRoute.GET("", controller.GetAllFiles)
		fileRoute.GET("/search", controller.SearchFiles)
		fileRoute.GET("/download/:file", controller.DownloadFile)
		fileRoute.POST("", middleware.MaxSizeMiddleware(25*1024*1024), middleware.UploadRateLimit(), controller.UploadFile)
		fileRoute.DELETE("/:id", controller.DeleteFile)
	}
	rg.GET("/files/download/:file", middleware.UserAuth(), controller.DownloadFile)

	// Templates
	templateRoute := rg.Group("/templates")
	templateRoute.Use(middleware.UserAuth())
	{
		templateRoute.GET("", ctrls.template.FindAllTemplates)
		templateRoute.GET("/:id", ctrls.template.FindOneTemplate)
		templateRoute.POST("", ctrls.template.CreateTemplate)
		templateRoute.PUT("/:id", ctrls.template.UpdateTemplate)
		templateRoute.DELETE("/:id", ctrls.template.DeleteTemplate)
	}

	// Audit Logs
	auditRouter := rg.Group("/audit-logs")
	auditRouter.Use(middleware.RootAuth(), middleware.CriticalRateLimit())
	{
		auditRouter.GET("", ctrls.auditLog.GetLogs)
	}

	// SES Callback Admin Logs
	sesLogsRoute := rg.Group("/ses-logs")
	sesLogsRoute.Use(middleware.UserAuth())
	{
		sesLogsRoute.GET("", ctrls.sesWebhook.GetCallbackLogs)
		sesLogsRoute.GET("/stats", ctrls.sesWebhook.GetCallbackStats)
		sesLogsRoute.GET("/:id", ctrls.sesWebhook.GetCallbackLogByID)
	}

	// Bulk Email Broadcast
	adminRoute := rg.Group("/email")
	adminRoute.Use(middleware.AdminAuth())
	{
		adminRoute.POST("/send-broadcast", ctrls.bulkEmail.SendBulkEmail)
	}
}
