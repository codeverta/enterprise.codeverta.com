package model

import (
	"path/filepath"
	"testing"

	"gin-template/internal/desktoprecovery"
	accountingmodel "gin-template/modules/accounting/model"
	sellingmodel "gin-template/modules/selling/model"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestDesktopSchemaMigrationPreservesExistingBusinessData(t *testing.T) {
	path := filepath.Join(t.TempDir(), "codeverta-offline.db")
	db, err := gorm.Open(sqlite.Open(path+"?_foreign_keys=on"), &gorm.Config{
		DisableForeignKeyConstraintWhenMigrating: true,
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.Exec(`CREATE TABLE legacy_financial_records (id INTEGER PRIMARY KEY, customer_name TEXT, amount INTEGER)`).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Exec(`INSERT INTO legacy_financial_records(id, customer_name, amount) VALUES(1, 'PT Aman', 12500000)`).Error; err != nil {
		t.Fatal(err)
	}
	if sqlDB, err := db.DB(); err == nil {
		_ = sqlDB.Close()
	}

	recovery := desktoprecovery.New(path, "0.0.2")
	session, err := recovery.Prepare()
	if err != nil {
		t.Fatal(err)
	}
	db, err = gorm.Open(sqlite.Open(path+"?_foreign_keys=on"), &gorm.Config{
		DisableForeignKeyConstraintWhenMigrating: true,
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := MigrateTenantSchema(db); err != nil {
		if sqlDB, dbErr := db.DB(); dbErr == nil {
			_ = sqlDB.Close()
		}
		_ = recovery.Rollback(session, err)
		t.Fatalf("migrate desktop schema: %v", err)
	}
	if err := recovery.Commit(session); err != nil {
		t.Fatal(err)
	}

	var legacy struct {
		CustomerName string
		Amount       int64
	}
	if err := db.Table("legacy_financial_records").Where("id = ?", 1).Scan(&legacy).Error; err != nil {
		t.Fatal(err)
	}
	if legacy.CustomerName != "PT Aman" || legacy.Amount != 12_500_000 {
		t.Fatalf("business data changed during migration: %#v", legacy)
	}
	if !db.Migrator().HasTable(&sellingmodel.Customer{}) {
		t.Fatal("customer schema was not migrated")
	}
	if !db.Migrator().HasTable(&accountingmodel.GLEntry{}) {
		t.Fatal("financial ledger schema was not migrated")
	}
	if err := MigrateTenantSchema(db); err != nil {
		t.Fatalf("desktop schema migration is not idempotent: %v", err)
	}
}
