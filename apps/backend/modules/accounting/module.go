package accounting

import (
	"gin-template/middleware"
	"gin-template/modules/accounting/controller"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(parent *gin.RouterGroup) {
	handler := controller.NewAccountController()
	glHandler := controller.NewGLEntryController()
	group := parent.Group("/accounting")
	group.Use(middleware.AdminAuth())
	{
		group.GET("/account-options", handler.Options)
		group.GET("/accounts", handler.List)
		group.POST("/accounts", handler.Create)
		group.PUT("/accounts/:id", handler.Update)
		group.DELETE("/accounts/:id", handler.Delete)

		group.GET("/gl-entries", glHandler.List)
		group.GET("/gl-entries/options", glHandler.Options)
		group.GET("/gl-entries/:id", glHandler.Get)
		group.POST("/gl-entries", glHandler.Create)
		group.PUT("/gl-entries/:id", glHandler.Update)
		group.DELETE("/gl-entries/:id", glHandler.Delete)
	}
}
