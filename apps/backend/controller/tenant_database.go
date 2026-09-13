package controller

import (
	"os"
	"strings"

	"gin-template/internal/tenancy"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func requestDatabase(c *gin.Context, legacyFallback *gorm.DB) *gorm.DB {
	if db, err := tenancy.DBFromContext(c.Request.Context()); err == nil {
		return db
	}
	if value, ok := c.Get("db"); ok {
		if db, valid := value.(*gorm.DB); valid && db != nil {
			return db.WithContext(c.Request.Context())
		}
	}
	if strings.EqualFold(strings.TrimSpace(os.Getenv("TENANCY_MODE")), "database-per-tenant") {
		panic("tenant database missing from request context")
	}
	return legacyFallback.WithContext(c.Request.Context())
}
