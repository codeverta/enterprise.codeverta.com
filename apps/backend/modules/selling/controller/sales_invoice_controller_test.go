package controller

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"

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
	if err := db.AutoMigrate(
		&sellingmodel.SalesInvoice{}, &sellingmodel.SalesInvoiceItem{}, &sellingmodel.SalesLedgerEntry{},
		&sellingmodel.Customer{}, &sellingmodel.LoyaltyProgram{}, &sellingmodel.CollectionRule{}, &sellingmodel.LoyaltyPointEntry{},
	); err != nil {
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
	router.GET("/selling/sales-invoices/options", controller.Options)
	router.GET("/selling/sales-invoices", controller.List)
	router.GET("/selling/sales-invoices/:id", controller.Get)
	router.PUT("/selling/sales-invoices/:id", controller.Update)
	router.POST("/selling/sales-invoices/:id/submit", controller.Submit)
	router.POST("/selling/sales-invoices/:id/mark-paid", controller.MarkPaid)
	router.POST("/selling/sales-invoices/:id/return", controller.CreateReturn)
	router.POST("/selling/sales-invoices/:id/refund", controller.Refund)
	router.DELETE("/selling/sales-invoices/:id", controller.Delete)
	return router, db
}

func TestSalesInvoiceOptions(t *testing.T) {
	router, _ := setupSalesInvoiceTestRouter(t)
	response := storeRequest(t, router, http.MethodGet, "/selling/sales-invoices/options", nil)
	if response.Code != http.StatusOK {
		t.Fatalf("options status = %d, body = %s", response.Code, response.Body.String())
	}
	var options struct {
		Customers  []string `json:"customers"`
		Currencies []string `json:"currencies"`
		Items      []struct {
			ItemCode string  `json:"item_code"`
			Rate     float64 `json:"rate"`
		} `json:"items"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &options); err != nil {
		t.Fatalf("decode options response: %v", err)
	}
	if len(options.Customers) == 0 || len(options.Currencies) == 0 || len(options.Items) == 0 {
		t.Fatalf("options response is incomplete: %+v", options)
	}
}

func TestSalesInvoiceListAndDetailIncludeItems(t *testing.T) {
	router, _ := setupSalesInvoiceTestRouter(t)
	response := storeRequest(t, router, http.MethodPost, "/selling/sales-invoices", map[string]interface{}{
		"customer": "Detail Customer", "company": "PT ZENIT TECHNOLOGY SOLUTION",
		"items": []map[string]interface{}{{"item_code": "ITEM-DETAIL", "item_name": "Detail Item", "quantity": 3, "uom": "Box", "rate": 12500}},
	})
	if response.Code != http.StatusCreated {
		t.Fatalf("create status = %d, body = %s", response.Code, response.Body.String())
	}
	var created sellingmodel.SalesInvoice
	if err := json.Unmarshal(response.Body.Bytes(), &created); err != nil {
		t.Fatalf("decode create response: %v", err)
	}

	listResponse := storeRequest(t, router, http.MethodGet, "/selling/sales-invoices?q=Detail", nil)
	if listResponse.Code != http.StatusOK {
		t.Fatalf("list status = %d, body = %s", listResponse.Code, listResponse.Body.String())
	}
	var listed struct {
		Data []sellingmodel.SalesInvoice `json:"data"`
	}
	if err := json.Unmarshal(listResponse.Body.Bytes(), &listed); err != nil {
		t.Fatalf("decode list response: %v", err)
	}
	if len(listed.Data) != 1 || len(listed.Data[0].Items) != 1 || listed.Data[0].Items[0].ItemCode != "ITEM-DETAIL" {
		t.Fatalf("list did not include invoice items: %+v", listed.Data)
	}

	detailResponse := storeRequest(t, router, http.MethodGet, "/selling/sales-invoices/"+created.ID, nil)
	if detailResponse.Code != http.StatusOK {
		t.Fatalf("detail status = %d, body = %s", detailResponse.Code, detailResponse.Body.String())
	}
	var detail sellingmodel.SalesInvoice
	if err := json.Unmarshal(detailResponse.Body.Bytes(), &detail); err != nil {
		t.Fatalf("decode detail response: %v", err)
	}
	if len(detail.Items) != 1 || detail.Items[0].Quantity != 3 || detail.Items[0].Rate != 12500 {
		t.Fatalf("detail item missing or incorrect: %+v", detail.Items)
	}
}

func TestSalesInvoiceUpdateAndDelete(t *testing.T) {
	router, db := setupSalesInvoiceTestRouter(t)
	response := storeRequest(t, router, http.MethodPost, "/selling/sales-invoices", map[string]interface{}{
		"customer": "Update Customer", "company": "PT ZENIT TECHNOLOGY SOLUTION",
		"items": []map[string]interface{}{{"item_code": "ITEM-UPDATE", "item_name": "Old Name", "quantity": 1, "rate": 1000}},
	})
	var created sellingmodel.SalesInvoice
	if err := json.Unmarshal(response.Body.Bytes(), &created); err != nil {
		t.Fatalf("decode create response: %v", err)
	}

	updateResponse := storeRequest(t, router, http.MethodPut, "/selling/sales-invoices/"+created.ID, map[string]interface{}{
		"customer": "Updated Customer", "company": "PT ZENIT TECHNOLOGY SOLUTION", "currency": "IDR", "tax_rate": 11,
		"items": []map[string]interface{}{{"item_code": "ITEM-UPDATE", "item_name": "Updated Name", "quantity": 2, "uom": "Nos", "rate": 1500}},
	})
	if updateResponse.Code != http.StatusOK {
		t.Fatalf("update status = %d, body = %s", updateResponse.Code, updateResponse.Body.String())
	}
	var updated sellingmodel.SalesInvoice
	if err := json.Unmarshal(updateResponse.Body.Bytes(), &updated); err != nil {
		t.Fatalf("decode update response: %v", err)
	}
	if updated.Customer != "Updated Customer" || len(updated.Items) != 1 || updated.Items[0].Quantity != 2 || updated.Items[0].Rate != 1500 {
		t.Fatalf("unexpected update: %+v", updated)
	}

	deleteResponse := storeRequest(t, router, http.MethodDelete, "/selling/sales-invoices/"+created.ID, nil)
	if deleteResponse.Code != http.StatusOK {
		t.Fatalf("delete status = %d, body = %s", deleteResponse.Code, deleteResponse.Body.String())
	}
	var count int64
	if err := db.Model(&sellingmodel.SalesInvoice{}).Where("id = ?", created.ID).Count(&count).Error; err != nil {
		t.Fatalf("count deleted invoice: %v", err)
	}
	if count != 0 {
		t.Fatalf("invoice still exists after delete")
	}
}

func TestSalesInvoiceAPIValidationAndTenantIsolation(t *testing.T) {
	router, _ := setupSalesInvoiceTestRouter(t)
	invalid := storeRequest(t, router, http.MethodPost, "/selling/sales-invoices", map[string]interface{}{"company": "PT ZENIT TECHNOLOGY SOLUTION", "items": []interface{}{}})
	if invalid.Code != http.StatusBadRequest {
		t.Fatalf("invalid create status = %d, body = %s", invalid.Code, invalid.Body.String())
	}
	notFound := storeRequest(t, router, http.MethodGet, "/selling/sales-invoices/not-existing", nil)
	if notFound.Code != http.StatusNotFound {
		t.Fatalf("missing detail status = %d, body = %s", notFound.Code, notFound.Body.String())
	}

	other := sellingmodel.SalesInvoice{ID: "sinv-other", TenantID: "tenant-other", Number: "ACC-SINV-OTHER", Customer: "Other", Company: "Other", PostingDate: time.Now(), Currency: "IDR"}
	coremodel.DB.Create(&other)
	isolation := storeRequest(t, router, http.MethodGet, "/selling/sales-invoices/"+other.ID, nil)
	if isolation.Code != http.StatusNotFound {
		t.Fatalf("cross-tenant detail status = %d, body = %s", isolation.Code, isolation.Body.String())
	}
	badJSON := storeRequest(t, router, http.MethodPost, "/selling/sales-invoices", "not-json")
	if badJSON.Code != http.StatusBadRequest {
		t.Fatalf("malformed create status = %d, body = %s", badJSON.Code, badJSON.Body.String())
	}
	returnOnCreate := storeRequest(t, router, http.MethodPost, "/selling/sales-invoices", map[string]interface{}{
		"customer": "Invalid Return", "is_return": true, "items": []map[string]interface{}{{"item_code": "X", "quantity": 1, "rate": 1}},
	})
	if returnOnCreate.Code != http.StatusBadRequest {
		t.Fatalf("direct return create status = %d, body = %s", returnOnCreate.Code, returnOnCreate.Body.String())
	}
}

func TestSalesInvoiceStateAndMutationErrors(t *testing.T) {
	router, _ := setupSalesInvoiceTestRouter(t)
	createdResponse := storeRequest(t, router, http.MethodPost, "/selling/sales-invoices", map[string]interface{}{
		"customer": "State Customer", "items": []map[string]interface{}{{"item_code": "STATE-1", "quantity": 1, "rate": 100}},
	})
	var invoice sellingmodel.SalesInvoice
	if err := json.Unmarshal(createdResponse.Body.Bytes(), &invoice); err != nil {
		t.Fatalf("decode invoice: %v", err)
	}
	if response := storeRequest(t, router, http.MethodPost, "/selling/sales-invoices/not-found/submit", nil); response.Code != http.StatusNotFound {
		t.Fatalf("missing submit status = %d", response.Code)
	}
	if response := storeRequest(t, router, http.MethodPost, "/selling/sales-invoices/"+invoice.ID+"/mark-paid", nil); response.Code != http.StatusConflict {
		t.Fatalf("draft mark-paid status = %d", response.Code)
	}
	if response := storeRequest(t, router, http.MethodPost, "/selling/sales-invoices/"+invoice.ID+"/return", map[string]interface{}{
		"items": []map[string]interface{}{{"against_item_id": "missing", "quantity": 1}},
	}); response.Code != http.StatusConflict {
		t.Fatalf("draft return status = %d", response.Code)
	}
	if response := storeRequest(t, router, http.MethodDelete, "/selling/sales-invoices/not-found", nil); response.Code != http.StatusConflict {
		t.Fatalf("missing delete status = %d", response.Code)
	}
	if response := storeRequest(t, router, http.MethodPut, "/selling/sales-invoices/not-found", map[string]interface{}{}); response.Code != http.StatusNotFound {
		t.Fatalf("missing update status = %d", response.Code)
	}
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
