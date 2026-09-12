package controller

import (
	"errors"
	"net/http"
	"strings"
	"time"

	stockmodel "gin-template/modules/stock/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type BrandController struct{}

func NewBrandController() *BrandController {
	return &BrandController{}
}

func (ctrl *BrandController) List(ctx *gin.Context) {
	db, tenant := stockDB(ctx), stockTenant(ctx)

	var brands []stockmodel.Brand
	query := db.Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant)

	if search := strings.TrimSpace(ctx.Query("q")); search != "" {
		like := "%" + search + "%"
		query = query.Where("brand_name LIKE ? OR description LIKE ?", like, like)
	}

	if enabledStr := strings.TrimSpace(ctx.Query("enabled")); enabledStr != "" {
		if enabledStr == "true" || enabledStr == "1" {
			query = query.Where("enabled = ?", true)
		} else if enabledStr == "false" || enabledStr == "0" {
			query = query.Where("enabled = ?", false)
		}
	}

	if err := query.Order("brand_name asc").Find(&brands).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil daftar Brand"})
		return
	}

	// Also retrieve distinct brands from buying_items if not already in brands
	var itemBrands []string
	itemQuery := db.Table("buying_items").
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND brand <> '' AND brand IS NOT NULL", tenant).
		Distinct("brand")
	if search := strings.TrimSpace(ctx.Query("q")); search != "" {
		itemQuery = itemQuery.Where("brand LIKE ?", "%"+search+"%")
	}
	_ = itemQuery.Pluck("brand", &itemBrands).Error

	existingNames := make(map[string]bool)
	for _, b := range brands {
		existingNames[strings.ToLower(strings.TrimSpace(b.BrandName))] = true
	}

	for _, ib := range itemBrands {
		trimmed := strings.TrimSpace(ib)
		if trimmed != "" && !existingNames[strings.ToLower(trimmed)] {
			existingNames[strings.ToLower(trimmed)] = true
			brands = append(brands, stockmodel.Brand{
				ID:        uuid.New().String(),
				TenantID:  tenant,
				BrandName: trimmed,
				Enabled:   true,
			})
		}
	}

	ctx.JSON(http.StatusOK, gin.H{"data": brands})
}

func (ctrl *BrandController) Get(ctx *gin.Context) {
	db, tenant, id := stockDB(ctx), stockTenant(ctx), ctx.Param("id")
	var brand stockmodel.Brand
	if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND (id = ? OR brand_name = ?)", tenant, id, id).First(&brand).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "Brand tidak ditemukan"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data Brand"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": brand})
}

type BrandInput struct {
	BrandName   string `json:"brand_name" binding:"required"`
	Description string `json:"description"`
	Enabled     *bool  `json:"enabled"`
}

func (ctrl *BrandController) Create(ctx *gin.Context) {
	db, tenant := stockDB(ctx), stockTenant(ctx)
	var input BrandInput
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Nama Brand wajib diisi"})
		return
	}

	name := strings.TrimSpace(input.BrandName)
	if name == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Nama Brand tidak boleh kosong"})
		return
	}

	enabled := true
	if input.Enabled != nil {
		enabled = *input.Enabled
	}

	// Check if already exists
	var existing stockmodel.Brand
	if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND LOWER(brand_name) = LOWER(?)", tenant, name).First(&existing).Error; err == nil {
		ctx.JSON(http.StatusOK, gin.H{"data": existing})
		return
	}

	brand := stockmodel.Brand{
		ID:          uuid.New().String(),
		TenantID:    tenant,
		BrandName:   name,
		Description: strings.TrimSpace(input.Description),
		Enabled:     enabled,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := db.Create(&brand).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat Brand"})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{"data": brand})
}

func (ctrl *BrandController) Delete(ctx *gin.Context) {
	db, tenant, id := stockDB(ctx), stockTenant(ctx), ctx.Param("id")
	if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).Delete(&stockmodel.Brand{}).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus Brand"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "Brand berhasil dihapus"})
}
