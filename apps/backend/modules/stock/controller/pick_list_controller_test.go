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
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupPickListTestRouter(t *testing.T) (*gin.Engine, *gorm.DB) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open("file:"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{})
	assert.NoError(t, err)

	err = stockmodel.Migrate(db)
	assert.NoError(t, err)

	err = db.AutoMigrate(&coremodel.Company{})
	assert.NoError(t, err)

	comp := coremodel.Company{
		ID:           uuid.MustParse("22222222-2222-2222-2222-222222222222"),
		Name:         "PT ZENIT TECHNOLOGY SOLUTION",
		Abbreviation: "PZTS",
		IsActive:     true,
	}
	_ = db.Create(&comp)

	coremodel.DB = db

	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("tenant_id", "test-tenant")
		c.Next()
	})

	ctrl := NewPickListController()
	r.GET("/pick-lists/options", ctrl.Options)
	r.GET("/pick-lists/pending-references", ctrl.GetPendingReferences)
	r.POST("/pick-lists/get-item-locations", ctrl.GetItemLocations)
	r.GET("/pick-lists", ctrl.List)
	r.GET("/pick-lists/:id", ctrl.Get)
	r.POST("/pick-lists", ctrl.Create)
	r.PUT("/pick-lists/:id", ctrl.Update)
	r.POST("/pick-lists/:id/submit", ctrl.Submit)
	r.POST("/pick-lists/:id/cancel", ctrl.Cancel)
	r.DELETE("/pick-lists/:id", ctrl.Delete)

	return r, db
}

func TestPickListCRUDAndSubmit(t *testing.T) {
	router, db := setupPickListTestRouter(t)

	// 1. Check options
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/pick-lists/options", nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	var optResp struct {
		Purposes   []string `json:"purposes"`
		Warehouses []string `json:"warehouses"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &optResp)
	assert.Contains(t, optResp.Purposes, "Delivery")

	// 2. Test GetItemLocations endpoint
	locPayload := map[string]any{
		"purpose": "Delivery",
		"items": []map[string]any{
			{
				"item_code": "FG-001",
				"item_name": "Test Product",
				"qty":       10,
				"uom":       "Nos",
			},
		},
	}
	locBody, _ := json.Marshal(locPayload)
	w = httptest.NewRecorder()
	req, _ = http.NewRequest(http.MethodPost, "/pick-lists/get-item-locations", bytes.NewReader(locBody))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	// 3. Create Pick List
	createPayload := map[string]any{
		"company":       "PT ZENIT TECHNOLOGY SOLUTION",
		"company_id":    "22222222-2222-2222-2222-222222222222",
		"purpose":       "Delivery",
		"scan_mode":     false,
		"prompt_qty":    false,
		"pick_manually": false,
		"locations": []map[string]any{
			{
				"item_code":  "FG-001",
				"item_name":  "Finished Good Motor",
				"warehouse":  "Finished Goods - PT ZENIT",
				"qty":        5,
				"stock_qty":  5,
				"picked_qty": 0,
				"uom":        "Nos",
			},
		},
	}
	createBody, _ := json.Marshal(createPayload)
	w = httptest.NewRecorder()
	req, _ = http.NewRequest(http.MethodPost, "/pick-lists", bytes.NewReader(createBody))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusCreated, w.Code)

	var created stockmodel.PickList
	err := json.Unmarshal(w.Body.Bytes(), &created)
	assert.NoError(t, err)
	assert.NotEmpty(t, created.PickListNumber)
	assert.Equal(t, stockmodel.PickListStatusDraft, created.Status)
	assert.Equal(t, 5.0, created.TotalQty)
	assert.Len(t, created.Locations, 1)

	// 4. Get By ID
	w = httptest.NewRecorder()
	req, _ = http.NewRequest(http.MethodGet, "/pick-lists/"+created.ID, nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	// 5. Update
	updatePayload := map[string]any{
		"company": "PT ZENIT TECHNOLOGY SOLUTION",
		"purpose": "Delivery",
		"remarks": "Updated remarks for picking",
		"locations": []map[string]any{
			{
				"item_code":  "FG-001",
				"item_name":  "Finished Good Motor",
				"warehouse":  "Finished Goods - PT ZENIT",
				"qty":        8,
				"stock_qty":  8,
				"picked_qty": 0,
				"uom":        "Nos",
			},
		},
	}
	updateBody, _ := json.Marshal(updatePayload)
	w = httptest.NewRecorder()
	req, _ = http.NewRequest(http.MethodPut, "/pick-lists/"+created.ID, bytes.NewReader(updateBody))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	// 6. Submit Pick List (with scan_mode false, picked_qty should become qty)
	w = httptest.NewRecorder()
	req, _ = http.NewRequest(http.MethodPost, "/pick-lists/"+created.ID+"/submit", nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	var submitted stockmodel.PickList
	_ = json.Unmarshal(w.Body.Bytes(), &submitted)
	assert.Equal(t, stockmodel.PickListStatusSubmitted, submitted.Status)
	assert.Equal(t, 8.0, submitted.TotalPickedQty)
	assert.Equal(t, 8.0, submitted.Locations[0].PickedQty)

	// 7. Cancel
	w = httptest.NewRecorder()
	req, _ = http.NewRequest(http.MethodPost, "/pick-lists/"+created.ID+"/cancel", nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	var cancelled stockmodel.PickList
	_ = json.Unmarshal(w.Body.Bytes(), &cancelled)
	assert.Equal(t, stockmodel.PickListStatusCancelled, cancelled.Status)

	_ = db
}
