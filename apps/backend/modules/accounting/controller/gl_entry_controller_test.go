package controller

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	coremodel "gin-template/model"
	accountingmodel "gin-template/modules/accounting/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupGLEntryTestRouter(t *testing.T) (*gin.Engine, *gorm.DB) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open("file:"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open gl entry test database: %v", err)
	}

	if err := db.AutoMigrate(&coremodel.Company{}, &accountingmodel.Account{}, &accountingmodel.GLEntry{}); err != nil {
		t.Fatalf("migrate gl entry test database: %v", err)
	}
	if err := db.Exec("INSERT INTO companies (id, name, abbreviation, currency, is_active, tenant_id) VALUES (?, ?, ?, ?, ?, ?)", uuid.NewString(), "PT ZENIT TECHNOLOGY SOLUTION", "PZTS", "IDR", true, "test-tenant-1").Error; err != nil {
		t.Fatalf("seed company fixture: %v", err)
	}
	coremodel.DB = db

	ctrl := NewGLEntryController()
	router := gin.New()
	router.Use(func(ctx *gin.Context) {
		ctx.Set("db", db)
		ctx.Set("tenant_id", "test-tenant-1")
		ctx.Next()
	})

	router.GET("/accounting/gl-entries", ctrl.List)
	router.GET("/accounting/gl-entries/options", ctrl.Options)
	router.GET("/accounting/gl-entries/:id", ctrl.Get)
	router.POST("/accounting/gl-entries", ctrl.Create)
	router.PUT("/accounting/gl-entries/:id", ctrl.Update)
	router.DELETE("/accounting/gl-entries/:id", ctrl.Delete)

	return router, db
}

func glRequest(t *testing.T, router http.Handler, method, path string, payload interface{}) *httptest.ResponseRecorder {
	t.Helper()
	var body bytes.Buffer
	if payload != nil {
		if err := json.NewEncoder(&body).Encode(payload); err != nil {
			t.Fatalf("encode request: %v", err)
		}
	}
	req, err := http.NewRequest(method, path, &body)
	if err != nil {
		t.Fatalf("new request %s %s: %v", method, path, err)
	}
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

func TestGLEntryAutoSeedAndList(t *testing.T) {
	router, _ := setupGLEntryTestRouter(t)

	// List GL entries - should auto seed default entries including 82808c1ee5
	res := glRequest(t, router, http.MethodGet, "/accounting/gl-entries", nil)
	if res.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", res.Code, res.Body.String())
	}

	var listResp struct {
		Data        []accountingmodel.GLEntry `json:"data"`
		Total       int64                     `json:"total"`
		TotalDebit  float64                   `json:"total_debit"`
		TotalCredit float64                   `json:"total_credit"`
		Difference  float64                   `json:"difference"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &listResp); err != nil {
		t.Fatalf("decode list response: %v", err)
	}

	if listResp.Total < 2 {
		t.Fatalf("expected at least 2 entries, got %d", listResp.Total)
	}

	// Verify entry 82808c1ee5 exists with exact attributes from prompt
	var found *accountingmodel.GLEntry
	for i := range listResp.Data {
		if listResp.Data[i].ID == "82808c1ee5" {
			found = &listResp.Data[i]
			break
		}
	}

	if found == nil {
		t.Fatalf("expected entry with ID 82808c1ee5, not found")
	}

	if found.Account != "4210.000 - HPP Pembelian - PZTS" {
		t.Errorf("expected account '4210.000 - HPP Pembelian - PZTS', got '%s'", found.Account)
	}
	if found.Against != "1141.000 - Persediaan Barang - PZTS" {
		t.Errorf("expected against '1141.000 - Persediaan Barang - PZTS', got '%s'", found.Against)
	}
	if found.VoucherType != "Delivery Note" {
		t.Errorf("expected voucher_type 'Delivery Note', got '%s'", found.VoucherType)
	}
	if found.VoucherNo != "MAT-DN-2026-00001" {
		t.Errorf("expected voucher_no 'MAT-DN-2026-00001', got '%s'", found.VoucherNo)
	}
	if found.Credit != 10000 {
		t.Errorf("expected credit 10000, got %f", found.Credit)
	}
	if !found.IsCancelled {
		t.Errorf("expected is_cancelled = true")
	}
	if found.Remarks != "On cancellation of MAT-DN-2026-00001" {
		t.Errorf("expected remarks 'On cancellation of MAT-DN-2026-00001', got '%s'", found.Remarks)
	}
	if found.Company != "PT ZENIT TECHNOLOGY SOLUTION" {
		t.Errorf("expected company 'PT ZENIT TECHNOLOGY SOLUTION', got '%s'", found.Company)
	}
	if found.CostCenter != "Main - PZTS" {
		t.Errorf("expected cost center 'Main - PZTS', got '%s'", found.CostCenter)
	}
}

func TestGLEntryGetByID(t *testing.T) {
	router, _ := setupGLEntryTestRouter(t)

	// Fetch 82808c1ee5 directly
	res := glRequest(t, router, http.MethodGet, "/accounting/gl-entries/82808c1ee5", nil)
	if res.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", res.Code, res.Body.String())
	}

	var getResp struct {
		Data accountingmodel.GLEntry `json:"data"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &getResp); err != nil {
		t.Fatalf("decode get response: %v", err)
	}

	if getResp.Data.ID != "82808c1ee5" {
		t.Errorf("expected ID 82808c1ee5, got %s", getResp.Data.ID)
	}
	if getResp.Data.FiscalYear != "2026" {
		t.Errorf("expected fiscal year 2026, got %s", getResp.Data.FiscalYear)
	}
	if getResp.Data.AccountCurrency != "IDR" {
		t.Errorf("expected account currency IDR, got %s", getResp.Data.AccountCurrency)
	}
}

