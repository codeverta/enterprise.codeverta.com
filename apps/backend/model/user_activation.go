package model

import (
	"gin-template/common"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type UserActivation struct {
	ID        uuid.UUID      `json:"id" gorm:"type:char(36);primaryKey"`
	UserID    uuid.UUID      `json:"user_id" gorm:"type:char(36);not null;index"`
	Token     string         `json:"token" gorm:"type:varchar(100);not null;uniqueIndex"`
	ExpiresAt time.Time      `json:"expires_at" gorm:"not null"`
	Used      bool           `json:"used" gorm:"type:tinyint(1);default:0"`
	CreatedAt time.Time      `json:"created_at" gorm:"autoCreateTime"`
	TenantID  *uuid.UUID     `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant    *Tenant        `json:"tenant,omitempty" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
	DeletedAt gorm.DeletedAt `json:"deleted_at" gorm:"index"`
}

func (m *UserActivation) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
		m.TenantID = &tenant.ID
	}
	return nil
}
