package controller

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"

	coremodel "gin-template/model"
	crmmodel "gin-template/model/crm"
	stockmodel "gin-template/modules/stock/model"

	"github.com/google/uuid"
)

func TestDeliveryNoteCRUDAndSubmit(t *testing.T) {
	router := setupStockTestRouter(t)

	// Register DeliveryNote routes
	dnCtrl := NewDeliveryNoteController()
	router.GET("/stock/delivery-notes", dnCtrl.List)
	router.GET("/stock/delivery-notes/:id", dnCtrl.Get)
	router.POST("/stock/delivery-notes", dnCtrl.Create)
	router.PUT("/stock/delivery-notes/:id", dnCtrl.Update)
	router.POST("/stock/delivery-notes/:id/submit", dnCtrl.Submit)
	router.POST("/stock/delivery-notes/:id/return", dnCtrl.CreateReturn)
	router.DELETE("/stock/delivery-notes/:id", dnCtrl.Delete)

	// 1. Create Delivery Note
	createPayload := map[string]interface{}{
		"naming_series": "MAT-DN-.YYYY.-",
		"customer":      "PT Zenit Customer Test",
		"company":       "PT ZENIT TECHNOLOGY SOLUTION",
		"items": []map[string]interface{}{
			{
				"item_code": "ITEM-TEST-001",
				"quantity":  5,
				"rate":      10000,
				"uom":       "Nos",
				"warehouse": "Stores - PT ZENIT",
			},
		},
		"taxes": []map[string]interface{}{
			{
				"charge_type":  "On Net Total",
				"account_head": "PPN 11%",
				"rate":         11,
			},
		},
	}

	resCreate := stockRequest(t, router, http.MethodPost, "/stock/delivery-notes", createPayload)
	if resCreate.Code != http.StatusCreated {
		t.Fatalf("create delivery note status = %d, body = %s", resCreate.Code, resCreate.Body.String())
	}

	var created stockmodel.DeliveryNote
	if err := json.Unmarshal(resCreate.Body.Bytes(), &created); err != nil {
		t.Fatalf("decode created delivery note: %v", err)
	}

	if created.TotalQty != 5.0 {
		t.Fatalf("expected TotalQty = 5.0, got %f", created.TotalQty)
	}
	if created.Total != 50000.0 {
		t.Fatalf("expected Subtotal = 50000, got %f", created.Total)
	}
	if created.TotalTaxesAndCharges != 5500.0 {
		t.Fatalf("expected TotalTaxesAndCharges = 5500, got %f", created.TotalTaxesAndCharges)
	}
	if created.GrandTotal != 55500.0 {
		t.Fatalf("expected GrandTotal = 55500, got %f", created.GrandTotal)
	}

	// 2. List Delivery Notes
	resList := stockRequest(t, router, http.MethodGet, "/stock/delivery-notes", nil)
	if resList.Code != http.StatusOK {
		t.Fatalf("list delivery notes status = %d, body = %s", resList.Code, resList.Body.String())
	}

	// 3. Submit Delivery Note
	resSubmit := stockRequest(t, router, http.MethodPost, "/stock/delivery-notes/"+created.ID+"/submit", nil)
	if resSubmit.Code != http.StatusOK {
		t.Fatalf("submit delivery note status = %d, body = %s", resSubmit.Code, resSubmit.Body.String())
	}

	var submitted stockmodel.DeliveryNote
	_ = json.Unmarshal(resSubmit.Body.Bytes(), &submitted)
	if submitted.Status != stockmodel.DeliveryNoteStatusSubmitted {
		t.Fatalf("expected status = Submitted, got %s", submitted.Status)
	}

	// 4. Partial return creates a separate document and a positive stock movement.
	returnPayload := map[string]interface{}{
		"reason": "2 item rusak",
		"items": []map[string]interface{}{{
			"against_item_id": created.Items[0].ID,
			"quantity":        2,
		}},
	}
	resReturn := stockRequest(t, router, http.MethodPost, "/stock/delivery-notes/"+created.ID+"/return", returnPayload)
	if resReturn.Code != http.StatusCreated {
		t.Fatalf("create return status = %d, body = %s", resReturn.Code, resReturn.Body.String())
	}
	var returned stockmodel.DeliveryNote
	if err := json.Unmarshal(resReturn.Body.Bytes(), &returned); err != nil {
		t.Fatalf("decode returned delivery note: %v", err)
	}
	if !returned.IsReturn || returned.ReturnAgainstID != created.ID || returned.TotalQty != 2 {
		t.Fatalf("unexpected delivery return: %+v", returned)
	}
	resSubmitReturn := stockRequest(t, router, http.MethodPost, "/stock/delivery-notes/"+returned.ID+"/submit", nil)
	if resSubmitReturn.Code != http.StatusOK {
		t.Fatalf("submit return status = %d, body = %s", resSubmitReturn.Code, resSubmitReturn.Body.String())
	}

	var stockBalance float64
	if err := coremodel.DB.Model(&stockmodel.StockLedgerEntry{}).
		Where("item_code = ?", "ITEM-TEST-001").Select("COALESCE(SUM(actual_qty), 0)").Scan(&stockBalance).Error; err != nil {
		t.Fatalf("calculate stock balance: %v", err)
	}
	if stockBalance != -3 {
		t.Fatalf("expected net stock movement -3 after returning 2 of 5, got %v", stockBalance)
	}

	// 5. A second return cannot exceed the remaining three items.
	overReturn := map[string]interface{}{
		"reason": "too many",
		"items":  []map[string]interface{}{{"against_item_id": created.Items[0].ID, "quantity": 4}},
	}
	resOverReturn := stockRequest(t, router, http.MethodPost, "/stock/delivery-notes/"+created.ID+"/return", overReturn)
	if resOverReturn.Code != http.StatusConflict {
		t.Fatalf("over-return status = %d, body = %s", resOverReturn.Code, resOverReturn.Body.String())
	}

	// 6. Exchange is a new outbound Delivery Note referencing the submitted return.
	replacementPayload := map[string]interface{}{
		"replacement_for_id": returned.ID,
		"company":            "PT ZENIT TECHNOLOGY SOLUTION",
		"items": []map[string]interface{}{{
			"item_code": "ITEM-REPLACEMENT-001", "quantity": 1, "rate": 10000,
			"uom": "Nos", "warehouse": "Stores - PT ZENIT",
		}},
	}
	resReplacement := stockRequest(t, router, http.MethodPost, "/stock/delivery-notes", replacementPayload)
	if resReplacement.Code != http.StatusCreated {
		t.Fatalf("create replacement status = %d, body = %s", resReplacement.Code, resReplacement.Body.String())
	}
	var replacement stockmodel.DeliveryNote
	if err := json.Unmarshal(resReplacement.Body.Bytes(), &replacement); err != nil {
		t.Fatalf("decode replacement: %v", err)
	}
	if replacement.ReplacementForID != returned.ID || replacement.IsReturn || replacement.Customer != created.Customer {
		t.Fatalf("unexpected replacement delivery: %+v", replacement)
	}
	if response := stockRequest(t, router, http.MethodPost, "/stock/delivery-notes/"+replacement.ID+"/submit", nil); response.Code != http.StatusOK {
		t.Fatalf("submit replacement status = %d, body = %s", response.Code, response.Body.String())
	}
}

