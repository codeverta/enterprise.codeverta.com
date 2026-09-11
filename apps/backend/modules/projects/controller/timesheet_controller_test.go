package controller

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	projectsmodel "gin-template/modules/projects/model"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupTestTimesheetDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	assert.NoError(t, err)

	err = projectsmodel.Migrate(db)
	assert.NoError(t, err)

	return db
}

func setupTimesheetTestRouter(db *gorm.DB) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	r.Use(func(c *gin.Context) {
		c.Set("db", db)
		c.Set("tenant_id", "00000000-0000-0000-0000-000000000001")
		c.Next()
	})

	ctrl := NewTimesheetController()

	tsGroup := r.Group("/timesheets")
	{
		tsGroup.GET("", ctrl.List)
		tsGroup.GET("/options", ctrl.Options)
		tsGroup.GET("/:id", ctrl.Get)
		tsGroup.POST("", ctrl.Create)
		tsGroup.PUT("/:id", ctrl.Update)
		tsGroup.POST("/:id/submit", ctrl.Submit)
		tsGroup.POST("/:id/cancel", ctrl.Cancel)
		tsGroup.DELETE("/:id", ctrl.Delete)
	}

	return r
}

func TestTimesheetCRUDAndCalculation(t *testing.T) {
	db := setupTestTimesheetDB(t)
	r := setupTimesheetTestRouter(db)

	now := time.Now()
	from1 := now
	to1 := from1.Add(2 * time.Hour)

	from2 := to1.Add(1 * time.Hour)
	to2 := from2.Add(3 * time.Hour)

	reqBody := SaveTimesheetRequest{
		EmployeeID:    "emp-001",
		EmployeeName:  "Rabih Utomo",
		EmployeeEmail: "admin@example.com",
		Company:       "CODEVERTA ENTERPRISE",
		Customer:      "PT Pelanggan Indonesia",
		Currency:      "IDR",
		ExchangeRate:  1.0,
		Status:        projectsmodel.TimesheetStatusDraft,
		TimeLogs: []projectsmodel.TimesheetDetail{
			{
				ActivityType:  "Communication",
				FromTime:      from1,
				ToTime:        &to1,
				Hours:         2,
				IsBillable:    true,
				BillingRate:   250000,
				CostingRate:   150000,
				ProjectName:   "Malabar Trailrun",
			},
			{
				ActivityType:  "Development",
				FromTime:      from2,
				ToTime:        &to2,
				Hours:         3,
				IsBillable:    false,
				BillingRate:   0,
				CostingRate:   200000,
				ProjectName:   "Malabar Trailrun",
			},
		},
	}
	b, _ := json.Marshal(reqBody)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/timesheets", bytes.NewBuffer(b))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)

	var createResp struct {
		Data    projectsmodel.Timesheet `json:"data"`
		Message string                  `json:"message"`
	}
	err := json.Unmarshal(w.Body.Bytes(), &createResp)
	assert.NoError(t, err)

	ts := createResp.Data
	assert.NotEmpty(t, ts.ID)
	assert.Contains(t, ts.ID, "TS-")
	assert.Equal(t, "Rabih Utomo", ts.EmployeeName)
	assert.Equal(t, float64(5), ts.TotalWorkingHours)
	assert.Equal(t, float64(2), ts.TotalBillableHours)
	assert.Equal(t, float64(500000), ts.TotalBillableAmount)
	assert.Equal(t, float64(900000), ts.TotalCostingAmount)

	// Test Get
	w = httptest.NewRecorder()
	req, _ = http.NewRequest(http.MethodGet, "/timesheets/"+ts.ID, nil)
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	// Test Submit
	w = httptest.NewRecorder()
	req, _ = http.NewRequest(http.MethodPost, "/timesheets/"+ts.ID+"/submit", nil)
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	var submitted projectsmodel.Timesheet
	db.First(&submitted, "id = ?", ts.ID)
	assert.Equal(t, projectsmodel.TimesheetStatusSubmitted, submitted.Status)

	// Try Update on Submitted timesheet -> should fail
	w = httptest.NewRecorder()
	req, _ = http.NewRequest(http.MethodPut, "/timesheets/"+ts.ID, bytes.NewBuffer(b))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)

	// Test Cancel
	w = httptest.NewRecorder()
	req, _ = http.NewRequest(http.MethodPost, "/timesheets/"+ts.ID+"/cancel", nil)
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	var cancelled projectsmodel.Timesheet
	db.First(&cancelled, "id = ?", ts.ID)
	assert.Equal(t, projectsmodel.TimesheetStatusCancelled, cancelled.Status)
}
