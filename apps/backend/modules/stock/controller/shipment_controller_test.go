package controller

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	coremodel "gin-template/model"
	stockmodel "gin-template/modules/stock/model"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupStockTestRouter(t *testing.T) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open stock test database: %v", err)
	}
	if err := db.AutoMigrate(
		&stockmodel.Shipment{}, &stockmodel.ShipmentParcel{}, &stockmodel.ShipmentDeliveryNote{},
		&stockmodel.DeliveryNote{}, &stockmodel.DeliveryNoteItem{}, &stockmodel.DeliveryNoteTax{},
	); err != nil {
		t.Fatalf("migrate stock test database: %v", err)
	}
	coremodel.DB = db

	ctrl := NewShipmentController()
	router := gin.New()
	router.Use(func(ctx *gin.Context) {
		ctx.Set("db", db)
		ctx.Set("tenant_id", "tenant-stock-test")
		ctx.Next()
	})

	router.GET("/stock/shipments", ctrl.List)
	router.GET("/stock/shipments/:id", ctrl.Get)
	router.POST("/stock/shipments", ctrl.Create)
	router.PUT("/stock/shipments/:id", ctrl.Update)
	router.POST("/stock/shipments/:id/submit", ctrl.Submit)
	router.DELETE("/stock/shipments/:id", ctrl.Delete)
	return router
}

func stockRequest(t *testing.T, router http.Handler, method, path string, payload interface{}) *httptest.ResponseRecorder {
	t.Helper()
	var body bytes.Buffer
	if payload != nil {
		if err := json.NewEncoder(&body).Encode(payload); err != nil {
			t.Fatalf("encode request: %v", err)
		}
	}
	req := httptest.NewRequest(method, path, &body)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

func TestShipmentCRUDAndSubmit(t *testing.T) {
	router := setupStockTestRouter(t)

	// 1. Create Shipment
	createPayload := map[string]interface{}{
		"pickup_from_type":     "Company",
		"pickup_company":       "PT ZENIT TECHNOLOGY SOLUTION",
		"delivery_to_type":     "Customer",
		"delivery_customer":   "Zenit Customer Test",
		"carrier":             "JNE",
		"awb_number":          "JNE-123456789",
		"parcels": []map[string]interface{}{
			{"length": 20, "width": 15, "height": 10, "weight": 2.5, "count": 2, "parcel_template": "Medium Box"},
		},
		"delivery_notes": []map[string]interface{}{
			{"delivery_note": "MAT-DN-2026-00001", "value": 50000},
		},
	}

	resCreate := stockRequest(t, router, http.MethodPost, "/stock/shipments", createPayload)
	if resCreate.Code != http.StatusCreated {
		t.Fatalf("create shipment status = %d, body = %s", resCreate.Code, resCreate.Body.String())
	}

	var created stockmodel.Shipment
	if err := json.Unmarshal(resCreate.Body.Bytes(), &created); err != nil {
		t.Fatalf("decode created shipment: %v", err)
	}

	if created.TotalWeight != 5.0 {
		t.Fatalf("expected total_weight = 5.0, got %f", created.TotalWeight)
	}
	if len(created.Parcels) != 1 || len(created.DeliveryNotes) != 1 {
		t.Fatalf("expected 1 parcel and 1 delivery note, got parcels=%d, dns=%d", len(created.Parcels), len(created.DeliveryNotes))
	}

	// 2. List Shipments
	resList := stockRequest(t, router, http.MethodGet, "/stock/shipments", nil)
	if resList.Code != http.StatusOK {
		t.Fatalf("list shipments status = %d, body = %s", resList.Code, resList.Body.String())
	}

	// 3. Submit Shipment
	resSubmit := stockRequest(t, router, http.MethodPost, "/stock/shipments/"+created.ID+"/submit", nil)
	if resSubmit.Code != http.StatusOK {
		t.Fatalf("submit shipment status = %d, body = %s", resSubmit.Code, resSubmit.Body.String())
	}

	var submitted stockmodel.Shipment
	_ = json.Unmarshal(resSubmit.Body.Bytes(), &submitted)
	if submitted.Status != stockmodel.ShipmentStatusSubmitted {
		t.Fatalf("expected status = Submitted, got %s", submitted.Status)
	}
}
