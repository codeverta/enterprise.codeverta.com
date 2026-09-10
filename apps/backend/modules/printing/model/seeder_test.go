package model

import (
	"testing"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestSeedPrintFormatsIsCompleteAndIdempotent(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:printing-seeder?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&PrintFormat{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	const tenant = "tenant-printing-test"
	if err := SeedPrintFormats(db, tenant); err != nil {
		t.Fatalf("first seed: %v", err)
	}

	var count int64
	if err := db.Model(&PrintFormat{}).Where("tenant_id = ?", tenant).Count(&count).Error; err != nil {
		t.Fatalf("count formats: %v", err)
	}
	if count != 35 {
		t.Fatalf("expected 35 formats, got %d", count)
	}

	var disabled int64
	if err := db.Model(&PrintFormat{}).Where("tenant_id = ? AND disabled = ?", tenant, true).Count(&disabled).Error; err != nil {
		t.Fatalf("count disabled: %v", err)
	}
	if disabled != 4 {
		t.Fatalf("expected 4 disabled formats, got %d", disabled)
	}

	if err := db.Model(&PrintFormat{}).Where("tenant_id = ? AND name = ?", tenant, "Sales Invoice Standard").Update("css", ".custom { color: red; }").Error; err != nil {
		t.Fatalf("customize format: %v", err)
	}
	if err := SeedPrintFormats(db, tenant); err != nil {
		t.Fatalf("second seed: %v", err)
	}
	var customized PrintFormat
	if err := db.Where("tenant_id = ? AND name = ?", tenant, "Sales Invoice Standard").First(&customized).Error; err != nil {
		t.Fatalf("read customized format: %v", err)
	}
	if customized.CSS != ".custom { color: red; }" {
		t.Fatalf("second seed overwrote customization: %q", customized.CSS)
	}
	if err := db.Model(&PrintFormat{}).Where("tenant_id = ?", tenant).Count(&count).Error; err != nil {
		t.Fatalf("recount formats: %v", err)
	}
	if count != 35 {
		t.Fatalf("second seed created duplicates, got %d", count)
	}
}
