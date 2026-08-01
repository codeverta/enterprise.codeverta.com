package controller

import (
	"fmt"
	"gin-template/common"
	"gin-template/handler"
	"gin-template/model"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type TenantController struct {
	DB *gorm.DB
}

func NewTenantController(db *gorm.DB) *TenantController {
	return &TenantController{DB: db}
}

// Helper untuk format cache key
func getTenantCacheKey(id string) string {
	return fmt.Sprintf("tenant:%s", id)
}

// 5. Get All Tenants (Direct DB Read)
func (h *TenantController) GetAllTenants(c *gin.Context) {
	var tenants []model.Tenant

	// Fetch all records (Gorm automatically handles DeletedAt for soft deletes)
	if err := h.DB.Set("skip_tenant_scope", true).Find(&tenants).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, tenants)
}

// 1. Create Tenant (Store & Update Cache)
func (h *TenantController) CreateTenant(c *gin.Context) {
	var tenantInput handler.CreateTenantInput
	if err := c.ShouldBindJSON(&tenantInput); err != nil {
		validationErrors := common.FormatValidationError(err)
		zap.L().Warn("Form Validation Failed",
			zap.String("path", c.Request.URL.Path),
			zap.String("ip", c.ClientIP()),
			zap.Any("validation_details", validationErrors),
			zap.String("user_agent", c.Request.UserAgent()),
		)
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"errors":  validationErrors, // Kirim object errors detail
			"message": "Mohon periksa kembali formulir anda",
		})
		return
	}

	tenant := model.Tenant{
		ID:       uuid.New(),
		Name:     tenantInput.Name,
		Domain:   tenantInput.Domain,
		IsActive: tenantInput.IsActive,
	}

	if err := h.DB.Create(&tenant).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Update Cache: Set data baru ke Redis
	common.SetPermanentCache(c, getTenantCacheKey(tenant.ID.String()), tenant)

	c.JSON(http.StatusCreated, tenant)
}

// 2. Get Tenant (Read Cache -> Read DB -> Set Cache)
func (h *TenantController) GetTenant(c *gin.Context) {
	id := c.Param("id")
	cacheKey := getTenantCacheKey(id)
	db := model.GetDB(c)

	// Cek Redis dulu
	var cachedTenant model.Tenant
	if common.GetCache(c, cacheKey, &cachedTenant) {
		c.JSON(http.StatusOK, cachedTenant)
		return
	}

	// Jika tidak ada di Redis, ambil dari DB
	var tenant model.Tenant
	if err := db.First(&tenant, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tenant not found"})
		return
	}

	// Simpan ke Redis untuk request berikutnya
	common.SetPermanentCache(c, cacheKey, tenant)

	c.JSON(http.StatusOK, tenant)
}

// 3. Update Tenant (Update DB & Update Cache)
func (h *TenantController) UpdateTenant(c *gin.Context) {
	id := c.Param("id")
	db := model.GetDB(c)

	var tenant model.Tenant

	// Cek eksistensi data
	if err := db.First(&tenant, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tenant not found"})
		return
	}

	var input model.Tenant
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Update ke DB
	// Menggunakan Updates agar hanya field yang dikirim yang berubah
	if err := db.Model(&tenant).Updates(input).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Refresh object tenant dr DB agar data lengkap (timestamp update, dll) sebelum masuk cache
	db.First(&tenant, "id = ?", id)

	// Update Cache: Timpa cache lama dengan data baru
	common.SetPermanentCache(c, getTenantCacheKey(id), tenant)

	c.JSON(http.StatusOK, tenant)
}

// 4. Delete Tenant (Delete DB & Delete Cache)
func (h *TenantController) DeleteTenant(c *gin.Context) {
	id := c.Param("id")
	db := model.GetDB(c)
	cacheKey := getTenantCacheKey(id)

	// Delete dari DB (Soft Delete karena ada gorm.DeletedAt)
	if err := db.Delete(&model.Tenant{}, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Hapus Cache Redis
	common.DeleteCache(c, cacheKey)

	c.JSON(http.StatusOK, gin.H{"message": "Tenant deleted"})
}
