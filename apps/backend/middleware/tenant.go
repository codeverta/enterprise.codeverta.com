package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"gin-template/common"
	"gin-template/model"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"gorm.io/gorm"
	// sesuaikan dengan driver redis kamu, misal go-redis
)

type TenantMiddleware struct {
	DB    *gorm.DB
	Redis *common.RedisClient // Sesuaikan tipe data client redis kamu
}

// Helper Cache Key (konsisten dengan snippet kamu)
func getTenantCacheKey(id string) string {
	if common.RDB == nil {
		return fmt.Sprintf("tenant:%s", id)
	}
	return common.RDB.GetKey(fmt.Sprintf("tenant:%s", id))
}

// tenantIDFromAccessToken lets authenticated ERP clients resolve their tenant
// without relying on a hardcoded frontend environment variable. The token is
// fully signature-validated before its user ID is used for the lookup.
func (m *TenantMiddleware) tenantIDFromAccessToken(c *gin.Context) string {
	tokenString := ""
	parts := strings.SplitN(c.GetHeader("Authorization"), " ", 2)
	if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
		tokenString = parts[1]
	} else {
		// WebSocket clients pass the same signed access token in the query
		// because browser WebSocket APIs cannot set Authorization headers.
		tokenString = strings.TrimSpace(c.Query("token"))
	}
	if tokenString == "" {
		return ""
	}
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %s", token.Method.Alg())
		}
		return []byte(common.JWTSecret), nil
	})
	if err != nil || !token.Valid {
		return ""
	}
	userID, err := uuid.Parse(claims.UserId)
	if err != nil {
		return ""
	}
	var user struct {
		TenantID *uuid.UUID `gorm:"column:tenant_id"`
	}
	if err := m.DB.Set("skip_tenant_scope", true).Table("users").Select("tenant_id").Where("id = ?", userID).Take(&user).Error; err != nil || user.TenantID == nil {
		return ""
	}
	return user.TenantID.String()
}

func (m *TenantMiddleware) TenantResolver() gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantID := c.GetHeader("X-Tenant-ID")
		if tenantID == "" {
			tenantID = c.Query("tenant_id")
		}
		if tenantID == "" || tenantID == "belum-di-set" {
			tenantID = m.tenantIDFromAccessToken(c)
		}
		if tenantID == "" {
			tenantID = model.DefaultTenantIDString
		}

		var tenant model.Tenant
		cacheKey := getTenantCacheKey(tenantID)

		// 1. Coba ambil dari Cache
		cachedData := ""
		cacheHit := false
		if common.RedisEnabled && m.Redis != nil {
			var err error
			cachedData, err = m.Redis.Get(c, cacheKey).Result()
			cacheHit = err == nil && cachedData != ""
		}

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
			if common.RedisEnabled && m.Redis != nil {
				tenantBytes, _ := json.Marshal(tenant)
				m.Redis.Set(c, cacheKey, tenantBytes, 0)
			}
		}

		// 3. BAGIAN KRUSIAL: Set Scoped DB & Context (Berlaku untuk Hit & Miss)
		// Gunakan .Session agar thread-safe. Request context juga harus membawa
		// tenant karena model hooks dan audit plugin membacanya dari sana.
		requestContext := context.WithValue(c.Request.Context(), common.CtxTenantKey, tenant)
		requestContext = context.WithValue(requestContext, "tenant_id", tenantID)
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
