package router

import (
	"gin-template/middleware"

	"github.com/gin-gonic/gin"
)

func registerPublicAndTenantRoutes(rg *gin.RouterGroup, ctrls *controllerList) {
	rg.GET("/ws/activity", ctrls.ws.HandleActivity)

	// User Self Routes
	userSelfRoute := rg.Group("/user")
	userSelfRoute.Use(middleware.UserAuth())
	{
		userSelfRoute.GET("/self", ctrls.user.GetSelf)
		userSelfRoute.PUT("/self", ctrls.user.UpdateSelf)
		userSelfRoute.DELETE("/self", ctrls.user.DeleteSelf)
		userSelfRoute.GET("/notifications", ctrls.user.GetMyNotifications)
		userSelfRoute.PUT("/notifications/:id/read", ctrls.user.MarkNotificationRead)
		userSelfRoute.PUT("/notifications/read-all", ctrls.user.MarkAllNotificationsRead)
		userSelfRoute.DELETE("/notifications/:id", ctrls.user.DeleteNotification)
	}

	// Promo Codes
	promoRouter := rg.Group("/promo-codes")
	promoRouter.Use(middleware.UserAuth())
	{
		promoRouter.POST("", ctrls.promo.CreatePromo)
		promoRouter.GET("", ctrls.promo.GetPromos)
		promoRouter.PUT("/:id", ctrls.promo.UpdatePromo)
		promoRouter.DELETE("/:id", ctrls.promo.ArchivePromo)
	}

	// Settings
	settingsRoute := rg.Group("/settings")
	{
		settingsRoute.GET("", middleware.PassiveAuth(), ctrls.setting.GetSettings)
		settingsRoute.GET("/admin", middleware.AdminAuth(), ctrls.setting.GetSettings)
		settingsRoute.PUT("", middleware.AdminAuth(), ctrls.setting.UpdateSettings)
	}

	// Public Webhooks
	webhookRoute := rg.Group("/webhooks")
	{
		webhookRoute.POST("/ses-callback", ctrls.sesWebhook.HandleSESCallback)
	}
}

func registerCoreRoutes(rg *gin.RouterGroup, ctrls *controllerList) {
	core := rg.Group("/core")
	core.Use(middleware.AdminAuth())
	{
		core.GET("/dashboard", ctrls.core.Dashboard)
	}

	orders := rg.Group("/orders")
	orders.Use(middleware.AdminAuth())
	{
		orders.GET("", ctrls.core.ListOrders)
		orders.POST("", ctrls.core.CreateOrder)
		orders.GET("/:id", ctrls.core.GetOrder)
		orders.PATCH("/:id/status", ctrls.core.UpdateOrderStatus)
	}

	// Subscription APIs keep their proven implementation while exposing a
	// product-neutral URL. A future ERP module can replace the implementation
	// without changing clients.
	rg.GET("/subscription-plans", ctrls.lms.ListSubscriptionPlans)
	rg.GET("/payment-methods", ctrls.lms.ListPaymentMethods)
	subscriptions := rg.Group("/subscriptions")
	subscriptions.Use(middleware.UserAuth())
	{
		subscriptions.GET("/my", ctrls.lms.ListMySubscriptions)
		subscriptions.POST("/checkout", ctrls.lms.CheckoutSubscription)
		subscriptions.GET("/payments/:id", ctrls.lms.GetSubscriptionPayment)
		subscriptions.POST("/:id/cancel", ctrls.lms.CancelSubscription)
	}
	subscriptionAdmin := rg.Group("/subscriptions/admin")
	subscriptionAdmin.Use(middleware.AdminAuth())
	{
		subscriptionAdmin.GET("/resources/:resource", ctrls.lms.ListAdminResource)
		subscriptionAdmin.POST("/resources/:resource", ctrls.lms.CreateAdminResource)
		subscriptionAdmin.PUT("/resources/:resource/:id", ctrls.lms.UpdateAdminResource)
		subscriptionAdmin.DELETE("/resources/:resource/:id", ctrls.lms.DeleteAdminResource)
		subscriptionAdmin.PUT("/:id/plan", ctrls.lms.MoveSubscriptionPlan)
	}
}

// registerCoreProfileAndMediaRoutes exposes generic profile and media
// capabilities without retaining the LMS namespace.
func registerCoreProfileAndMediaRoutes(rg *gin.RouterGroup, ctrls *controllerList) {
	profile := rg.Group("/my-profile")
	profile.Use(middleware.UserAuth())
	{
		profile.GET("", ctrls.lms.GetMyProfile)
		profile.PUT("", ctrls.lms.UpdateMyProfile)
		profile.POST("/avatar", middleware.MaxSizeMiddleware(5*1024*1024), middleware.UploadRateLimit(), ctrls.lms.UpdateMyAvatar)
	}

	media := rg.Group("/admin")
	media.Use(middleware.AdminAuth())
	{
		media.POST("/upload-image", middleware.MaxSizeMiddleware(10*1024*1024), middleware.UploadRateLimit(), ctrls.lms.UploadImage)
		media.POST("/upload-media", middleware.MaxSizeMiddleware(25*1024*1024), middleware.UploadRateLimit(), ctrls.lms.UploadMedia)
	}
}
