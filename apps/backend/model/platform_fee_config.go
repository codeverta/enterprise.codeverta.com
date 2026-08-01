package model

import (
	"fmt"
	"gin-template/common"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type FeeType string

const (
	FeePercentage FeeType = "percentage"
	FeeFixed      FeeType = "fixed"
)

type PlatformFeeConfig struct {
	ID        uuid.UUID `json:"id" gorm:"type:char(36);primaryKey"`
	FeeName   string    `json:"fee_name" gorm:"type:varchar(100);not null;uniqueIndex:uk_fee_name_tenant"`
	FeeType   FeeType   `json:"fee_type" gorm:"type:varchar(20);not null"`
	FeeValue  float64   `json:"fee_value" gorm:"type:decimal(10,4);not null"`
	IsActive  bool      `json:"is_active" gorm:"default:true"`
	CreatedAt time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt time.Time `json:"updated_at" gorm:"autoUpdateTime"`

	TenantID uuid.UUID `json:"tenant_id" gorm:"type:char(36);not null;uniqueIndex:uk_fee_name_tenant"`
	Tenant   Tenant    `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;"`
}

func (f *PlatformFeeConfig) BeforeCreate(tx *gorm.DB) error {
	if f.ID == uuid.Nil {
		f.ID = uuid.New()
	}
	if f.TenantID == uuid.Nil {
		if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
			f.TenantID = tenant.ID
		} else {
			return fmt.Errorf("tenant_id is required for security isolation")
		}
	}
	return nil
}
