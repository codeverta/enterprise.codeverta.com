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
	); err != nil {
		return fmt.Errorf("auto migrate Stock models: %w", err)
	}

	indexes := []struct {
		model         interface{}
		name, columns string
	}{
		{&Shipment{}, "idx_shipment_tenant_status", "tenant_id, status"},
		{&ShipmentParcel{}, "idx_shipment_parcel_shipment", "shipment_id"},
		{&ShipmentDeliveryNote{}, "idx_shipment_dn_shipment", "shipment_id"},
		{&DeliveryNote{}, "idx_dn_tenant_status", "tenant_id, status"},
		{&DeliveryNoteItem{}, "idx_dn_item_dn", "delivery_note_id"},
		{&DeliveryNoteTax{}, "idx_dn_tax_dn", "delivery_note_id"},
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
