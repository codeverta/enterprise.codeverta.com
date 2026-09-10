package model

import (
	"fmt"
	"gin-template/common"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Definisi tipe ENUM untuk keamanan type di level aplikasi (opsional tapi disarankan)
type DiscountType string

const (
	DiscountPercent DiscountType = "PERCENT"
	DiscountFixed   DiscountType = "FIXED"
)

// 1. New Model: PromoCode
type PromoCode struct {
	ID   uuid.UUID `gorm:"type:char(36);primaryKey" json:"id"`
	Code string    `gorm:"uniqueIndex;type:varchar(20)" json:"code"`

	// Sesuai request: discount_type ENUM('PERCENT','FIXED')
	DiscountType DiscountType `gorm:"type:varchar(10);default:'FIXED'" json:"discount_type"`

	// Sesuai request: discount_value
	DiscountValue float64 `json:"discount_value"`

	// Sesuai request: max_discount (biasanya nullable jika tipe FIXED, tapi float64 aman)
	MaxDiscount     float64 `json:"max_discount"`
	MinParticipants int     `gorm:"default:1" json:"min_participants"`

	Quota     int `json:"quota"`
	UsedQuota int `gorm:"default:0" json:"used_quota"` // Kolom tracking pemakaian

	// Sesuai request: start_at & end_at
	StartAt *time.Time `json:"start_at"`
	EndAt   *time.Time `json:"end_at"`

	// Sesuai request: is_active
	IsActive bool `gorm:"default:true" json:"is_active"`

	// Standard Time Stamps (Opsional, tapi best practice GORM)
	CreatedAt *time.Time     `json:"created_at"`
	UpdatedAt *time.Time     `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (pc *PromoCode) BeforeCreate(tx *gorm.DB) (err error) {
	// Pastikan pc.ID adalah uuid.Nil (nol/kosong)
	if pc.ID == uuid.Nil {
		// Generate UUID baru
		pc.ID = uuid.New()
	}
	if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
		pc.TenantID = &tenant.ID
	} else {
		// Dalam riset Cybersecurity, ini penting:
		// Jangan biarkan record dibuat tanpa TenantID jika dalam mode multi-tenant
		return fmt.Errorf("tenant_id is required for security isolation")
	}
	return nil
}
