package model

import (
	"fmt"
	"gin-template/common"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Organization struct {
	ID            uuid.UUID      `json:"id" gorm:"type:char(36);primaryKey"`
	Name          string         `json:"name" gorm:"type:varchar(200);not null"`
	Slug          string         `json:"slug" gorm:"type:varchar(100);not null;uniqueIndex"`
	LogoURL       string         `json:"logo_url" gorm:"type:text"`
	Description   string         `json:"description" gorm:"type:text"`
	ContactEmail  string         `json:"contact_email" gorm:"type:varchar(200)"`
	ContactPhone  string         `json:"contact_phone" gorm:"type:varchar(50)"`
	IsActive      bool           `json:"is_active" gorm:"default:true"`
	CreatedAt     time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt     time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt     gorm.DeletedAt `json:"deleted_at" gorm:"index"`

	TenantID uuid.UUID `json:"tenant_id" gorm:"type:char(36);not null;index"`
	Tenant   Tenant    `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;"`
}

func (o *Organization) BeforeCreate(tx *gorm.DB) error {
	if o.ID == uuid.Nil {
		o.ID = uuid.New()
	}
	if o.TenantID == uuid.Nil {
		if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
			o.TenantID = tenant.ID
		} else {
			return fmt.Errorf("tenant_id is required for security isolation")
		}
	}
	return nil
}
