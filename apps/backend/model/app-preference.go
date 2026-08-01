package model

import (
	"fmt"
	"gin-template/common"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type UserAppPreference struct {
	ID               uuid.UUID      `json:"id" gorm:"type:char(36);primaryKey"`
	UserID           uuid.UUID      `json:"user_id" gorm:"type:char(36);not null;uniqueIndex"`
	Language         string         `json:"language" gorm:"type:varchar(8);not null;default:'id'"`
	AIChatDailyLimit int            `json:"ai_chat_daily_limit" gorm:"type:int;not null;default:200"`
	Onboarding       datatypes.JSON `json:"onboarding" gorm:"type:json"`
	CreatedAt        time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt        time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt        gorm.DeletedAt `json:"deleted_at" gorm:"index"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
}

func (m *UserAppPreference) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	if m.Language == "" {
		m.Language = "id"
	}
	if m.AIChatDailyLimit <= 0 {
		m.AIChatDailyLimit = 200
	}
	if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
		m.TenantID = &tenant.ID
	} else {
		return fmt.Errorf("tenant_id is required for security isolation")
	}
	return nil
}
