package controller

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	coremodel "gin-template/model"
	buyingmodel "gin-template/modules/buying/model"
	sellingmodel "gin-template/modules/selling/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupPOSTestRouter(t *testing.T) (*gin.Engine, *gorm.DB) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open("file:"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{})
	assert.NoError(t, err)

	err = sellingmodel.Migrate(db)
	assert.NoError(t, err)

	err = buyingmodel.Migrate(db)
	assert.NoError(t, err)

	err = db.AutoMigrate(&coremodel.Company{}, &coremodel.User{})
	assert.NoError(t, err)

	comp := coremodel.Company{
		ID:           uuid.MustParse("33333333-3333-3333-3333-333333333333"),
		Name:         "UD MILLION CANDLES",
		Abbreviation: "MC",
		IsActive:     true,
	}
	_ = db.Create(&comp)

	u := coremodel.User{
		ID:          uuid.MustParse("44444444-4444-4444-4444-444444444444"),
		Username:    "Administrator",
		DisplayName: "Administrator",
		Email:       "admin@candles.com",
	}
	_ = db.Create(&u)

	coremodel.DB = db

	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("tenant_id", "test-pos-tenant")
		c.Next()
	})

	posCtrl := NewPOSController()
	posProfCtrl := NewPOSProfileController()

	r.GET("/pos-profiles/options", posProfCtrl.Options)
	r.GET("/pos-profiles", posProfCtrl.List)
	r.POST("/pos-profiles", posProfCtrl.Create)
	r.GET("/pos-profiles/:id", posProfCtrl.Get)
	r.PUT("/pos-profiles/:id", posProfCtrl.Update)
	r.DELETE("/pos-profiles/:id", posProfCtrl.Delete)

	r.GET("/pos/items", posCtrl.Items)
	r.POST("/pos/invoices", posCtrl.CreateInvoice)
	r.GET("/pos/opening-entries", posCtrl.OpeningEntries)
	r.GET("/pos/opening-entries/current", posCtrl.CurrentOpening)
	r.GET("/pos/opening-entries/:id", posCtrl.GetOpeningEntry)
	r.POST("/pos/opening-entries", posCtrl.CreateOpening)
	r.POST("/pos/opening-entries/:id/close", posCtrl.CloseOpening)
	r.GET("/pos/closing-entries", posCtrl.ClosingEntries)
	r.GET("/pos/closing-entries/:id", posCtrl.GetClosingEntry)

	return r, db
}

