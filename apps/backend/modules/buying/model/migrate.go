package model

import (
	"fmt"

	"gorm.io/gorm"
)

func Migrate(db *gorm.DB) error {
	if err := db.AutoMigrate(
		&PurchaseOrder{}, &PurchaseOrderItem{}, &PurchaseOrderTax{}, &PurchaseOrderSequence{},
		&PurchaseInvoice{}, &PurchaseInvoiceItem{}, &PurchaseInvoiceTax{}, &PurchaseInvoiceSequence{},
	); err != nil {
		return fmt.Errorf("auto migrate Buying models: %w", err)
	}
	indexes := []struct {
		model         interface{}
		name, columns string
	}{
		{&PurchaseOrder{}, "idx_buying_po_tenant_number", "tenant_id, number"},
		{&PurchaseOrderSequence{}, "idx_buying_po_sequence", "tenant_id, year, prefix"},
		{&PurchaseInvoice{}, "idx_buying_pinv_tenant_number", "tenant_id, number"},
		{&PurchaseInvoiceSequence{}, "idx_buying_pinv_sequence", "tenant_id, year, prefix"},
	}
	for _, index := range indexes {
		if db.Migrator().HasIndex(index.model, index.name) {
			continue
		}
		statement := &gorm.Statement{DB: db}
		if err := statement.Parse(index.model); err != nil {
			return err
		}
		if err := db.Exec(fmt.Sprintf("CREATE UNIQUE INDEX %s ON %s (%s)", index.name, statement.Schema.Table, index.columns)).Error; err != nil {
			return fmt.Errorf("create Buying index %s: %w", index.name, err)
		}
	}
	return nil
}
