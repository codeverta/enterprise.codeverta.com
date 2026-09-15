package model

import (
	"fmt"
	"os"
	"strings"

	"gin-template/internal/tenancy"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

var DB *gorm.DB

func ensureSystemSettingColumns(db *gorm.DB) error {
	migrator := db.Migrator()
	columns := []string{"email_quota", "email_used", "participant_quota", "participant_used", "discord_withdrawal_webhook", "rounding_method"}

	for _, column := range columns {
		if !migrator.HasColumn(&SystemSetting{}, column) {
			if err := migrator.AddColumn(&SystemSetting{}, column); err != nil {
				return err
			}
		}
	}

	return db.Session(&gorm.Session{AllowGlobalUpdate: true}).Model(&SystemSetting{}).Updates(map[string]interface{}{
		"email_quota":       gorm.Expr("COALESCE(email_quota, 0)"),
		"email_used":        gorm.Expr("COALESCE(email_used, 0)"),
		"participant_quota": gorm.Expr("COALESCE(participant_quota, 0)"),
		"participant_used":  gorm.Expr("COALESCE(participant_used, 0)"),
		"rounding_method":   gorm.Expr("COALESCE(NULLIF(rounding_method, ''), ?)", DefaultRoundingMethod),
	}).Error
}

// migrateSQLiteSystemSettingAdditively avoids GORM's SQLite table-rebuild path.
// That path can drop trailing columns when it normalizes complex defaults, which
// previously made a second startup lose tenant_id before recreating its index.
// Desktop migrations are additive; destructive transformations must be written
// as an explicit versioned migration protected by desktoprecovery snapshots.
func migrateSQLiteSystemSettingAdditively(db *gorm.DB) error {
	migrator := db.Migrator()
	if !migrator.HasTable(&SystemSetting{}) {
		return db.AutoMigrate(&SystemSetting{})
	}
	statement := &gorm.Statement{DB: db}
	if err := statement.Parse(&SystemSetting{}); err != nil {
		return err
	}
	for _, field := range statement.Schema.Fields {
		if field.DBName == "" || migrator.HasColumn(&SystemSetting{}, field.DBName) {
			continue
		}
		if err := migrator.AddColumn(&SystemSetting{}, field.Name); err != nil {
			return fmt.Errorf("add system_settings.%s: %w", field.DBName, err)
		}
	}
	if migrator.HasColumn(&SystemSetting{}, "tenant_id") && !migrator.HasIndex(&SystemSetting{}, "idx_tenant_settings") {
		if err := migrator.CreateIndex(&SystemSetting{}, "idx_tenant_settings"); err != nil {
			return err
		}
	}
	return nil
}

func CloseDB() error {
	sqlDB, err := DB.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}

func GetDB(c *gin.Context) *gorm.DB {
	if tenantDB, err := tenancy.DBFromContext(c.Request.Context()); err == nil {
		return tenantDB.Session(&gorm.Session{})
	}
	val, exists := c.Get("db")
	if !exists {
		if strings.EqualFold(strings.TrimSpace(os.Getenv("TENANCY_MODE")), "database-per-tenant") {
			panic("tenant database missing from request context")
		}
		fmt.Println("DB not found in context, using global DB")
		// Fallback ke DB global jika tidak ada di context (untuk tabel global)
		return DB
	}
	return val.(*gorm.DB).Session(&gorm.Session{})
}