func TestPOSProfileAndOpeningClosingFlow(t *testing.T) {
	router, _ := setupPOSTestRouter(t)

	// 1. POS Profile Options
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/pos-profiles/options", nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	// 2. POS Profile List (auto-seeds default if empty)
	w = httptest.NewRecorder()
	req, _ = http.NewRequest(http.MethodGet, "/pos-profiles", nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	var profListResp struct {
		Data []sellingmodel.POSProfile `json:"data"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &profListResp)
	assert.NotEmpty(t, profListResp.Data)
	assert.Equal(t, "Usaha Jualan Lilin", profListResp.Data[0].Name)

	// 3. Create POS Opening Entry
	openPayload := map[string]any{
		"company":           "UD MILLION CANDLES",
		"pos_profile":       "Usaha Jualan Lilin",
		"user":              "Administrator",
		"period_start_date": time.Now(),
		"posting_date":      time.Now(),
		"balance_details": []map[string]any{
			{"mode_of_payment": "Cash", "opening_amount": 100000},
			{"mode_of_payment": "Bank Transfer", "opening_amount": 0},
		},
	}
	openBody, _ := json.Marshal(openPayload)
	w = httptest.NewRecorder()
	req, _ = http.NewRequest(http.MethodPost, "/pos/opening-entries", bytes.NewReader(openBody))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusCreated, w.Code)

	var createdOpening sellingmodel.POSOpeningEntry
	err := json.Unmarshal(w.Body.Bytes(), &createdOpening)
	assert.NoError(t, err)
	assert.Equal(t, sellingmodel.POSOpeningStatusOpen, createdOpening.Status)
	assert.Equal(t, 100000.0, createdOpening.OpeningBalanceTotal)

	// 4. Check Current Opening
	w = httptest.NewRecorder()
	req, _ = http.NewRequest(http.MethodGet, "/pos/opening-entries/current", nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	// 5. Close Opening Entry (POS Closing Entry)
	closePayload := map[string]any{
		"closing_amounts": map[string]float64{
			"Cash":          100000,
			"Bank Transfer": 50000,
		},
	}
	closeBody, _ := json.Marshal(closePayload)
	w = httptest.NewRecorder()
	req, _ = http.NewRequest(http.MethodPost, "/pos/opening-entries/"+createdOpening.ID+"/close", bytes.NewReader(closeBody))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusCreated, w.Code)

	var createdClosing sellingmodel.POSClosingEntry
	err = json.Unmarshal(w.Body.Bytes(), &createdClosing)
	assert.NoError(t, err)
	assert.Equal(t, "UD MILLION CANDLES", createdClosing.Company)
	assert.Equal(t, "Usaha Jualan Lilin", createdClosing.POSProfile)
	assert.Equal(t, "Administrator", createdClosing.User)
	assert.NotEmpty(t, createdClosing.Reconciliations)

	// 6. Get Closing Detail
	w = httptest.NewRecorder()
	req, _ = http.NewRequest(http.MethodGet, "/pos/closing-entries/"+createdClosing.ID, nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestPOSClosingLinkedSalesInvoices(t *testing.T) {
	router, db := setupPOSTestRouter(t)

	// 1. Create Opening
	openPayload := map[string]any{
		"company":           "UD MILLION CANDLES",
		"pos_profile":       "Usaha Jualan Lilin",
		"user":              "Administrator",
		"period_start_date": time.Now(),
		"posting_date":      time.Now(),
		"balance_details": []map[string]any{
			{"mode_of_payment": "Cash", "opening_amount": 0},
		},
	}
	openBody, _ := json.Marshal(openPayload)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/pos/opening-entries", bytes.NewReader(openBody))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusCreated, w.Code)

	var opening sellingmodel.POSOpeningEntry
	_ = json.Unmarshal(w.Body.Bytes(), &opening)

	// 2. Simulate Invoice in this opening
	inv := sellingmodel.POSInvoice{
		ID:             "posi-test-11",
		TenantID:       "test-pos-tenant",
		InvoiceNumber:  "ACC-SINV-2026-00011",
		OpeningEntryID: opening.ID,
		Customer:       "Walk-in Customer",
		NetTotal:       28000,
		GrandTotal:     28000,
		PaidAmount:     28000,
		ModeOfPayment:  "Cash",
		Status:         "Paid",
		CreatedAt:      time.Now(),
	}
	err := db.Create(&inv).Error
	assert.NoError(t, err)

	// 3. Close Opening
	closePayload := map[string]any{
		"closing_amounts": map[string]float64{
			"Cash": 28000,
		},
	}
	closeBody, _ := json.Marshal(closePayload)
	w = httptest.NewRecorder()
	req, _ = http.NewRequest(http.MethodPost, "/pos/opening-entries/"+opening.ID+"/close", bytes.NewReader(closeBody))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusCreated, w.Code)

	var closing sellingmodel.POSClosingEntry
	_ = json.Unmarshal(w.Body.Bytes(), &closing)
	assert.NotEmpty(t, closing.SalesInvoices)
	assert.Equal(t, "ACC-SINV-2026-00011", closing.SalesInvoices[0].SalesInvoice)
	assert.Equal(t, 28000.0, closing.SalesInvoices[0].GrandTotal)

	// 4. Get Closing Entry by ID (e.g. POS-CLOSE-...)
	w = httptest.NewRecorder()
	req, _ = http.NewRequest(http.MethodGet, "/pos/closing-entries/"+closing.ID, nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	var fetched sellingmodel.POSClosingEntry
	_ = json.Unmarshal(w.Body.Bytes(), &fetched)
	assert.NotEmpty(t, fetched.SalesInvoices)
	assert.Equal(t, "ACC-SINV-2026-00011", fetched.SalesInvoices[0].SalesInvoice)
	assert.Equal(t, 28000.0, fetched.SalesInvoices[0].GrandTotal)
}

func TestPOSItemsUsesLatestItemPrice(t *testing.T) {
	router, db := setupPOSTestRouter(t)

	// 1. Seed Item
	item := buyingmodel.Item{
		Base:         buyingmodel.Base{ID: uuid.New(), TenantID: uuid.New()},
		ItemCode:     "MK",
		ItemName:     "Lilin Million Kecil",
		ItemGroup:    "Products",
		OpeningStock: 50,
		StockUOM:     "Nos",
		ImageURL:     "uploads/items/lilin-small.png",
		IsStockItem:  true,
		Disabled:     false,
	}
	err := db.Create(&item).Error
	assert.NoError(t, err)

	// 2. Seed older ItemPrice with Rate 1500
	oldPrice := sellingmodel.ItemPrice{
		ID:            "ip-old",
		TenantID:      "test-pos-tenant",
		ItemCode:      "MK",
		ItemName:      "Lilin Million Kecil",
		PriceList:     "Standard Selling",
		PriceListRate: 1500,
		Selling:       true,
		IsActive:      true,
		CreatedAt:     time.Now().Add(-2 * time.Hour),
	}
	err = db.Create(&oldPrice).Error
	assert.NoError(t, err)

	// 3. Seed latest ItemPrice with Rate 2000 (from /desk/item-price)
	latestPrice := sellingmodel.ItemPrice{
		ID:            "ip-latest",
		TenantID:      "test-pos-tenant",
		ItemCode:      "MK",
		ItemName:      "Lilin Million Kecil",
		PriceList:     "Standard Selling",
		PriceListRate: 2000,
		Selling:       true,
		IsActive:      true,
		CreatedAt:     time.Now(),
	}
	err = db.Create(&latestPrice).Error
	assert.NoError(t, err)

	// 4. Query /pos/items and verify rate is 2000 (not 10000 and not 1500)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/pos/items", nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	var resp struct {
		Data []posItemResponse `json:"data"`
	}
	err = json.Unmarshal(w.Body.Bytes(), &resp)
	assert.NoError(t, err)
	assert.Len(t, resp.Data, 1)
	assert.Equal(t, "MK", resp.Data[0].ItemCode)
	assert.Equal(t, 2000.0, resp.Data[0].Rate)
	assert.Equal(t, "uploads/items/lilin-small.png", resp.Data[0].Image)
	assert.Equal(t, "uploads/items/lilin-small.png", resp.Data[0].ImageURL)
}

func TestPOSInvoiceRecomputesCatalogPriceAndDiscount(t *testing.T) {
	router, db := setupPOSTestRouter(t)

	item := buyingmodel.Item{
		Base:      buyingmodel.Base{ID: uuid.New(), TenantID: uuid.New()},
		ItemCode:  "MK",
		ItemName:  "Lilin Million Kecil",
		ItemGroup: "Products",
		StockUOM:  "Nos",
		Disabled:  false,
	}
	assert.NoError(t, db.Create(&item).Error)
	assert.NoError(t, db.Create(&sellingmodel.ItemPrice{
		ID: "ip-pos", TenantID: "test-pos-tenant", ItemCode: "MK", ItemName: item.ItemName,
		PriceList: "Standard Selling", PriceListRate: 2000, Selling: true, IsActive: true,
		CreatedAt: time.Now(),
	}).Error)
	assert.NoError(t, db.Create(&sellingmodel.POSOpeningEntry{
		ID: "opening-pos-price", TenantID: "test-pos-tenant", PeriodStartDate: time.Now(),
		PostingDate: time.Now(), Company: "UD MILLION CANDLES", POSProfile: "Usaha Jualan Lilin",
		User: "Administrator", Status: sellingmodel.POSOpeningStatusOpen,
	}).Error)

	body, err := json.Marshal(map[string]any{
		"opening_entry_id": "opening-pos-price",
		"customer":         "Walk-in Customer",
		"mode_of_payment":  "Cash",
		"discount_amount":  1000,
		"items": []map[string]any{{
			"item_code": "MK", "item_name": "Client supplied name", "quantity": 2, "rate": 999999,
		}},
	})
	assert.NoError(t, err)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/pos/invoices", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusCreated, w.Code)

	var invoice sellingmodel.POSInvoice
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &invoice))
	assert.Len(t, invoice.Items, 1)
	assert.Equal(t, 2000.0, invoice.Items[0].Rate)
	assert.Equal(t, 4000.0, invoice.NetTotal)
	assert.Equal(t, 1000.0, invoice.DiscountAmount)
	assert.Equal(t, 3000.0, invoice.GrandTotal)
	assert.Equal(t, 3000.0, invoice.PaidAmount)
}
