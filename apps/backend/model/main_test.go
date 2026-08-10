package model

import (
	"testing"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestEnsureDefaultTenantMigratesLegacyBrandName(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:default-tenant-brand?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&Tenant{}, &SystemSetting{}); err != nil {
		t.Fatalf("auto-migrate: %v", err)
	}

	if err := db.Create(&Tenant{
		ID:       DefaultTenantID,
		Name:     LegacyDefaultTenantName,
		Domain:   DefaultTenantDomain,
		IsActive: true,
	}).Error; err != nil {
		t.Fatalf("create legacy tenant: %v", err)
	}
	if err := db.Exec(
		"INSERT INTO system_settings (id, tenant_id, app_name) VALUES (?, ?, ?)",
		"ea80dcb2-5e19-4c03-9d67-e2d7de67b585",
		DefaultTenantID,
		LegacyDefaultTenantName,
	).Error; err != nil {
		t.Fatalf("create legacy settings: %v", err)
	}

	if err := EnsureDefaultTenant(db); err != nil {
		t.Fatalf("ensure default tenant: %v", err)
	}

	var tenant Tenant
	if err := db.Set("skip_tenant_scope", true).First(&tenant, "id = ?", DefaultTenantID).Error; err != nil {
		t.Fatalf("read tenant: %v", err)
	}
	if tenant.Name != DefaultTenantName {
		t.Fatalf("expected tenant name %q, got %q", DefaultTenantName, tenant.Name)
	}

	var appName string
	if err := db.Table("system_settings").Select("app_name").Where("tenant_id = ?", DefaultTenantID).Scan(&appName).Error; err != nil {
		t.Fatalf("read app name: %v", err)
	}
	if appName != DefaultTenantName {
		t.Fatalf("expected app name %q, got %q", DefaultTenantName, appName)
	}
}

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
