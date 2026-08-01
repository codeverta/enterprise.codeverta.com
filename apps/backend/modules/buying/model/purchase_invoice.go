package model

import (
	"math"
	"strings"
	"time"

	"github.com/google/uuid"
)

const (
	PurchaseInvoiceDraft     = "draft"
	PurchaseInvoiceSubmitted = "submitted"
	PurchaseInvoiceCancelled = "cancelled"
)

type PurchaseInvoice struct {
	Base
	Number                         string                `json:"number" gorm:"type:varchar(64);not null;index"`
	NamingSeries                   string                `json:"naming_series" gorm:"type:varchar(64);not null;default:'ACC-PINV-.YYYY.-'" binding:"required,max=64"`
	Status                         string                `json:"status" gorm:"type:varchar(24);not null;default:'draft';index"`
	Supplier                       string                `json:"supplier" gorm:"type:varchar(180);not null;index" binding:"required,max=180"`
	Company                        string                `json:"company" gorm:"type:varchar(180);not null;index" binding:"required,max=180"`
	PostingDate                    time.Time             `json:"posting_date" gorm:"type:date;not null;index" binding:"required"`
	PostingTime                    string                `json:"posting_time" gorm:"type:varchar(8);not null" binding:"required,max=8"`
	SetPostingTime                 bool                  `json:"set_posting_time"`
	DueDate                        time.Time             `json:"due_date" gorm:"type:date;not null;index" binding:"required"`
	IsPaid                         bool                  `json:"is_paid"`
	IsReturn                       bool                  `json:"is_return"`
	ApplyTDS                       bool                  `json:"apply_tds"`
	BillNo                         string                `json:"bill_no" gorm:"type:varchar(120);index" binding:"max=120"`
	BillDate                       *time.Time            `json:"bill_date" gorm:"type:date;index"`
	CostCenter                     string                `json:"cost_center" gorm:"type:varchar(180);index" binding:"max=180"`
	Project                        string                `json:"project" gorm:"type:varchar(180);index" binding:"max=180"`
	Currency                       string                `json:"currency" gorm:"type:varchar(8);not null;default:'IDR'" binding:"required,max=8"`
	UseTransactionDateExchangeRate bool                  `json:"use_transaction_date_exchange_rate"`
	BuyingPriceList                string                `json:"buying_price_list" gorm:"type:varchar(120);default:'Standard Buying'" binding:"max=120"`
	IgnorePricingRule              bool                  `json:"ignore_pricing_rule"`
	UpdateStock                    bool                  `json:"update_stock"`
	IsSubcontracted                bool                  `json:"is_subcontracted"`
	TaxCategory                    string                `json:"tax_category" gorm:"type:varchar(120);index" binding:"max=120"`
	TaxesAndCharges                string                `json:"taxes_and_charges" gorm:"type:varchar(180)" binding:"max=180"`
	ShippingRule                   string                `json:"shipping_rule" gorm:"type:varchar(180)" binding:"max=180"`
	Incoterm                       string                `json:"incoterm" gorm:"type:varchar(32)" binding:"max=32"`
	TotalQty                       float64               `json:"total_qty" gorm:"type:decimal(18,6);not null;default:0"`
	Total                          float64               `json:"total" gorm:"type:decimal(18,2);not null;default:0"`
	BaseTaxesAndChargesAdded       float64               `json:"base_taxes_and_charges_added" gorm:"type:decimal(18,2);not null;default:0"`
	BaseTaxesAndChargesDeducted    float64               `json:"base_taxes_and_charges_deducted" gorm:"type:decimal(18,2);not null;default:0"`
	BaseTotalTaxesAndCharges       float64               `json:"base_total_taxes_and_charges" gorm:"type:decimal(18,2);not null;default:0"`
	TaxesAndChargesAdded           float64               `json:"taxes_and_charges_added" gorm:"type:decimal(18,2);not null;default:0"`
	TaxesAndChargesDeducted        float64               `json:"taxes_and_charges_deducted" gorm:"type:decimal(18,2);not null;default:0"`
	TotalTaxesAndCharges           float64               `json:"total_taxes_and_charges" gorm:"type:decimal(18,2);not null;default:0"`
	UseCompanyRoundoffCostCenter   bool                  `json:"use_company_roundoff_cost_center"`
	GrandTotal                     float64               `json:"grand_total" gorm:"type:decimal(18,2);not null;default:0"`
	RoundingAdjustment             float64               `json:"rounding_adjustment" gorm:"type:decimal(18,2);not null;default:0"`
	RoundedTotal                   float64               `json:"rounded_total" gorm:"type:decimal(18,2);not null;default:0"`
	TotalAdvance                   float64               `json:"total_advance" gorm:"type:decimal(18,2);not null;default:0" binding:"min=0"`
	ApplyDiscountOn                string                `json:"apply_discount_on" gorm:"type:varchar(24);default:'grand_total'" binding:"omitempty,oneof=grand_total net_total"`
	AdditionalDiscountPercentage   float64               `json:"additional_discount_percentage" gorm:"type:decimal(8,4);not null;default:0" binding:"min=0,max=100"`
	AdditionalDiscountAmount       float64               `json:"additional_discount_amount" gorm:"type:decimal(18,2);not null;default:0" binding:"min=0"`
	ModeOfPayment                  string                `json:"mode_of_payment" gorm:"type:varchar(100)" binding:"max=100"`
	CashBankAccount                string                `json:"cash_bank_account" gorm:"type:varchar(180)" binding:"max=180"`
	PaidAmount                     float64               `json:"paid_amount" gorm:"type:decimal(18,2);not null;default:0" binding:"min=0"`
	SupplierAddress                string                `json:"supplier_address" gorm:"type:text"`
	ShippingAddress                string                `json:"shipping_address" gorm:"type:text"`
	ContactPerson                  string                `json:"contact_person" gorm:"type:varchar(180)" binding:"max=180"`
	ContactEmail                   string                `json:"contact_email" gorm:"type:varchar(180)" binding:"omitempty,email,max=180"`
	ContactPhone                   string                `json:"contact_phone" gorm:"type:varchar(40)" binding:"max=40"`
	Terms                          string                `json:"terms" gorm:"type:longtext"`
	PaymentTermsTemplate           string                `json:"payment_terms_template" gorm:"type:varchar(180)" binding:"max=180"`
	LetterHead                     string                `json:"letter_head" gorm:"type:varchar(180)" binding:"max=180"`
	Remarks                        string                `json:"remarks" gorm:"type:text"`
	SubmittedAt                    *time.Time            `json:"submitted_at"`
	Items                          []PurchaseInvoiceItem `json:"items" gorm:"foreignKey:PurchaseInvoiceID" binding:"required,min=1,dive"`
	Taxes                          []PurchaseInvoiceTax  `json:"taxes" gorm:"foreignKey:PurchaseInvoiceID" binding:"dive"`
}

