package controller

import (
	"encoding/json"
	"net/http"
	"testing"

	coremodel "gin-template/model"
	stockmodel "gin-template/modules/stock/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupStockEntryTypeTestRouter(t *testing.T) (*gin.Engine, *gorm.DB) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open("file:"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(&stockmodel.StockEntryType{}); err != nil {
		t.Fatalf("migrate db: %v", err)
	}
	coremodel.DB = db

	ctrl := NewStockEntryTypeController()

	router := gin.New()
	router.Use(func(ctx *gin.Context) {
		ctx.Set("db", db)
		ctx.Set("tenant_id", "00000000-0000-0000-0000-000000000001")
		ctx.Next()
	})

	router.GET("/stock/stock-entry-types", ctrl.List)
	router.GET("/stock/stock-entry-types/purposes", ctrl.Purposes)
	router.GET("/stock/stock-entry-types/:id", ctrl.Get)
	router.POST("/stock/stock-entry-types", ctrl.Create)
	router.PUT("/stock/stock-entry-types/:id", ctrl.Update)
	router.DELETE("/stock/stock-entry-types/:id", ctrl.Delete)
	router.POST("/stock/stock-entry-types/seed", ctrl.Seed)

	return router, db
}

func TestStockEntryTypeAutoSeedAndList(t *testing.T) {
	router, _ := setupStockEntryTypeTestRouter(t)

	// 1. Calling List should auto-seed 13 standard types
	res := stockRequest(t, router, http.MethodGet, "/stock/stock-entry-types", nil)
	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", res.Code, res.Body.String())
	}

	var body struct {
		Data  []stockmodel.StockEntryType `json:"data"`
		Count int                         `json:"count"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}

	if len(body.Data) != 13 {
		t.Fatalf("expected 13 standard stock entry types, got %d", len(body.Data))
	}

	// Check if "Material Issue" and "Manufacture" exist
	hasMaterialIssue := false
	hasManufacture := false
	for _, it := range body.Data {
		if it.Name == "Material Issue" && it.Purpose == "Material Issue" {
			hasMaterialIssue = true
		}
		if it.Name == "Manufacture" && it.Purpose == "Manufacture" {
			hasManufacture = true
		}
	}
	if !hasMaterialIssue || !hasManufacture {
		t.Fatalf("expected standard types to contain Material Issue and Manufacture")
	}

	// 2. Purposes endpoint
	purposeRes := stockRequest(t, router, http.MethodGet, "/stock/stock-entry-types/purposes", nil)
	if purposeRes.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", purposeRes.Code)
	}
}

func TestStockEntryTypeCRUD(t *testing.T) {
	router, _ := setupStockEntryTypeTestRouter(t)

	// 1. Create custom stock entry type
	createPayload := CreateStockEntryTypeRequest{
		Name:        "Custom Internal Scrap",
		Purpose:     "Material Issue",
		Description: "Pembuangan barang rusak internal",
	}
	res := stockRequest(t, router, http.MethodPost, "/stock/stock-entry-types", createPayload)
	if res.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", res.Code, res.Body.String())
	}

	var created stockmodel.StockEntryType
	if err := json.NewDecoder(res.Body).Decode(&created); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if created.Name != "Custom Internal Scrap" {
		t.Fatalf("expected Custom Internal Scrap, got %s", created.Name)
	}

	// 2. Get by ID
	getRes := stockRequest(t, router, http.MethodGet, "/stock/stock-entry-types/"+created.ID, nil)
	if getRes.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", getRes.Code)
	}

	// 3. Update
	updPayload := map[string]interface{}{
		"description": "Deskripsi diperbarui",
		"disabled":    true,
	}
	updRes := stockRequest(t, router, http.MethodPut, "/stock/stock-entry-types/"+created.ID, updPayload)
	if updRes.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", updRes.Code)
	}

	// 4. Delete
	delRes := stockRequest(t, router, http.MethodDelete, "/stock/stock-entry-types/"+created.ID, nil)
	if delRes.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", delRes.Code)
	}
}
