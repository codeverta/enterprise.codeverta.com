package model

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Base struct {
	ID        uuid.UUID      `json:"id" gorm:"type:char(36);primaryKey"`
	TenantID  uuid.UUID      `json:"-" gorm:"type:char(36);not null;index"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`
}

func (b *Base) BeforeCreate(tx *gorm.DB) error {
	if b.ID == uuid.Nil {
		b.ID = uuid.New()
	}
	if b.TenantID != uuid.Nil {
		return nil
	}
	value, ok := tx.Get("tenant_id")
	if !ok {
		return fmt.Errorf("tenant_id is required for Buying data")
	}
	tenantID, err := uuid.Parse(fmt.Sprint(value))
	if err != nil || tenantID == uuid.Nil {
		return fmt.Errorf("invalid tenant_id for Buying data")
	}
	b.TenantID = tenantID
	return nil
}