func (PurchaseInvoice) TableName() string { return "buying_purchase_invoices" }

type PurchaseInvoiceItem struct {
	Base
	PurchaseInvoiceID uuid.UUID `json:"purchase_invoice_id" gorm:"type:char(36);not null;index"`
	Idx               int       `json:"idx" gorm:"not null"`
	ItemCode          string    `json:"item_code" gorm:"type:varchar(120);not null;index" binding:"required,max=120"`
	ItemName          string    `json:"item_name" gorm:"type:varchar(180)" binding:"max=180"`
	Description       string    `json:"description" gorm:"type:text"`
	AcceptedQty       float64   `json:"accepted_qty" gorm:"type:decimal(18,6);not null" binding:"required,gt=0"`
	UOM               string    `json:"uom" gorm:"type:varchar(32);not null" binding:"required,max=32"`
	Rate              float64   `json:"rate" gorm:"type:decimal(18,2);not null" binding:"min=0"`
	Amount            float64   `json:"amount" gorm:"type:decimal(18,2);not null"`
	Warehouse         string    `json:"warehouse" gorm:"type:varchar(180);index" binding:"max=180"`
}

func (PurchaseInvoiceItem) TableName() string { return "buying_purchase_invoice_items" }

type PurchaseInvoiceTax struct {
	Base
	PurchaseInvoiceID uuid.UUID `json:"purchase_invoice_id" gorm:"type:char(36);not null;index"`
	Idx               int       `json:"idx" gorm:"not null"`
	AddDeduct         string    `json:"add_deduct" gorm:"type:varchar(12);not null;default:'add'" binding:"required,oneof=add deduct"`
	ChargeType        string    `json:"charge_type" gorm:"type:varchar(32);not null" binding:"required,oneof=actual on_net_total on_previous_row_total"`
	AccountHead       string    `json:"account_head" gorm:"type:varchar(180);not null" binding:"required,max=180"`
	Description       string    `json:"description" gorm:"type:varchar(255)" binding:"max=255"`
	Rate              float64   `json:"rate" gorm:"type:decimal(10,4);not null;default:0"`
	NetAmount         float64   `json:"net_amount" gorm:"type:decimal(18,2);not null;default:0"`
	TaxAmount         float64   `json:"tax_amount" gorm:"type:decimal(18,2);not null;default:0"`
	Total             float64   `json:"total" gorm:"type:decimal(18,2);not null;default:0"`
}

