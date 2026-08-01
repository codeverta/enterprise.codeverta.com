package model

import (
	"fmt"
	"gin-template/common"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type WithdrawalStatus string

const (
	WithdrawalStatusPending  WithdrawalStatus = "PENDING"
	WithdrawalStatusApproved WithdrawalStatus = "APPROVED"
	WithdrawalStatusRejected WithdrawalStatus = "REJECTED"
)

type Withdrawal struct {
	ID              uuid.UUID        `json:"id" gorm:"type:char(36);primaryKey"`
	Amount            float64          `json:"amount" gorm:"type:decimal(16,2);not null"`
	AdminFee          float64          `json:"admin_fee" gorm:"type:decimal(16,2);default:0"`
	TotalDeduct       float64          `json:"total_deduct" gorm:"type:decimal(16,2);default:0"`
	Status            WithdrawalStatus `json:"status" gorm:"type:varchar(20);default:'PENDING';index"`
	RequestedByID   uuid.UUID        `json:"requested_by_id" gorm:"type:char(36);not null;index"`
	RequestedBy     User             `json:"requested_by" gorm:"foreignKey:RequestedByID"`
	ApprovedByID    *uuid.UUID       `json:"approved_by_id" gorm:"type:char(36);index"`
	ApprovedBy      *User            `json:"approved_by" gorm:"foreignKey:ApprovedByID"`
	Notes             string           `json:"notes" gorm:"type:text"`
	BankName          string           `json:"bank_name" gorm:"type:varchar(100);not null"`
	BankAccountNumber string           `json:"bank_account_number" gorm:"type:varchar(100);not null"`
	BankAccountName   string           `json:"bank_account_name" gorm:"type:varchar(150);not null"`
	RejectionReason   string           `json:"rejection_reason" gorm:"type:text"`
	WalletID          *uuid.UUID       `json:"wallet_id" gorm:"type:char(36);index"`
	CreatedAt         time.Time        `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt       time.Time        `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt       gorm.DeletedAt   `json:"deleted_at" gorm:"index"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (w *Withdrawal) BeforeCreate(tx *gorm.DB) error {
	if w.ID == uuid.Nil {
		w.ID = uuid.New()
	}
	if w.TenantID == nil {
		if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
			w.TenantID = &tenant.ID
		} else {
			return fmt.Errorf("tenant_id is required for security isolation")
		}
	}
	return nil
}
