package controller

import (
	"encoding/json"
	"net/http"
	"testing"

	stockmodel "gin-template/modules/stock/model"
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
}
