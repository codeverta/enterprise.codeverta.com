package model

import "github.com/google/uuid"

type Supplier struct {
	Base
	SupplierName               string                   `json:"supplier_name" gorm:"type:varchar(180);not null;index" binding:"required,max=180"`
	SupplierType               string                   `json:"supplier_type" gorm:"type:varchar(32);not null;default:'Company'" binding:"required,oneof=Company Individual"`
	SupplierGroup              string                   `json:"supplier_group" gorm:"type:varchar(120);not null;index" binding:"required,max=120"`
	Country                    string                   `json:"country" gorm:"type:varchar(100);default:'Indonesia'"`
	IsTransporter              bool                     `json:"is_transporter"`
	DefaultCurrency            string                   `json:"default_currency" gorm:"type:varchar(8);default:'IDR'"`
	DefaultBankAccount         string                   `json:"default_bank_account" gorm:"type:varchar(180)"`
	DefaultPriceList           string                   `json:"default_price_list" gorm:"type:varchar(120);default:'Standard Buying'"`
	SupplierDetails            string                   `json:"supplier_details" gorm:"type:text"`
	Website                    string                   `json:"website" gorm:"type:varchar(255)"`
	Language                   string                   `json:"language" gorm:"type:varchar(64);default:'English'"`
	AllowInvoiceWithoutPO      bool                     `json:"allow_purchase_invoice_creation_without_purchase_order"`
	AllowInvoiceWithoutReceipt bool                     `json:"allow_purchase_invoice_creation_without_purchase_receipt"`
	Disabled                   bool                     `json:"disabled" gorm:"index"`
	IsFrozen                   bool                     `json:"is_frozen"`
	BlockSupplier              bool                     `json:"block_supplier"`
	TaxID                      string                   `json:"tax_id" gorm:"type:varchar(100);index"`
	TaxCategory                string                   `json:"tax_category" gorm:"type:varchar(120)"`
	TaxWithholdingCategory     string                   `json:"tax_withholding_category" gorm:"type:varchar(120)"`
	TaxWithholdingGroup        string                   `json:"tax_withholding_group" gorm:"type:varchar(120)"`
	SupplierAddress            string                   `json:"supplier_address" gorm:"type:text"`
	ContactPerson              string                   `json:"contact_person" gorm:"type:varchar(180)"`
	ContactEmail               string                   `json:"contact_email" gorm:"type:varchar(180)" binding:"omitempty,email"`
	ContactPhone               string                   `json:"contact_phone" gorm:"type:varchar(40)"`
	AccountsPayable            string                   `json:"accounts_payable" gorm:"type:varchar(180)"`
	PortalUsers                string                   `json:"portal_users" gorm:"type:text"`
	CustomerNumbers            []SupplierCustomerNumber `json:"customer_numbers" gorm:"foreignKey:SupplierID"`
}

func (Supplier) TableName() string { return "buying_suppliers" }

type SupplierCustomerNumber struct {
	Base
	SupplierID     uuid.UUID `json:"supplier_id" gorm:"type:char(36);not null;index"`
	Idx            int       `json:"idx"`
	Company        string    `json:"company" gorm:"type:varchar(180);not null" binding:"required"`
	CustomerNumber string    `json:"customer_number" gorm:"type:varchar(120);not null" binding:"required"`
}

func (SupplierCustomerNumber) TableName() string { return "buying_supplier_customer_numbers" }

type SupplierGroup struct {
	Base
	GroupName        string `json:"group_name" gorm:"type:varchar(120);not null;index" binding:"required,max=120"`
	ParentGroup      string `json:"parent_group" gorm:"type:varchar(120);index"`
	IsGroup          bool   `json:"is_group"`
	DefaultPriceList string `json:"default_price_list" gorm:"type:varchar(120)"`
	PaymentTerms     string `json:"payment_terms" gorm:"type:varchar(180)"`
	Description      string `json:"description" gorm:"type:text"`
}

func (SupplierGroup) TableName() string { return "buying_supplier_groups" }

