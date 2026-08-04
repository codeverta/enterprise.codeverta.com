package selling

import (
	"gin-template/middleware"
	"gin-template/modules/selling/controller"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(parent *gin.RouterGroup) {
	loyaltyHandler := controller.NewLoyaltyProgramController()
	posHandler := controller.NewPOSController()
	storeHandler := controller.NewStoreController()
	priceListHandler := controller.NewPriceListController()

	store := parent.Group("/store")
	{
		store.POST("/auth/register", middleware.CriticalRateLimit(), storeHandler.Register)
		store.GET("/categories", storeHandler.Categories)
		store.GET("/products", storeHandler.Products)
		store.GET("/products/:slug", storeHandler.Product)
	}
	storeAccount := store.Group("")
	storeAccount.Use(middleware.UserAuth())
	{
		storeAccount.GET("/me", storeHandler.Me)
		storeAccount.PUT("/me", storeHandler.UpdateMe)
		storeAccount.GET("/cart", storeHandler.Cart)
		storeAccount.POST("/cart/:productID", storeHandler.AddCart)
		storeAccount.PUT("/cart/:productID", storeHandler.UpdateCart)
		storeAccount.DELETE("/cart/:productID", storeHandler.RemoveCart)
		storeAccount.GET("/wishlist", storeHandler.Wishlist)
		storeAccount.POST("/wishlist/:productID", storeHandler.AddWishlist)
		storeAccount.DELETE("/wishlist/:productID", storeHandler.RemoveWishlist)
		storeAccount.GET("/orders", storeHandler.Orders)
		storeAccount.POST("/orders", storeHandler.CreateOrder)
	}

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
		group.GET("/pos/opening-entries", posHandler.OpeningEntries)
		group.GET("/pos/opening-entries/current", posHandler.CurrentOpening)
		group.POST("/pos/opening-entries", posHandler.CreateOpening)
		group.POST("/pos/opening-entries/:id/close", posHandler.CloseOpening)
		group.GET("/pos/closing-entries", posHandler.ClosingEntries)
		group.GET("/pos/invoices", posHandler.Invoices)
		group.POST("/pos/invoices", posHandler.CreateInvoice)
		group.GET("/price-lists", priceListHandler.ListPriceLists)
		group.GET("/price-lists/:id", priceListHandler.GetPriceList)
		group.POST("/price-lists", priceListHandler.CreatePriceList)
		group.PUT("/price-lists/:id", priceListHandler.UpdatePriceList)
		group.DELETE("/price-lists/:id", priceListHandler.DeletePriceList)
		group.GET("/item-prices", priceListHandler.ListItemPrices)
		group.GET("/item-prices/:id", priceListHandler.GetItemPrice)
		group.POST("/item-prices", priceListHandler.CreateItemPrice)
		group.PUT("/item-prices/:id", priceListHandler.UpdateItemPrice)
		group.DELETE("/item-prices/:id", priceListHandler.DeleteItemPrice)
	}
}
