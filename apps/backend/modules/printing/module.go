package printing

import (
	"gin-template/middleware"
	"gin-template/modules/printing/controller"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(parent *gin.RouterGroup) {
	handler := controller.NewPrintFormatController()
	group := parent.Group("/printing")
	group.Use(middleware.AdminAuth())
	{
		group.GET("/print-formats", handler.List)
		group.GET("/print-formats/:id", handler.Get)
		group.POST("/print-formats", handler.Create)
		group.PUT("/print-formats/:id", handler.Update)
		group.DELETE("/print-formats/:id", handler.Delete)
	}
}
