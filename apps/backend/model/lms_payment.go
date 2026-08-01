package model

import (
	"fmt"
	"gin-template/common"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type LMSPayment struct {
	ID             uuid.UUID        `json:"id" gorm:"type:char(36);primaryKey"`
	SubscriptionID *uuid.UUID       `json:"subscription_id" gorm:"type:char(36);index"`
	ParentID       uuid.UUID        `json:"parent_id" gorm:"type:char(36);not null;index"`
	StudentID      uuid.UUID        `json:"student_id" gorm:"type:char(36);not null;index"`
	CourseID       *uuid.UUID       `json:"course_id" gorm:"type:char(36);index"`
	Provider       string           `json:"provider" gorm:"type:varchar(40);default:'xendit';index"`
	ExternalID     string           `json:"external_id" gorm:"type:varchar(120);uniqueIndex"`
	TransactionID  string           `json:"transaction_id" gorm:"type:varchar(120);index"`
	PaymentType    string           `json:"payment_type" gorm:"type:varchar(50);index"`
	PaymentNumber  string           `json:"payment_number" gorm:"type:text"`
	InvoiceURL     string           `json:"invoice_url" gorm:"type:text"`
	Amount         float64          `json:"amount" gorm:"type:decimal(16,2);not null"`
	AdminFee       float64          `json:"admin_fee" gorm:"type:decimal(16,2);default:0"`
	HandlingFee    float64          `json:"handling_fee" gorm:"type:decimal(16,2);default:0"`
	TotalAmount    float64          `json:"total_amount" gorm:"type:decimal(16,2);default:0"`
	Currency       string           `json:"currency" gorm:"type:varchar(8);default:'IDR'"`
	Status         LMSPaymentStatus `json:"status" gorm:"type:varchar(24);default:'pending';index"`
	ExpiryDate     *time.Time       `json:"expiry_date"`
	PaidAt         *time.Time       `json:"paid_at"`
	GatewayData    datatypes.JSON   `json:"gateway_data" gorm:"type:json"`
	CreatedAt      time.Time        `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt      time.Time        `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt      gorm.DeletedAt   `json:"deleted_at" gorm:"index"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (m *LMSPayment) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
		m.TenantID = &tenant.ID
	} else {
		return fmt.Errorf("tenant_id is required for security isolation")
	}
	return nil
}
