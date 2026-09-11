package accounting

import (
	"gin-template/middleware"
	"gin-template/modules/accounting/controller"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(parent *gin.RouterGroup) {
	handler := controller.NewAccountController()
	group := parent.Group("/accounting")
	group.Use(middleware.AdminAuth())
	{
		group.GET("/account-options", handler.Options)
		group.GET("/accounts", handler.List)
		group.POST("/accounts", handler.Create)
		group.PUT("/accounts/:id", handler.Update)
		group.DELETE("/accounts/:id", handler.Delete)
	}
}
