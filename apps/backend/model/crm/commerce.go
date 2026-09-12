package crm

import (
	"time"

	"github.com/google/uuid"
)

type Product struct {
	Base
	Name        string  `json:"name" gorm:"type:varchar(150);not null;index" binding:"required,max=150"`
	SKU         string  `json:"sku" gorm:"type:varchar(50);not null;index" binding:"required,max=50"`
	Price       float64 `json:"price" gorm:"type:decimal(18,2);not null" binding:"min=0"`
	Description string  `json:"description" gorm:"type:text"`
	IsActive    bool    `json:"is_active" gorm:"not null;default:true;index"`
}

func (Product) TableName() string { return "crm_products" }

type Quotation struct {
	Base
	OpportunityID *uuid.UUID `json:"opportunity_id" gorm:"type:char(36);index"`
	QuoteNumber   string     `json:"quote_number" gorm:"type:varchar(50);not null;index" binding:"required,max=50"`
	TotalAmount   float64    `json:"total_amount" gorm:"type:decimal(18,2);not null;default:0" binding:"min=0"`
	Status        string     `json:"status" gorm:"type:varchar(20);not null;default:'draft';index" binding:"omitempty,oneof=draft sent accepted rejected"`
	ValidUntil    *time.Time `json:"valid_until" gorm:"type:date"`
}

func (Quotation) TableName() string { return "crm_quotations" }

type QuotationItem struct {
	Base
	QuotationID uuid.UUID `json:"quotation_id" gorm:"type:char(36);not null;index" binding:"required"`
	ProductID   uuid.UUID `json:"product_id" gorm:"type:char(36);not null;index" binding:"required"`
	Quantity    int       `json:"quantity" gorm:"not null" binding:"required,min=1"`
	UnitPrice   float64   `json:"unit_price" gorm:"type:decimal(18,2);not null" binding:"min=0"`
	Subtotal    float64   `json:"subtotal" gorm:"type:decimal(18,2);not null" binding:"min=0"`
}

func (QuotationItem) TableName() string { return "crm_quotation_items" }

type SalesOrder struct {
	Base
	OpportunityID    *uuid.UUID       `json:"opportunity_id" gorm:"type:char(36);index"`
	QuotationID      *uuid.UUID       `json:"quotation_id" gorm:"type:char(36);index"`
	StoreOrderID     *string          `json:"store_order_id,omitempty" gorm:"type:varchar(64);index"`
	OrderNumber      string           `json:"order_number" gorm:"type:varchar(50);not null;index" binding:"required,max=50"`
	Company          string           `json:"company" gorm:"type:varchar(255);index"`
	Customer         string           `json:"customer" gorm:"type:varchar(255);index"`
	CustomerEmail    string           `json:"customer_email" gorm:"type:varchar(255);index"`
	ShippingAddress  string           `json:"shipping_address" gorm:"type:text"`
	TransactionDate  time.Time        `json:"transaction_date" gorm:"type:date;index"`
	Currency         string           `json:"currency" gorm:"type:varchar(3);not null;default:'IDR'"`
	Subtotal         float64          `json:"subtotal" gorm:"type:decimal(18,2);not null;default:0" binding:"min=0"`
	ShippingAmount   float64          `json:"shipping_amount" gorm:"type:decimal(18,2);not null;default:0" binding:"min=0"`
	TotalAmount      float64          `json:"total_amount" gorm:"type:decimal(18,2);not null;default:0" binding:"min=0"`
	PaymentStatus    string           `json:"payment_status" gorm:"type:varchar(20);index"`
	PaymentMethod    string           `json:"payment_method" gorm:"type:varchar(100);index"`
	PaymentProvider  string           `json:"payment_provider" gorm:"type:varchar(40);index"`
	PaymentReference string           `json:"payment_reference" gorm:"type:varchar(128);index"`
	PaidAt           *time.Time       `json:"paid_at"`
	Status           string           `json:"status" gorm:"type:varchar(20);not null;default:'processing';index" binding:"omitempty,oneof=processing confirmed completed cancelled"`
	Items            []SalesOrderItem `json:"items" gorm:"foreignKey:SalesOrderID;constraint:OnDelete:CASCADE"`
}

func (SalesOrder) TableName() string { return "crm_sales_orders" }

type SalesOrderItem struct {
	Base
	SalesOrderID uuid.UUID `json:"sales_order_id" gorm:"type:char(36);not null;index"`
	ProductID    string    `json:"product_id" gorm:"type:varchar(64);index"`
	ItemCode     string    `json:"item_code" gorm:"type:varchar(100);not null;index"`
	ItemName     string    `json:"item_name" gorm:"type:varchar(255);not null"`
	Quantity     int       `json:"quantity" gorm:"not null"`
	Rate         float64   `json:"rate" gorm:"type:decimal(18,2);not null"`
	Amount       float64   `json:"amount" gorm:"type:decimal(18,2);not null"`
}

func (SalesOrderItem) TableName() string { return "crm_sales_order_items" }

type Invoice struct {
	Base
	SalesOrderID  *uuid.UUID `json:"sales_order_id" gorm:"type:char(36);index"`
	InvoiceNumber string     `json:"invoice_number" gorm:"type:varchar(50);not null;index" binding:"required,max=50"`
	Amount        float64    `json:"amount" gorm:"type:decimal(18,2);not null;default:0" binding:"min=0"`
	DueDate       *time.Time `json:"due_date" gorm:"type:date;index"`
	Status        string     `json:"status" gorm:"type:varchar(20);not null;default:'unpaid';index" binding:"omitempty,oneof=unpaid paid overdue void"`
	PaidAt        *time.Time `json:"paid_at"`
}

func (Invoice) TableName() string { return "crm_invoices" }
