package controller

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	coremodel "gin-template/model"
	hrmodel "gin-template/modules/hr/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupHRTestRouter(t *testing.T) (*gin.Engine, *gorm.DB) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open("file:"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open hr test database: %v", err)
	}
	if err := db.AutoMigrate(
		&coremodel.User{},
		&coremodel.Profile{},
		&hrmodel.PayrollEntry{},
		&hrmodel.PayrollEntryEmployee{},
	); err != nil {
		t.Fatalf("migrate hr test database: %v", err)
	}
	coremodel.DB = db

	// Seed test active users
	tenantUUID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	user1 := coremodel.User{
		ID:          uuid.New(),
		TenantID:    &tenantUUID,
		Username:    "budi_hr",
		DisplayName: "Budi Santoso",
		Email:       "budi@example.com",
		Status:      1,
		Balance:     5000000,
	}
	user2 := coremodel.User{
		ID:          uuid.New(),
		TenantID:    &tenantUUID,
		Username:    "siti_eng",
		DisplayName: "Siti Rahma",
		Email:       "siti@example.com",
		Status:      1,
		Balance:     7500000,
	}
	if err := db.Create(&user1).Error; err != nil {
		t.Fatalf("failed to create user1: %v", err)
	}
	if err := db.Create(&user2).Error; err != nil {
		t.Fatalf("failed to create user2: %v", err)
	}

	ctrl := NewPayrollEntryController()
	router := gin.New()
	router.Use(func(ctx *gin.Context) {
		ctx.Set("db", db)
		ctx.Set("tenant_id", "00000000-0000-0000-0000-000000000001")
		ctx.Next()
	})

	router.GET("/hr/payroll-entries/options", ctrl.Options)
	router.GET("/hr/payroll-entries", ctrl.List)
	router.POST("/hr/payroll-entries", ctrl.Create)
	router.GET("/hr/payroll-entries/:id", ctrl.Get)
	router.PUT("/hr/payroll-entries/:id", ctrl.Update)
	router.DELETE("/hr/payroll-entries/:id", ctrl.Delete)
	router.POST("/hr/payroll-entries/:id/get-employees", ctrl.GetEmployees)
	router.POST("/hr/payroll-entries/:id/submit", ctrl.Submit)

	return router, db
}

func TestPayrollEntryCRUDGetEmployeesAndSubmit(t *testing.T) {
	router, db := setupHRTestRouter(t)

	// 1. Create Payroll Entry
	createBody := hrmodel.PayrollEntry{
		Company:          "PT ZENIT TECHNOLOGY SOLUTION",
		PayrollFrequency: "Monthly",
		PostingDate:      time.Now(),
		StartDate:        time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC),
		EndDate:          time.Date(2026, 9, 30, 0, 0, 0, 0, time.UTC),
	}
	payload, _ := json.Marshal(createBody)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/hr/payroll-entries", bytes.NewBuffer(payload))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected status 201, got %d: %s", w.Code, w.Body.String())
	}

	var created hrmodel.PayrollEntry
	if err := json.Unmarshal(w.Body.Bytes(), &created); err != nil {
		t.Fatalf("unmarshal created payroll entry: %v", err)
	}
	if created.ID == "" {
		t.Fatal("expected ID to be generated")
	}

	// 2. Get Employees (Auto Populate)
	wGetEmp := httptest.NewRecorder()
	reqGetEmp, _ := http.NewRequest(http.MethodPost, "/hr/payroll-entries/"+created.ID+"/get-employees", nil)
	router.ServeHTTP(wGetEmp, reqGetEmp)

	if wGetEmp.Code != http.StatusOK {
		t.Fatalf("expected status 200 on get-employees, got %d: %s", wGetEmp.Code, wGetEmp.Body.String())
	}

	var populated hrmodel.PayrollEntry
	if err := json.Unmarshal(wGetEmp.Body.Bytes(), &populated); err != nil {
		t.Fatalf("unmarshal populated payroll entry: %v", err)
	}
	if len(populated.Items) < 2 {
		t.Fatalf("expected at least 2 employees populated, got %d", len(populated.Items))
	}
	if populated.TotalNetPay <= 0 {
		t.Fatalf("expected total net pay to be > 0, got %f", populated.TotalNetPay)
	}

	// 3. Submit Payroll Entry
	wSub := httptest.NewRecorder()
	reqSub, _ := http.NewRequest(http.MethodPost, "/hr/payroll-entries/"+created.ID+"/submit", nil)
	router.ServeHTTP(wSub, reqSub)

	if wSub.Code != http.StatusOK {
		t.Fatalf("expected status 200 on submit, got %d: %s", wSub.Code, wSub.Body.String())
	}

	// Verify database status
	var final hrmodel.PayrollEntry
	db.Preload("Items").First(&final, "id = ?", created.ID)
	if final.Status != hrmodel.PayrollEntryStatusSubmitted {
		t.Fatalf("expected status Submitted, got %s", final.Status)
	}
	if !final.SalarySlipCreated {
		t.Fatal("expected SalarySlipCreated to be true")
	}
}
