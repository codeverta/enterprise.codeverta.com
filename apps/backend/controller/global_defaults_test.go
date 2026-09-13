package controller

import (
	"context"
	"net/http"
	"testing"

	"gin-template/common"
	coremodel "gin-template/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestGlobalDefaultsGetAndLazyInit(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open("file:global_defaults_test?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&coremodel.Tenant{}, &coremodel.Company{}, &coremodel.GlobalDefaults{}))

	tenant := coremodel.Tenant{ID: uuid.New(), Name: "Global Defaults Tenant", Domain: "gd.local", IsActive: true}
	require.NoError(t, db.Create(&tenant).Error)

	company := coremodel.Company{
		ID:           uuid.New(),
		TenantID:     tenant.ID,
		Name:         "PT ZENIT TECHNOLOGY SOLUTION",
		Abbreviation: "PZTS",
		IsActive:     true,
	}
	require.NoError(t, db.Create(&company).Error)

	ctrl := NewGlobalDefaultsController(db)
	router := gin.New()
	router.Use(func(ctx *gin.Context) {
		requestContext := context.WithValue(ctx.Request.Context(), common.CtxTenantKey, tenant)
		requestContext = context.WithValue(requestContext, "tenant_id", tenant.ID.String())
		ctx.Request = ctx.Request.WithContext(requestContext)
		ctx.Set("db", db.WithContext(requestContext))
		ctx.Set(common.CtxTenantKey, tenant)
		ctx.Next()
	})
	router.GET("/global-defaults", ctrl.Get)
	router.PUT("/global-defaults", ctrl.Update)

	// First GET should lazy-initialize
	getResp := performJSON(router, http.MethodGet, "/global-defaults", "")
	require.Equal(t, http.StatusOK, getResp.Code)
	require.Contains(t, getResp.Body.String(), "PT ZENIT TECHNOLOGY SOLUTION")
	require.Contains(t, getResp.Body.String(), "Indonesia")
	require.Contains(t, getResp.Body.String(), "Kilometer")

	// Update settings
	updateResp := performJSON(router, http.MethodPut, "/global-defaults", `{
		"default_company": "PT ZENIT TECHNOLOGY SOLUTION",
		"country": "Indonesia",
		"default_distance_unit": "Meter",
		"default_currency": "USD",
		"hide_currency_symbol": "Yes",
		"disable_rounded_total": true,
		"disable_in_words": true,
		"use_posting_datetime_for_naming_documents": true
	}`)
	require.Equal(t, http.StatusOK, updateResp.Code)

	var saved coremodel.GlobalDefaults
	require.NoError(t, db.First(&saved).Error)
	require.Equal(t, "PT ZENIT TECHNOLOGY SOLUTION", saved.DefaultCompany)
	require.Equal(t, "Meter", saved.DefaultDistanceUnit)
	require.Equal(t, "USD", saved.DefaultCurrency)
	require.Equal(t, "Yes", saved.HideCurrencySymbol)
	require.True(t, saved.DisableRoundedTotal)
	require.True(t, saved.DisableInWords)
	require.True(t, saved.UsePostingDatetimeForNamingDocuments)
}