func (PurchaseInvoiceTax) TableName() string { return "buying_purchase_invoice_taxes" }

type PurchaseInvoiceSequence struct {
	Base
	Year    int    `json:"year" gorm:"not null"`
	Prefix  string `json:"prefix" gorm:"type:varchar(64);not null"`
	Current int    `json:"current" gorm:"not null;default:0"`
}

func (PurchaseInvoiceSequence) TableName() string { return "buying_purchase_invoice_sequences" }

func (invoice *PurchaseInvoice) Calculate() {
	sign := 1.0
	if invoice.IsReturn {
		sign = -1
	}
	invoice.TotalQty, invoice.Total = 0, 0
	for index := range invoice.Items {
		item := &invoice.Items[index]
		item.Idx = index + 1
		item.Amount = money(item.AcceptedQty * item.Rate)
		invoice.TotalQty += item.AcceptedQty
		invoice.Total += item.Amount
	}
	invoice.TotalQty = precision(invoice.TotalQty, 6)
	invoice.Total = money(invoice.Total * sign)
	invoice.TaxesAndChargesAdded, invoice.TaxesAndChargesDeducted = 0, 0
	runningTotal := invoice.Total
	for index := range invoice.Taxes {
		tax := &invoice.Taxes[index]
		tax.Idx, tax.NetAmount = index+1, invoice.Total
		base := math.Abs(invoice.Total)
		if tax.ChargeType == "on_previous_row_total" {
			base = math.Abs(runningTotal)
		}
		if tax.ChargeType != "actual" {
			tax.TaxAmount = money(base * tax.Rate / 100)
		} else {
			tax.TaxAmount = money(math.Abs(tax.TaxAmount))
		}
		tax.TaxAmount *= sign
		if tax.AddDeduct == "deduct" {
			invoice.TaxesAndChargesDeducted += tax.TaxAmount
			runningTotal -= tax.TaxAmount
		} else {
			tax.AddDeduct = "add"
			invoice.TaxesAndChargesAdded += tax.TaxAmount
			runningTotal += tax.TaxAmount
		}
		tax.Total = money(runningTotal)
	}
	invoice.TaxesAndChargesAdded = money(invoice.TaxesAndChargesAdded)
	invoice.TaxesAndChargesDeducted = money(invoice.TaxesAndChargesDeducted)
	invoice.TotalTaxesAndCharges = money(invoice.TaxesAndChargesAdded - invoice.TaxesAndChargesDeducted)
	invoice.BaseTaxesAndChargesAdded = invoice.TaxesAndChargesAdded
	invoice.BaseTaxesAndChargesDeducted = invoice.TaxesAndChargesDeducted
	invoice.BaseTotalTaxesAndCharges = invoice.TotalTaxesAndCharges
	beforeDiscount := invoice.Total + invoice.TotalTaxesAndCharges
	discountBase := beforeDiscount
	if strings.EqualFold(invoice.ApplyDiscountOn, "net_total") {
		discountBase = invoice.Total
	}
	if invoice.AdditionalDiscountPercentage > 0 {
		invoice.AdditionalDiscountAmount = money(math.Abs(discountBase) * invoice.AdditionalDiscountPercentage / 100)
	} else {
		invoice.AdditionalDiscountAmount = money(invoice.AdditionalDiscountAmount)
	}
	invoice.GrandTotal = money(beforeDiscount - sign*invoice.AdditionalDiscountAmount)
	invoice.RoundedTotal = math.Round(invoice.GrandTotal)
	invoice.RoundingAdjustment = money(invoice.RoundedTotal - invoice.GrandTotal)
	if invoice.IsPaid {
		invoice.PaidAmount = math.Abs(invoice.RoundedTotal)
	}
}
