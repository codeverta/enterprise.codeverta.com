package model

import (
	"time"
)

type DeliveryNoteStatus string

const (
	DeliveryNoteStatusDraft     DeliveryNoteStatus = "Draft"
	DeliveryNoteStatusSubmitted DeliveryNoteStatus = "Submitted"
	DeliveryNoteStatusCancelled DeliveryNoteStatus = "Cancelled"
)

type DeliveryNote struct {
	ID           string             `gorm:"primaryKey;size:64" json:"id"`
	TenantID     string             `gorm:"size:64;not null;index" json:"tenant_id"`
	Number       string             `gorm:"size:64;not null;index;uniqueIndex:idx_delivery_note_number_tenant" json:"number"`
	NamingSeries string             `gorm:"size:64;default:'MAT-DN-.YYYY.-'" json:"naming_series"`
	Status       DeliveryNoteStatus `gorm:"size:32;not null;default:'Draft';index" json:"status"`

	Customer         string    `gorm:"size:180;not null;index" json:"customer"`
	PostingDate      time.Time `json:"posting_date"`
	PostingTime      string    `gorm:"size:32" json:"posting_time"`
	SetPostingTime   bool      `gorm:"default:false" json:"set_posting_time"`
	Company          string    `gorm:"size:180;not null;default:'PT ZENIT TECHNOLOGY SOLUTION'" json:"company"`
	IsReturn         bool      `gorm:"default:false" json:"is_return"`
	ReturnAgainstID  string    `gorm:"size:64;index" json:"return_against_id"`
	ReturnReason     string    `gorm:"type:text" json:"return_reason"`
	ReplacementForID string    `gorm:"size:64;index" json:"replacement_for_id"`

	SalesOrderID    string `gorm:"size:64;index" json:"sales_order_id"`
	SetWarehouse    string `gorm:"size:180" json:"set_warehouse"`
	TaxCategory     string `gorm:"size:120" json:"tax_category"`
	TaxesAndCharges string `gorm:"size:180" json:"taxes_and_charges"`
	ShippingRule    string `gorm:"size:120" json:"shipping_rule"`
	Incoterm        string `gorm:"size:32" json:"incoterm"`

	TotalQty                 float64 `gorm:"type:decimal(18,2);default:0" json:"total_qty"`
	Total                    float64 `gorm:"type:decimal(18,2);default:0" json:"total"`
	BaseTotalTaxesAndCharges float64 `gorm:"type:decimal(18,2);default:0" json:"base_total_taxes_and_charges"`
	TotalTaxesAndCharges     float64 `gorm:"type:decimal(18,2);default:0" json:"total_taxes_and_charges"`
	GrandTotal               float64 `gorm:"type:decimal(18,2);default:0" json:"grand_total"`
	RoundingAdjustment       float64 `gorm:"type:decimal(18,2);default:0" json:"rounding_adjustment"`
	RoundedTotal             float64 `gorm:"type:decimal(18,2);default:0" json:"rounded_total"`

	ApplyDiscountOn              string  `gorm:"size:32;default:'grand_total'" json:"apply_discount_on"`
	AdditionalDiscountPercentage float64 `gorm:"type:decimal(18,2);default:0" json:"additional_discount_percentage"`
	AdditionalDiscountAmount     float64 `gorm:"type:decimal(18,2);default:0" json:"additional_discount_amount"`

	Items []DeliveryNoteItem `gorm:"foreignKey:DeliveryNoteID;constraint:OnDelete:CASCADE" json:"items"`
	Taxes []DeliveryNoteTax  `gorm:"foreignKey:DeliveryNoteID;constraint:OnDelete:CASCADE" json:"taxes"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (DeliveryNote) TableName() string { return "stock_delivery_notes" }

type DeliveryNoteItem struct {
	ID             string  `gorm:"primaryKey;size:64" json:"id"`
	DeliveryNoteID string  `gorm:"size:64;not null;index" json:"delivery_note_id"`
	Idx            int     `gorm:"default:0" json:"idx"`
	ItemCode       string  `gorm:"size:120;not null;index" json:"item_code"`
	ItemName       string  `gorm:"size:180" json:"item_name"`
	Quantity       float64 `gorm:"type:decimal(18,2);not null;default:1" json:"quantity"`
	UOM            string  `gorm:"size:32;default:'Nos'" json:"uom"`
	Rate           float64 `gorm:"type:decimal(18,2);default:0" json:"rate"`
	Amount         float64 `gorm:"type:decimal(18,2);default:0" json:"amount"`
	Warehouse      string  `gorm:"size:180" json:"warehouse"`
	AgainstItemID  string  `gorm:"size:64;index" json:"against_item_id"`
}

func (DeliveryNoteItem) TableName() string { return "stock_delivery_note_items" }

type DeliveryNoteTax struct {
	ID             string  `gorm:"primaryKey;size:64" json:"id"`
	DeliveryNoteID string  `gorm:"size:64;not null;index" json:"delivery_note_id"`
	Idx            int     `gorm:"default:0" json:"idx"`
	ChargeType     string  `gorm:"size:64;default:'On Net Total'" json:"charge_type"`
	AccountHead    string  `gorm:"size:180;not null" json:"account_head"`
	Rate           float64 `gorm:"type:decimal(18,2);default:0" json:"rate"`
	NetAmount      float64 `gorm:"type:decimal(18,2);default:0" json:"net_amount"`
	TaxAmount      float64 `gorm:"type:decimal(18,2);default:0" json:"tax_amount"`
	Total          float64 `gorm:"type:decimal(18,2);default:0" json:"total"`
}

func (DeliveryNoteTax) TableName() string { return "stock_delivery_note_taxes" }

// StockLedgerEntry is append-only. Submitted Delivery Notes create negative
// movements and submitted Delivery Note Returns create positive movements.
type StockLedgerEntry struct {
	ID              string    `gorm:"primaryKey;size:64" json:"id"`
	TenantID        string    `gorm:"size:64;not null;index" json:"tenant_id"`
	PostingDate     time.Time `gorm:"index;not null" json:"posting_date"`
	VoucherType     string    `gorm:"size:64;not null;index" json:"voucher_type"`
	VoucherID       string    `gorm:"size:64;not null;index" json:"voucher_id"`
	VoucherNumber   string    `gorm:"size:64;not null;index" json:"voucher_number"`
	VoucherDetailID string    `gorm:"size:64;not null;uniqueIndex:idx_stock_ledger_voucher_detail" json:"voucher_detail_id"`
	ItemCode        string    `gorm:"size:120;not null;index" json:"item_code"`
	Warehouse       string    `gorm:"size:180;not null;index" json:"warehouse"`
	ActualQty       float64   `gorm:"type:decimal(18,2);not null" json:"actual_qty"`
	CreatedAt       time.Time `json:"created_at"`
}

func (StockLedgerEntry) TableName() string { return "stock_ledger_entries" }
