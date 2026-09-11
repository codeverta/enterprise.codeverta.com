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
		&POSProfile{},
		&POSProfileUser{},
		&POSProfilePaymentMethod{},
		&POSProfileItemGroup{},
		&POSProfileCustomerGroup{},
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
		&Customer{},
		&CustomerGroup{},
		&Address{},
		&Contact{},
		&Territory{},
		&TerritoryTarget{},
		&SalesPartnerType{},
		&ItemGroup{},
		&FiscalYear{},
		&SalesPartner{},
		&SalesPartnerTarget{},
		&TaxCategory{},
		&Quotation{},
		&QuotationItem{},
		&Subscription{},
		&SubscriptionPlanItem{},
		&SubscriptionPlanMaster{},
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
		{&Customer{}, "idx_selling_customer_tenant", "tenant_id"},
		{&CustomerGroup{}, "idx_selling_customer_group_tenant", "tenant_id"},
		{&Address{}, "idx_selling_address_tenant", "tenant_id"},
		{&Contact{}, "idx_selling_contact_tenant", "tenant_id"},
		{&Territory{}, "idx_selling_territory_tenant", "tenant_id"},
		{&TerritoryTarget{}, "idx_selling_territory_target_tenant", "tenant_id, territory_id"},
		{&SalesPartnerType{}, "idx_selling_sp_type_tenant", "tenant_id"},
		{&ItemGroup{}, "idx_selling_item_group_tenant", "tenant_id"},
		{&FiscalYear{}, "idx_selling_fiscal_year_tenant", "tenant_id"},
		{&SalesPartner{}, "idx_selling_sales_partner_tenant", "tenant_id"},
		{&SalesPartnerTarget{}, "idx_selling_sp_target_tenant", "tenant_id, sales_partner_id"},
		{&TaxCategory{}, "idx_selling_tax_category_tenant", "tenant_id"},
		{&Quotation{}, "idx_selling_quotation_tenant", "tenant_id"},
		{&QuotationItem{}, "idx_selling_quotation_item_quote", "quotation_id"},
		{&SubscriptionPlanMaster{}, "idx_selling_spm_tenant", "tenant_id"},
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
