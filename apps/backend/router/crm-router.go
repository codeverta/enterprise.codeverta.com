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
		protected.GET("/directory/accounts", controller.ListAccounts)
		protected.POST("/directory/accounts", controller.CreateAccount)
		protected.PATCH("/directory/accounts/:id", controller.UpdateAccount)
		protected.DELETE("/directory/accounts/:id", controller.DeleteAccount)
		protected.GET("/directory/contacts", controller.ListContacts)
		protected.POST("/directory/contacts", controller.CreateContact)
		protected.PATCH("/directory/contacts/:id", controller.UpdateContact)
		protected.DELETE("/directory/contacts/:id", controller.DeleteContact)
		protected.GET("/directory/:kind/:id/interactions", controller.ListInteractions)
		protected.POST("/directory/:kind/:id/interactions", controller.CreateInteraction)
		protected.GET("/pipeline", controller.GetPipeline)
		protected.POST("/pipeline/stages", controller.CreatePipelineStage)
		protected.PATCH("/pipeline/stages/:id", controller.UpdatePipelineStage)
		protected.DELETE("/pipeline/stages/:id", controller.DeletePipelineStage)
		protected.POST("/pipeline/opportunities", controller.CreateOpportunity)
		protected.PATCH("/pipeline/opportunities/:id", controller.UpdateOpportunity)
		protected.DELETE("/pipeline/opportunities/:id", controller.DeleteOpportunity)
		protected.POST("/pipeline/opportunities/:id/move", controller.MoveOpportunity)
		protected.GET("/pipeline/forecast", controller.SalesForecast)
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