func TestCreateDeliveryNoteFromSalesOrderReference(t *testing.T) {
	router := setupStockTestRouter(t)
	dnCtrl := NewDeliveryNoteController()
	router.POST("/stock/delivery-notes", dnCtrl.Create)

	tenantID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	salesOrderID := uuid.MustParse("982704fd-635f-423a-a507-17b0234a9235")
	salesOrder := crmmodel.SalesOrder{
		Base:            crmmodel.Base{ID: salesOrderID, TenantID: tenantID},
		OrderNumber:     "SAL-ORD-2026-00001",
		Customer:        "PT Pelanggan Indonesia",
		TransactionDate: time.Date(2026, 8, 7, 0, 0, 0, 0, time.UTC),
		Currency:        "IDR",
		Status:          "confirmed",
	}
	if err := coremodel.DB.Create(&salesOrder).Error; err != nil {
		t.Fatalf("seed sales order reference: %v", err)
	}

	payload := map[string]interface{}{
		"naming_series":       "MAT-DN-.YYYY.-",
		"sales_order_id":      salesOrderID.String(),
		"posting_date":        "2026-08-07T00:00:00Z",
		"posting_time":        "10:20:18",
		"company":             "PT ZENIT TECHNOLOGY SOLUTION",
		"cost_center":         "Main - ZENIT",
		"project":             "Project A",
		"currency":            "IDR",
		"selling_price_list":  "Standard Selling",
		"ignore_pricing_rule": true,
		"items": []map[string]interface{}{{
			"item_code": "ITEM-001", "item_name": "Produk Satu", "quantity": 2,
			"rate": 100000, "uom": "Nos", "warehouse": "Stores - PT ZENIT",
		}},
	}

	response := stockRequest(t, router, http.MethodPost, "/stock/delivery-notes", payload)
	if response.Code != http.StatusCreated {
		t.Fatalf("create referenced delivery note status = %d, body = %s", response.Code, response.Body.String())
	}
	var created stockmodel.DeliveryNote
	if err := json.Unmarshal(response.Body.Bytes(), &created); err != nil {
		t.Fatalf("decode referenced delivery note: %v", err)
	}
	if created.SalesOrderID != salesOrderID.String() || created.Customer != salesOrder.Customer {
		t.Fatalf("sales order reference was not applied: %+v", created)
	}
	if created.CostCenter != "Main - ZENIT" || created.Project != "Project A" || created.Currency != "IDR" || created.SellingPriceList != "Standard Selling" || !created.IgnorePricingRule {
		t.Fatalf("delivery note dimensions were not persisted: %+v", created)
	}
	if len(created.Items) != 1 || created.TotalQty != 2 || created.Total != 200000 {
		t.Fatalf("delivery note items were not persisted: %+v", created.Items)
	}
}
