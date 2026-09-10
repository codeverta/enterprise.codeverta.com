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

type StockEntryTypeController struct{}

func NewStockEntryTypeController() *StockEntryTypeController {
	return &StockEntryTypeController{}
}

var StandardPurposes = []string{
	"Material Issue",
	"Material Receipt",
	"Material Transfer",
	"Material Transfer for Manufacture",
	"Material Consumption for Manufacture",
	"Manufacture",
	"Repack",
	"Send to Subcontractor",
	"Disassemble",
	"Receive from Customer",
	"Return Raw Material to Customer",
	"Subcontracting Delivery",
	"Subcontracting Return",
}

func (ctrl *StockEntryTypeController) List(ctx *gin.Context) {
	db, tenant := stockDB(ctx), stockTenant(ctx)

	// Auto-seed standard stock entry types if table is empty
	var count int64
	db.Model(&stockmodel.StockEntryType{}).Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant).Count(&count)
	if count == 0 {
		_ = stockmodel.SeedStockEntryTypes(db, tenant)
	}

	var types []stockmodel.StockEntryType
	query := db.Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant)

	if search := strings.TrimSpace(ctx.Query("q")); search != "" {
		like := "%" + search + "%"
		query = query.Where("name LIKE ? OR purpose LIKE ? OR description LIKE ?", like, like, like)
	}

	if purpose := strings.TrimSpace(ctx.Query("purpose")); purpose != "" && purpose != "All" {
		query = query.Where("purpose = ?", purpose)
	}

	if disabledStr := strings.TrimSpace(ctx.Query("disabled")); disabledStr != "" {
		if disabledStr == "true" || disabledStr == "1" {
			query = query.Where("disabled = ?", true)
		} else if disabledStr == "false" || disabledStr == "0" {
			query = query.Where("disabled = ?", false)
		}
	}

	if err := query.Order("name asc").Find(&types).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil daftar Stock Entry Type"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"data":  types,
		"count": len(types),
	})
}

func (ctrl *StockEntryTypeController) Get(ctx *gin.Context) {
	db, tenant, id := stockDB(ctx), stockTenant(ctx), ctx.Param("id")

	var row stockmodel.StockEntryType
	if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND (id = ? OR name = ?)", tenant, id, id).First(&row).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "Stock Entry Type tidak ditemukan"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data Stock Entry Type"})
		return
	}

	ctx.JSON(http.StatusOK, row)
}

type CreateStockEntryTypeRequest struct {
	Name        string `json:"name" binding:"required"`
	Purpose     string `json:"purpose" binding:"required"`
	Disabled    bool   `json:"disabled"`
	Description string `json:"description"`
}

func (ctrl *StockEntryTypeController) Create(ctx *gin.Context) {
	db, tenant := stockDB(ctx), stockTenant(ctx)

	var req CreateStockEntryTypeRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Name wajib diisi"})
		return
	}

	purpose := strings.TrimSpace(req.Purpose)
	if purpose == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Purpose wajib diisi"})
		return
	}

	var count int64
	db.Model(&stockmodel.StockEntryType{}).
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND name = ?", tenant, name).
		Count(&count)
	if count > 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Stock Entry Type dengan nama ini sudah ada"})
		return
	}

	newType := stockmodel.StockEntryType{
		ID:          "set-" + uuid.NewString()[:8],
		TenantID:    tenant,
		Name:        name,
		Purpose:     purpose,
		IsStandard:  false,
		Disabled:    req.Disabled,
		Description: req.Description,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := db.Create(&newType).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat Stock Entry Type: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, newType)
}

func (ctrl *StockEntryTypeController) Update(ctx *gin.Context) {
	db, tenant, id := stockDB(ctx), stockTenant(ctx), ctx.Param("id")

	var existing stockmodel.StockEntryType
	if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).First(&existing).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "Stock Entry Type tidak ditemukan"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mencari data"})
		return
	}

	var req stockmodel.StockEntryType
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Name != "" && req.Name != existing.Name {
		var exists int64
		db.Model(&stockmodel.StockEntryType{}).
			Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND name = ? AND id != ?", tenant, req.Name, id).
			Count(&exists)
		if exists > 0 {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "Nama Stock Entry Type sudah dipakai oleh record lain"})
			return
		}
		existing.Name = req.Name
	}

	if req.Purpose != "" {
		existing.Purpose = req.Purpose
	}
	existing.Disabled = req.Disabled
	existing.Description = req.Description
	existing.UpdatedAt = time.Now()

	if err := db.Save(&existing).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui Stock Entry Type: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, existing)
}

func (ctrl *StockEntryTypeController) Delete(ctx *gin.Context) {
	db, tenant, id := stockDB(ctx), stockTenant(ctx), ctx.Param("id")

	res := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).Delete(&stockmodel.StockEntryType{})
	if res.Error != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus Stock Entry Type"})
		return
	}
	if res.RowsAffected == 0 {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Stock Entry Type tidak ditemukan"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "Stock Entry Type berhasil dihapus"})
}

func (ctrl *StockEntryTypeController) Seed(ctx *gin.Context) {
	db, tenant := stockDB(ctx), stockTenant(ctx)

	if err := stockmodel.SeedStockEntryTypes(db, tenant); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menjalankan seeder Stock Entry Type: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "Berhasil melakukan seeder 13 Stock Entry Type"})
}

func (ctrl *StockEntryTypeController) Purposes(ctx *gin.Context) {
	ctx.JSON(http.StatusOK, gin.H{
		"purposes": StandardPurposes,
	})
}
