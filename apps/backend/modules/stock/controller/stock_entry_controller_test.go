package controller

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	coremodel "gin-template/model"
	stockmodel "gin-template/modules/stock/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupStockEntryTestRouter(t *testing.T) (*gin.Engine, *gorm.DB) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open("file:"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{})
	assert.NoError(t, err)

	err = stockmodel.Migrate(db)
	assert.NoError(t, err)

	err = db.AutoMigrate(&coremodel.Company{})
	assert.NoError(t, err)

	comp := coremodel.Company{
		ID:           uuid.MustParse("11111111-1111-1111-1111-111111111111"),
		Name:         "PT ZENIT TECHNOLOGY SOLUTION",
		Abbreviation: "PZTS",
		IsActive:     true,
	}
	_ = db.Create(&comp)

	err = stockmodel.SeedStockEntryTypes(db, "test-tenant")
	assert.NoError(t, err)

	coremodel.DB = db

	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("tenant_id", "test-tenant")
		c.Next()
	})

	ctrl := NewStockEntryController()
	r.GET("/stock-entries/options", ctrl.Options)
	r.GET("/stock-entries", ctrl.List)
	r.POST("/stock-entries", ctrl.Create)
	r.GET("/stock-entries/:id", ctrl.Get)
	r.PUT("/stock-entries/:id", ctrl.Update)

	return r, db
}

func TestStockEntryOptionsDynamic(t *testing.T) {
	r, _ := setupStockEntryTestRouter(t)

	req, _ := http.NewRequest(http.MethodGet, "/stock-entries/options", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var res map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &res)
	assert.NoError(t, err)

	types, ok := res["stock_entry_types"].([]interface{})
	assert.True(t, ok)
	assert.GreaterOrEqual(t, len(types), 13)

	compOptions, okComp := res["company_options"].([]interface{})
	assert.True(t, okComp)
	assert.GreaterOrEqual(t, len(compOptions), 1)
}

func TestStockEntryCreateAndUpdateWithPurposeFields(t *testing.T) {
	r, _ := setupStockEntryTestRouter(t)

	// Create Manufacture entry
	entry := stockmodel.StockEntry{
		StockEntryType:     "Manufacture",
		Purpose:            "Manufacture",
		CompanyID:          "11111111-1111-1111-1111-111111111111",
		Company:            "PT ZENIT TECHNOLOGY SOLUTION",
		PostingDate:        time.Now(),
		PostingTime:        "12:00:00",
		WorkOrder:          "MFG-WO-2026-00001",
		InspectionRequired: true,
		Items: []stockmodel.StockEntryItem{
			{
				ItemCode:        "RAW-001",
				ItemName:        "Raw Material",
				SourceWarehouse: "Stores - PZTS",
				TargetWarehouse: "Work In Progress - PZTS",
				Qty:             10,
				BasicRate:       50000,
			},
		},
	}

	body, _ := json.Marshal(entry)
	req, _ := http.NewRequest(http.MethodPost, "/stock-entries", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)

	var created stockmodel.StockEntry
	err := json.Unmarshal(w.Body.Bytes(), &created)
	assert.NoError(t, err)
	assert.Equal(t, "11111111-1111-1111-1111-111111111111", created.CompanyID)
	assert.Equal(t, "PT ZENIT TECHNOLOGY SOLUTION", created.Company)
	assert.Equal(t, "MFG-WO-2026-00001", created.WorkOrder)
	assert.True(t, created.InspectionRequired)
	assert.Equal(t, float64(500000), created.TotalAmount)

	// Update to Material Transfer with transit options and company update
	created.StockEntryType = "Material Transfer"
	created.Purpose = "Material Transfer"
	created.CompanyID = "22222222-2222-2222-2222-222222222222"
	created.Company = "PT Codeverta Utama"
	created.AddToTransit = true
	created.ApplyPutawayRule = true

	bodyUpdate, _ := json.Marshal(created)
	reqUpdate, _ := http.NewRequest(http.MethodPut, "/stock-entries/"+created.ID, bytes.NewBuffer(bodyUpdate))
	reqUpdate.Header.Set("Content-Type", "application/json")
	wUpdate := httptest.NewRecorder()
	r.ServeHTTP(wUpdate, reqUpdate)

	assert.Equal(t, http.StatusOK, wUpdate.Code)

	var updated stockmodel.StockEntry
	err = json.Unmarshal(wUpdate.Body.Bytes(), &updated)
	assert.NoError(t, err)
	assert.Equal(t, "22222222-2222-2222-2222-222222222222", updated.CompanyID)
	assert.Equal(t, "PT Codeverta Utama", updated.Company)
	assert.True(t, updated.AddToTransit)
	assert.True(t, updated.ApplyPutawayRule)
}
