package controller

import (
	"gin-template/common"
	"gin-template/model"
	"net/http"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// RegionController menangani logika untuk data wilayah
type RegionController struct {
	DB *gorm.DB
}

// NewRegionController membuat instance baru dari RegionController
func NewRegionController(db *gorm.DB) *RegionController {
	return &RegionController{DB: db}
}

// GetProvinces mengembalikan daftar semua provinsi
func (ctrl *RegionController) GetProvinces(c *gin.Context) {
	var provinces []model.RegProvince
	cacheKey := "regions:provinces"

	// 1. Cek Redis
	if common.GetCache(c.Request.Context(), cacheKey, &provinces) {
		c.JSON(http.StatusOK, provinces)
		return
	}

	db := model.GetDB(c)

	// 2. Jika tidak ada, ambil dari DB
	if result := db.Set("skip_tenant_scope", true).Order("id asc").Find(&provinces); result.Error != nil {
		zap.L().Error("Gagal mengambil data provinsi", zap.Error(result.Error))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal database"})
		return
	}

	// 3. Simpan ke Redis permanen
	common.SetPermanentCache(c.Request.Context(), cacheKey, provinces)

	c.JSON(http.StatusOK, provinces)
}

// GetRegenciesByProvinceID mengembalikan daftar kabupaten/kota berdasarkan province_id
func (ctrl *RegionController) GetRegenciesByProvinceID(c *gin.Context) {
	provinceID := c.Param("provinceID")
	if provinceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "provinceID diperlukan"})
		return
	}

	var regencies []model.RegRegency
	db := model.GetDB(c)

	if result := db.Set("skip_tenant_scope", true).Where("province_id = ?", provinceID).Order("id asc").Find(&regencies); result.Error != nil {
		zap.L().Error("Gagal mengambil data kabupaten/kota", zap.Error(result.Error))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data kabupaten/kota"})
		return
	}
	c.JSON(http.StatusOK, regencies)
}

// GetDistrictsByRegencyID mengembalikan daftar kecamatan berdasarkan regency_id
func (ctrl *RegionController) GetDistrictsByRegencyID(c *gin.Context) {
	regencyID := c.Param("regencyID")
	if regencyID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "regencyID diperlukan"})
		return
	}

	var districts []model.RegDistrict
	db := model.GetDB(c)
	if result := db.Set("skip_tenant_scope", true).Where("regency_id = ?", regencyID).Order("id asc").Find(&districts); result.Error != nil {
		zap.L().Error("Gagal mengambil data kecamatan", zap.Error(result.Error))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data kecamatan"})
		return
	}
	c.JSON(http.StatusOK, districts)
}
