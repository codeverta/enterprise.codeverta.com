package model

import (
	"testing"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestEnsureSystemSettingColumnsAddsAndBackfillsCounters(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:system-setting-columns?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}

	if err := db.Exec(`CREATE TABLE system_settings (
		id char(36) PRIMARY KEY,
		app_name text,
		created_at datetime,
		updated_at datetime,
		deleted_at datetime
	)`).Error; err != nil {
		t.Fatalf("create legacy table: %v", err)
	}
	if err := db.Exec(`INSERT INTO system_settings (id, app_name) VALUES ('setting-1', 'Legacy')`).Error; err != nil {
		t.Fatalf("insert legacy row: %v", err)
	}

	if err := ensureSystemSettingColumns(db); err != nil {
		t.Fatalf("ensure columns failed: %v", err)
	}

	for _, column := range []string{"email_quota", "email_used", "participant_quota", "participant_used"} {
		if !db.Migrator().HasColumn(&SystemSetting{}, column) {
			t.Fatalf("expected %s column to exist", column)
		}
	}

	var row struct {
		EmailQuota      int
		EmailUsed       int
		ParticipantUsed int
	}
	if err := db.Table("system_settings").Select("email_quota, email_used, participant_used").Where("id = ?", "setting-1").Scan(&row).Error; err != nil {
		t.Fatalf("scan row: %v", err)
	}
	if row.EmailQuota != 0 || row.EmailUsed != 0 || row.ParticipantUsed != 0 {
		t.Fatalf("expected counters backfilled to zero, got %#v", row)
	}
}
