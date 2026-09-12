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

func TestStockEntryCreateAcceptsHTMLDateInput(t *testing.T) {
	r, _ := setupStockEntryTestRouter(t)
	payload := map[string]any{
		"naming_series":    "MAT-STE-.YYYY.-",
		"stock_entry_type": "Material Transfer",
		"purpose":          "Material Transfer",
		"company_id":       "11111111-1111-1111-1111-111111111111",
		"company":          "PT ZENIT TECHNOLOGY SOLUTION",
		"posting_date":     "2026-09-12",
		"posting_time":     "13:46:54",
		"items": []map[string]any{{
			"item_code": "MK", "source_warehouse": "Finished Goods - PZTS",
			"target_warehouse": "Goods In Transit - PZTS", "qty": 1, "uom": "Box",
			"conversion_factor": 1, "basic_rate": 0,
		}},
	}
	body, err := json.Marshal(payload)
	assert.NoError(t, err)
	req, _ := http.NewRequest(http.MethodPost, "/stock-entries", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)
	var created stockmodel.StockEntry
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &created))
	assert.Equal(t, "2026-09-12", created.PostingDate.Format("2006-01-02"))
}

func TestStockEntryUserExactPayload(t *testing.T) {
	r, _ := setupStockEntryTestRouter(t)
	rawJSON := `{"naming_series":"MAT-STE-.YYYY.-","stock_entry_type":"Material Transfer","purpose":"Material Transfer","company_id":"1ee042db-e6c0-4ee6-a17b-3c2ba6ae01fd","company":"PT ZENIT TECHNOLOGY SOLUTION","posting_date":"2026-09-12","posting_time":"18:47:21","set_posting_time":false,"inspection_required":false,"add_to_transit":false,"apply_putaway_rule":false,"work_order":"","from_bom":false,"bom_no":"","from_warehouse":"Finished Goods - PZTS","to_warehouse":"Goods In Transit - PZTS","scan_barcode":"","total_qty":1,"total_amount":1000,"status":"Draft","remarks":"","items":[{"item_code":"MK","item_name":"Lilin Million Kecil","description":"","source_warehouse":"Finished Goods - PZTS","target_warehouse":"Goods In Transit - PZTS","qty":1,"transfer_qty":1,"uom":"Box","conversion_factor":1,"basic_rate":1000,"amount":1000,"barcode":"","batch_no":"","idx":1}]}`

	req, _ := http.NewRequest(http.MethodPost, "/stock-entries", bytes.NewBufferString(rawJSON))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	t.Logf("Response code: %d, body: %s", w.Code, w.Body.String())
	assert.Equal(t, http.StatusCreated, w.Code)
}

func TestStockEntryValidationErrorMessages(t *testing.T) {
	r, _ := setupStockEntryTestRouter(t)

	// 1. Invalid JSON syntax
	req, _ := http.NewRequest(http.MethodPost, "/stock-entries", bytes.NewBufferString(`{invalid_json`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
	var errRes map[string]string
	_ = json.Unmarshal(w.Body.Bytes(), &errRes)
	assert.Contains(t, errRes["error"], "Data Stock Entry tidak valid:")

	// 2. Missing company
	noCompany := `{"stock_entry_type":"Material Transfer","items":[{"item_code":"MK","qty":1}]}`
	req, _ = http.NewRequest(http.MethodPost, "/stock-entries", bytes.NewBufferString(noCompany))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
	_ = json.Unmarshal(w.Body.Bytes(), &errRes)
	assert.Equal(t, "Company wajib diisi", errRes["error"])

	// 3. Missing items
	noItems := `{"company":"PT ZENIT TECHNOLOGY SOLUTION","stock_entry_type":"Material Transfer","items":[]}`
	req, _ = http.NewRequest(http.MethodPost, "/stock-entries", bytes.NewBufferString(noItems))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
	_ = json.Unmarshal(w.Body.Bytes(), &errRes)
	assert.Equal(t, "Stock Entry wajib memiliki minimal 1 item", errRes["error"])

	// 4. Item missing item_code
	emptyItemCode := `{"company":"PT ZENIT TECHNOLOGY SOLUTION","stock_entry_type":"Material Transfer","items":[{"item_code":"","qty":1}]}`
	req, _ = http.NewRequest(http.MethodPost, "/stock-entries", bytes.NewBufferString(emptyItemCode))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
	_ = json.Unmarshal(w.Body.Bytes(), &errRes)
	assert.Equal(t, "Item Code pada baris 1 wajib diisi", errRes["error"])
}


