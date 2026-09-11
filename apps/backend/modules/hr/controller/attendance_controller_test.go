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

func setupAttendanceTestRouter(t *testing.T) (*gin.Engine, *gorm.DB, coremodel.User) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open("file:"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open attendance test db: %v", err)
	}
	if err := db.AutoMigrate(
		&coremodel.User{},
		&coremodel.Profile{},
		&hrmodel.Attendance{},
		&hrmodel.EmployeeCheckin{},
		&hrmodel.ShiftType{},
	); err != nil {
		t.Fatalf("migrate test db: %v", err)
	}
	coremodel.DB = db

	tenantUUID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	testUser := coremodel.User{
		ID:          uuid.New(),
		TenantID:    &tenantUUID,
		Username:    "agus_staff",
		DisplayName: "Agus Pratama",
		Email:       "agus@example.com",
		Status:      1,
	}
	if err := db.Create(&testUser).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}

	ctrl := NewAttendanceController()
	router := gin.New()
	router.Use(func(ctx *gin.Context) {
		ctx.Set("db", db)
		ctx.Set("tenant_id", "00000000-0000-0000-0000-000000000001")
		ctx.Next()
	})

	router.GET("/hr/attendances/options", ctrl.Options)
	router.GET("/hr/attendances/stats", ctrl.Stats)
	router.GET("/hr/attendances", ctrl.List)
	router.POST("/hr/attendances", ctrl.Create)
	router.GET("/hr/attendances/:id", ctrl.Get)
	router.PUT("/hr/attendances/:id", ctrl.Update)
	router.DELETE("/hr/attendances/:id", ctrl.Delete)
	router.POST("/hr/attendances/mark-bulk", ctrl.MarkBulk)
	router.POST("/hr/checkins/scan", ctrl.ProcessScan)
	router.GET("/hr/checkins", ctrl.Checkins)

	return router, db, testUser
}

func TestAttendanceValidationAndWorkflow(t *testing.T) {
	router, db, testUser := setupAttendanceTestRouter(t)

	// 1. Validation: Future date should be rejected
	futureDate := time.Now().AddDate(0, 0, 5)
	futureBody := hrmodel.Attendance{
		UserID:         testUser.ID.String(),
		EmployeeName:   testUser.DisplayName,
		AttendanceDate: futureDate,
		Status:         hrmodel.AttendanceStatusPresent,
	}
	payload, _ := json.Marshal(futureBody)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/hr/attendances", bytes.NewBuffer(payload))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400 for future date, got %d", w.Code)
	}

	// 2. Create valid attendance for today
	validBody := hrmodel.Attendance{
		UserID:         testUser.ID.String(),
		EmployeeName:   testUser.DisplayName,
		AttendanceDate: time.Now(),
		Status:         hrmodel.AttendanceStatusPresent,
		Shift:          "General Shift",
	}
	payload, _ = json.Marshal(validBody)
	w = httptest.NewRecorder()
	req, _ = http.NewRequest(http.MethodPost, "/hr/attendances", bytes.NewBuffer(payload))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected status 201, got %d: %s", w.Code, w.Body.String())
	}

	// 3. Test QR/Fingerprint Checkin ProcessScan
	scanBody := map[string]string{
		"identifier": testUser.Email,
		"source":     "QR Code",
		"device_id":  "Lobby Kiosk Scanner",
		"log_type":   "OUT",
	}
	payload, _ = json.Marshal(scanBody)
	wScan := httptest.NewRecorder()
	reqScan, _ := http.NewRequest(http.MethodPost, "/hr/checkins/scan", bytes.NewBuffer(payload))
	reqScan.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(wScan, reqScan)

	if wScan.Code != http.StatusOK {
		t.Fatalf("expected status 200 on scan, got %d: %s", wScan.Code, wScan.Body.String())
	}

	// 4. Test Bulk Attendance Tool
	bulkBody := map[string]interface{}{
		"user_ids":         []string{testUser.ID.String()},
		"dates":            []string{"2026-09-01", "2026-09-02"},
		"status":           "Present",
		"exclude_holidays": true,
	}
	payload, _ = json.Marshal(bulkBody)
	wBulk := httptest.NewRecorder()
	reqBulk, _ := http.NewRequest(http.MethodPost, "/hr/attendances/mark-bulk", bytes.NewBuffer(payload))
	reqBulk.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(wBulk, reqBulk)

	if wBulk.Code != http.StatusOK {
		t.Fatalf("expected status 200 on bulk mark, got %d: %s", wBulk.Code, wBulk.Body.String())
	}

	var count int64
	db.Model(&hrmodel.Attendance{}).Where("user_id = ?", testUser.ID.String()).Count(&count)
	if count < 3 {
		t.Fatalf("expected at least 3 attendance records, got %d", count)
	}
}
