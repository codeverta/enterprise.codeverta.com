package router

import (
	"gin-template/common"
	"gin-template/controller"
	"gin-template/middleware"
	accountingmodule "gin-template/modules/accounting"
	buyingmodule "gin-template/modules/buying"
	frameworkmodule "gin-template/modules/framework"
	hrmodule "gin-template/modules/hr"
	manufacturingmodule "gin-template/modules/manufacturing"
	printingmodule "gin-template/modules/printing"
	projectsmodule "gin-template/modules/projects"
	sellingmodule "gin-template/modules/selling"
	stockmodule "gin-template/modules/stock"
	"gin-template/repository"
	"gin-template/services"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

func SetApiRouter(router *gin.Engine, db *gorm.DB) {
	logger, _ := zap.NewProduction()
	middleware.RegisterTenantPlugin(db)
	middleware.RegisterAuditPlugin(db)
	tenantMid := &middleware.TenantMiddleware{DB: db, Redis: common.RDB}
	secretID := os.Getenv("TENCENTCLOUD_SECRET_ID")
	secretKey := os.Getenv("TENCENTCLOUD_SECRET_KEY")
	region := "ap-singapore"

	// Root Landing Page Route
	htmlContent := `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Document</title></head><body><div style="text-align: center; margin-top: 20%;">developed by <a href="http://bikinwebsitejogja.com" target="_blank" rel="noopener noreferrer">bikinwebsitejogja.com</a></div></body></html>`
	router.GET("/", func(c *gin.Context) {
		c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(htmlContent))
	})

	// Repositories & Services
	promoRepo := repository.NewPromoRepository(db)
	dashboardRepo := repository.NewDashboardRepository(db)
	participantDashboardRepo := repository.NewParticipantStatRepository(db)

	var sesService *services.SESService
	if strings.EqualFold(os.Getenv("OFFLINE_MODE"), "true") {
		sesService = services.NewOfflineSESService(logger)
	} else {
		if secretID == "" || secretKey == "" {
			panic("TENCENTCLOUD_SECRET_ID atau TENCENTCLOUD_SECRET_KEY tidak ditemukan di env")
		}
		var err error
		sesService, err = services.NewSESService(secretID, secretKey, region, logger)
		if err != nil {
			panic("Gagal init Tencent Service: " + err.Error())
		}
	}
	promoService := services.NewPromoService(promoRepo)

	// Controllers Initialization
	ctrls := &controllerList{
		template:   controller.NewTemplateController(db, sesService),
		auditLog:   controller.NewAuditController(db),
		auth:       controller.NewAuthController(db),
		user:       controller.NewUserController(db),
		setting:    controller.NewSettingController(db, common.Logger),
		region:     controller.NewRegionController(db),
		tenant:     controller.NewTenantController(db),
		sesWebhook: controller.NewSESWebhookController(db, os.Getenv("DISCORD_WEBHOOK_URL")),
		promo:      controller.NewPromoController(promoService),

		bulkEmail:   controller.NewBulkEmailController(db),
		dashboard:   controller.NewDashboardController(dashboardRepo, participantDashboardRepo),
		core:        controller.NewCoreController(db),
		lms:         controller.NewLMSController(db),
		payment:     controller.NewPaymentXenditController(db, dashboardRepo, participantDashboardRepo),
		balance:     controller.NewBalanceWithdrawalController(db),
		walletAdmin: controller.NewWalletAdminController(db),
		ws:          controller.NewWebSocketController(db),
		country:     controller.NewCountryController(),
		currency:    controller.NewCurrencyController(db),
	}

	// Base API Group and Global Middlewares
	apiRouter := router.Group("/api")
	apiRouter.Use(middleware.GlobalAPIRateLimit(), middleware.MaxSizeMiddlewareExcept(
		50*1024,
		"/api/file",
		"/api/admin/upload-image",
		"/api/admin/upload-media",
		"/api/my-profile/avatar",
		"/api/crm/leads/import",
		"/api/crm/webhooks/",
		"/api/buying/items/upload-image",
	))

	// Register Sub-Modules Router
	registerAuthRoutes(apiRouter, ctrls)

	// Public Tenant Independent routes
	apiRouter.POST("/xendit/webhook", ctrls.payment.XenditWebhook)
	apiRouter.POST("/webhooks/dispatcher", gin.WrapF(controller.HandleWebhook(db, os.Getenv("DISPATCHER_WEBHOOK_SECRET"))))

	tenantGroup := apiRouter.Group("")
	tenantGroup.Use(tenantMid.TenantResolver())
	{
		registerPublicAndTenantRoutes(tenantGroup, ctrls)
		registerAdminRoutes(tenantGroup, ctrls)
		registerCoreRoutes(tenantGroup, ctrls)
		registerCoreProfileAndMediaRoutes(tenantGroup, ctrls)
		registerCRMRoutes(tenantGroup)
		accountingmodule.RegisterRoutes(tenantGroup)
		buyingmodule.RegisterRoutes(tenantGroup)
		hrmodule.RegisterRoutes(tenantGroup)
		manufacturingmodule.RegisterRoutes(tenantGroup)
		if err := frameworkmodule.RegisterRoutes(tenantGroup, db); err != nil {
			panic("Gagal mendaftarkan DocType framework: " + err.Error())
		}
		printingmodule.RegisterRoutes(tenantGroup)
		sellingmodule.RegisterRoutes(tenantGroup)
		stockmodule.RegisterRoutes(tenantGroup)
		projectsmodule.RegisterRoutes(tenantGroup)
		registerOrganizationRoutes(tenantGroup, db)

		// Countries (loaded directly from embedded countries.json, not DB)
		tenantGroup.GET("/countries", ctrls.country.List)
		tenantGroup.GET("/countries/:id", ctrls.country.Get)

		// Currencies (loaded from currencies table, with auto-seed and admin mutations)
		currencyRoute := tenantGroup.Group("/currencies")
		{
			currencyRoute.GET("", ctrls.currency.List)
			currencyRoute.GET("/:id", ctrls.currency.Get)
			currencyRoute.POST("", middleware.AdminAuth(), ctrls.currency.Create)
			currencyRoute.PUT("/:id", middleware.AdminAuth(), ctrls.currency.Update)
			currencyRoute.DELETE("/:id", middleware.AdminAuth(), ctrls.currency.Delete)
		}

		// Finance & Payout Settings
		financeRoute := tenantGroup.Group("/finance")
		financeRoute.Use(middleware.FinanceAuth())
		{
			financeRoute.GET("/summary", ctrls.balance.GetFinanceSummary)
			financeRoute.GET("/withdrawals", ctrls.balance.GetFinanceWithdrawals)
			financeRoute.GET("/transactions", ctrls.balance.GetFinanceTransactions)
			financeRoute.POST("/withdraw", ctrls.balance.CreateWithdrawal)
		}

		payoutRoute := tenantGroup.Group("/settings")
		payoutRoute.Use(middleware.FinanceAuth())
		{
			payoutRoute.GET("/payout", ctrls.balance.GetPayoutSetting)
			payoutRoute.POST("/payout", ctrls.balance.UpdatePayoutSetting)
		}
	}
}

