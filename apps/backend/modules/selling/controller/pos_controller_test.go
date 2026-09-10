package controller

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	coremodel "gin-template/model"
	sellingmodel "gin-template/modules/selling/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupPOSTestRouter(t *testing.T) (*gin.Engine, *gorm.DB) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open("file:"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{})
	assert.NoError(t, err)

	err = sellingmodel.Migrate(db)
	assert.NoError(t, err)

	err = db.AutoMigrate(&coremodel.Company{}, &coremodel.User{})
	assert.NoError(t, err)

	comp := coremodel.Company{
		ID:           uuid.MustParse("33333333-3333-3333-3333-333333333333"),
		Name:         "UD MILLION CANDLES",
		Abbreviation: "MC",
		IsActive:     true,
	}
	_ = db.Create(&comp)

	u := coremodel.User{
		ID:          uuid.MustParse("44444444-4444-4444-4444-444444444444"),
		Username:    "Administrator",
		DisplayName: "Administrator",
		Email:       "admin@candles.com",
	}
	_ = db.Create(&u)

	coremodel.DB = db

	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("tenant_id", "test-pos-tenant")
		c.Next()
	})

	posCtrl := NewPOSController()
	posProfCtrl := NewPOSProfileController()

	r.GET("/pos-profiles/options", posProfCtrl.Options)
	r.GET("/pos-profiles", posProfCtrl.List)
	r.POST("/pos-profiles", posProfCtrl.Create)
	r.GET("/pos-profiles/:id", posProfCtrl.Get)
	r.PUT("/pos-profiles/:id", posProfCtrl.Update)
	r.DELETE("/pos-profiles/:id", posProfCtrl.Delete)

	r.GET("/pos/opening-entries", posCtrl.OpeningEntries)
	r.GET("/pos/opening-entries/current", posCtrl.CurrentOpening)
	r.GET("/pos/opening-entries/:id", posCtrl.GetOpeningEntry)
	r.POST("/pos/opening-entries", posCtrl.CreateOpening)
	r.POST("/pos/opening-entries/:id/close", posCtrl.CloseOpening)
	r.GET("/pos/closing-entries", posCtrl.ClosingEntries)
	r.GET("/pos/closing-entries/:id", posCtrl.GetClosingEntry)

	return r, db
}

func TestPOSProfileAndOpeningClosingFlow(t *testing.T) {
	router, _ := setupPOSTestRouter(t)

	// 1. POS Profile Options
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/pos-profiles/options", nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	// 2. POS Profile List (auto-seeds default if empty)
	w = httptest.NewRecorder()
	req, _ = http.NewRequest(http.MethodGet, "/pos-profiles", nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	var profListResp struct {
		Data []sellingmodel.POSProfile `json:"data"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &profListResp)
	assert.NotEmpty(t, profListResp.Data)
	assert.Equal(t, "Usaha Jualan Lilin", profListResp.Data[0].Name)

	// 3. Create POS Opening Entry
	openPayload := map[string]any{
		"company":           "UD MILLION CANDLES",
		"pos_profile":       "Usaha Jualan Lilin",
		"user":              "Administrator",
		"period_start_date": time.Now(),
		"posting_date":      time.Now(),
		"balance_details": []map[string]any{
			{"mode_of_payment": "Cash", "opening_amount": 100000},
			{"mode_of_payment": "Bank Transfer", "opening_amount": 0},
		},
	}
	openBody, _ := json.Marshal(openPayload)
	w = httptest.NewRecorder()
	req, _ = http.NewRequest(http.MethodPost, "/pos/opening-entries", bytes.NewReader(openBody))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusCreated, w.Code)

	var createdOpening sellingmodel.POSOpeningEntry
	err := json.Unmarshal(w.Body.Bytes(), &createdOpening)
	assert.NoError(t, err)
	assert.Equal(t, sellingmodel.POSOpeningStatusOpen, createdOpening.Status)
	assert.Equal(t, 100000.0, createdOpening.OpeningBalanceTotal)

	// 4. Check Current Opening
	w = httptest.NewRecorder()
	req, _ = http.NewRequest(http.MethodGet, "/pos/opening-entries/current", nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	// 5. Close Opening Entry (POS Closing Entry)
	closePayload := map[string]any{
		"closing_amounts": map[string]float64{
			"Cash":          100000,
			"Bank Transfer": 50000,
		},
	}
	closeBody, _ := json.Marshal(closePayload)
	w = httptest.NewRecorder()
	req, _ = http.NewRequest(http.MethodPost, "/pos/opening-entries/"+createdOpening.ID+"/close", bytes.NewReader(closeBody))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusCreated, w.Code)

	var createdClosing sellingmodel.POSClosingEntry
	err = json.Unmarshal(w.Body.Bytes(), &createdClosing)
	assert.NoError(t, err)
	assert.Equal(t, "UD MILLION CANDLES", createdClosing.Company)
	assert.Equal(t, "Usaha Jualan Lilin", createdClosing.POSProfile)
	assert.Equal(t, "Administrator", createdClosing.User)
	assert.NotEmpty(t, createdClosing.Reconciliations)

	// 6. Get Closing Detail
	w = httptest.NewRecorder()
	req, _ = http.NewRequest(http.MethodGet, "/pos/closing-entries/"+createdClosing.ID, nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}
