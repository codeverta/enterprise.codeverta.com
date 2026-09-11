package model

import (
	"time"
)

type Quotation struct {
	ID                           string          `gorm:"primaryKey;size:64" json:"id"`
	TenantID                     string          `gorm:"size:64;index" json:"tenant_id"`
	NamingSeries                 string          `gorm:"size:64;default:'SAL-QTN-.YYYY.-'" json:"naming_series"`
	QuotationNumber              string          `gorm:"size:64;index" json:"quotation_number"`
	QuotationTo                  string          `gorm:"size:40;default:'Customer'" json:"quotation_to"`
	PartyName                    string          `gorm:"size:120;index" json:"party_name"`
	CustomerName                 string          `gorm:"size:140" json:"customer_name"`
	TransactionDate              string          `gorm:"size:20" json:"transaction_date"`
	ValidTill                    string          `gorm:"size:20" json:"valid_till"`
	OrderType                    string          `gorm:"size:40;default:'Sales'" json:"order_type"`
	Company                      string          `gorm:"size:140" json:"company"`
	Currency                     string          `gorm:"size:10;default:'IDR'" json:"currency"`
	SellingPriceList             string          `gorm:"size:64;default:'Standard Selling'" json:"selling_price_list"`
	ScanBarcode                  string          `gorm:"size:64" json:"scan_barcode"`
	TotalQty                     float64         `gorm:"default:0" json:"total_qty"`
	Total                        float64         `gorm:"default:0" json:"total"`
	TaxCategory                  string          `gorm:"size:64" json:"tax_category"`
	TaxesAndCharges              string          `gorm:"size:100" json:"taxes_and_charges"`
	ShippingRule                 string          `gorm:"size:100" json:"shipping_rule"`
	Incoterm                     string          `gorm:"size:50" json:"incoterm"`
	BaseTotalTaxesAndCharges     float64         `gorm:"default:0" json:"base_total_taxes_and_charges"`
	TotalTaxesAndCharges         float64         `gorm:"default:0" json:"total_taxes_and_charges"`
	GrandTotal                   float64         `gorm:"default:0" json:"grand_total"`
	RoundingAdjustment           float64         `gorm:"default:0" json:"rounding_adjustment"`
	RoundedTotal                 float64         `gorm:"default:0" json:"rounded_total"`
	DisableRoundedTotal          bool            `gorm:"default:false" json:"disable_rounded_total"`
	ApplyDiscountOn              string          `gorm:"size:40;default:'Grand Total'" json:"apply_discount_on"`
	CouponCode                   string          `gorm:"size:64" json:"coupon_code"`
	AdditionalDiscountPercentage float64         `gorm:"default:0" json:"additional_discount_percentage"`
	DiscountAmount               float64         `gorm:"default:0" json:"discount_amount"`
	SalesPartner                 string          `gorm:"size:120" json:"sales_partner"`
	Status                       string          `gorm:"size:40;default:'Draft'" json:"status"`
	Items                        []QuotationItem `gorm:"foreignKey:QuotationID;constraint:OnDelete:CASCADE" json:"items"`
	CreatedAt                    time.Time       `json:"created_at"`
	UpdatedAt                    time.Time       `json:"updated_at"`
}

func (Quotation) TableName() string {
	return "selling_quotations"
}

type QuotationItem struct {
	ID          string    `gorm:"primaryKey;size:64" json:"id"`
	TenantID    string    `gorm:"size:64;index" json:"tenant_id"`
	QuotationID string    `gorm:"size:64;index;not null" json:"quotation_id"`
	ItemCode    string    `gorm:"size:100;not null" json:"item_code"`
	ItemName    string    `gorm:"size:255" json:"item_name"`
	Quantity    float64   `gorm:"default:1" json:"qty"`
	Rate        float64   `gorm:"default:0" json:"rate"`
	Amount      float64   `gorm:"default:0" json:"amount"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (QuotationItem) TableName() string {
	return "selling_quotation_items"
}