// Struct helper untuk passing controller antar file router
type controllerList struct {
	template   *controller.TemplateController
	auditLog   *controller.AuditController
	auth       *controller.AuthController
	user       *controller.UserController
	setting    *controller.SettingController
	region     *controller.RegionController
	tenant     *controller.TenantController
	sesWebhook *controller.SESWebhookController
	promo      *controller.PromoController

	bulkEmail   *controller.BulkEmailController
	dashboard   *controller.DashboardController
	core        *controller.CoreController
	lms         *controller.LMSController
	payment     *controller.PaymentXenditController
	balance     *controller.BalanceWithdrawalController
	walletAdmin *controller.WalletAdminController
	ws          *controller.WebSocketController
	country     *controller.CountryController
	currency    *controller.CurrencyController
}

func registerOrganizationRoutes(rg *gin.RouterGroup, db *gorm.DB) {
	oc := controller.NewOrganizationController(db)
	org := rg.Group("/organization")
	org.Use(middleware.AdminAuth())
	{
		org.POST("/seed", oc.Seed)

		org.GET("/companies", oc.ListCompanies)
		org.GET("/company-context", oc.GetCompanyContext)
		org.POST("/company-context/select", oc.SelectCompany)
		org.POST("/companies", oc.CreateCompany)
		org.GET("/companies/:id", oc.GetCompany)
		org.PUT("/companies/:id", oc.UpdateCompany)
		org.DELETE("/companies/:id", oc.DeleteCompany)
		org.GET("/companies/:id/addresses", oc.ListCompanyAddresses)

		// Direct aliases for /companies and /companies/:id/addresses
		rg.GET("/companies", oc.ListCompanies)
		rg.GET("/companies/:id/addresses", oc.ListCompanyAddresses)

		org.GET("/branches", oc.ListBranches)
		org.POST("/branches", oc.CreateBranch)
		org.GET("/branches/:id", oc.GetBranch)
		org.PUT("/branches/:id", oc.UpdateBranch)
		org.DELETE("/branches/:id", oc.DeleteBranch)

		org.GET("/departments", oc.ListDepartments)
		org.POST("/departments", oc.CreateDepartment)
		org.GET("/departments/:id", oc.GetDepartment)
		org.PUT("/departments/:id", oc.UpdateDepartment)
		org.DELETE("/departments/:id", oc.DeleteDepartment)

		org.GET("/letter-heads", oc.ListLetterHeads)
		org.POST("/letter-heads", oc.CreateLetterHead)
		org.GET("/letter-heads/:id", oc.GetLetterHead)
		org.PUT("/letter-heads/:id", oc.UpdateLetterHead)
		org.DELETE("/letter-heads/:id", oc.DeleteLetterHead)
	}
}
