package controller

import (
	"bytes"
	"encoding/json"
	"gin-template/model"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupCurrencyTestDB(t *testing.T) (*gorm.DB, *gin.Engine) {
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	assert.NoError(t, err)

	err = db.AutoMigrate(&model.Currency{})
	assert.NoError(t, err)

	currencyCtrl := NewCurrencyController(db)
	countryCtrl := NewCountryController()

	r := gin.New()
	r.GET("/api/countries", countryCtrl.List)
	r.GET("/api/countries/:id", countryCtrl.Get)

	r.GET("/api/currencies", currencyCtrl.List)
	r.GET("/api/currencies/:id", currencyCtrl.Get)
	r.POST("/api/currencies", currencyCtrl.Create)
	r.PUT("/api/currencies/:id", currencyCtrl.Update)
	r.DELETE("/api/currencies/:id", currencyCtrl.Delete)

	return db, r
}

func TestCountriesEndpointDirectFromJSON(t *testing.T) {
	_, r := setupCurrencyTestDB(t)

	// List all countries
	req, _ := http.NewRequest(http.MethodGet, "/api/countries", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	var listRes struct {
		Data []struct {
			ID          string `json:"id"`
			CountryName string `json:"country_name"`
			Code        string `json:"code"`
		} `json:"data"`
	}
	err := json.Unmarshal(w.Body.Bytes(), &listRes)
	assert.NoError(t, err)
	assert.Greater(t, len(listRes.Data), 200)

	// Search country
	req, _ = http.NewRequest(http.MethodGet, "/api/countries?q=Indonesia", nil)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	err = json.Unmarshal(w.Body.Bytes(), &listRes)
	assert.NoError(t, err)
	assert.NotEmpty(t, listRes.Data)
	assert.Equal(t, "Indonesia", listRes.Data[0].CountryName)

	// Get single country
	req, _ = http.NewRequest(http.MethodGet, "/api/countries/Indonesia", nil)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestCurrencyCRUDAndAutoSeed(t *testing.T) {
	_, r := setupCurrencyTestDB(t)

	// 1. List auto-seeds
	req, _ := http.NewRequest(http.MethodGet, "/api/currencies", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	var listRes struct {
		Data []model.Currency `json:"data"`
	}
	err := json.Unmarshal(w.Body.Bytes(), &listRes)
	assert.NoError(t, err)
	assert.GreaterOrEqual(t, len(listRes.Data), 9)

	// 2. Get IDR
	req, _ = http.NewRequest(http.MethodGet, "/api/currencies/IDR", nil)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	var cur model.Currency
	err = json.Unmarshal(w.Body.Bytes(), &cur)
	assert.NoError(t, err)
	assert.Equal(t, "IDR", cur.ID)
	assert.Equal(t, "Rp", cur.Symbol)
	assert.True(t, cur.Enabled)

	// 3. Update IDR
	cur.Fraction = "Cent-IDR"
	bodyBytes, _ := json.Marshal(cur)
	req, _ = http.NewRequest(http.MethodPut, "/api/currencies/IDR", bytes.NewBuffer(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	// 4. Create new Currency
	newCur := model.Currency{
		ID:           "CHF",
		CurrencyName: "Swiss Franc",
		Enabled:      true,
		Symbol:       "CHF",
	}
	bodyBytes, _ = json.Marshal(newCur)
	req, _ = http.NewRequest(http.MethodPost, "/api/currencies", bytes.NewBuffer(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusCreated, w.Code)

	// 5. Delete Currency
	req, _ = http.NewRequest(http.MethodDelete, "/api/currencies/CHF", nil)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusNoContent, w.Code)
}
