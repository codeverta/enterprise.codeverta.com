package model

import (
	"math"
	"strings"
	"time"

	"github.com/google/uuid"
)

const (
	PurchaseOrderDraft     = "draft"
	PurchaseOrderSubmitted = "submitted"
	PurchaseOrderCancelled = "cancelled"
)

type PurchaseOrder struct {
	Base
	Number                       string              `json:"number" gorm:"type:varchar(64);not null;index"`
	NamingSeries                 string              `json:"naming_series" gorm:"type:varchar(64);not null;default:'PUR-ORD-.YYYY.-'" binding:"required,max=64"`
	Status                       string              `json:"status" gorm:"type:varchar(24);not null;default:'draft';index"`
	Supplier                     string              `json:"supplier" gorm:"type:varchar(180);not null;index" binding:"required,max=180"`
	TransactionDate              time.Time           `json:"transaction_date" gorm:"type:date;not null;index" binding:"required"`
	ScheduleDate                 time.Time           `json:"schedule_date" gorm:"type:date;not null;index" binding:"required"`
	Company                      string              `json:"company" gorm:"type:varchar(180);not null;index" binding:"required,max=180"`
	IsSubcontracted              bool                `json:"is_subcontracted"`
	CostCenter                   string              `json:"cost_center" gorm:"type:varchar(180);index" binding:"max=180"`
	Project                      string              `json:"project" gorm:"type:varchar(180);index" binding:"max=180"`
	Currency                     string              `json:"currency" gorm:"type:varchar(8);not null;default:'IDR'" binding:"required,max=8"`
	BuyingPriceList              string              `json:"buying_price_list" gorm:"type:varchar(120);default:'Standard Buying'" binding:"max=120"`
	IgnorePricingRule            bool                `json:"ignore_pricing_rule"`
	SetWarehouse                 string              `json:"set_warehouse" gorm:"type:varchar(180);index" binding:"max=180"`
	TaxCategory                  string              `json:"tax_category" gorm:"type:varchar(120);index" binding:"max=120"`
	TaxesAndCharges              string              `json:"taxes_and_charges" gorm:"type:varchar(180)" binding:"max=180"`
	ShippingRule                 string              `json:"shipping_rule" gorm:"type:varchar(180)" binding:"max=180"`
	Incoterm                     string              `json:"incoterm" gorm:"type:varchar(32)" binding:"max=32"`
	TotalQty                     float64             `json:"total_qty" gorm:"type:decimal(18,6);not null;default:0"`
	Total                        float64             `json:"total" gorm:"type:decimal(18,2);not null;default:0"`
	TotalTaxesAndCharges         float64             `json:"total_taxes_and_charges" gorm:"type:decimal(18,2);not null;default:0"`
	GrandTotal                   float64             `json:"grand_total" gorm:"type:decimal(18,2);not null;default:0"`
	DisableRoundedTotal          bool                `json:"disable_rounded_total"`
	RoundingAdjustment           float64             `json:"rounding_adjustment" gorm:"type:decimal(18,2);not null;default:0"`
	RoundedTotal                 float64             `json:"rounded_total" gorm:"type:decimal(18,2);not null;default:0"`
	AdvancePaid                  float64             `json:"advance_paid" gorm:"type:decimal(18,2);not null;default:0" binding:"min=0"`
	ApplyDiscountOn              string              `json:"apply_discount_on" gorm:"type:varchar(24);default:'grand_total'" binding:"omitempty,oneof=grand_total net_total"`
	AdditionalDiscountPercentage float64             `json:"additional_discount_percentage" gorm:"type:decimal(8,4);not null;default:0" binding:"min=0,max=100"`
	AdditionalDiscountAmount     float64             `json:"additional_discount_amount" gorm:"type:decimal(18,2);not null;default:0" binding:"min=0"`
	SupplierAddress              string              `json:"supplier_address" gorm:"type:text"`
	ShippingAddress              string              `json:"shipping_address" gorm:"type:text"`
	ContactPerson                string              `json:"contact_person" gorm:"type:varchar(180)" binding:"max=180"`
	ContactEmail                 string              `json:"contact_email" gorm:"type:varchar(180)" binding:"omitempty,email,max=180"`
	ContactPhone                 string              `json:"contact_phone" gorm:"type:varchar(40)" binding:"max=40"`
	Terms                        string              `json:"terms" gorm:"type:longtext"`
	PaymentTermsTemplate         string              `json:"payment_terms_template" gorm:"type:varchar(180)" binding:"max=180"`
	LetterHead                   string              `json:"letter_head" gorm:"type:varchar(180)" binding:"max=180"`
	Remarks                      string              `json:"remarks" gorm:"type:text"`
	SubmittedAt                  *time.Time          `json:"submitted_at"`
	Items                        []PurchaseOrderItem `json:"items" gorm:"foreignKey:PurchaseOrderID" binding:"required,min=1,dive"`
	Taxes                        []PurchaseOrderTax  `json:"taxes" gorm:"foreignKey:PurchaseOrderID" binding:"dive"`
}

func (PurchaseOrder) TableName() string { return "buying_purchase_orders" }

