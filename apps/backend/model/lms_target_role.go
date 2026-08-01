package model

import (
	"fmt"
	"gin-template/common"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type CourseCategoryTargetRole struct {
	ID               uuid.UUID      `json:"id" gorm:"type:char(36);primaryKey"`
	CourseCategoryID uuid.UUID      `json:"course_category_id" gorm:"type:char(36);not null;index"`
	Role             string         `json:"role" gorm:"type:varchar(32);not null;index"`
	CreatedAt        time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt        time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt        gorm.DeletedAt `json:"deleted_at" gorm:"index"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (m *CourseCategoryTargetRole) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
		m.TenantID = &tenant.ID
	} else if m.TenantID == nil {
		return fmt.Errorf("tenant_id is required for security isolation")
	}
	return nil
}

type CourseTargetRole struct {
	ID        uuid.UUID      `json:"id" gorm:"type:char(36);primaryKey"`
	CourseID  uuid.UUID      `json:"course_id" gorm:"type:char(36);not null;index"`
	Role      string         `json:"role" gorm:"type:varchar(32);not null;index"`
	CreatedAt time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt gorm.DeletedAt `json:"deleted_at" gorm:"index"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (m *CourseTargetRole) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
		m.TenantID = &tenant.ID
	} else if m.TenantID == nil {
		return fmt.Errorf("tenant_id is required for security isolation")
	}
	return nil
}
