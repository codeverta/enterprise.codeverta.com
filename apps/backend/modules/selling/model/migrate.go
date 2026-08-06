package model

import (
	"fmt"

	"gorm.io/gorm"
)

func Migrate(db *gorm.DB) error {
	if err := db.AutoMigrate(
		&LoyaltyProgram{},
		&CollectionRule{},
		&LoyaltyPointEntry{},
		&POSOpeningEntry{},
		&POSOpeningBalance{},
		&POSInvoice{},
		&POSInvoiceItem{},
		&POSClosingEntry{},
		&POSPaymentReconciliation{},
		&StoreCategory{},
		&StoreProduct{},
		&StoreCartItem{},
		&StoreWishlistItem{},
		&StoreOrder{},
		&StoreOrderItem{},
		&PriceList{},
		&ItemPrice{},
		&SalesInvoice{},
		&SalesInvoiceItem{},
		&SalesLedgerEntry{},
	); err != nil {
		return fmt.Errorf("auto migrate Selling models: %w", err)
	}

	indexes := []struct {
		model         interface{}
		name, columns string
	}{
		{&LoyaltyProgram{}, "idx_selling_lp_tenant", "tenant_id"},
		{&LoyaltyPointEntry{}, "idx_selling_lpe_tenant_cust", "tenant_id, customer"},
		{&POSOpeningEntry{}, "idx_selling_pos_open_tenant_status", "tenant_id, status"},
		{&POSInvoice{}, "idx_selling_pos_invoice_opening", "tenant_id, opening_entry_id"},
		{&POSClosingEntry{}, "idx_selling_pos_closing_tenant", "tenant_id"},
		{&StoreCategory{}, "idx_store_category_tenant_slug", "tenant_id, slug"},
		{&StoreProduct{}, "idx_store_product_tenant_slug", "tenant_id, slug"},
		{&StoreCartItem{}, "idx_store_cart_user_product", "tenant_id, user_id, product_id"},
		{&StoreWishlistItem{}, "idx_store_wishlist_user_product", "tenant_id, user_id, product_id"},
		{&StoreOrder{}, "idx_store_order_tenant_user", "tenant_id, user_id"},
		{&SalesInvoice{}, "idx_sales_invoice_tenant_status", "tenant_id, status, is_return"},
		{&SalesInvoiceItem{}, "idx_sales_invoice_item_invoice", "sales_invoice_id"},
		{&SalesLedgerEntry{}, "idx_sales_ledger_voucher", "tenant_id, voucher_id, entry_type"},
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
			return fmt.Errorf("create Selling index %s: %w", index.name, err)
		}
	}

	return nil
}
