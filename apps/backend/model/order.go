package model

import (
	"fmt"
	"gin-template/common"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type OrderStatus string

const (
	OrderDraft     OrderStatus = "draft"
	OrderPending   OrderStatus = "pending"
	OrderPaid      OrderStatus = "paid"
	OrderCancelled OrderStatus = "cancelled"
	OrderRefunded  OrderStatus = "refunded"
)

// Order is a product-neutral commercial transaction. ERP modules can reference
// it through ReferenceType/ReferenceID without coupling core to their tables.
type Order struct {
	ID            uuid.UUID      `json:"id" gorm:"type:char(36);primaryKey"`
	Number        string         `json:"number" gorm:"type:varchar(64);not null;uniqueIndex"`
	CustomerID    *uuid.UUID     `json:"customer_id" gorm:"type:char(36);index"`
	Status        OrderStatus    `json:"status" gorm:"type:varchar(24);not null;default:'draft';index"`
	Currency      string         `json:"currency" gorm:"type:varchar(8);not null;default:'IDR'"`
	Subtotal      float64        `json:"subtotal" gorm:"type:decimal(16,2);not null;default:0"`
	DiscountTotal float64        `json:"discount_total" gorm:"type:decimal(16,2);not null;default:0"`
	TaxTotal      float64        `json:"tax_total" gorm:"type:decimal(16,2);not null;default:0"`
	GrandTotal    float64        `json:"grand_total" gorm:"type:decimal(16,2);not null;default:0"`
	PromoCodeID   *uuid.UUID     `json:"promo_code_id" gorm:"type:char(36);index"`
	ReferenceType string         `json:"reference_type" gorm:"type:varchar(64);index"`
	ReferenceID   string         `json:"reference_id" gorm:"type:varchar(128);index"`
	Notes         string         `json:"notes" gorm:"type:text"`
	Metadata      datatypes.JSON `json:"metadata" gorm:"type:json"`
	PaidAt        *time.Time     `json:"paid_at"`
	TenantID      *uuid.UUID     `json:"tenant_id" gorm:"type:char(36);not null;index"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `json:"-" gorm:"index"`
}

func (o *Order) BeforeCreate(tx *gorm.DB) error {
	if o.ID == uuid.Nil {
		o.ID = uuid.New()
	}
	if o.Number == "" {
		o.Number = "ORD-" + time.Now().UTC().Format("20060102-150405") + "-" + o.ID.String()[:8]
	}
	if o.Currency == "" {
		o.Currency = "IDR"
	}
	if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
		o.TenantID = &tenant.ID
	} else if o.TenantID == nil {
		return fmt.Errorf("tenant_id is required for security isolation")
	}
	o.GrandTotal = o.Subtotal - o.DiscountTotal + o.TaxTotal
	return nil
}
