package controller

import (
	"encoding/json"
	"net/http"
	"net/url"
	"testing"
	"time"

	buyingmodel "gin-template/modules/buying/model"
	sellingmodel "gin-template/modules/selling/model"

	"github.com/google/uuid"
)

func TestPOSSuccessfulSaleCreatesLoyaltyPointEntry(t *testing.T) {
	router, db := setupPOSTestRouter(t)
	tenant := "test-pos-tenant"
	now := time.Now()
	customer := sellingmodel.Customer{
		ID: "cust-pos-loyalty", TenantID: tenant, CustomerName: "POS Loyal Customer",
		CustomerGroup: "Retail", Territory: "Indonesia",
	}
	program := sellingmodel.LoyaltyProgram{
		ID: "lp-pos-loyalty", TenantID: tenant, LoyaltyProgramName: "POS Rewards",
		CustomerGroup: "Retail", CustomerTerritory: "Indonesia", AutoOptIn: true, ExpiryDuration: 90,
		CollectionRules: []sellingmodel.CollectionRule{{ID: "rule-pos", TierName: "Default", CollectionFactor: 10000}},
	}
	opening := sellingmodel.POSOpeningEntry{
		ID: "POS-OPEN-LOYALTY", TenantID: tenant, PeriodStartDate: now, PostingDate: now,
		Company: "UD MILLION CANDLES", POSProfile: "Usaha Jualan Lilin", User: "Administrator", Status: sellingmodel.POSOpeningStatusOpen,
	}
	item := buyingmodel.Item{
		Base: buyingmodel.Base{ID: uuid.New(), TenantID: uuid.New()}, ItemCode: "LOYALTY-ITEM",
		ItemName: "Loyalty Item", ItemGroup: "Products",
		StockUOM: "Nos", IsStockItem: true, Disabled: false,
	}
	itemPrice := sellingmodel.ItemPrice{
		ID: "ip-loyalty-item", TenantID: tenant, ItemCode: "LOYALTY-ITEM", ItemName: "Loyalty Item",
		PriceList: "Standard Selling", PriceListRate: 50000, Selling: true, IsActive: true,
	}
	for _, value := range []interface{}{&customer, &program, &opening, &item, &itemPrice} {
		if err := db.Create(value).Error; err != nil {
			t.Fatal(err)
		}
	}

	response := storeRequest(t, router, http.MethodPost, "/pos/invoices", map[string]interface{}{
		"opening_entry_id": opening.ID,
		"customer":         customer.CustomerName,
		"mode_of_payment":  "Cash",
		"items": []map[string]interface{}{{
			"item_code": item.ItemCode, "quantity": 2, "rate": 50000,
		}},
	})
	if response.Code != http.StatusCreated {
		t.Fatalf("POS create status=%d body=%s", response.Code, response.Body.String())
	}
	var entries []sellingmodel.LoyaltyPointEntry
	if err := db.Where("tenant_id = ?", tenant).Find(&entries).Error; err != nil {
		t.Fatal(err)
	}
	if len(entries) != 1 || entries[0].LoyaltyPoints != 10 || entries[0].ReferenceType != "POS Invoice" {
		t.Fatalf("unexpected POS loyalty entries: %+v", entries)
	}
}

func TestSubmittedSalesInvoiceCreatesLoyaltyPointEntryOnce(t *testing.T) {
	router, db := setupSalesInvoiceTestRouter(t)
	tenant := "tenant-invoice-test"
	customer := sellingmodel.Customer{
		ID: "cust-invoice-loyalty", TenantID: tenant, CustomerName: "Invoice Loyal Customer",
		CustomerGroup: "Commercial", Territory: "Indonesia",
	}
	program := sellingmodel.LoyaltyProgram{
		ID: "lp-invoice-loyalty", TenantID: tenant, LoyaltyProgramName: "Invoice Rewards",
		CustomerGroup: "Commercial", CustomerTerritory: "All Territories", AutoOptIn: true,
		CollectionRules: []sellingmodel.CollectionRule{{ID: "rule-invoice", TierName: "Default", CollectionFactor: 5000}},
	}
	if err := db.Create(&customer).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&program).Error; err != nil {
		t.Fatal(err)
	}

	created := storeRequest(t, router, http.MethodPost, "/selling/sales-invoices", map[string]interface{}{
		"customer": customer.CustomerName,
		"company":  "PT ZENIT TECHNOLOGY SOLUTION",
		"items": []map[string]interface{}{{
			"item_code": "INV-LOYALTY", "quantity": 1, "rate": 25000,
		}},
	})
	if created.Code != http.StatusCreated {
		t.Fatalf("invoice create status=%d body=%s", created.Code, created.Body.String())
	}
	var invoice sellingmodel.SalesInvoice
	if err := decodeJSON(created.Body.Bytes(), &invoice); err != nil {
		t.Fatal(err)
	}
	for attempt := 0; attempt < 2; attempt++ {
		response := storeRequest(t, router, http.MethodPost, "/selling/sales-invoices/"+invoice.ID+"/submit", nil)
		if response.Code != http.StatusOK {
			t.Fatalf("submit attempt %d status=%d body=%s", attempt+1, response.Code, response.Body.String())
		}
	}
	var entries []sellingmodel.LoyaltyPointEntry
	if err := db.Where("tenant_id = ?", tenant).Find(&entries).Error; err != nil {
		t.Fatal(err)
	}
	if len(entries) != 1 || entries[0].LoyaltyPoints != 5 || entries[0].ReferenceType != "Sales Invoice" {
		t.Fatalf("unexpected invoice loyalty entries: %+v", entries)
	}
}