type PurchaseOrderItem struct {
	Base
	PurchaseOrderID uuid.UUID `json:"purchase_order_id" gorm:"type:char(36);not null;index"`
	Idx             int       `json:"idx" gorm:"not null"`
	ItemCode        string    `json:"item_code" gorm:"type:varchar(120);not null;index" binding:"required,max=120"`
	ItemName        string    `json:"item_name" gorm:"type:varchar(180)" binding:"max=180"`
	Description     string    `json:"description" gorm:"type:text"`
	ScheduleDate    time.Time `json:"schedule_date" gorm:"type:date;not null" binding:"required"`
	Quantity        float64   `json:"quantity" gorm:"type:decimal(18,6);not null" binding:"required,gt=0"`
	UOM             string    `json:"uom" gorm:"type:varchar(32);not null" binding:"required,max=32"`
	Rate            float64   `json:"rate" gorm:"type:decimal(18,2);not null" binding:"min=0"`
	Amount          float64   `json:"amount" gorm:"type:decimal(18,2);not null"`
	TargetWarehouse string    `json:"target_warehouse" gorm:"type:varchar(180);index" binding:"max=180"`
}

func (PurchaseOrderItem) TableName() string { return "buying_purchase_order_items" }

type PurchaseOrderTax struct {
	Base
	PurchaseOrderID uuid.UUID `json:"purchase_order_id" gorm:"type:char(36);not null;index"`
	Idx             int       `json:"idx" gorm:"not null"`
	ChargeType      string    `json:"charge_type" gorm:"type:varchar(32);not null" binding:"required,oneof=actual on_net_total on_previous_row_total"`
	AccountHead     string    `json:"account_head" gorm:"type:varchar(180);not null" binding:"required,max=180"`
	Description     string    `json:"description" gorm:"type:varchar(255)" binding:"max=255"`
	Rate            float64   `json:"rate" gorm:"type:decimal(10,4);not null;default:0"`
	NetAmount       float64   `json:"net_amount" gorm:"type:decimal(18,2);not null;default:0"`
	TaxAmount       float64   `json:"tax_amount" gorm:"type:decimal(18,2);not null;default:0"`
	Total           float64   `json:"total" gorm:"type:decimal(18,2);not null;default:0"`
}

func (PurchaseOrderTax) TableName() string { return "buying_purchase_order_taxes" }

type PurchaseOrderSequence struct {
	Base
	Year    int    `json:"year" gorm:"not null"`
	Prefix  string `json:"prefix" gorm:"type:varchar(64);not null"`
	Current int    `json:"current" gorm:"not null;default:0"`
}

func (PurchaseOrderSequence) TableName() string { return "buying_purchase_order_sequences" }

func (po *PurchaseOrder) Calculate() {
	po.TotalQty = 0
	po.Total = 0
	for index := range po.Items {
		item := &po.Items[index]
		item.Idx = index + 1
		if item.ScheduleDate.IsZero() {
			item.ScheduleDate = po.ScheduleDate
		}
		if item.TargetWarehouse == "" {
			item.TargetWarehouse = po.SetWarehouse
		}
		item.Amount = money(item.Quantity * item.Rate)
		po.TotalQty += item.Quantity
		po.Total += item.Amount
	}
	po.TotalQty = precision(po.TotalQty, 6)
	po.Total = money(po.Total)
	po.TotalTaxesAndCharges = 0
	runningTotal := po.Total
	for index := range po.Taxes {
		tax := &po.Taxes[index]
		tax.Idx = index + 1
		tax.NetAmount = po.Total
		switch tax.ChargeType {
		case "actual":
			tax.TaxAmount = money(tax.TaxAmount)
		case "on_previous_row_total":
			tax.TaxAmount = money(runningTotal * tax.Rate / 100)
		default:
			tax.ChargeType = "on_net_total"
			tax.TaxAmount = money(po.Total * tax.Rate / 100)
		}
		po.TotalTaxesAndCharges += tax.TaxAmount
		runningTotal += tax.TaxAmount
		tax.Total = money(runningTotal)
	}
	po.TotalTaxesAndCharges = money(po.TotalTaxesAndCharges)
	beforeDiscount := po.Total + po.TotalTaxesAndCharges
	discountBase := beforeDiscount
	if strings.EqualFold(po.ApplyDiscountOn, "net_total") {
		discountBase = po.Total
	}
	if po.AdditionalDiscountPercentage > 0 {
		po.AdditionalDiscountAmount = money(discountBase * po.AdditionalDiscountPercentage / 100)
	} else {
		po.AdditionalDiscountAmount = money(po.AdditionalDiscountAmount)
	}
	po.GrandTotal = money(math.Max(0, beforeDiscount-po.AdditionalDiscountAmount))
	if po.DisableRoundedTotal {
		po.RoundedTotal = po.GrandTotal
		po.RoundingAdjustment = 0
	} else {
		po.RoundedTotal = math.Round(po.GrandTotal)
		po.RoundingAdjustment = money(po.RoundedTotal - po.GrandTotal)
	}
}

func money(value float64) float64 { return precision(value, 2) }

func precision(value float64, places int) float64 {
	factor := math.Pow10(places)
	return math.Round(value*factor) / factor
}
