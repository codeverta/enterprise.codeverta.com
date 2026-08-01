package model

import (
	"fmt"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

var DB *gorm.DB

func ensureSystemSettingColumns(db *gorm.DB) error {
	migrator := db.Migrator()
	columns := []string{"email_quota", "email_used", "participant_quota", "participant_used", "discord_withdrawal_webhook"}

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
	}).Error
}

func CloseDB() error {
	sqlDB, err := DB.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}

func GetDB(c *gin.Context) *gorm.DB {
	val, exists := c.Get("db")
	if !exists {
		fmt.Println("DB not found in context, using global DB")
		// Fallback ke DB global jika tidak ada di context (untuk tabel global)
		return DB
	}
	return val.(*gorm.DB).Session(&gorm.Session{})
}
