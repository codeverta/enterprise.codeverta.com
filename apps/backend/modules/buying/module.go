package buying

import (
	"gin-template/middleware"
	"gin-template/modules/buying/controller"

	"github.com/gin-gonic/gin"
)

// RegisterRoutes is the single HTTP entry point for the isolated Buying module.
func RegisterRoutes(parent *gin.RouterGroup) {
	handler := controller.NewPurchaseOrderController()
	invoiceHandler := controller.NewPurchaseInvoiceController()
	group := parent.Group("/buying")
	group.Use(middleware.AdminAuth())
	{
		group.GET("/purchase-orders/options", handler.Options)
		group.GET("/purchase-orders", handler.List)
		group.POST("/purchase-orders", handler.Create)
		group.GET("/purchase-orders/:id", handler.Get)
		group.PUT("/purchase-orders/:id", handler.Update)
		group.POST("/purchase-orders/:id/submit", handler.Submit)
		group.DELETE("/purchase-orders/:id", handler.Delete)
		group.GET("/purchase-invoices/options", invoiceHandler.Options)
		group.GET("/purchase-invoices", invoiceHandler.List)
		group.POST("/purchase-invoices", invoiceHandler.Create)
		group.GET("/purchase-invoices/:id", invoiceHandler.Get)
		group.PUT("/purchase-invoices/:id", invoiceHandler.Update)
		group.POST("/purchase-invoices/:id/submit", invoiceHandler.Submit)
		group.DELETE("/purchase-invoices/:id", invoiceHandler.Delete)
	}
}
