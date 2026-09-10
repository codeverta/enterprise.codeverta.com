package model

import (
	"time"
)

type PurchaseReceiptStatus string

const (
	PurchaseReceiptStatusDraft     PurchaseReceiptStatus = "Draft"
	PurchaseReceiptStatusSubmitted PurchaseReceiptStatus = "Submitted"
	PurchaseReceiptStatusCancelled PurchaseReceiptStatus = "Cancelled"
)

type PurchaseReceipt struct {
	ID           string                `gorm:"primaryKey;size:64" json:"id"`
	TenantID     string                `gorm:"size:64;not null;index" json:"tenant_id"`
	Number       string                `gorm:"size:64;not null;index;uniqueIndex:idx_purchase_receipt_number_tenant" json:"number"`
	NamingSeries string                `gorm:"size:64;default:'MAT-PRE-.YYYY.-'" json:"naming_series"`
	Status       PurchaseReceiptStatus `gorm:"size:32;not null;default:'Draft';index" json:"status"`

	Supplier             string    `gorm:"size:180;not null;index" json:"supplier"`
	SupplierDeliveryNote string    `gorm:"size:120" json:"supplier_delivery_note"`
	PostingDate          time.Time `json:"posting_date"`
	PostingTime          string    `gorm:"size:32" json:"posting_time"`
	SetPostingTime       bool      `gorm:"default:false" json:"set_posting_time"`
	Company              string    `gorm:"size:180;not null;default:'PT ZENIT TECHNOLOGY SOLUTION'" json:"company"`
	ApplyPutawayRule     bool      `gorm:"default:false" json:"apply_putaway_rule"`
	IsReturn             bool      `gorm:"default:false" json:"is_return"`
	ReturnAgainstID      string    `gorm:"size:64;index" json:"return_against_id"`

	// Accounting Dimensions
	CostCenter string `gorm:"size:180" json:"cost_center"`
	Project    string `gorm:"size:180" json:"project"`

	// Currency & Price List
	Currency           string `gorm:"size:8;default:'IDR'" json:"currency"`
	BuyingPriceList    string `gorm:"size:180;default:'Standard Buying'" json:"buying_price_list"`
	IgnorePricingRule  bool   `gorm:"default:false" json:"ignore_pricing_rule"`

	// Items Header Defaults
	ScanBarcode        string `gorm:"size:120" json:"scan_barcode"`
	SetWarehouse       string `gorm:"size:180" json:"set_warehouse"`
	RejectedWarehouse  string `gorm:"size:180" json:"rejected_warehouse"`
	IsSubcontracted    bool   `gorm:"default:false" json:"is_subcontracted"`

	// Taxes & Charges Header
	TaxCategory     string `gorm:"size:120" json:"tax_category"`
	TaxesAndCharges string `gorm:"size:180" json:"taxes_and_charges"`
	ShippingRule    string `gorm:"size:120" json:"shipping_rule"`
	Incoterm        string `gorm:"size:32" json:"incoterm"`

	// Totals
	TotalQty                     float64 `gorm:"type:decimal(18,2);default:0" json:"total_qty"`
	Total                        float64 `gorm:"type:decimal(18,2);default:0" json:"total"`
	BaseTaxesAndChargesAdded     float64 `gorm:"type:decimal(18,2);default:0" json:"base_taxes_and_charges_added"`
	BaseTaxesAndChargesDeducted  float64 `gorm:"type:decimal(18,2);default:0" json:"base_taxes_and_charges_deducted"`
	BaseTotalTaxesAndCharges     float64 `gorm:"type:decimal(18,2);default:0" json:"base_total_taxes_and_charges"`
	TaxesAndChargesAdded         float64 `gorm:"type:decimal(18,2);default:0" json:"taxes_and_charges_added"`
	TaxesAndChargesDeducted      float64 `gorm:"type:decimal(18,2);default:0" json:"taxes_and_charges_deducted"`
	TotalTaxesAndCharges         float64 `gorm:"type:decimal(18,2);default:0" json:"total_taxes_and_charges"`
	GrandTotal                   float64 `gorm:"type:decimal(18,2);default:0" json:"grand_total"`
	DisableRoundedTotal          bool    `gorm:"default:false" json:"disable_rounded_total"`
	RoundingAdjustment           float64 `gorm:"type:decimal(18,2);default:0" json:"rounding_adjustment"`
	RoundedTotal                 float64 `gorm:"type:decimal(18,2);default:0" json:"rounded_total"`

	// Additional Discount
	ApplyDiscountOn              string  `gorm:"size:32;default:'grand_total'" json:"apply_discount_on"`
	AdditionalDiscountPercentage float64 `gorm:"type:decimal(18,2);default:0" json:"additional_discount_percentage"`
	DiscountAmount               float64 `gorm:"type:decimal(18,2);default:0" json:"discount_amount"`

	Remarks string `gorm:"type:text" json:"remarks"`

	Items         []PurchaseReceiptItem        `gorm:"foreignKey:PurchaseReceiptID;constraint:OnDelete:CASCADE" json:"items"`
	Taxes         []PurchaseReceiptTax         `gorm:"foreignKey:PurchaseReceiptID;constraint:OnDelete:CASCADE" json:"taxes"`
	SuppliedItems []PurchaseReceiptSuppliedItem `gorm:"foreignKey:PurchaseReceiptID;constraint:OnDelete:CASCADE" json:"supplied_items"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (PurchaseReceipt) TableName() string { return "stock_purchase_receipts" }

type PurchaseReceiptItem struct {
	ID                string  `gorm:"primaryKey;size:64" json:"id"`
	PurchaseReceiptID string  `gorm:"size:64;not null;index" json:"purchase_receipt_id"`
	Idx               int     `gorm:"default:0" json:"idx"`
	ItemCode          string  `gorm:"size:120;not null;index" json:"item_code"`
	ItemName          string  `gorm:"size:180" json:"item_name"`
	AcceptedQuantity  float64 `gorm:"type:decimal(18,2);not null;default:0" json:"accepted_quantity"`
	RejectedQuantity  float64 `gorm:"type:decimal(18,2);default:0" json:"rejected_quantity"`
	UOM               string  `gorm:"size:32;default:'Nos'" json:"uom"`
	Rate              float64 `gorm:"type:decimal(18,2);default:0" json:"rate"`
	Amount            float64 `gorm:"type:decimal(18,2);default:0" json:"amount"`
	AcceptedWarehouse string  `gorm:"size:180" json:"accepted_warehouse"`
	RejectedWarehouse string  `gorm:"size:180" json:"rejected_warehouse"`
	Barcode           string  `gorm:"size:120" json:"barcode"`
	BatchNo           string  `gorm:"size:120" json:"batch_no"`
	AgainstItemID     string  `gorm:"size:64;index" json:"against_item_id"`
}

func (PurchaseReceiptItem) TableName() string { return "stock_purchase_receipt_items" }

type PurchaseReceiptTax struct {
	ID                string  `gorm:"primaryKey;size:64" json:"id"`
	PurchaseReceiptID string  `gorm:"size:64;not null;index" json:"purchase_receipt_id"`
	Idx               int     `gorm:"default:0" json:"idx"`
	Type              string  `gorm:"size:64;default:'Actual'" json:"type"`
	AccountHead       string  `gorm:"size:180;not null" json:"account_head"`
	TaxRate           float64 `gorm:"type:decimal(18,2);default:0" json:"tax_rate"`
	NetAmount         float64 `gorm:"type:decimal(18,2);default:0" json:"net_amount"`
	Amount            float64 `gorm:"type:decimal(18,2);default:0" json:"amount"`
	Total             float64 `gorm:"type:decimal(18,2);default:0" json:"total"`
}

func (PurchaseReceiptTax) TableName() string { return "stock_purchase_receipt_taxes" }

type PurchaseReceiptSuppliedItem struct {
	ID                         string  `gorm:"primaryKey;size:64" json:"id"`
	PurchaseReceiptID          string  `gorm:"size:64;not null;index" json:"purchase_receipt_id"`
	Idx                        int     `gorm:"default:0" json:"idx"`
	ItemCode                   string  `gorm:"size:120;not null" json:"item_code"`
	RawMaterialItemCode        string  `gorm:"size:120;not null" json:"raw_material_item_code"`
	AvailableQtyForConsumption float64 `gorm:"type:decimal(18,2);default:0" json:"available_qty_for_consumption"`
	QtyToBeConsumed            float64 `gorm:"type:decimal(18,2);default:0" json:"qty_to_be_consumed"`
	CurrentStock               float64 `gorm:"type:decimal(18,2);default:0" json:"current_stock"`
}

func (PurchaseReceiptSuppliedItem) TableName() string { return "stock_purchase_receipt_supplied_items" }
