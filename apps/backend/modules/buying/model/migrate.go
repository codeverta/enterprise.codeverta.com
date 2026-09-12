package model

import (
	"fmt"
	"time"

	"gorm.io/gorm"
)

func Migrate(db *gorm.DB) error {
	if err := db.AutoMigrate(
		&PurchaseOrder{}, &PurchaseOrderItem{}, &PurchaseOrderTax{}, &PurchaseOrderSequence{},
		&PurchaseInvoice{}, &PurchaseInvoiceItem{}, &PurchaseInvoiceTax{}, &PurchaseInvoiceSequence{},
		&Supplier{}, &SupplierCustomerNumber{}, &SupplierGroup{},
		&Item{}, &ItemUOM{}, &ItemBarcode{}, &ItemReorderLevel{}, &ItemSupplier{},
	); err != nil {
		return fmt.Errorf("auto migrate Buying models: %w", err)
	}

	if db.Migrator().HasColumn(&Item{}, "standard_rate") {
		if db.Migrator().HasTable("selling_item_prices") {
			type legacyItem struct {
				ID           string
				TenantID     string
				ItemCode     string
				ItemName     string
				StandardRate float64
				StockUOM     string
			}
			var legacy []legacyItem
			if err := db.Table("buying_items").Where("standard_rate > 0").Select("id, tenant_id, item_code, item_name, standard_rate, stock_uom").Scan(&legacy).Error; err == nil {
				now := time.Now()
				for _, li := range legacy {
					var count int64
					_ = db.Table("selling_item_prices").Where("item_code = ? AND selling = ?", li.ItemCode, true).Count(&count).Error
					if count == 0 {
						prefix := li.ID
						if len(prefix) > 8 {
							prefix = prefix[:8]
						}
						_ = db.Table("selling_item_prices").Create(map[string]interface{}{
							"id":              "mig-ip-" + prefix,
							"tenant_id":       li.TenantID,
							"item_code":       li.ItemCode,
							"item_name":       li.ItemName,
							"price_list":      "Standard Selling",
							"price_list_rate": li.StandardRate,
							"currency":        "IDR",
							"uom":             li.StockUOM,
							"packing_unit":    1,
							"selling":         true,
							"buying":          false,
							"is_active":       true,
							"created_at":      now,
							"updated_at":      now,
						}).Error
					}
				}
			}
		}
		_ = db.Migrator().DropColumn(&Item{}, "standard_rate")
	}
	indexes := []struct {
		model         interface{}
		name, columns string
	}{
		{&PurchaseOrder{}, "idx_buying_po_tenant_number", "tenant_id, number"},
		{&PurchaseOrderSequence{}, "idx_buying_po_sequence", "tenant_id, year, prefix"},
		{&PurchaseInvoice{}, "idx_buying_pinv_tenant_number", "tenant_id, number"},
		{&PurchaseInvoiceSequence{}, "idx_buying_pinv_sequence", "tenant_id, year, prefix"},
		{&Supplier{}, "idx_buying_supplier_name", "tenant_id, supplier_name"},
		{&SupplierGroup{}, "idx_buying_supplier_group_name", "tenant_id, group_name"},
		{&Item{}, "idx_buying_item_code", "tenant_id, item_code"},
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
