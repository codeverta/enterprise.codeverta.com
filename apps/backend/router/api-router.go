package router

import (
	"context"
	"database/sql"
	"gin-template/common"
	"gin-template/controller"
	"gin-template/internal/platform/adminauth"
	platformhttp "gin-template/internal/platform/httpapi"
	"gin-template/internal/platform/provisioning"
	"gin-template/internal/tenancy"
	"gin-template/middleware"
	"gin-template/model"
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
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

func SetApiRouter(router *gin.Engine, db *gorm.DB) {
	logger, _ := zap.NewProduction()
	databasePerTenant := strings.EqualFold(strings.TrimSpace(os.Getenv("TENANCY_MODE")), "database-per-tenant")
	if !databasePerTenant {
		middleware.RegisterTenantPlugin(db)
		middleware.RegisterAuditPlugin(db)
	}
	legacyTenantMid := &middleware.TenantMiddleware{DB: db, Redis: common.RDB}
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
		country:        controller.NewCountryController(),
		currency:       controller.NewCurrencyController(db),
		globalDefaults: controller.NewGlobalDefaultsController(db),
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

	var resolveTenant gin.HandlerFunc
	var platformAPI *platformhttp.Controller
	var platformAuth *adminauth.Service
	if databasePerTenant {
		cipher, err := tenancy.NewCredentialCipher(os.Getenv("TENANT_CREDENTIAL_KEY"))
		if err != nil {
			panic("TENANT_CREDENTIAL_KEY must be a base64 encoded 32-byte key in database-per-tenant mode")
		}
		registry := tenancy.NewRegistry(db, durationEnv("TENANT_REGISTRY_CACHE_TTL", 5*time.Minute))
		if err := registry.Migrate(); err != nil {
			panic("failed to migrate platform tenant registry: " + err.Error())
		}
		databaseManager := tenancy.NewDatabaseManager(cipher, tenancy.PoolConfig{
			MaxOpenConns:    intEnv("TENANT_DB_MAX_OPEN_CONNS", 20),
			MaxIdleConns:    intEnv("TENANT_DB_MAX_IDLE_CONNS", 5),
			ConnMaxLifetime: durationEnv("TENANT_DB_CONN_MAX_LIFETIME", 30*time.Minute),
			ConnMaxIdleTime: durationEnv("TENANT_DB_CONN_MAX_IDLE_TIME", 5*time.Minute),
			IdlePoolTTL:     durationEnv("TENANT_DB_IDLE_POOL_TTL", 15*time.Minute),
		})
		databaseManager.SetOnOpen(middleware.RegisterAuditPlugin)
		resolveTenant = tenancy.NewMiddleware(registry, databaseManager).Resolve()
		platformAuth, err = adminauth.New(db, os.Getenv("PLATFORM_JWT_SECRET"))
		if err != nil {
			panic(err)
		}
		adminDSN := strings.TrimSpace(os.Getenv("TENANT_DB_ADMIN_DSN"))
		if adminDSN == "" {
			panic("TENANT_DB_ADMIN_DSN is required in database-per-tenant mode")
		}
		provisioningDB, err := sql.Open("mysql", adminDSN)
		if err != nil {
			panic("failed to initialize tenant database provisioner: " + err.Error())
		}
		provisionService := provisioning.NewService(registry, databaseManager, cipher, provisioning.MySQLProvisioner{Admin: provisioningDB},
			func(_ context.Context, tenantDB *gorm.DB) error { return model.MigrateTenantSchema(tenantDB) },
			func(ctx context.Context, tenantDB *gorm.DB, tenant tenancy.Record, request provisioning.Request) error {
				return model.BootstrapTenantAdmin(ctx, tenantDB, tenant, request.AdminEmail, request.AdminPassword)
			}, envString("TENANT_DB_HOST", "mysql"), uint16(intEnv("TENANT_DB_PORT", 3306)), envString("TENANT_PLATFORM_DOMAIN_SUFFIX", "erp.example.com"))
		platformAPI = &platformhttp.Controller{Auth: platformAuth, Registry: registry, Databases: databaseManager, Provision: provisionService, Migrate: func(_ context.Context, tenantDB *gorm.DB) error {
			return model.MigrateTenantSchema(tenantDB)
		}}
	} else {
		resolveTenant = legacyTenantMid.TenantResolver()
	}

	// Legacy mode preserves the old platform endpoints. In database-per-tenant
	// mode tenant authentication is hostname-scoped like all ERP endpoints.
	if databasePerTenant {
		platformHost := strings.TrimSpace(os.Getenv("PLATFORM_ADMIN_HOST"))
		if platformHost == "" {
			panic("PLATFORM_ADMIN_HOST is required in database-per-tenant mode")
		}
		platform := apiRouter.Group("/platform")
		platform.Use(adminauth.RequireHost(platformHost))
		platform.POST("/auth/login", middleware.CriticalRateLimit(), platformAPI.Login)
		platformProtected := platform.Group("")
		platformProtected.Use(platformAuth.Authenticate(), middleware.CriticalRateLimit())
		platformProtected.GET("/tenants", platformAPI.ListTenants)
		platformProtected.POST("/tenants", platformAPI.CreateTenant)
		platformProtected.PATCH("/tenants/:slug/status", platformAPI.SetTenantState)
		platformProtected.GET("/tenants/:slug/health", platformAPI.Health)
		platformProtected.POST("/tenants/:slug/migrate", platformAPI.MigrateTenant)
		platformProtected.POST("/tenants/:slug/domains", platformAPI.BeginDomainVerification)
		platformProtected.POST("/tenants/:slug/domains/:domain/verify", platformAPI.VerifyDomain)

		tenantAuth := apiRouter.Group("")
		tenantAuth.Use(resolveTenant, tenantModelContextBridge())
		registerTenantAuthRoutes(tenantAuth, ctrls)
	} else {
		registerAuthRoutes(apiRouter, ctrls)
	}

	// Legacy webhooks use the former shared business database. They are not
	// mounted in strict mode until provider-account -> tenant mapping is stored
	// in platform_db; silently running them against platform_db would be unsafe.
	if !databasePerTenant {
		apiRouter.POST("/xendit/webhook", ctrls.payment.XenditWebhook)
		apiRouter.POST("/webhooks/dispatcher", gin.WrapF(controller.HandleWebhook(db, os.Getenv("DISPATCHER_WEBHOOK_SECRET"))))
	}

	tenantGroup := apiRouter.Group("")
	tenantGroup.Use(resolveTenant, tenantModelContextBridge())
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

		// Global Defaults
		globalDefaultsRoute := tenantGroup.Group("/global-defaults")
		{
			globalDefaultsRoute.GET("", ctrls.globalDefaults.Get)
			globalDefaultsRoute.GET("/:id", ctrls.globalDefaults.Get)
			globalDefaultsRoute.PUT("", middleware.AdminAuth(), ctrls.globalDefaults.Update)
			globalDefaultsRoute.PUT("/:id", middleware.AdminAuth(), ctrls.globalDefaults.Update)
			globalDefaultsRoute.POST("", middleware.AdminAuth(), ctrls.globalDefaults.Update)
		}

		// System Settings
		systemSettingsRoute := tenantGroup.Group("/system-settings")
		{
			systemSettingsRoute.GET("", ctrls.setting.GetSettings)
			systemSettingsRoute.GET("/:id", ctrls.setting.GetSettings)
			systemSettingsRoute.PUT("", middleware.AdminAuth(), ctrls.setting.UpdateSettings)
			systemSettingsRoute.PUT("/:id", middleware.AdminAuth(), ctrls.setting.UpdateSettings)
			systemSettingsRoute.POST("", middleware.AdminAuth(), ctrls.setting.UpdateSettings)
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

func intEnv(name string, fallback int) int {
	value, err := strconv.Atoi(strings.TrimSpace(os.Getenv(name)))
	if err != nil || value <= 0 {
		return fallback
	}
	return value
}

func durationEnv(name string, fallback time.Duration) time.Duration {
	value, err := time.ParseDuration(strings.TrimSpace(os.Getenv(name)))
	if err != nil || value <= 0 {
		return fallback
	}
	return value
}

func envString(name, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(name)); value != "" {
		return value
	}
	return fallback
}

// tenantModelContextBridge keeps existing model hooks working while the codebase
// is incrementally moved from tenant_id scoping to physical database isolation.
func tenantModelContextBridge() gin.HandlerFunc {
	return func(c *gin.Context) {
		safe, scoped := tenancy.FromContext(c.Request.Context())
		db, dbErr := tenancy.DBFromContext(c.Request.Context())
		if !scoped || dbErr != nil {
			c.Next()
			return
		}
		legacy := model.Tenant{ID: safe.ID, Name: safe.Slug, Domain: safe.Domain, IsActive: safe.Status == tenancy.StatusActive || safe.Status == tenancy.StatusTrial}
		ctx := context.WithValue(c.Request.Context(), common.CtxTenantKey, legacy)
		ctx = tenancy.WithScope(ctx, safe, db.WithContext(ctx))
		c.Request = c.Request.WithContext(ctx)
		c.Set("db", db.WithContext(ctx))
		c.Set(common.CtxTenantKey, legacy)
		c.Next()
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
	country        *controller.CountryController
	currency       *controller.CurrencyController
	globalDefaults *controller.GlobalDefaultsController
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
