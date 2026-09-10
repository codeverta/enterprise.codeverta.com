package model

import "time"

const (
	POSOpeningStatusOpen   = "Open"
	POSOpeningStatusClosed = "Closed"
)

type POSOpeningEntry struct {
	ID                  string              `gorm:"primaryKey;size:64" json:"id"`
	TenantID            string              `gorm:"size:64;index;not null" json:"tenant_id"`
	PeriodStartDate     time.Time           `gorm:"index;not null" json:"period_start_date"`
	PostingDate         time.Time           `gorm:"type:date;not null" json:"posting_date"`
	Company             string              `gorm:"size:255;not null" json:"company"`
	POSProfile          string              `gorm:"size:255;not null;index" json:"pos_profile"`
	User                string              `gorm:"size:255;not null;index" json:"user"`
	Status              string              `gorm:"size:20;default:'Open';index" json:"status"`
	OpeningBalanceTotal float64             `gorm:"type:decimal(16,2);default:0" json:"opening_balance_total"`
	BalanceDetails      []POSOpeningBalance `gorm:"foreignKey:OpeningEntryID;constraint:OnDelete:CASCADE" json:"balance_details"`
	ClosedAt            *time.Time          `json:"closed_at,omitempty"`
	CreatedAt           time.Time           `json:"created_at"`
	UpdatedAt           time.Time           `json:"updated_at"`
}

type POSOpeningBalance struct {
	ID             string  `gorm:"primaryKey;size:64" json:"id"`
	OpeningEntryID string  `gorm:"size:64;index;not null" json:"opening_entry_id"`
	ModeOfPayment  string  `gorm:"size:100;not null" json:"mode_of_payment"`
	OpeningAmount  float64 `gorm:"type:decimal(16,2);default:0" json:"opening_amount"`
}

type POSInvoice struct {
	ID             string           `gorm:"primaryKey;size:64" json:"id"`
	TenantID       string           `gorm:"size:64;index;not null" json:"tenant_id"`
	InvoiceNumber  string           `gorm:"size:64;uniqueIndex;not null" json:"invoice_number"`
	OpeningEntryID string           `gorm:"size:64;index;not null" json:"opening_entry_id"`
	Customer       string           `gorm:"size:255" json:"customer"`
	NetTotal       float64          `gorm:"type:decimal(16,2);default:0" json:"net_total"`
	TaxTotal       float64          `gorm:"type:decimal(16,2);default:0" json:"tax_total"`
	GrandTotal     float64          `gorm:"type:decimal(16,2);default:0" json:"grand_total"`
	ModeOfPayment  string           `gorm:"size:100;not null" json:"mode_of_payment"`
	PaidAmount     float64          `gorm:"type:decimal(16,2);default:0" json:"paid_amount"`
	Status         string           `gorm:"size:20;default:'Paid'" json:"status"`
	Items          []POSInvoiceItem `gorm:"foreignKey:InvoiceID;constraint:OnDelete:CASCADE" json:"items"`
	CreatedAt      time.Time        `json:"created_at"`
}

type POSInvoiceItem struct {
	ID        string  `gorm:"primaryKey;size:64" json:"id"`
	InvoiceID string  `gorm:"size:64;index;not null" json:"invoice_id"`
	ItemCode  string  `gorm:"size:100;not null" json:"item_code"`
	ItemName  string  `gorm:"size:255;not null" json:"item_name"`
	Quantity  float64 `gorm:"type:decimal(12,3);default:1" json:"quantity"`
	Rate      float64 `gorm:"type:decimal(16,2);default:0" json:"rate"`
	Amount    float64 `gorm:"type:decimal(16,2);default:0" json:"amount"`
}

type POSClosingEntry struct {
	ID                   string                     `gorm:"primaryKey;size:64" json:"id"`
	TenantID             string                     `gorm:"size:64;index;not null" json:"tenant_id"`
	OpeningEntryID       string                     `gorm:"size:64;uniqueIndex;not null" json:"pos_opening_entry"`
	PeriodStartDate      *time.Time                 `json:"period_start_date"`
	PeriodEndDate        time.Time                  `gorm:"not null" json:"period_end_date"`
	PostingDate          time.Time                  `gorm:"type:date;not null" json:"posting_date"`
	PostingTime          string                     `gorm:"size:20" json:"posting_time"`
	Company              string                     `gorm:"size:255;not null" json:"company"`
	POSProfile           string                     `gorm:"size:255;index" json:"pos_profile"`
	User                 string                     `gorm:"size:255;not null" json:"user"`
	TotalQuantity        float64                    `gorm:"type:decimal(16,2);default:0" json:"total_quantity"`
	NetTotal             float64                    `gorm:"type:decimal(16,2);default:0" json:"net_total"`
	TotalTaxesAndCharges float64                    `gorm:"type:decimal(16,2);default:0" json:"total_taxes_and_charges"`
	GrandTotal           float64                    `gorm:"type:decimal(16,2);default:0" json:"grand_total"`
	Status               string                     `gorm:"size:20;default:'Submitted'" json:"status"`
	Reconciliations      []POSPaymentReconciliation `gorm:"foreignKey:ClosingEntryID;constraint:OnDelete:CASCADE" json:"payment_reconciliation"`
	CreatedAt            time.Time                  `json:"created_at"`
}

type POSPaymentReconciliation struct {
	ID             string  `gorm:"primaryKey;size:64" json:"id"`
	ClosingEntryID string  `gorm:"size:64;index;not null" json:"closing_entry_id"`
	ModeOfPayment  string  `gorm:"size:100;not null" json:"mode_of_payment"`
	OpeningAmount  float64 `gorm:"type:decimal(16,2);default:0" json:"opening_amount"`
	ExpectedAmount float64 `gorm:"type:decimal(16,2);default:0" json:"expected_amount"`
	ClosingAmount  float64 `gorm:"type:decimal(16,2);default:0" json:"closing_amount"`
	Difference     float64 `gorm:"type:decimal(16,2);default:0" json:"difference"`
}
