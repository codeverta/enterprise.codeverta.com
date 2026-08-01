package router

import (
	"gin-template/common"
	"gin-template/controller"
	"gin-template/middleware"
	buyingmodule "gin-template/modules/buying"
	"gin-template/repository"
	"gin-template/services"
	"log"
	"net/http"
	"os"

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

	if secretID == "" || secretKey == "" {
		log.Fatal("Error: TENCENTCLOUD_SECRET_ID atau KEY tidak ditemukan di env")
	}

	// Root Landing Page Route
	htmlContent := `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Document</title></head><body><div style="text-align: center; margin-top: 20%;">developed by <a href="http://bikinwebsitejogja.com" target="_blank" rel="noopener noreferrer">bikinwebsitejogja.com</a></div></body></html>`
	router.GET("/", func(c *gin.Context) {
		c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(htmlContent))
	})

	// Repositories & Services
	promoRepo := repository.NewPromoRepository(db)
	dashboardRepo := repository.NewDashboardRepository(db)
	participantDashboardRepo := repository.NewParticipantStatRepository(db)

	sesService, err := services.NewSESService(secretID, secretKey, region, logger)
	if err != nil {
		log.Fatal("Gagal init Tencent Service:", err)
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
		buyingmodule.RegisterRoutes(tenantGroup)

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
}
