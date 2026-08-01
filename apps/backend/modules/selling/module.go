package selling

import (
	"gin-template/middleware"
	"gin-template/modules/selling/controller"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(parent *gin.RouterGroup) {
	loyaltyHandler := controller.NewLoyaltyProgramController()

	group := parent.Group("/selling")
	group.Use(middleware.AdminAuth())
	{
		group.GET("/loyalty-programs/options", loyaltyHandler.Options)
		group.GET("/loyalty-programs", loyaltyHandler.List)
		group.POST("/loyalty-programs", loyaltyHandler.Create)
		group.GET("/loyalty-programs/:id", loyaltyHandler.Get)
		group.PUT("/loyalty-programs/:id", loyaltyHandler.Update)
		group.DELETE("/loyalty-programs/:id", loyaltyHandler.Delete)
		group.GET("/loyalty-point-entries", loyaltyHandler.EntriesList)
	}
}
