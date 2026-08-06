package stock

import (
	"gin-template/middleware"
	"gin-template/modules/stock/controller"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(parent *gin.RouterGroup) {
	shipmentHandler := controller.NewShipmentController()
	deliveryNoteHandler := controller.NewDeliveryNoteController()

	group := parent.Group("/stock")
	group.Use(middleware.AdminAuth())
	{
		group.GET("/shipments/options", shipmentHandler.Options)
		group.GET("/shipments", shipmentHandler.List)
		group.GET("/shipments/:id", shipmentHandler.Get)
		group.POST("/shipments", shipmentHandler.Create)
		group.PUT("/shipments/:id", shipmentHandler.Update)
		group.POST("/shipments/:id/submit", shipmentHandler.Submit)
		group.DELETE("/shipments/:id", shipmentHandler.Delete)

		group.GET("/delivery-notes/options", deliveryNoteHandler.Options)
		group.GET("/delivery-notes", deliveryNoteHandler.List)
		group.GET("/delivery-notes/:id", deliveryNoteHandler.Get)
		group.POST("/delivery-notes", deliveryNoteHandler.Create)
		group.PUT("/delivery-notes/:id", deliveryNoteHandler.Update)
		group.POST("/delivery-notes/:id/submit", deliveryNoteHandler.Submit)
		group.POST("/delivery-notes/:id/return", deliveryNoteHandler.CreateReturn)
		group.DELETE("/delivery-notes/:id", deliveryNoteHandler.Delete)
		group.GET("/stock-balances", deliveryNoteHandler.StockBalances)
	}
}
