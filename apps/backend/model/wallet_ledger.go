package model

import (
	"fmt"
	"gin-template/common"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type LedgerEntryType string

const (
	LedgerCredit LedgerEntryType = "credit"
	LedgerDebit  LedgerEntryType = "debit"
)

type LedgerReason string

const (
	LedgerReasonCourseSale      LedgerReason = "course_sale"
	LedgerReasonPlatformFee     LedgerReason = "platform_fee"
	LedgerReasonWithdrawal      LedgerReason = "withdrawal"
	LedgerReasonAdminAdjustment LedgerReason = "admin_adjustment"
	LedgerReasonRefund          LedgerReason = "refund"
)

type WalletLedger struct {
	ID             uuid.UUID       `json:"id" gorm:"type:char(36);primaryKey"`
	WalletID       uuid.UUID       `json:"wallet_id" gorm:"type:char(36);not null;index:idx_ledger_wallet_created"`
	Amount         float64         `json:"amount" gorm:"type:decimal(16,2);not null"`
	RunningBalance float64         `json:"running_balance" gorm:"type:decimal(16,2);not null"`
	EntryType      LedgerEntryType `json:"entry_type" gorm:"type:varchar(20);not null"`
	Reason         LedgerReason    `json:"reason" gorm:"type:varchar(50);not null"`
	ReferenceType  string          `json:"reference_type" gorm:"type:varchar(30);index"`
	ReferenceID    *uuid.UUID      `json:"reference_id" gorm:"type:char(36)"`
	Description    string          `json:"description" gorm:"type:text"`
	CreatedAt      time.Time       `json:"created_at" gorm:"autoCreateTime;index"`

	TenantID uuid.UUID `json:"tenant_id" gorm:"type:char(36);not null;index"`
	Tenant   Tenant    `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;"`
	Wallet   Wallet    `json:"-" gorm:"foreignKey:WalletID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;"`
}

func (l *WalletLedger) BeforeCreate(tx *gorm.DB) error {
	if l.ID == uuid.Nil {
		l.ID = uuid.New()
	}
	if l.TenantID == uuid.Nil {
		if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
			l.TenantID = tenant.ID
		} else {
			return fmt.Errorf("tenant_id is required for security isolation")
		}
	}
	return nil
}
