package accounting

import (
	"gin-template/middleware"
	"gin-template/modules/accounting/controller"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(parent *gin.RouterGroup) {
	handler := controller.NewAccountController()
	bankingHandler := controller.NewBankingController()
	glHandler := controller.NewGLEntryController()
	group := parent.Group("/accounting")
	group.Use(middleware.AdminAuth())
	{
		group.GET("/account-options", handler.Options)
		group.GET("/accounts", handler.List)
		group.POST("/accounts", handler.Create)
		group.PUT("/accounts/:id", handler.Update)
		group.DELETE("/accounts/:id", handler.Delete)
		group.GET("/banks", bankingHandler.Banks)
		group.GET("/banks/:id", bankingHandler.Bank)
		group.POST("/banks", bankingHandler.CreateBank)
		group.PUT("/banks/:id", bankingHandler.UpdateBank)
		group.DELETE("/banks/:id", bankingHandler.DeleteBank)
		group.GET("/bank-accounts/options", bankingHandler.BankAccountOptions)
		group.GET("/bank-accounts", bankingHandler.BankAccounts)
		group.GET("/bank-accounts/:id", bankingHandler.BankAccount)
		group.POST("/bank-accounts", bankingHandler.CreateBankAccount)
		group.PUT("/bank-accounts/:id", bankingHandler.UpdateBankAccount)
		group.DELETE("/bank-accounts/:id", bankingHandler.DeleteBankAccount)
		group.GET("/bank-account-types", bankingHandler.BankAccountTypes)
		group.POST("/bank-account-types", bankingHandler.CreateBankAccountType)

		group.GET("/gl-entries", glHandler.List)
		group.GET("/gl-entries/options", glHandler.Options)
		group.GET("/gl-entries/:id", glHandler.Get)
		group.POST("/gl-entries", glHandler.Create)
		group.PUT("/gl-entries/:id", glHandler.Update)
		group.DELETE("/gl-entries/:id", glHandler.Delete)
	}
}
