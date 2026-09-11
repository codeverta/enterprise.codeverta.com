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
