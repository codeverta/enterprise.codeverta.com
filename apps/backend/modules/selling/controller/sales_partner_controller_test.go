package controller

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	coremodel "gin-template/model"
	sellingmodel "gin-template/modules/selling/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupSalesPartnerTestRouter(t *testing.T) (*gin.Engine, *gorm.DB) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	if err := db.AutoMigrate(
		&sellingmodel.SalesPartnerType{},
		&sellingmodel.ItemGroup{},
		&sellingmodel.FiscalYear{},
		&sellingmodel.SalesPartner{},
		&sellingmodel.SalesPartnerTarget{},
		&sellingmodel.Territory{},
	); err != nil {
		t.Fatalf("migrate database: %v", err)
	}
	coremodel.DB = db
	controller := NewSalesPartnerController()
	router := gin.New()
	router.Use(func(ctx *gin.Context) {
		ctx.Set("db", db)
		ctx.Set("tenant_id", "tenant-partner-test")
		ctx.Next()
	})
	router.GET("/selling/sales-partner-types", controller.ListPartnerTypes)
	router.POST("/selling/sales-partner-types", controller.CreatePartnerType)
	router.GET("/selling/item-groups", controller.ListItemGroups)
	router.POST("/selling/item-groups", controller.CreateItemGroup)
	router.GET("/selling/fiscal-years", controller.ListFiscalYears)
	router.POST("/selling/fiscal-years", controller.CreateFiscalYear)
	router.GET("/selling/sales-partners/options", controller.Options)
	router.GET("/selling/sales-partners", controller.List)
	router.GET("/selling/sales-partners/:id", controller.Get)
	router.POST("/selling/sales-partners", controller.Create)
	router.PUT("/selling/sales-partners/:id", controller.Update)
	router.DELETE("/selling/sales-partners/:id", controller.Delete)
	return router, db
}

func partnerRequest(t *testing.T, router *gin.Engine, method, path string, payload interface{}) *httptest.ResponseRecorder {
	t.Helper()
	var body bytes.Buffer
	if payload != nil {
		if err := json.NewEncoder(&body).Encode(payload); err != nil {
			t.Fatalf("encode payload: %v", err)
		}
	}
	req, err := http.NewRequest(method, path, &body)
	if err != nil {
		t.Fatalf("create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)
	return recorder
}

func TestSalesPartnerCRUDAndMasters(t *testing.T) {
	router, _ := setupSalesPartnerTestRouter(t)

	// 1. Verify Partner Types seeded with 7 types
	ptRes := partnerRequest(t, router, http.MethodGet, "/selling/sales-partner-types", nil)
	if ptRes.Code != http.StatusOK {
		t.Fatalf("list partner types status = %d, body = %s", ptRes.Code, ptRes.Body.String())
	}
	var ptBody struct {
		Data []sellingmodel.SalesPartnerType `json:"data"`
	}
	if err := json.Unmarshal(ptRes.Body.Bytes(), &ptBody); err != nil {
		t.Fatalf("unmarshal partner types: %v", err)
	}
	if len(ptBody.Data) < 7 {
		t.Fatalf("expected >= 7 partner types, got %d", len(ptBody.Data))
	}

	// 2. Verify Item Groups seeded
	igRes := partnerRequest(t, router, http.MethodGet, "/selling/item-groups", nil)
	if igRes.Code != http.StatusOK {
		t.Fatalf("list item groups status = %d", igRes.Code)
	}

	// 3. Verify Fiscal Years seeded
	fyRes := partnerRequest(t, router, http.MethodGet, "/selling/fiscal-years", nil)
	if fyRes.Code != http.StatusOK {
		t.Fatalf("list fiscal years status = %d", fyRes.Code)
	}

	// 4. Create Sales Partner
	createPayload := map[string]interface{}{
		"partner_name":    "PT Mitra Sukses Abadi",
		"partner_type":    "Distributor",
		"territory":       "Indonesia",
		"commission_rate": 5.5,
		"show_in_website": true,
		"referral_code":   "REF-MITRA-001",
		"disabled":        false,
		"targets": []map[string]interface{}{
			{
				"item_group":      "Products",
				"fiscal_year":     "2026",
				"target_qty":      1000,
				"target_amount":   250000000,
				"distribution_id": "Even",
			},
		},
	}
	createRes := partnerRequest(t, router, http.MethodPost, "/selling/sales-partners", createPayload)
	if createRes.Code != http.StatusCreated {
		t.Fatalf("create status = %d, body = %s", createRes.Code, createRes.Body.String())
	}
	var created sellingmodel.SalesPartner
	if err := json.Unmarshal(createRes.Body.Bytes(), &created); err != nil {
		t.Fatalf("unmarshal created: %v", err)
	}
	if created.PartnerName != "PT Mitra Sukses Abadi" || len(created.Targets) != 1 {
		t.Fatalf("unexpected created partner: %+v", created)
	}
	if created.CommissionRate != 5.5 || created.ReferralCode != "REF-MITRA-001" {
		t.Fatalf("unexpected partner fields: %+v", created)
	}

	// 5. Get Sales Partner
	getRes := partnerRequest(t, router, http.MethodGet, "/selling/sales-partners/"+created.ID, nil)
	if getRes.Code != http.StatusOK {
		t.Fatalf("get status = %d, body = %s", getRes.Code, getRes.Body.String())
	}

	// 6. Update Sales Partner
	updatePayload := map[string]interface{}{
		"partner_name":    "PT Mitra Sukses Abadi (Updated)",
		"partner_type":    "Reseller",
		"territory":       "Indonesia",
		"commission_rate": 7.0,
		"show_in_website": false,
		"referral_code":   "REF-MITRA-002",
		"disabled":        false,
		"targets": []map[string]interface{}{
			{
				"item_group":      "Products",
				"fiscal_year":     "2026",
				"target_qty":      1500,
				"target_amount":   350000000,
				"distribution_id": "Quarterly",
			},
			{
				"item_group":      "Services",
				"fiscal_year":     "2026",
				"target_qty":      200,
				"target_amount":   50000000,
				"distribution_id": "Even",
			},
		},
	}
	updateRes := partnerRequest(t, router, http.MethodPut, "/selling/sales-partners/"+created.ID, updatePayload)
	if updateRes.Code != http.StatusOK {
		t.Fatalf("update status = %d, body = %s", updateRes.Code, updateRes.Body.String())
	}
	var updated sellingmodel.SalesPartner
	if err := json.Unmarshal(updateRes.Body.Bytes(), &updated); err != nil {
		t.Fatalf("unmarshal updated: %v", err)
	}
	if updated.PartnerName != "PT Mitra Sukses Abadi (Updated)" || len(updated.Targets) != 2 {
		t.Fatalf("unexpected updated partner: %+v", updated)
	}

	// 7. Delete Sales Partner
	delRes := partnerRequest(t, router, http.MethodDelete, "/selling/sales-partners/"+created.ID, nil)
	if delRes.Code != http.StatusOK {
		t.Fatalf("delete status = %d, body = %s", delRes.Code, delRes.Body.String())
	}
}
