package model

import (
	"fmt"
	"gin-template/common"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Lesson struct {
	ID                     uuid.UUID      `json:"id" gorm:"type:char(36);primaryKey"`
	ModuleID               uuid.UUID      `json:"module_id" gorm:"type:char(36);not null;index"`
	Module                 Module         `json:"-" gorm:"foreignKey:ModuleID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Title                  string         `json:"title" gorm:"type:varchar(180);not null"`
	Summary                string         `json:"summary" gorm:"type:text"`
	DurationSec            int            `json:"duration_sec" gorm:"default:0"`
	SortOrder              int            `json:"sort_order" gorm:"default:0;index"`
	IsPreview              bool           `json:"is_preview" gorm:"default:false;index"`
	IsPublished            bool           `json:"is_published" gorm:"default:false;index"`
	RequireAttachment      bool           `json:"require_attachment" gorm:"default:false"`
	AttachmentPassingScore float64        `json:"attachment_passing_score" gorm:"type:decimal(5,2);default:0"`
	CreatedAt              time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt              time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt              gorm.DeletedAt `json:"deleted_at" gorm:"index"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (m *Lesson) BeforeCreate(tx *gorm.DB) error {
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