type Item struct {
	Base
	ItemCode                   string             `json:"item_code" gorm:"type:varchar(120);not null;index" binding:"required,max=120"`
	ItemName                   string             `json:"item_name" gorm:"type:varchar(180);not null;index" binding:"required,max=180"`
	ItemGroup                  string             `json:"item_group" gorm:"type:varchar(120);not null;index" binding:"required"`
	StockUOM                   string             `json:"stock_uom" gorm:"type:varchar(32);not null;default:'Nos'" binding:"required"`
	Disabled                   bool               `json:"disabled" gorm:"index"`
	AllowAlternativeItem       bool               `json:"allow_alternative_item"`
	IsStockItem                bool               `json:"is_stock_item"`
	HasVariants                bool               `json:"has_variants"`
	IsFixedAsset               bool               `json:"is_fixed_asset"`
	OpeningStock               float64            `json:"opening_stock" gorm:"type:decimal(18,6);default:0"`
	ImageURL                   string             `json:"image_url" gorm:"type:text"`
	Description                string             `json:"description" gorm:"type:text"`
	Brand                      string             `json:"brand" gorm:"type:varchar(120)"`
	ValuationMethod            string             `json:"valuation_method" gorm:"type:varchar(32);default:'FIFO'"`
	ValuationRate              float64            `json:"valuation_rate" gorm:"type:decimal(18,2);default:0"`
	ShelfLifeInDays            int                `json:"shelf_life_in_days"`
	EndOfLife                  string             `json:"end_of_life" gorm:"type:varchar(10);default:'2099-12-31'"`
	DefaultMaterialRequestType string             `json:"default_material_request_type" gorm:"type:varchar(32);default:'Purchase'"`
	WarrantyPeriod             int                `json:"warranty_period"`
	WeightPerUnit              float64            `json:"weight_per_unit" gorm:"type:decimal(18,6);default:0"`
	WeightUOM                  string             `json:"weight_uom" gorm:"type:varchar(32)"`
	AllowNegativeStock         bool               `json:"allow_negative_stock"`
	HasBatchNo                 bool               `json:"has_batch_no"`
	PurchaseUOM                string             `json:"purchase_uom" gorm:"type:varchar(32)"`
	MinOrderQty                float64            `json:"min_order_qty" gorm:"type:decimal(18,6);default:0"`
	SafetyStock                float64            `json:"safety_stock" gorm:"type:decimal(18,6);default:0"`
	IsPurchaseItem             bool               `json:"is_purchase_item"`
	LeadTimeDays               int                `json:"lead_time_days"`
	IsCustomerProvidedItem     bool               `json:"is_customer_provided_item"`
	DeliveredBySupplier        bool               `json:"delivered_by_supplier"`
	CountryOfOrigin            string             `json:"country_of_origin" gorm:"type:varchar(100);default:'Indonesia'"`
	CustomsTariffNumber        string             `json:"customs_tariff_number" gorm:"type:varchar(120)"`
	IncomeAccount              string             `json:"income_account" gorm:"type:varchar(180)"`
	ExpenseAccount             string             `json:"expense_account" gorm:"type:varchar(180)"`
	TaxCategory                string             `json:"tax_category" gorm:"type:varchar(120)"`
	QualityInspectionRequired  bool               `json:"quality_inspection_required"`
	UOMs                       []ItemUOM          `json:"uoms" gorm:"foreignKey:ItemID"`
	Barcodes                   []ItemBarcode      `json:"barcodes" gorm:"foreignKey:ItemID"`
	ReorderLevels              []ItemReorderLevel `json:"reorder_levels" gorm:"foreignKey:ItemID"`
	SupplierItems              []ItemSupplier     `json:"supplier_items" gorm:"foreignKey:ItemID"`
}

func (Item) TableName() string { return "buying_items" }

type ItemUOM struct {
	Base
	ItemID           uuid.UUID `json:"item_id" gorm:"type:char(36);not null;index"`
	Idx              int       `json:"idx"`
	UOM              string    `json:"uom" gorm:"type:varchar(32);not null" binding:"required"`
	ConversionFactor float64   `json:"conversion_factor" gorm:"type:decimal(18,6);not null;default:1" binding:"gt=0"`
}

func (ItemUOM) TableName() string { return "buying_item_uoms" }

type ItemBarcode struct {
	Base
	ItemID      uuid.UUID `json:"item_id" gorm:"type:char(36);not null;index"`
	Idx         int       `json:"idx"`
	Barcode     string    `json:"barcode" gorm:"type:varchar(180);not null;index" binding:"required"`
	BarcodeType string    `json:"barcode_type" gorm:"type:varchar(32)"`
	UOM         string    `json:"uom" gorm:"type:varchar(32)"`
}

func (ItemBarcode) TableName() string { return "buying_item_barcodes" }

type ItemReorderLevel struct {
	Base
	ItemID              uuid.UUID `json:"item_id" gorm:"type:char(36);not null;index"`
	Idx                 int       `json:"idx"`
	RequestFor          string    `json:"request_for" gorm:"type:varchar(180)"`
	Warehouse           string    `json:"warehouse" gorm:"type:varchar(180)"`
	ReorderLevel        float64   `json:"reorder_level"`
	ReorderQty          float64   `json:"reorder_qty"`
	MaterialRequestType string    `json:"material_request_type" gorm:"type:varchar(32);default:'Purchase'"`
}

func (ItemReorderLevel) TableName() string { return "buying_item_reorder_levels" }

type ItemSupplier struct {
	Base
	ItemID             uuid.UUID `json:"item_id" gorm:"type:char(36);not null;index"`
	Idx                int       `json:"idx"`
	Supplier           string    `json:"supplier" gorm:"type:varchar(180);not null" binding:"required"`
	SupplierPartNumber string    `json:"supplier_part_number" gorm:"type:varchar(120)"`
}

func (ItemSupplier) TableName() string { return "buying_item_suppliers" }
