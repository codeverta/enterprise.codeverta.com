package controller

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"

	coremodel "gin-template/model"
	buyingmodel "gin-template/modules/buying/model"
	stockmodel "gin-template/modules/stock/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupStockLedgerTestRouter(t *testing.T) (*gin.Engine, *gorm.DB) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open("file:"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(
		&stockmodel.StockLedgerEntry{},
		&stockmodel.StockEntry{},
		&stockmodel.StockEntryItem{},
		&stockmodel.PurchaseReceipt{},
		&stockmodel.PurchaseReceiptItem{},
		&stockmodel.Warehouse{},
		&stockmodel.Batch{},
		&buyingmodel.Item{},
	); err != nil {
		t.Fatalf("migrate db: %v", err)
	}
	coremodel.DB = db

	ctrl := NewStockLedgerController()

	router := gin.New()
	router.Use(func(ctx *gin.Context) {
		ctx.Set("db", db)
		ctx.Set("tenant_id", "00000000-0000-0000-0000-000000000001")
		ctx.Next()
	})

	router.GET("/stock/stock-ledger", ctrl.List)
	router.GET("/stock/stock-ledger/options", ctrl.Options)

	return router, db
}

func TestStockLedgerListAndOptions(t *testing.T) {
	router, db := setupStockLedgerTestRouter(t)

	tenant := "00000000-0000-0000-0000-000000000001"
	now := time.Now()

	// Seed SLEs
	sle1 := stockmodel.StockLedgerEntry{
		ID:              "sle-01",
		TenantID:        tenant,
		PostingDate:     now.Add(-2 * time.Hour),
		VoucherType:     "Stock Entry",
		VoucherID:       "ste-01",
		VoucherNumber:   "MAT-STE-2026-00001",
		VoucherDetailID: "item-01-tgt",
		ItemCode:        "ITEM-A",
		Warehouse:       "Stores - PZTS",
		ActualQty:       10,
		IncomingRate:    50000,
		ValuationRate:   50000,
		Company:         "PT ZENIT TECHNOLOGY SOLUTION",
		CreatedAt:       now.Add(-2 * time.Hour),
	}
	sle2 := stockmodel.StockLedgerEntry{
		ID:              "sle-02",
		TenantID:        tenant,
		PostingDate:     now.Add(-1 * time.Hour),
		VoucherType:     "Stock Entry",
		VoucherID:       "ste-02",
		VoucherNumber:   "MAT-STE-2026-00002",
		VoucherDetailID: "item-01-src",
		ItemCode:        "ITEM-A",
		Warehouse:       "Stores - PZTS",
		ActualQty:       -3,
		IncomingRate:    50000,
		ValuationRate:   50000,
		Company:         "PT ZENIT TECHNOLOGY SOLUTION",
		CreatedAt:       now.Add(-1 * time.Hour),
	}
	if err := db.Create(&sle1).Error; err != nil {
		t.Fatalf("seed sle1: %v", err)
	}
	if err := db.Create(&sle2).Error; err != nil {
		t.Fatalf("seed sle2: %v", err)
	}

	// 1. Test List
	res := stockRequest(t, router, http.MethodGet, "/stock/stock-ledger?item_code=ITEM-A", nil)
	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", res.Code, res.Body.String())
	}

	var body struct {
		Data  []StockLedgerRow `json:"data"`
		Stats struct {
			TotalEntries int     `json:"total_entries"`
			TotalInQty   float64 `json:"total_in_qty"`
			TotalOutQty  float64 `json:"total_out_qty"`
			NetBalance   float64 `json:"net_balance"`
		} `json:"stats"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	if len(body.Data) != 2 {
		t.Fatalf("expected 2 ledger rows, got %d", len(body.Data))
	}

	row1 := body.Data[0]
	if row1.InQty != 10 || row1.BalanceQty != 10 {
		t.Fatalf("expected row1 in_qty=10, balance_qty=10, got in_qty=%f, balance_qty=%f", row1.InQty, row1.BalanceQty)
	}

	row2 := body.Data[1]
	if row2.OutQty != 3 || row2.BalanceQty != 7 {
		t.Fatalf("expected row2 out_qty=3, balance_qty=7, got out_qty=%f, balance_qty=%f", row2.OutQty, row2.BalanceQty)
	}

	if body.Stats.NetBalance != 7 {
		t.Fatalf("expected net_balance=7, got %f", body.Stats.NetBalance)
	}

	// 2. Test Options
	optRes := stockRequest(t, router, http.MethodGet, "/stock/stock-ledger/options", nil)
	if optRes.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", optRes.Code)
	}
}
