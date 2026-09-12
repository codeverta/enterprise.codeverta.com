package stock

import (
	"gin-template/middleware"
	"gin-template/modules/stock/controller"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(parent *gin.RouterGroup) {
	shipmentHandler := controller.NewShipmentController()
	deliveryNoteHandler := controller.NewDeliveryNoteController()
	uomHandler := controller.NewUOMController()
	warehouseHandler := controller.NewWarehouseController()
	stockEntryHandler := controller.NewStockEntryController()
	purchaseReceiptHandler := controller.NewPurchaseReceiptController()
	serialNoHandler := controller.NewSerialNoController()
	batchHandler := controller.NewBatchController()
	stockLedgerHandler := controller.NewStockLedgerController()
	stockEntryTypeHandler := controller.NewStockEntryTypeController()
	pickListHandler := controller.NewPickListController()
	brandHandler := controller.NewBrandController()

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

		group.GET("/uoms", uomHandler.List)
		group.GET("/uoms/:id", uomHandler.Get)
		group.POST("/uoms", uomHandler.Create)
		group.PUT("/uoms/:id", uomHandler.Update)
		group.DELETE("/uoms/:id", uomHandler.Delete)
		group.POST("/uoms/seed", uomHandler.Seed)

		group.GET("/brands", brandHandler.List)
		group.GET("/brands/:id", brandHandler.Get)
		group.POST("/brands", brandHandler.Create)
		group.DELETE("/brands/:id", brandHandler.Delete)

		group.GET("/warehouses", warehouseHandler.List)
		group.GET("/warehouses/tree", warehouseHandler.Tree)
		group.GET("/warehouses/:id", warehouseHandler.Get)
		group.POST("/warehouses", warehouseHandler.Create)
		group.PUT("/warehouses/:id", warehouseHandler.Update)
		group.DELETE("/warehouses/:id", warehouseHandler.Delete)
		group.POST("/warehouses/seed", warehouseHandler.Seed)

		group.GET("/stock-entries/options", stockEntryHandler.Options)
		group.GET("/stock-entries", stockEntryHandler.List)
		group.GET("/stock-entries/:id", stockEntryHandler.Get)
		group.POST("/stock-entries", stockEntryHandler.Create)
		group.PUT("/stock-entries/:id", stockEntryHandler.Update)
		group.POST("/stock-entries/:id/submit", stockEntryHandler.Submit)
		group.POST("/stock-entries/:id/cancel", stockEntryHandler.Cancel)
		group.DELETE("/stock-entries/:id", stockEntryHandler.Delete)

		group.GET("/purchase-receipts/options", purchaseReceiptHandler.Options)
		group.GET("/purchase-receipts", purchaseReceiptHandler.List)
		group.GET("/purchase-receipts/:id", purchaseReceiptHandler.Get)
		group.POST("/purchase-receipts", purchaseReceiptHandler.Create)
		group.PUT("/purchase-receipts/:id", purchaseReceiptHandler.Update)
		group.POST("/purchase-receipts/:id/submit", purchaseReceiptHandler.Submit)
		group.POST("/purchase-receipts/:id/cancel", purchaseReceiptHandler.Cancel)
		group.DELETE("/purchase-receipts/:id", purchaseReceiptHandler.Delete)

		group.GET("/serial-nos/options", serialNoHandler.Options)
		group.GET("/serial-nos", serialNoHandler.List)
		group.GET("/serial-nos/:id", serialNoHandler.Get)
		group.POST("/serial-nos", serialNoHandler.Create)
		group.PUT("/serial-nos/:id", serialNoHandler.Update)
		group.DELETE("/serial-nos/:id", serialNoHandler.Delete)

		group.GET("/batches/options", batchHandler.Options)
		group.GET("/batches", batchHandler.List)
		group.GET("/batches/:id", batchHandler.Get)
		group.POST("/batches", batchHandler.Create)
		group.PUT("/batches/:id", batchHandler.Update)
		group.DELETE("/batches/:id", batchHandler.Delete)

		group.GET("/stock-ledger/options", stockLedgerHandler.Options)
		group.GET("/stock-ledger", stockLedgerHandler.List)

		group.GET("/stock-entry-types/purposes", stockEntryTypeHandler.Purposes)
		group.GET("/stock-entry-types", stockEntryTypeHandler.List)
		group.GET("/stock-entry-types/:id", stockEntryTypeHandler.Get)
		group.POST("/stock-entry-types", stockEntryTypeHandler.Create)
		group.PUT("/stock-entry-types/:id", stockEntryTypeHandler.Update)
		group.DELETE("/stock-entry-types/:id", stockEntryTypeHandler.Delete)
		group.POST("/stock-entry-types/seed", stockEntryTypeHandler.Seed)

		group.GET("/pick-lists/options", pickListHandler.Options)
		group.GET("/pick-lists/pending-references", pickListHandler.GetPendingReferences)
		group.POST("/pick-lists/get-item-locations", pickListHandler.GetItemLocations)
		group.GET("/pick-lists", pickListHandler.List)
		group.GET("/pick-lists/:id", pickListHandler.Get)
		group.POST("/pick-lists", pickListHandler.Create)
		group.PUT("/pick-lists/:id", pickListHandler.Update)
		group.DELETE("/pick-lists/:id", pickListHandler.Delete)
		group.POST("/pick-lists/:id/submit", pickListHandler.Submit)
		group.POST("/pick-lists/:id/cancel", pickListHandler.Cancel)
	}
}