func TestGLEntryFilterAndSearch(t *testing.T) {
	router, _ := setupGLEntryTestRouter(t)

	// Filter by voucher_type = Delivery Note
	resDN := glRequest(t, router, http.MethodGet, "/accounting/gl-entries?voucher_type=Delivery%20Note", nil)
	if resDN.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", resDN.Code)
	}
	var dnResp struct {
		Data []accountingmodel.GLEntry `json:"data"`
	}
	_ = json.Unmarshal(resDN.Body.Bytes(), &dnResp)
	for _, entry := range dnResp.Data {
		if entry.VoucherType != "Delivery Note" {
			t.Errorf("expected voucher_type 'Delivery Note', got %s", entry.VoucherType)
		}
	}

	// Filter by is_cancelled = true
	resCancel := glRequest(t, router, http.MethodGet, "/accounting/gl-entries?is_cancelled=true", nil)
	var cancelResp struct {
		Data []accountingmodel.GLEntry `json:"data"`
	}
	_ = json.Unmarshal(resCancel.Body.Bytes(), &cancelResp)
	for _, entry := range cancelResp.Data {
		if !entry.IsCancelled {
			t.Errorf("expected entry %s to be cancelled", entry.ID)
		}
	}
}

func TestGLEntryCRUD(t *testing.T) {
	router, _ := setupGLEntryTestRouter(t)

	// Create new manual entry
	newEntry := map[string]interface{}{
		"account":          "5110.000 - Biaya Gaji - PZTS",
		"against":          "1121.001 - Bank Mandiri - PZTS",
		"voucher_type":     "Journal Entry",
		"voucher_no":       "JV-2026-00099",
		"posting_date":     time.Date(2026, 8, 20, 0, 0, 0, 0, time.UTC),
		"debit":            7500000,
		"credit":           0,
		"remarks":          "Monthly Salary Payment",
		"cost_center":      "Main - PZTS",
		"company":          "PT ZENIT TECHNOLOGY SOLUTION",
	}

	resCreate := glRequest(t, router, http.MethodPost, "/accounting/gl-entries", newEntry)
	if resCreate.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d: %s", resCreate.Code, resCreate.Body.String())
	}

	var created struct {
		Data accountingmodel.GLEntry `json:"data"`
	}
	_ = json.Unmarshal(resCreate.Body.Bytes(), &created)
	if created.Data.ID == "" {
		t.Fatalf("expected generated ID, got empty")
	}
	if created.Data.Debit != 7500000 {
		t.Errorf("expected debit 7500000, got %f", created.Data.Debit)
	}

	// Update entry
	updatePayload := map[string]interface{}{
		"remarks": "Updated Salary Remarks",
	}
	resUpdate := glRequest(t, router, http.MethodPut, "/accounting/gl-entries/"+created.Data.ID, updatePayload)
	if resUpdate.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on update, got %d", resUpdate.Code)
	}

	// Delete entry
	resDel := glRequest(t, router, http.MethodDelete, "/accounting/gl-entries/"+created.Data.ID, nil)
	if resDel.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on delete, got %d", resDel.Code)
	}
}

func TestGLEntryOptions(t *testing.T) {
	router, _ := setupGLEntryTestRouter(t)

	res := glRequest(t, router, http.MethodGet, "/accounting/gl-entries/options", nil)
	if res.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", res.Code)
	}

	var optionsResp struct {
		Accounts     []string `json:"accounts"`
		Companies    []string `json:"companies"`
		CostCenters  []string `json:"cost_centers"`
		VoucherTypes []string `json:"voucher_types"`
		Currencies   []string `json:"currencies"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &optionsResp); err != nil {
		t.Fatalf("decode options response: %v", err)
	}

	if len(optionsResp.Accounts) == 0 {
		t.Errorf("expected accounts options")
	}
	if len(optionsResp.VoucherTypes) == 0 {
		t.Errorf("expected voucher types options")
	}
}
