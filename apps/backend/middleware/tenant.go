package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"gin-template/common"
	"gin-template/model"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	// sesuaikan dengan driver redis kamu, misal go-redis
)

type TenantMiddleware struct {
	DB    *gorm.DB
	Redis *common.RedisClient // Sesuaikan tipe data client redis kamu
}

// Helper Cache Key (konsisten dengan snippet kamu)
func getTenantCacheKey(id string) string {
	return common.RDB.GetKey(fmt.Sprintf("tenant:%s", id))
}

func (m *TenantMiddleware) TenantResolver() gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantID := c.GetHeader("X-Tenant-ID")
		if tenantID == "" {
			tenantID = c.Query("tenant_id")
		}
		if tenantID == "" {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "X-Tenant-ID is required"})
			return
		}

		var tenant model.Tenant
		cacheKey := getTenantCacheKey(tenantID)

		// 1. Coba ambil dari Cache
		cachedData, err := m.Redis.Get(c, cacheKey).Result()
		cacheHit := err == nil && cachedData != ""

		if cacheHit {
			if jsonErr := json.Unmarshal([]byte(cachedData), &tenant); jsonErr == nil {
				// Jangan langsung return/Next di sini!
				// Biarkan alur lanjut ke bawah untuk set DB session.
			} else {
				cacheHit = false // Jika json rusak, paksa query DB
			}
		}

		// 2. Jika Cache Miss, ambil dari DB
		if !cacheHit {
			if err := m.DB.Set("skip_tenant_scope", true).Where("id = ?", tenantID).First(&tenant).Error; err != nil {
				status := http.StatusInternalServerError
				if err == gorm.ErrRecordNotFound {
					status = http.StatusNotFound
				}
				c.AbortWithStatusJSON(status, gin.H{"error": "Tenant not found"})
				return
			}
			// Simpan balik ke Redis
			tenantBytes, _ := json.Marshal(tenant)
			m.Redis.Set(c, cacheKey, tenantBytes, 0)
		}

		// 3. BAGIAN KRUSIAL: Set Scoped DB & Context (Berlaku untuk Hit & Miss)
		// Gunakan .Session agar thread-safe. Request context juga harus membawa
		// tenant karena model hooks dan audit plugin membacanya dari sana.
		requestContext := context.WithValue(c.Request.Context(), common.CtxTenantKey, tenant)
		c.Request = c.Request.WithContext(requestContext)
		scopedDB := m.DB.Session(&gorm.Session{}).
			Set("tenant_id", tenantID).
			WithContext(requestContext)

		c.Set("db", scopedDB)
		c.Set(common.CtxTenantKey, tenant)
		c.Set("tenant_id", tenantID)

		c.Next()
	}
}
