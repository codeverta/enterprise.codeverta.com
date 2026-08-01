package model

import (
	"fmt"
	"gin-template/common"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Definisikan constants
type BalanceLogCategory string

const (
	CategorySubscribe BalanceLogCategory = "SUBSCRIBE"
	CategoryRefund    BalanceLogCategory = "REFUND"
)

type BalanceLog struct {
	ID            uuid.UUID `json:"id" gorm:"type:char(36);primaryKey"`
	TransactionID string    `json:"transaction_id" gorm:"type:varchar(100);index"` // Triggered by this trx

	Category BalanceLogCategory `json:"category" gorm:"type:varchar(50);not null"`

	Description string `json:"description" gorm:"type:text"`

	// Snapshot Data
	GatewayAmount float64 `json:"gateway_amount" gorm:"type:decimal(16,2)"` // Dari API TIAS (amount_real)
	SystemAmount  float64 `json:"system_amount" gorm:"type:decimal(16,2)"`  // SUM(original_amount) dari DB Local
	Diff          float64 `json:"diff" gorm:"type:decimal(16,2)"`           // Selisih

	Status    string    `json:"status" gorm:"type:varchar(20)"` // MATCH, SUSPECT, ERROR
	CreatedAt time.Time `json:"created_at"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (a *BalanceLog) BeforeCreate(tx *gorm.DB) (err error) {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}

	// Only set TenantID from context if not already explicitly provided
	if a.TenantID == nil {
		if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
			a.TenantID = &tenant.ID
		} else {
			return fmt.Errorf("tenant_id is required for security isolation")
		}
	}
	return nil
}
