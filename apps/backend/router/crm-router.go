package router

import (
	crmcontroller "gin-template/controller/crm"
	"gin-template/middleware"

	"github.com/gin-gonic/gin"
)

func registerCRMRoutes(rg *gin.RouterGroup) {
	controller := crmcontroller.NewController()
	crm := rg.Group("/crm")
	crm.Use(middleware.UserAuth())
	{
		crm.GET("/:resource", controller.List)
		crm.POST("/:resource", controller.Create)
		crm.GET("/:resource/:id", controller.Get)
		crm.PATCH("/:resource/:id", controller.Update)
		crm.DELETE("/:resource/:id", controller.Delete)
	}
}
