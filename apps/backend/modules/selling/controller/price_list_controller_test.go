package controller

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	coremodel "gin-template/model"
	sellingmodel "gin-template/modules/selling/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestPriceListSeedAndList(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open("file:"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{})
	assert.NoError(t, err)

	err = sellingmodel.Migrate(db)
	assert.NoError(t, err)

	coremodel.DB = db

	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("tenant_id", "test-pl-tenant")
		c.Next()
	})

	ctrl := NewPriceListController()
	r.GET("/price-lists", ctrl.ListPriceLists)
	r.POST("/price-lists/seed", ctrl.Seed)

	// 1. Calling seed should succeed
	reqSeed := httptest.NewRequest(http.MethodPost, "/price-lists/seed", nil)
	wSeed := httptest.NewRecorder()
	r.ServeHTTP(wSeed, reqSeed)
	assert.Equal(t, http.StatusOK, wSeed.Code)

	// 2. Calling list should return Standar Selling and Standar Buying
	reqList := httptest.NewRequest(http.MethodGet, "/price-lists", nil)
	wList := httptest.NewRecorder()
	r.ServeHTTP(wList, reqList)
	assert.Equal(t, http.StatusOK, wList.Code)

	var res struct {
		Data []sellingmodel.PriceList `json:"data"`
	}
	err = json.Unmarshal(wList.Body.Bytes(), &res)
	assert.NoError(t, err)
	assert.GreaterOrEqual(t, len(res.Data), 2)

	foundStandarSelling := false
	foundStandarBuying := false
	for _, pl := range res.Data {
		if pl.PriceListName == "Standar Selling" {
			foundStandarSelling = true
			assert.True(t, pl.Selling)
			assert.False(t, pl.Buying)
		}
		if pl.PriceListName == "Standar Buying" {
			foundStandarBuying = true
			assert.False(t, pl.Selling)
			assert.True(t, pl.Buying)
		}
	}
	assert.True(t, foundStandarSelling, "Standar Selling must be present")
	assert.True(t, foundStandarBuying, "Standar Buying must be present")
}

func TestCreateItemPriceWithDateStrings(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open("file:"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{})
	assert.NoError(t, err)

	err = sellingmodel.Migrate(db)
	assert.NoError(t, err)

	coremodel.DB = db

	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("tenant_id", "test-pl-tenant")
		c.Next()
	})

	ctrl := NewPriceListController()
	r.POST("/item-prices", ctrl.CreateItemPrice)

	payload := `{
		"item_code": "MK",
		"item_name": "Lilin Million Kecil",
		"price_list": "Standard Buying",
		"batch_no": "",
		"buying": true,
		"currency": "IDR",
		"is_active": true,
		"lead_time_days": 32,
		"note": "",
		"packing_unit": 1,
		"price_list_rate": 2000,
		"reference": "",
		"selling": true,
		"uom": "Nos",
		"valid_from": "2026-09-11",
		"valid_upto": "2026-09-18"
	}`

	req := httptest.NewRequest(http.MethodPost, "/item-prices", bytes.NewBufferString(payload))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)
	var created sellingmodel.ItemPrice
	err = json.Unmarshal(w.Body.Bytes(), &created)
	assert.NoError(t, err)
	assert.Equal(t, "MK", created.ItemCode)
	assert.Equal(t, "Standard Buying", created.PriceList)
	assert.Equal(t, 2000.0, created.PriceListRate)
	assert.NotNil(t, created.ValidFrom)
	assert.NotNil(t, created.ValidUpto)
}
