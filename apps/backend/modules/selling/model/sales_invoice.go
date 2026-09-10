package model

import "time"

type SalesInvoiceStatus string

const (
	SalesInvoiceStatusDraft     SalesInvoiceStatus = "Draft"
	SalesInvoiceStatusSubmitted SalesInvoiceStatus = "Submitted"
	SalesInvoiceStatusCancelled SalesInvoiceStatus = "Cancelled"
)

type SalesInvoice struct {
	ID                              string             `gorm:"primaryKey;size:64" json:"id"`
	TenantID                        string             `gorm:"size:64;not null;index" json:"tenant_id"`
	Number                          string             `gorm:"size:64;not null;uniqueIndex:idx_sales_invoice_number_tenant" json:"number"`
	NamingSeries                    string             `gorm:"size:64;default:'ACC-SINV-.YYYY.-'" json:"naming_series"`
	Status                          SalesInvoiceStatus `gorm:"size:32;not null;default:'Draft';index" json:"status"`
	Customer                        string             `gorm:"size:255;not null;index" json:"customer"`
	Company                         string             `gorm:"size:255;not null" json:"company"`
	PostingDate                     time.Time          `gorm:"type:date;not null;index" json:"posting_date"`
	PostingTime                     string             `gorm:"size:20" json:"posting_time"`
	SetPostingTime                  bool               `gorm:"default:false" json:"set_posting_time"`
	DueDate                         *time.Time         `gorm:"type:date;index" json:"due_date"`
	IsPOS                           bool               `gorm:"default:false" json:"is_pos"`
	IsReturn                        bool               `gorm:"default:false;index" json:"is_return"`
	IsDebitNote                     bool               `gorm:"default:false" json:"is_debit_note"`
	ApplyTDS                        bool               `gorm:"default:false" json:"apply_tds"`
	CostCenter                      string             `gorm:"size:120" json:"cost_center"`
	Project                         string             `gorm:"size:120" json:"project"`
	ScanBarcode                     string             `gorm:"size:120" json:"scan_barcode"`
	UpdateStock                     bool               `gorm:"default:false" json:"update_stock"`
	SalesOrderID                    string             `gorm:"size:64;index" json:"sales_order_id"`
	DeliveryNoteID                  string             `gorm:"size:64;index" json:"delivery_note_id"`
	ReturnAgainstID                 string             `gorm:"size:64;index" json:"return_against_id"`
	ReturnReason                    string             `gorm:"type:text" json:"return_reason"`
	Currency                        string             `gorm:"size:3;not null;default:'IDR'" json:"currency"`
	TotalQty                        float64            `gorm:"type:decimal(18,2);not null;default:0" json:"total_qty"`
	NetTotal                        float64            `gorm:"type:decimal(18,2);not null;default:0" json:"net_total"`
	TaxCategory                     string             `gorm:"size:120" json:"tax_category"`
	TaxesAndCharges                 string             `gorm:"size:120" json:"taxes_and_charges"`
	ShippingRule                    string             `gorm:"size:120" json:"shipping_rule"`
	Incoterm                        string             `gorm:"size:40" json:"incoterm"`
	TaxRate                         float64            `gorm:"type:decimal(8,4);not null;default:0" json:"tax_rate"`
	TaxAmount                       float64            `gorm:"type:decimal(18,2);not null;default:0" json:"tax_amount"`
	TotalTaxesAndCharges            float64            `gorm:"type:decimal(18,2);not null;default:0" json:"total_taxes_and_charges"`
	UseCompanyRoundoffCostCenter    bool               `gorm:"default:false" json:"use_company_roundoff_cost_center"`
	GrandTotal                      float64            `gorm:"type:decimal(18,2);not null;default:0" json:"grand_total"`
	RoundingAdjustment              float64            `gorm:"type:decimal(18,2);not null;default:0" json:"rounding_adjustment"`
	RoundedTotal                    float64            `gorm:"type:decimal(18,2);not null;default:0" json:"rounded_total"`
	TotalAdvance                    float64            `gorm:"type:decimal(18,2);not null;default:0" json:"total_advance"`
	OutstandingAmount               float64            `gorm:"type:decimal(18,2);not null;default:0" json:"outstanding_amount"`
	ApplyDiscountOn                 string             `gorm:"size:40;default:'Grand Total'" json:"apply_discount_on"`
	CouponCode                      string             `gorm:"size:80" json:"coupon_code"`
	AdditionalDiscountPercentage    float64            `gorm:"type:decimal(8,4);default:0" json:"additional_discount_percentage"`
	DiscountAmount                  float64            `gorm:"type:decimal(18,2);default:0" json:"discount_amount"`
	IsCashOrNonTradeDiscount        bool               `gorm:"default:false" json:"is_cash_or_non_trade_discount"`
	AllocateAdvancesAutomatically   bool               `gorm:"default:false" json:"allocate_advances_automatically"`
	RedeemLoyaltyPoints             bool               `gorm:"default:false" json:"redeem_loyalty_points"`
	LoyaltyProgram                  string             `gorm:"size:120" json:"loyalty_program"`
	CustomerAddress                 string             `gorm:"size:255" json:"customer_address"`
	ContactPerson                   string             `gorm:"size:255" json:"contact_person"`
	Territory                       string             `gorm:"size:120" json:"territory"`
	ShippingAddressName             string             `gorm:"size:255" json:"shipping_address_name"`
	DispatchAddressName             string             `gorm:"size:255" json:"dispatch_address_name"`
	CompanyAddress                  string             `gorm:"size:255" json:"company_address"`
	PaymentTermsTemplate            string             `gorm:"size:120" json:"payment_terms_template"`
	TCName                          string             `gorm:"size:120" json:"tc_name"`
	TermsAndConditions              string             `gorm:"type:text" json:"terms_and_conditions"`
	PONo                            string             `gorm:"size:80" json:"po_no"`
	PODate                          *time.Time         `gorm:"type:date" json:"po_date"`
	DebitTo                         string             `gorm:"size:120" json:"debit_to"`
	SalesPartner                    string             `gorm:"size:120" json:"sales_partner"`
	AmountEligibleForCommission     float64            `gorm:"type:decimal(18,2);default:0" json:"amount_eligible_for_commission"`
	CommissionRate                  float64            `gorm:"type:decimal(8,4);default:0" json:"commission_rate"`
	TotalCommission                 float64            `gorm:"type:decimal(18,2);default:0" json:"total_commission"`
	LetterHead                      string             `gorm:"size:120" json:"letter_head"`
	GroupSameItems                  bool               `gorm:"default:false" json:"group_same_items"`
	SelectPrintHeading              string             `gorm:"size:120" json:"select_print_heading"`
	Language                        string             `gorm:"size:40;default:'English'" json:"language"`
	Subscription                    string             `gorm:"size:120" json:"subscription"`
	FromDate                        *time.Time         `gorm:"type:date" json:"from_date"`
	ToDate                          *time.Time         `gorm:"type:date" json:"to_date"`
	UTMSource                       string             `gorm:"size:120" json:"utm_source"`
	UTMMedium                       string             `gorm:"size:120" json:"utm_medium"`
	UTMCampaign                     string             `gorm:"size:120" json:"utm_campaign"`
	UTMContent                      string             `gorm:"size:120" json:"utm_content"`
	IsPaid                          bool               `gorm:"default:false;index" json:"is_paid"`
	RefundStatus                    string             `gorm:"size:32;not null;default:'Not Applicable';index" json:"refund_status"`
	RefundReference                 string             `gorm:"size:128" json:"refund_reference"`
	RefundedAt                      *time.Time         `json:"refunded_at"`
	Items                           []SalesInvoiceItem `gorm:"foreignKey:SalesInvoiceID;constraint:OnDelete:CASCADE" json:"items"`
	CreatedAt                       time.Time          `json:"created_at"`
	UpdatedAt                       time.Time          `json:"updated_at"`
}

