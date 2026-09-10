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

func setupSerialBatchTestRouter(t *testing.T) (*gin.Engine, *gorm.DB) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open("file:"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(
		&stockmodel.SerialNo{},
		&stockmodel.Batch{},
		&stockmodel.Warehouse{},
	); err != nil {
		t.Fatalf("migrate db: %v", err)
	}
	coremodel.DB = db

	serialCtrl := NewSerialNoController()
	batchCtrl := NewBatchController()

	router := gin.New()
	router.Use(func(ctx *gin.Context) {
		ctx.Set("db", db)
		ctx.Set("tenant_id", "00000000-0000-0000-0000-000000000001")
		ctx.Next()
	})

	router.GET("/stock/serial-nos", serialCtrl.List)
	router.GET("/stock/serial-nos/:id", serialCtrl.Get)
	router.POST("/stock/serial-nos", serialCtrl.Create)
	router.PUT("/stock/serial-nos/:id", serialCtrl.Update)
	router.DELETE("/stock/serial-nos/:id", serialCtrl.Delete)

	router.GET("/stock/batches", batchCtrl.List)
	router.GET("/stock/batches/:id", batchCtrl.Get)
	router.POST("/stock/batches", batchCtrl.Create)
	router.PUT("/stock/batches/:id", batchCtrl.Update)
	router.DELETE("/stock/batches/:id", batchCtrl.Delete)

	return router, db
}

func TestSerialNoCRUD(t *testing.T) {
	router, _ := setupSerialBatchTestRouter(t)

	// 1. Create Serial No
	createPayload := CreateSerialNoRequest{
		SerialNo:  "SN-TEST-001",
		ItemCode:  "ITEM-LAPTOP-01",
		ItemName:  "Business Laptop Pro 14",
		Warehouse: "Stores - PZTS",
		Status:    "Available",
	}
	res := stockRequest(t, router, http.MethodPost, "/stock/serial-nos", createPayload)
	if res.Code != http.StatusCreated {
		t.Fatalf("expected status 201, got %d: %s", res.Code, res.Body.String())
	}

	var created stockmodel.SerialNo
	if err := json.NewDecoder(res.Body).Decode(&created); err != nil {
		t.Fatalf("decode created serial no: %v", err)
	}
	if created.SerialNo != "SN-TEST-001" {
		t.Fatalf("expected SN-TEST-001, got %s", created.SerialNo)
	}

	// 2. List Serial Nos
	listRes := stockRequest(t, router, http.MethodGet, "/stock/serial-nos?status=Available", nil)
	if listRes.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", listRes.Code)
	}

	// 3. Update Serial No
	updatePayload := map[string]interface{}{
		"status":   "Delivered",
		"customer": "Customer PT Maju",
	}
	updRes := stockRequest(t, router, http.MethodPut, "/stock/serial-nos/"+created.ID, updatePayload)
	if updRes.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", updRes.Code, updRes.Body.String())
	}

	// 4. Delete Serial No
	delRes := stockRequest(t, router, http.MethodDelete, "/stock/serial-nos/"+created.ID, nil)
	if delRes.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", delRes.Code)
	}
}

func TestBatchCRUD(t *testing.T) {
	router, _ := setupSerialBatchTestRouter(t)

	// 1. Create Batch
	createPayload := CreateBatchRequest{
		BatchID:          "BATCH-LOT-999",
		ItemCode:         "ITEM-PARACETAMOL-500",
		ItemName:         "Paracetamol 500mg",
		BatchQty:         5000,
		ShelfLifeInDays:  365,
	}
	res := stockRequest(t, router, http.MethodPost, "/stock/batches", createPayload)
	if res.Code != http.StatusCreated {
		t.Fatalf("expected status 201, got %d: %s", res.Code, res.Body.String())
	}

	var created stockmodel.Batch
	if err := json.NewDecoder(res.Body).Decode(&created); err != nil {
		t.Fatalf("decode created batch: %v", err)
	}
	if created.BatchID != "BATCH-LOT-999" {
		t.Fatalf("expected BATCH-LOT-999, got %s", created.BatchID)
	}

	// 2. List Batches
	listRes := stockRequest(t, router, http.MethodGet, "/stock/batches?status=Active", nil)
	if listRes.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", listRes.Code)
	}

	// 3. Delete Batch
	delRes := stockRequest(t, router, http.MethodDelete, "/stock/batches/"+created.ID, nil)
	if delRes.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", delRes.Code)
	}
}
