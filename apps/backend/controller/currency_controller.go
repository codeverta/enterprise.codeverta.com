package controller

import (
	"gin-template/model"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type CurrencyController struct {
	DB *gorm.DB
}

func NewCurrencyController(db *gorm.DB) *CurrencyController {
	return &CurrencyController{DB: db}
}

// List returns all currencies, optionally filtered by ?enabled=true/false or ?q=...
func (ctrl *CurrencyController) List(c *gin.Context) {
	db := requestDatabase(c, ctrl.DB).Set("skip_tenant_scope", true)

	var count int64
	db.Model(&model.Currency{}).Count(&count)
	if count == 0 {
		_ = model.SeedCurrencies(db)
	}

	query := db.Model(&model.Currency{})
	if enabledStr := c.Query("enabled"); enabledStr != "" {
		if strings.EqualFold(enabledStr, "true") || enabledStr == "1" {
			query = query.Where("enabled = ?", true)
		} else if strings.EqualFold(enabledStr, "false") || enabledStr == "0" {
			query = query.Where("enabled = ?", false)
		}
	}

	if q := strings.TrimSpace(c.Query("q")); q != "" {
		like := "%" + q + "%"
		query = query.Where("id LIKE ? OR currency_name LIKE ? OR symbol LIKE ?", like, like, like)
	}

	var currencies []model.Currency
	if err := query.Order("id ASC").Find(&currencies).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data mata uang: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": currencies})
}

// Get returns details of a single currency by ID.
func (ctrl *CurrencyController) Get(c *gin.Context) {
	db := requestDatabase(c, ctrl.DB).Set("skip_tenant_scope", true)
	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID mata uang diperlukan"})
		return
	}

	var cur model.Currency
	if err := db.First(&cur, "id = ?", id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Mata uang tidak ditemukan"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, cur)
}

// Create registers a new currency.
func (ctrl *CurrencyController) Create(c *gin.Context) {
	db := requestDatabase(c, ctrl.DB).Set("skip_tenant_scope", true)
	var input model.Currency
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	input.ID = strings.TrimSpace(strings.ToUpper(input.ID))
	if input.ID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Kode mata uang (ID) wajib diisi"})
		return
	}
	if input.CurrencyName == "" {
		input.CurrencyName = input.ID
	}
	if input.Symbol == "" {
		input.Symbol = input.ID
	}

	var existing model.Currency
	if err := db.First(&existing, "id = ?", input.ID).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Mata uang dengan kode ini sudah ada"})
		return
	}

	if err := requestDatabase(c, ctrl.DB).Session(&gorm.Session{NewDB: true}).Set("skip_tenant_scope", true).Create(&input).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan mata uang: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, input)
}

// Update modifies an existing currency.
func (ctrl *CurrencyController) Update(c *gin.Context) {
	db := requestDatabase(c, ctrl.DB).Set("skip_tenant_scope", true)
	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID mata uang diperlukan"})
		return
	}

	var existing model.Currency
	if err := db.First(&existing, "id = ?", id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Mata uang tidak ditemukan"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var input model.Currency
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	input.ID = existing.ID
	input.CreatedAt = existing.CreatedAt

	if err := db.Session(&gorm.Session{NewDB: true}).Set("skip_tenant_scope", true).Save(&input).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui mata uang: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, input)
}

// Delete removes a currency.
func (ctrl *CurrencyController) Delete(c *gin.Context) {
	db := requestDatabase(c, ctrl.DB).Set("skip_tenant_scope", true)
	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID mata uang diperlukan"})
		return
	}

	if err := db.Session(&gorm.Session{NewDB: true}).Set("skip_tenant_scope", true).Delete(&model.Currency{}, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus mata uang: " + err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}