func (SalesInvoice) TableName() string { return "selling_sales_invoices" }

type SalesInvoiceItem struct {
	ID             string  `gorm:"primaryKey;size:64" json:"id"`
	SalesInvoiceID string  `gorm:"size:64;not null;index" json:"sales_invoice_id"`
	AgainstItemID  string  `gorm:"size:64;index" json:"against_item_id"`
	ItemCode       string  `gorm:"size:120;not null;index" json:"item_code"`
	ItemName       string  `gorm:"size:255" json:"item_name"`
	Warehouse      string  `gorm:"size:120" json:"warehouse"`
	Quantity       float64 `gorm:"type:decimal(18,2);not null" json:"quantity"`
	UOM            string  `gorm:"size:32;default:'Nos'" json:"uom"`
	Rate           float64 `gorm:"type:decimal(18,2);not null;default:0" json:"rate"`
	Amount         float64 `gorm:"type:decimal(18,2);not null;default:0" json:"amount"`
}

func (SalesInvoiceItem) TableName() string { return "selling_sales_invoice_items" }

type SalesLedgerEntry struct {
	ID            string    `gorm:"primaryKey;size:64" json:"id"`
	TenantID      string    `gorm:"size:64;not null;index" json:"tenant_id"`
	PostingDate   time.Time `gorm:"index;not null" json:"posting_date"`
	VoucherID     string    `gorm:"size:64;not null;index" json:"voucher_id"`
	VoucherNumber string    `gorm:"size:64;not null;index" json:"voucher_number"`
	EntryType     string    `gorm:"size:32;not null" json:"entry_type"`
	Account       string    `gorm:"size:180;not null;index" json:"account"`
	Debit         float64   `gorm:"type:decimal(18,2);not null;default:0" json:"debit"`
	Credit        float64   `gorm:"type:decimal(18,2);not null;default:0" json:"credit"`
	CreatedAt     time.Time `json:"created_at"`
}

func (SalesLedgerEntry) TableName() string { return "selling_ledger_entries" }
