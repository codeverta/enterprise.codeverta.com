package model

import "time"

type POSProfileUser struct {
	ID           string    `gorm:"primaryKey;size:64" json:"id"`
	POSProfileID string    `gorm:"size:64;index;not null" json:"pos_profile_id"`
	User         string    `gorm:"size:255;not null" json:"user"`
	IsDefault    bool      `gorm:"default:false" json:"default"`
	CreatedAt    time.Time `json:"created_at"`
}

type POSProfilePaymentMethod struct {
	ID             string    `gorm:"primaryKey;size:64" json:"id"`
	POSProfileID   string    `gorm:"size:64;index;not null" json:"pos_profile_id"`
	ModeOfPayment  string    `gorm:"size:100;not null" json:"mode_of_payment"`
	IsDefault      bool      `gorm:"default:false" json:"default"`
	AllowInReturns bool      `gorm:"default:true" json:"allow_in_returns"`
	CreatedAt      time.Time `json:"created_at"`
}

type POSProfileItemGroup struct {
	ID           string    `gorm:"primaryKey;size:64" json:"id"`
	POSProfileID string    `gorm:"size:64;index;not null" json:"pos_profile_id"`
	ItemGroup    string    `gorm:"size:100;not null" json:"item_group"`
	CreatedAt    time.Time `json:"created_at"`
}

type POSProfileCustomerGroup struct {
	ID            string    `gorm:"primaryKey;size:64" json:"id"`
	POSProfileID  string    `gorm:"size:64;index;not null" json:"pos_profile_id"`
	CustomerGroup string    `gorm:"size:100;not null" json:"customer_group"`
	CreatedAt     time.Time `json:"created_at"`
}

type POSProfile struct {
	ID                           string                     `gorm:"primaryKey;size:64" json:"id"`
	TenantID                     string                     `gorm:"size:64;index;not null" json:"tenant_id"`
	Name                         string                     `gorm:"size:255;not null;index" json:"name"`
	Company                      string                     `gorm:"size:255;not null" json:"company"`
	Customer                     string                     `gorm:"size:255" json:"customer"`
	Country                      string                     `gorm:"size:100;default:'Indonesia'" json:"country"`
	Disabled                     bool                       `gorm:"default:false" json:"disabled"`
	Warehouse                    string                     `gorm:"size:255" json:"warehouse"`
	CompanyAddress               string                     `gorm:"size:255" json:"company_address"`
	HideImages                   bool                       `gorm:"default:false" json:"hide_images"`
	HideUnavailableItems         bool                       `gorm:"default:false" json:"hide_unavailable_items"`
	AutoAddItemToCart            bool                       `gorm:"default:false" json:"auto_add_item_to_cart"`
	ValidateStockOnSave          bool                       `gorm:"default:false" json:"validate_stock_on_save"`
	PrintReceiptOnOrderComplete  bool                       `gorm:"default:true" json:"print_receipt_on_order_complete"`
	ActionOnNewInvoice           string                     `gorm:"size:50;default:'Always Ask'" json:"action_on_new_invoice"`
	IgnorePricingRule            bool                       `gorm:"default:false" json:"ignore_pricing_rule"`
	AllowRateChange              bool                       `gorm:"default:false" json:"allow_rate_change"`
	AllowDiscountChange          bool                       `gorm:"default:false" json:"allow_discount_change"`
	SetGrandTotalToDefaultMop    bool                       `gorm:"default:true" json:"set_grand_total_to_default_mop"`
	AllowPartialPayment          bool                       `gorm:"default:false" json:"allow_partial_payment"`
	PrintFormat                  string                     `gorm:"size:100" json:"print_format"`
	LetterHead                   string                     `gorm:"size:100" json:"letter_head"`
	TermsAndConditions           string                     `gorm:"size:100" json:"tc_name"`
	PrintHeading                 string                     `gorm:"size:100" json:"select_print_heading"`
	SellingPriceList             string                     `gorm:"size:100" json:"selling_price_list"`
	Currency                     string                     `gorm:"size:20;default:'IDR'" json:"currency"`
	WriteOffAccount              string                     `gorm:"size:100" json:"write_off_account"`
	WriteOffCostCenter           string                     `gorm:"size:100" json:"write_off_cost_center"`
	WriteOffLimit                float64                    `gorm:"type:decimal(16,2);default:0" json:"write_off_limit"`
	AccountForChangeAmount       string                     `gorm:"size:100" json:"account_for_change_amount"`
	DisableRoundedTotal          bool                       `gorm:"default:false" json:"disable_rounded_total"`
	IncomeAccount                string                     `gorm:"size:100" json:"income_account"`
	ExpenseAccount               string                     `gorm:"size:100" json:"expense_account"`
	TaxesAndCharges              string                     `gorm:"size:100" json:"taxes_and_charges"`
	TaxCategory                  string                     `gorm:"size:100" json:"tax_category"`
	ApplyDiscountOn              string                     `gorm:"size:50;default:'Grand Total'" json:"apply_discount_on"`
	CostCenter                   string                     `gorm:"size:100" json:"cost_center"`
	Project                      string                     `gorm:"size:100" json:"project"`
	UTMSource                    string                     `gorm:"size:100" json:"utm_source"`
	UTMCampaign                  string                     `gorm:"size:100" json:"utm_campaign"`
	UTMMedium                    string                     `gorm:"size:100" json:"utm_medium"`
	ApplicableForUsers           []POSProfileUser           `gorm:"foreignKey:POSProfileID;constraint:OnDelete:CASCADE" json:"applicable_for_users"`
	Payments                     []POSProfilePaymentMethod  `gorm:"foreignKey:POSProfileID;constraint:OnDelete:CASCADE" json:"payments"`
	ItemGroups                   []POSProfileItemGroup      `gorm:"foreignKey:POSProfileID;constraint:OnDelete:CASCADE" json:"item_groups"`
	CustomerGroups               []POSProfileCustomerGroup  `gorm:"foreignKey:POSProfileID;constraint:OnDelete:CASCADE" json:"customer_groups"`
	CreatedAt                    time.Time                  `json:"created_at"`
	UpdatedAt                    time.Time                  `json:"updated_at"`
}