func decodeJSON(data []byte, target interface{}) error {
	return json.Unmarshal(data, target)
}

func TestLoyaltyProgramControllerListAndEntriesCRUD(t *testing.T) {
	router, db := setupSalesInvoiceTestRouter(t)
	tenant := "tenant-invoice-test"
	loyaltyCtrl := NewLoyaltyProgramController()

	// Register loyalty routes on test router
	router.GET("/selling/loyalty-programs", loyaltyCtrl.List)
	router.POST("/selling/loyalty-point-entries", loyaltyCtrl.CreateEntry)
	router.GET("/selling/loyalty-point-entries", loyaltyCtrl.EntriesList)
	router.DELETE("/selling/loyalty-point-entries/:id", loyaltyCtrl.DeleteEntry)

	// 1. List programs: should auto-seed default program if empty
	resp := storeRequest(t, router, http.MethodGet, "/selling/loyalty-programs", nil)
	if resp.Code != http.StatusOK {
		t.Fatalf("list programs status=%d body=%s", resp.Code, resp.Body.String())
	}
	var progResp struct {
		Data []sellingmodel.LoyaltyProgram `json:"data"`
	}
	if err := decodeJSON(resp.Body.Bytes(), &progResp); err != nil {
		t.Fatal(err)
	}
	if len(progResp.Data) == 0 {
		t.Fatal("expected at least one loyalty program")
	}
	programName := progResp.Data[0].LoyaltyProgramName

	// 2. Create manual Loyalty Point Entry
	entryPayload := map[string]interface{}{
		"customer":        "Customer VIP Test",
		"loyalty_program": programName,
		"type":            "Earned",
		"loyalty_points":  50,
		"purchase_amount": 500000,
		"sales_invoice":   "INV-MANUAL-001",
	}
	createResp := storeRequest(t, router, http.MethodPost, "/selling/loyalty-point-entries", entryPayload)
	if createResp.Code != http.StatusCreated {
		t.Fatalf("create entry status=%d body=%s", createResp.Code, createResp.Body.String())
	}
	var createdEntry struct {
		Data sellingmodel.LoyaltyPointEntry `json:"data"`
	}
	if err := decodeJSON(createResp.Body.Bytes(), &createdEntry); err != nil {
		t.Fatal(err)
	}
	if createdEntry.Data.LoyaltyPoints != 50 || createdEntry.Data.Customer != "Customer VIP Test" {
		t.Fatalf("unexpected created entry: %+v", createdEntry.Data)
	}

	// 3. List entries and test filtering
	listResp := storeRequest(t, router, http.MethodGet, "/selling/loyalty-point-entries?program="+url.QueryEscape(programName), nil)
	if listResp.Code != http.StatusOK {
		t.Fatalf("list entries status=%d body=%s", listResp.Code, listResp.Body.String())
	}
	var entriesListResp struct {
		Data []sellingmodel.LoyaltyPointEntry `json:"data"`
	}
	if err := decodeJSON(listResp.Body.Bytes(), &entriesListResp); err != nil {
		t.Fatal(err)
	}
	if len(entriesListResp.Data) != 1 || entriesListResp.Data[0].ID != createdEntry.Data.ID {
		t.Fatalf("unexpected entries list: %+v", entriesListResp.Data)
	}

	// 4. Delete entry
	delResp := storeRequest(t, router, http.MethodDelete, "/selling/loyalty-point-entries/"+createdEntry.Data.ID, nil)
	if delResp.Code != http.StatusOK {
		t.Fatalf("delete entry status=%d body=%s", delResp.Code, delResp.Body.String())
	}

	// Verify entry is gone
	var count int64
	db.Model(&sellingmodel.LoyaltyPointEntry{}).Where("tenant_id = ? AND id = ?", tenant, createdEntry.Data.ID).Count(&count)
	if count != 0 {
		t.Fatalf("expected 0 entries after delete, got %d", count)
	}
}
