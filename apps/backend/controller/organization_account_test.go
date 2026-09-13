package controller

import (
	"context"
	"net/http"
	"testing"

	"gin-template/common"
	coremodel "gin-template/model"
	accountingmodel "gin-template/modules/accounting/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestCreateCompanySeedsChartOfAccounts(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open("file:company_accounts?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&coremodel.Tenant{}, &coremodel.Company{}, &accountingmodel.Account{}))

	tenant := coremodel.Tenant{ID: uuid.New(), Name: "Tenant Accounting", Domain: "accounting.local", IsActive: true}
	require.NoError(t, db.Create(&tenant).Error)

	controller := NewOrganizationController(db)
	router := gin.New()
	router.Use(func(ctx *gin.Context) {
		requestContext := context.WithValue(ctx.Request.Context(), common.CtxTenantKey, tenant)
		requestContext = context.WithValue(requestContext, "tenant_id", tenant.ID.String())
		ctx.Request = ctx.Request.WithContext(requestContext)
		ctx.Set("db", db.WithContext(requestContext))
		ctx.Set("tenant_id", tenant.ID.String())
		ctx.Next()
	})
	router.POST("/companies", controller.CreateCompany)

	response := performJSON(router, http.MethodPost, "/companies", `{
		"name":"PT NEW COMPANY",
		"abbreviation":"PNC",
		"currency":"USD",
		"is_active":true
	}`)
	require.Equal(t, http.StatusCreated, response.Code, response.Body.String())

	var company coremodel.Company
	require.NoError(t, db.Where("name = ?", "PT NEW COMPANY").First(&company).Error)
	var count int64
	require.NoError(t, db.Model(&accountingmodel.Account{}).Where("company_id = ?", company.ID.String()).Count(&count).Error)
	require.EqualValues(t, accountingmodel.DefaultAccountTemplateCount(), count)

	var account accountingmodel.Account
	require.NoError(t, db.Where("company_id = ? AND account_number = ?", company.ID.String(), "1121.001").First(&account).Error)
	require.Equal(t, "USD", account.AccountCurrency)
	require.Contains(t, account.AccountName, "PT NEW COMPANY")
}

func TestGetAndUpdateCompanyByNameWithTabsFields(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open("file:company_get_update?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&coremodel.Tenant{}, &coremodel.Company{}, &accountingmodel.Account{}))

	tenant := coremodel.Tenant{ID: uuid.New(), Name: "Tenant Org", Domain: "org.local", IsActive: true}
	require.NoError(t, db.Create(&tenant).Error)

	comp := coremodel.Company{
		ID:           uuid.New(),
		TenantID:     tenant.ID,
		Name:         "PT ZENIT TECHNOLOGY SOLUTION",
		Abbreviation: "PZTS",
		Currency:     "IDR",
		IsActive:     true,
	}
	require.NoError(t, db.Create(&comp).Error)

	controller := NewOrganizationController(db)
	router := gin.New()
	router.Use(func(ctx *gin.Context) {
		requestContext := context.WithValue(ctx.Request.Context(), common.CtxTenantKey, tenant)
		requestContext = context.WithValue(requestContext, "tenant_id", tenant.ID.String())
		ctx.Request = ctx.Request.WithContext(requestContext)
		ctx.Set("db", db.WithContext(requestContext))
		ctx.Next()
	})
	router.GET("/companies/:id", controller.GetCompany)
	router.PUT("/companies/:id", controller.UpdateCompany)

	// Fetch by company name
	getResp := performJSON(router, http.MethodGet, "/companies/PT%20ZENIT%20TECHNOLOGY%20SOLUTION", "")
	require.Equal(t, http.StatusOK, getResp.Code)
	require.Contains(t, getResp.Body.String(), "PT ZENIT TECHNOLOGY SOLUTION")

	// Update accounts and stock settings
	updateResp := performJSON(router, http.MethodPut, "/companies/PT%20ZENIT%20TECHNOLOGY%20SOLUTION", `{
		"name": "PT ZENIT TECHNOLOGY SOLUTION",
		"abbreviation": "PZTS",
		"currency": "IDR",
		"default_inventory_account": "1141.000 - Persediaan Barang - PZTS",
		"stock_adjustment_account": "5110.020 - Penyesuaian Stock - PZTS",
		"stock_received_but_not_billed": "2115.000 - Stock Diterima Tapi Tidak Ditagih - PZTS",
		"monthly_sales_target": 50000000,
		"accounts_frozen_till_date": "2026-12-31"
	}`)
	require.Equal(t, http.StatusOK, updateResp.Code)

	var updated coremodel.Company
	require.NoError(t, db.Where("name = ?", "PT ZENIT TECHNOLOGY SOLUTION").First(&updated).Error)
	require.Equal(t, "1141.000 - Persediaan Barang - PZTS", updated.DefaultInventoryAccount)
	require.Equal(t, "5110.020 - Penyesuaian Stock - PZTS", updated.StockAdjustmentAccount)
	require.Equal(t, "2115.000 - Stock Diterima Tapi Tidak Ditagih - PZTS", updated.StockReceivedButNotBilled)
	require.EqualValues(t, 50000000, updated.MonthlySalesTarget)
	require.Equal(t, "2026-12-31", updated.AccountsFrozenTillDate)
}
