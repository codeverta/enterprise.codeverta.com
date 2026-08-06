package controller

import (
	"encoding/json"
	"net/http"
	"testing"

	coremodel "gin-template/model"
	sellingmodel "gin-template/modules/selling/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupSalesInvoiceTestRouter(t *testing.T) (*gin.Engine, *gorm.DB) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	if err := db.AutoMigrate(&sellingmodel.SalesInvoice{}, &sellingmodel.SalesInvoiceItem{}, &sellingmodel.SalesLedgerEntry{}); err != nil {
		t.Fatalf("migrate database: %v", err)
	}
	coremodel.DB = db
	controller := NewSalesInvoiceController()
	router := gin.New()
	router.Use(func(ctx *gin.Context) {
		ctx.Set("db", db)
		ctx.Set("tenant_id", "tenant-invoice-test")
		ctx.Next()
	})
	router.POST("/selling/sales-invoices", controller.Create)
	router.GET("/selling/sales-invoices/:id", controller.Get)
	router.POST("/selling/sales-invoices/:id/submit", controller.Submit)
	router.POST("/selling/sales-invoices/:id/mark-paid", controller.MarkPaid)
	router.POST("/selling/sales-invoices/:id/return", controller.CreateReturn)
	router.POST("/selling/sales-invoices/:id/refund", controller.Refund)
	return router, db
}

func TestSalesInvoicePartialCreditNoteAndRefund(t *testing.T) {
	router, db := setupSalesInvoiceTestRouter(t)
	createPayload := map[string]interface{}{
		"customer": "Customer Return Test", "company": "PT ZENIT TECHNOLOGY SOLUTION", "tax_rate": 10,
		"items": []map[string]interface{}{{
			"item_code": "LIP-001", "item_name": "Lipstick", "quantity": 10, "uom": "Nos", "rate": 100000,
		}},
	}
	createResponse := storeRequest(t, router, http.MethodPost, "/selling/sales-invoices", createPayload)
	if createResponse.Code != http.StatusCreated {
		t.Fatalf("create invoice status = %d, body = %s", createResponse.Code, createResponse.Body.String())
	}
	var invoice sellingmodel.SalesInvoice
	if err := json.Unmarshal(createResponse.Body.Bytes(), &invoice); err != nil {
		t.Fatalf("decode invoice: %v", err)
	}
	if invoice.GrandTotal != 1100000 || len(invoice.Items) != 1 {
		t.Fatalf("unexpected invoice totals: %+v", invoice)
	}
	if response := storeRequest(t, router, http.MethodPost, "/selling/sales-invoices/"+invoice.ID+"/submit", nil); response.Code != http.StatusOK {
		t.Fatalf("submit invoice status = %d, body = %s", response.Code, response.Body.String())
	}
	if response := storeRequest(t, router, http.MethodPost, "/selling/sales-invoices/"+invoice.ID+"/submit", nil); response.Code != http.StatusOK {
		t.Fatalf("repeat submit invoice status = %d, body = %s", response.Code, response.Body.String())
	}
	if response := storeRequest(t, router, http.MethodPost, "/selling/sales-invoices/"+invoice.ID+"/mark-paid", nil); response.Code != http.StatusOK {
		t.Fatalf("mark invoice paid status = %d, body = %s", response.Code, response.Body.String())
	}

	returnPayload := map[string]interface{}{
		"reason": "Dua lipstick rusak",
		"items":  []map[string]interface{}{{"against_item_id": invoice.Items[0].ID, "quantity": 2}},
	}
	returnResponse := storeRequest(t, router, http.MethodPost, "/selling/sales-invoices/"+invoice.ID+"/return", returnPayload)
	if returnResponse.Code != http.StatusCreated {
		t.Fatalf("create credit note status = %d, body = %s", returnResponse.Code, returnResponse.Body.String())
	}
	var credit sellingmodel.SalesInvoice
	if err := json.Unmarshal(returnResponse.Body.Bytes(), &credit); err != nil {
		t.Fatalf("decode credit note: %v", err)
	}
	if !credit.IsReturn || credit.GrandTotal != -220000 || credit.RefundStatus != "Pending Refund" {
		t.Fatalf("unexpected credit note: %+v", credit)
	}
	if response := storeRequest(t, router, http.MethodPost, "/selling/sales-invoices/"+credit.ID+"/submit", nil); response.Code != http.StatusOK {
		t.Fatalf("submit credit note status = %d, body = %s", response.Code, response.Body.String())
	}
	refundResponse := storeRequest(t, router, http.MethodPost, "/selling/sales-invoices/"+credit.ID+"/refund", map[string]interface{}{"reference": "BANK-REF-001"})
	if refundResponse.Code != http.StatusOK {
		t.Fatalf("refund credit note status = %d, body = %s", refundResponse.Code, refundResponse.Body.String())
	}

	var ledgerCount int64
	if err := db.Model(&sellingmodel.SalesLedgerEntry{}).Count(&ledgerCount).Error; err != nil {
		t.Fatalf("count ledger: %v", err)
	}
	if ledgerCount != 8 {
		t.Fatalf("expected 8 balanced ledger lines including tax reversal, got %d", ledgerCount)
	}
	var totals struct{ Debit, Credit float64 }
	if err := db.Model(&sellingmodel.SalesLedgerEntry{}).
		Select("COALESCE(SUM(debit), 0) AS debit, COALESCE(SUM(credit), 0) AS credit").Scan(&totals).Error; err != nil {
		t.Fatalf("sum ledger: %v", err)
	}
	if totals.Debit != totals.Credit {
		t.Fatalf("ledger is not balanced: debit=%v credit=%v", totals.Debit, totals.Credit)
	}

	overReturn := map[string]interface{}{
		"reason": "exceeds remaining",
		"items":  []map[string]interface{}{{"against_item_id": invoice.Items[0].ID, "quantity": 9}},
	}
	response := storeRequest(t, router, http.MethodPost, "/selling/sales-invoices/"+invoice.ID+"/return", overReturn)
	if response.Code != http.StatusConflict {
		t.Fatalf("over credit status = %d, body = %s", response.Code, response.Body.String())
	}
}
