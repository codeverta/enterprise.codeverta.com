package controller

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	coremodel "gin-template/model"
	stockmodel "gin-template/modules/stock/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupStockReconciliationTestRouter(t *testing.T) (*gin.Engine, *gorm.DB) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open("file:"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{})
	assert.NoError(t, err)

	err = stockmodel.Migrate(db)
	assert.NoError(t, err)

	err = db.AutoMigrate(&coremodel.Company{})
	assert.NoError(t, err)

	comp := coremodel.Company{
		ID:           uuid.MustParse("11111111-1111-1111-1111-111111111111"),
		Name:         "UD MILLION CANDLES",
		Abbreviation: "MC",
		IsActive:     true,
	}
	_ = db.Create(&comp)

	coremodel.DB = db

	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("tenant_id", "test-tenant")
		c.Next()
	})

	ctrl := NewStockReconciliationController()
	r.GET("/stock-reconciliations/options", ctrl.Options)
	r.GET("/stock-reconciliations", ctrl.List)
	r.POST("/stock-reconciliations", ctrl.Create)
	r.GET("/stock-reconciliations/:id", ctrl.Get)
	r.PUT("/stock-reconciliations/:id", ctrl.Update)
	r.POST("/stock-reconciliations/:id/submit", ctrl.Submit)
	r.POST("/stock-reconciliations/:id/cancel", ctrl.Cancel)
	r.DELETE("/stock-reconciliations/:id", ctrl.Delete)

	return r, db
}

func TestStockReconciliationCRUDAndSubmit(t *testing.T) {
	r, db := setupStockReconciliationTestRouter(t)

	// 1. Initial stock ledger entry (current balance is 10 for MK in Finished Goods - MC)
	_ = db.Create(&stockmodel.StockLedgerEntry{
		ID:          "sle-seed-1",
		TenantID:    "test-tenant",
		PostingDate: time.Now(),
		VoucherType: "Stock Entry",
		ItemCode:    "MK",
		Warehouse:   "Finished Goods - MC",
		ActualQty:   10,
	})

	// 2. Create Stock Reconciliation with qty = 15
	payload := map[string]any{
		"naming_series":    "MAT-RECO-.YYYY.-",
		"purpose":          "Stock Reconciliation",
		"company":          "UD MILLION CANDLES",
		"posting_date":     "2026-09-12",
		"posting_time":     "18:12:54",
		"set_warehouse":    "Finished Goods - MC",
		"expense_account":  "5111 - Stock Adjustment - Expense",
		"cost_center":      "Main - MC",
		"items": []map[string]any{{
			"item_code":      "MK",
			"warehouse":      "Finished Goods - MC",
			"quantity":       15,
			"stock_uom":      "Nos",
			"valuation_rate": 2000,
		}},
	}
	body, _ := json.Marshal(payload)
	req, _ := http.NewRequest(http.MethodPost, "/stock-reconciliations", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)
	var created stockmodel.StockReconciliation
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &created))
	assert.Equal(t, "Draft", created.Status)
	assert.Equal(t, 1, len(created.Items))
	assert.Equal(t, float64(15), created.Items[0].Qty)

	// 3. Submit Stock Reconciliation
	reqSubmit, _ := http.NewRequest(http.MethodPost, "/stock-reconciliations/"+created.ID+"/submit", nil)
	wSubmit := httptest.NewRecorder()
	r.ServeHTTP(wSubmit, reqSubmit)
	assert.Equal(t, http.StatusOK, wSubmit.Code)

	var submitted stockmodel.StockReconciliation
	assert.NoError(t, json.Unmarshal(wSubmit.Body.Bytes(), &submitted))
	assert.Equal(t, "Submitted", submitted.Status)

	// 4. Verify Stock Ledger Entry created with diffQty = 15 - 10 = +5
	var sles []stockmodel.StockLedgerEntry
	err := db.Where("voucher_id = ? AND voucher_type = ?", created.ID, "Stock Reconciliation").Find(&sles).Error
	assert.NoError(t, err)
	assert.Equal(t, 1, len(sles))
	assert.Equal(t, float64(5), sles[0].ActualQty)
	assert.Equal(t, "MK", sles[0].ItemCode)
}
