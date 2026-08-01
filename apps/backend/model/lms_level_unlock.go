package model

import (
	"fmt"
	"gin-template/common"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type LevelUnlock struct {
	ID         uuid.UUID      `json:"id" gorm:"type:char(36);primaryKey"`
	StudentID  uuid.UUID      `json:"student_id" gorm:"type:char(36);not null;index"`
	CourseID   uuid.UUID      `json:"course_id" gorm:"type:char(36);not null;index"`
	Level      string         `json:"level" gorm:"type:varchar(80);not null;index"`
	UnlockedAt time.Time      `json:"unlocked_at" gorm:"autoCreateTime"`
	CreatedAt  time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt  time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt  gorm.DeletedAt `json:"deleted_at" gorm:"index"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (m *LevelUnlock) BeforeCreate(tx *gorm.DB) error {
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
