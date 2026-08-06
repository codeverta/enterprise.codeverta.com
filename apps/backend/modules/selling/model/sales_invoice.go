package model

import "time"

type SalesInvoiceStatus string

const (
	SalesInvoiceStatusDraft     SalesInvoiceStatus = "Draft"
	SalesInvoiceStatusSubmitted SalesInvoiceStatus = "Submitted"
	SalesInvoiceStatusCancelled SalesInvoiceStatus = "Cancelled"
)

type SalesInvoice struct {
	ID                string             `gorm:"primaryKey;size:64" json:"id"`
	TenantID          string             `gorm:"size:64;not null;index" json:"tenant_id"`
	Number            string             `gorm:"size:64;not null;uniqueIndex:idx_sales_invoice_number_tenant" json:"number"`
	Status            SalesInvoiceStatus `gorm:"size:32;not null;default:'Draft';index" json:"status"`
	Customer          string             `gorm:"size:255;not null;index" json:"customer"`
	Company           string             `gorm:"size:255;not null" json:"company"`
	PostingDate       time.Time          `gorm:"type:date;not null;index" json:"posting_date"`
	DueDate           *time.Time         `gorm:"type:date;index" json:"due_date"`
	SalesOrderID      string             `gorm:"size:64;index" json:"sales_order_id"`
	DeliveryNoteID    string             `gorm:"size:64;index" json:"delivery_note_id"`
	IsReturn          bool               `gorm:"default:false;index" json:"is_return"`
	ReturnAgainstID   string             `gorm:"size:64;index" json:"return_against_id"`
	ReturnReason      string             `gorm:"type:text" json:"return_reason"`
	Currency          string             `gorm:"size:3;not null;default:'IDR'" json:"currency"`
	NetTotal          float64            `gorm:"type:decimal(18,2);not null;default:0" json:"net_total"`
	TaxRate           float64            `gorm:"type:decimal(8,4);not null;default:0" json:"tax_rate"`
	TaxAmount         float64            `gorm:"type:decimal(18,2);not null;default:0" json:"tax_amount"`
	GrandTotal        float64            `gorm:"type:decimal(18,2);not null;default:0" json:"grand_total"`
	OutstandingAmount float64            `gorm:"type:decimal(18,2);not null;default:0" json:"outstanding_amount"`
	IsPaid            bool               `gorm:"default:false;index" json:"is_paid"`
	RefundStatus      string             `gorm:"size:32;not null;default:'Not Applicable';index" json:"refund_status"`
	RefundReference   string             `gorm:"size:128" json:"refund_reference"`
	RefundedAt        *time.Time         `json:"refunded_at"`
	Items             []SalesInvoiceItem `gorm:"foreignKey:SalesInvoiceID;constraint:OnDelete:CASCADE" json:"items"`
	CreatedAt         time.Time          `json:"created_at"`
	UpdatedAt         time.Time          `json:"updated_at"`
}

func (SalesInvoice) TableName() string { return "selling_sales_invoices" }

type SalesInvoiceItem struct {
	ID             string  `gorm:"primaryKey;size:64" json:"id"`
	SalesInvoiceID string  `gorm:"size:64;not null;index" json:"sales_invoice_id"`
	AgainstItemID  string  `gorm:"size:64;index" json:"against_item_id"`
	ItemCode       string  `gorm:"size:120;not null;index" json:"item_code"`
	ItemName       string  `gorm:"size:255" json:"item_name"`
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
