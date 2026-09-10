package model

import (
	"fmt"

	"gorm.io/gorm"
)

func Migrate(db *gorm.DB) error {
	if err := db.AutoMigrate(
		&Shipment{},
		&ShipmentParcel{},
		&ShipmentDeliveryNote{},
		&DeliveryNote{},
		&DeliveryNoteItem{},
		&DeliveryNoteTax{},
		&StockLedgerEntry{},
		&UOM{},
		&Warehouse{},
		&StockEntry{},
		&StockEntryItem{},
		&PurchaseReceipt{},
		&PurchaseReceiptItem{},
		&PurchaseReceiptTax{},
		&PurchaseReceiptSuppliedItem{},
		&SerialNo{},
		&Batch{},
		&StockEntryType{},
		&PickList{},
		&PickListItem{},
	); err != nil {
		return fmt.Errorf("auto migrate Stock models: %w", err)
	}

	indexes := []struct {
		model         interface{}
		name, columns string
	}{
		{&StockEntryType{}, "idx_stock_entry_type_tenant_name", "tenant_id, name"},
		{&SerialNo{}, "idx_serial_no_tenant_sn", "tenant_id, serial_no"},
		{&SerialNo{}, "idx_serial_no_tenant_item", "tenant_id, item_code"},
		{&SerialNo{}, "idx_serial_no_tenant_status", "tenant_id, status"},
		{&Batch{}, "idx_batch_tenant_id", "tenant_id, batch_id"},
		{&Batch{}, "idx_batch_tenant_item", "tenant_id, item_code"},
		{&StockEntry{}, "idx_stock_entry_tenant_status", "tenant_id, status"},
		{&StockEntry{}, "idx_stock_entry_tenant_number", "tenant_id, stock_entry_number"},
		{&StockEntryItem{}, "idx_stock_entry_item_entry", "stock_entry_id"},
		{&Warehouse{}, "idx_stock_wh_tenant_name", "tenant_id, warehouse_name"},
		{&Warehouse{}, "idx_stock_wh_tenant_company", "tenant_id, company"},
		{&UOM{}, "idx_stock_uom_tenant_name", "tenant_id, uom_name"},
		{&Shipment{}, "idx_shipment_tenant_status", "tenant_id, status"},
		{&ShipmentParcel{}, "idx_shipment_parcel_shipment", "shipment_id"},
		{&ShipmentDeliveryNote{}, "idx_shipment_dn_shipment", "shipment_id"},
		{&DeliveryNote{}, "idx_dn_tenant_status", "tenant_id, status"},
		{&DeliveryNoteItem{}, "idx_dn_item_dn", "delivery_note_id"},
		{&DeliveryNoteTax{}, "idx_dn_tax_dn", "delivery_note_id"},
		{&StockLedgerEntry{}, "idx_stock_ledger_balance", "tenant_id, item_code, warehouse, posting_date"},
	}

	for _, index := range indexes {
		if db.Migrator().HasIndex(index.model, index.name) {
			continue
		}
		statement := &gorm.Statement{DB: db}
		if err := statement.Parse(index.model); err != nil {
			return err
		}
		if err := db.Exec(fmt.Sprintf("CREATE INDEX %s ON %s (%s)", index.name, statement.Schema.Table, index.columns)).Error; err != nil {
			return fmt.Errorf("create Stock index %s: %w", index.name, err)
		}
	}

	return nil
}
