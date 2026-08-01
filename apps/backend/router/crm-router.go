package router

import (
	crmcontroller "gin-template/controller/crm"
	"gin-template/middleware"

	"github.com/gin-gonic/gin"
)

func registerCRMRoutes(rg *gin.RouterGroup) {
	controller := crmcontroller.NewController()
	crm := rg.Group("/crm")
	// Public capture is intended for tenant websites and landing pages. It is
	// still tenant-resolved and rate-limited by the parent API middleware.
	crm.POST("/capture", middleware.CriticalRateLimit(), controller.CaptureLead)
	crm.GET("/webhooks/:provider", middleware.CriticalRateLimit(), controller.VerifyAdWebhook)
	crm.POST("/webhooks/:provider", middleware.CriticalRateLimit(), controller.ReceiveAdWebhook)

	protected := crm.Group("")
	protected.Use(middleware.UserAuth())
	{
		protected.GET("/dashboard", controller.Dashboard)
		protected.POST("/leads/import", middleware.MaxSizeMiddleware(10*1024*1024), controller.ImportLeads)
		protected.GET("/automation", controller.GetAutomation)
		protected.PUT("/automation", controller.UpdateAutomation)
		protected.GET("/:resource", controller.List)
		protected.POST("/:resource", controller.Create)
		protected.GET("/:resource/:id", controller.Get)
		protected.PATCH("/:resource/:id", controller.Update)
		protected.DELETE("/:resource/:id", controller.Delete)
	}

	integrations := crm.Group("/integrations")
	integrations.Use(middleware.AdminAuth())
	{
		integrations.GET("", controller.ListIntegrations)
		integrations.PUT("/:provider", controller.UpdateIntegration)
	}
}
