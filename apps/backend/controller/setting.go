package controller

import (
	"encoding/json"
	"fmt"
	"gin-template/common"
	"gin-template/model"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type SettingController struct {
	DB     *gorm.DB // Global DB (jarang dipakai langsung, pakai scoped)
	Logger *zap.Logger
}

func NewSettingController(db *gorm.DB, logger *zap.Logger) *SettingController {
	return &SettingController{DB: db, Logger: logger}
}

// GET /api/settings
func (ctrl *SettingController) GetSettings(c *gin.Context) {
	// 1. Ambil Info Tenant & User dari Context
	// Pastikan middleware TenantResolver sudah jalan sebelum endpoint ini
	tenantVal, exists := c.Get(common.CtxTenantKey)
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Tenant context missing"})
		return
	}
	tenant := tenantVal.(model.Tenant)
	tenantIDStr := tenant.ID.String()

	_, isAuthenticated := c.Get("id") // Cek login user

	// 2. Setup Redis Key yang UNIK per Tenant
	cacheKey := model.GetSettingCacheKey(tenantIDStr)
	ctx := c.Request.Context()
	var setting model.SystemSetting

	// 3. Cek Redis (Hanya Cache Hit kalau Tenant & Key cocok)
	var cached bool = false
	if common.RedisEnabled && common.RDB != nil && !isAuthenticated {
		if common.GetCache(ctx, cacheKey, &setting) {
			c.JSON(http.StatusOK, setting.ToResponse(false))
			return
		}
	}

	// 4. Ambil dari Scoped Database
	// model.GetDB(c) mengembalikan DB yang sudah di-filter: WHERE tenant_id = '...'
	scopedDB := requestDatabase(c, ctrl.DB)

	if err := scopedDB.First(&setting).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			// ==========================================
			// LAZY INIT: Buat Setting default untuk Tenant ini
			// ==========================================
			fmt.Printf("Initializing settings for tenant: %s\n", tenant.Name)

			setting = model.SystemSetting{
				ID:                 uuid.New(),
				TenantID:           &tenant.ID,  // EXPLICIT ASSIGNMENT
				AppName:            tenant.Name, // Custom nama default
				AppTagline:         "Future of Homeschooling",
				IsDevMode:          false,
				IsRegistrationOpen: true,
				IsMaintenanceMode:  false,
				BannerText:         fmt.Sprintf("Welcome to %s!", tenant.Name),
				EventStartTime:     time.Now().UTC().Add(24 * time.Hour),
				EmailQuota:         1000,
				ParticipantQuota:   500,
			}

			if createErr := scopedDB.Session(&gorm.Session{NewDB: true}).Create(&setting).Error; createErr != nil {
				ctrl.Logger.Error("Failed to init settings", zap.Error(createErr))
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to init settings"})
				return
			}
		} else {
			ctrl.Logger.Error("Database error", zap.Error(err))
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
			return
		}
	}

	// 5. Update Live Data (Optional)
	if isAuthenticated {
		// Contoh hitung peserta REALTIME dari DB Tenant ini
		// var partCount int64
		// scopedDB.Model(&model.Participant{}).Where("is_paid", 1).Count(&partCount)
		// setting.ParticipantUsed = int(partCount)
	}

	// 6. Simpan ke Redis (Cache Per Tenant)
	if common.RedisEnabled && common.RDB != nil && !cached {
		data, err := json.Marshal(setting)
		if err == nil {
			// Simpan dengan key spesifik tenant
			common.RDB.Set(ctx, common.RDB.GetKey(cacheKey), data, 1*time.Hour).Result()
		}
	}

	roleVal, exists := c.Get("role")
	isAdmin := false
	if exists {
		if role, ok := roleVal.(int); ok && role >= 99 {
			isAdmin = true
		} else if roleF, ok := roleVal.(float64); ok && roleF >= 99 {
			isAdmin = true
		}
	}

	c.JSON(http.StatusOK, setting.ToResponse(isAdmin))
}

// PUT /api/settings
func (ctrl *SettingController) UpdateSettings(c *gin.Context) {
	// 1. Ambil Tenant Info
	tenantVal, _ := c.Get(common.CtxTenantKey)
	tenant := tenantVal.(model.Tenant)
	tenantIDStr := tenant.ID.String()

	scopedDB := model.GetDB(c)
	ctx := c.Request.Context()

	var setting model.SystemSetting

	// 2. Fetch existing (Scoped)
	if err := scopedDB.First(&setting).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Settings not initialized"})
		return
	}

	var input model.SystemSetting
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Preserve identifiers
	input.ID = setting.ID
	input.TenantID = setting.TenantID
	input.CreatedAt = setting.CreatedAt

	if err := scopedDB.WithContext(c).Save(&input).Error; err != nil {
		ctrl.Logger.Error("Update failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update settings"})
		return
	}

	// 3. INVALIDASI CACHE (Gunakan Key Spesifik Tenant)
	if common.RedisEnabled && common.RDB != nil {
		cacheKey := model.GetSettingCacheKey(tenantIDStr)
		common.DeleteCache(ctx, cacheKey)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Settings updated", "data": input.ToResponse(true)})
}
