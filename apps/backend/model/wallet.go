package model

import (
	"fmt"
	"gin-template/common"
	"math"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type WalletOwnerType string

const (
	WalletOwnerUser         WalletOwnerType = "user"
	WalletOwnerOrganization WalletOwnerType = "organization"
	WalletOwnerPlatform     WalletOwnerType = "platform"
)

type Wallet struct {
	ID            uuid.UUID       `json:"id" gorm:"type:char(36);primaryKey"`
	OwnerType     WalletOwnerType `json:"owner_type" gorm:"type:varchar(20);not null;uniqueIndex:uk_wallet_owner"`
	OwnerID       uuid.UUID       `json:"owner_id" gorm:"type:char(36);not null;uniqueIndex:uk_wallet_owner"`
	Balance       float64         `json:"balance" gorm:"type:decimal(16,2);default:0"`
	LockedBalance float64         `json:"locked_balance" gorm:"type:decimal(16,2);default:0"`
	Currency      string          `json:"currency" gorm:"type:varchar(3);default:'IDR'"`
	IsActive      bool            `json:"is_active" gorm:"default:true"`
	CreatedAt     time.Time       `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt     time.Time       `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt     gorm.DeletedAt  `json:"deleted_at" gorm:"index"`

	TenantID uuid.UUID `json:"tenant_id" gorm:"type:char(36);not null;index"`
	Tenant   Tenant    `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;"`
}

func (w *Wallet) GetAvailableBalance() float64 {
	return math.Max(0, w.Balance-w.LockedBalance)
}

func (w *Wallet) BeforeCreate(tx *gorm.DB) error {
	if w.ID == uuid.Nil {
		w.ID = uuid.New()
	}
	if w.TenantID == uuid.Nil {
		if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
			w.TenantID = tenant.ID
		} else {
			return fmt.Errorf("tenant_id is required for security isolation")
		}
	}
	return nil
}
