package controller

import (
	"errors"
	"net/http"
	"strings"

	stockmodel "gin-template/modules/stock/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type UOMController struct{}

func NewUOMController() *UOMController {
	return &UOMController{}
}

func (ctrl *UOMController) List(ctx *gin.Context) {
	db, tenant := stockDB(ctx), stockTenant(ctx)

	// Check if any UOM exists, if not auto-seed
	var count int64
	db.Model(&stockmodel.UOM{}).Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant).Count(&count)
	if count == 0 {
		_ = stockmodel.SeedUOMs(db, tenant)
	}

	var uoms []stockmodel.UOM
	query := db.Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant)

	if search := strings.TrimSpace(ctx.Query("q")); search != "" {
		like := "%" + search + "%"
		query = query.Where("uom_name LIKE ? OR symbol LIKE ? OR common_code LIKE ?", like, like, like)
	}

	if enabledStr := strings.TrimSpace(ctx.Query("enabled")); enabledStr != "" {
		if enabledStr == "true" || enabledStr == "1" {
			query = query.Where("enabled = ?", true)
		} else if enabledStr == "false" || enabledStr == "0" {
			query = query.Where("enabled = ?", false)
		}
	}

	if err := query.Order("uom_name asc").Find(&uoms).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil daftar UOM"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": uoms})
}

func (ctrl *UOMController) Get(ctx *gin.Context) {
	db, tenant, id := stockDB(ctx), stockTenant(ctx), ctx.Param("id")
	var uom stockmodel.UOM
	if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).First(&uom).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "UOM tidak ditemukan"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data UOM"})
		return
	}
	ctx.JSON(http.StatusOK, uom)
}

func (ctrl *UOMController) Create(ctx *gin.Context) {
	var input stockmodel.UOM
	if err := ctx.ShouldBindJSON(&input); err != nil || strings.TrimSpace(input.UOMName) == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "UOM Name wajib diisi"})
		return
	}

	db, tenant := stockDB(ctx), stockTenant(ctx)

	// Check duplicate name
	var existing stockmodel.UOM
	if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND LOWER(uom_name) = LOWER(?)", tenant, strings.TrimSpace(input.UOMName)).First(&existing).Error; err == nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "UOM Name sudah ada"})
		return
	}

	input.ID = "uom-" + uuid.NewString()[:8]
	input.TenantID = tenant
	input.UOMName = strings.TrimSpace(input.UOMName)
	input.Symbol = strings.TrimSpace(input.Symbol)
	input.CommonCode = strings.TrimSpace(input.CommonCode)
	input.Description = strings.TrimSpace(input.Description)

	if err := db.Create(&input).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat UOM"})
		return
	}

	ctx.JSON(http.StatusCreated, input)
}

func (ctrl *UOMController) Update(ctx *gin.Context) {
	id := ctx.Param("id")
	var input stockmodel.UOM
	if err := ctx.ShouldBindJSON(&input); err != nil || strings.TrimSpace(input.UOMName) == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Data UOM tidak valid"})
		return
	}

	db, tenant := stockDB(ctx), stockTenant(ctx)
	var existing stockmodel.UOM
	if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).First(&existing).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "UOM tidak ditemukan"})
		return
	}

	// Check duplicate if name changed
	if !strings.EqualFold(existing.UOMName, strings.TrimSpace(input.UOMName)) {
		var dup stockmodel.UOM
		if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND LOWER(uom_name) = LOWER(?) AND id != ?", tenant, strings.TrimSpace(input.UOMName), id).First(&dup).Error; err == nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "UOM Name sudah digunakan oleh UOM lain"})
			return
		}
	}

	existing.UOMName = strings.TrimSpace(input.UOMName)
	existing.Symbol = strings.TrimSpace(input.Symbol)
	existing.CommonCode = strings.TrimSpace(input.CommonCode)
	existing.Description = strings.TrimSpace(input.Description)
	existing.Enabled = input.Enabled
	existing.MustBeWholeNumber = input.MustBeWholeNumber

	if err := db.Save(&existing).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui UOM"})
		return
	}

	ctx.JSON(http.StatusOK, existing)
}

func (ctrl *UOMController) Delete(ctx *gin.Context) {
	db, tenant, id := stockDB(ctx), stockTenant(ctx), ctx.Param("id")
	if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).Delete(&stockmodel.UOM{}).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus UOM"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "UOM terhapus"})
}

func (ctrl *UOMController) Seed(ctx *gin.Context) {
	db, tenant := stockDB(ctx), stockTenant(ctx)
	if err := stockmodel.SeedUOMs(db, tenant); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal seeding UOM"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "UOM default berhasil di-seed"})
}
