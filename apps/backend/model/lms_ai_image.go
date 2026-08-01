package model

import (
	"fmt"
	"gin-template/common"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AIImageGenerationStatus string

const (
	AIImageGenerationReserved       AIImageGenerationStatus = "reserved"
	AIImageGenerationGenerated      AIImageGenerationStatus = "generated"
	AIImageGenerationApproved       AIImageGenerationStatus = "approved"
	AIImageGenerationRejected       AIImageGenerationStatus = "rejected"
	AIImageGenerationProviderFailed AIImageGenerationStatus = "provider_failed"
	AIImageGenerationStorageFailed  AIImageGenerationStatus = "storage_failed"
)

// AIImageGeneration is a durable usage/audit record. Rejected images are
// deliberately retained so quota and generation history cannot be bypassed.
type AIImageGeneration struct {
	ID                   uuid.UUID               `json:"id" gorm:"type:char(36);primaryKey"`
	UserID               uuid.UUID               `json:"user_id" gorm:"type:char(36);not null;index:idx_ai_image_user_created,priority:1"`
	Prompt               string                  `json:"prompt" gorm:"type:varchar(700);not null"`
	Style                string                  `json:"style" gorm:"type:varchar(100)"`
	IncludeText          bool                    `json:"include_text" gorm:"not null;default:false"`
	QuotaDate            string                  `json:"-" gorm:"type:char(10);not null;index"`
	Status               AIImageGenerationStatus `json:"status" gorm:"type:varchar(24);not null;index"`
	ReplacesGenerationID *uuid.UUID              `json:"-" gorm:"type:char(36);index"`
	ProcessingStartedAt  *time.Time              `json:"-" gorm:"index"`
	LeaseExpiresAt       *time.Time              `json:"-" gorm:"index"`
	AttemptCount         int                     `json:"-" gorm:"not null;default:0"`
	ObjectKey            string                  `json:"-" gorm:"type:text"`
	ImageURL             string                  `json:"image_url,omitempty" gorm:"type:text"`
	ProviderRequestID    string                  `json:"-" gorm:"type:varchar(120)"`
	ErrorCode            string                  `json:"-" gorm:"type:varchar(80)"`
	CreatedAt            time.Time               `json:"created_at" gorm:"autoCreateTime;index:idx_ai_image_user_created,priority:2"`
	UpdatedAt            time.Time               `json:"updated_at" gorm:"autoUpdateTime"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);not null;index"`
}

func (m *AIImageGeneration) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	if m.TenantID != nil {
		return nil
	}
	if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
		m.TenantID = &tenant.ID
		return nil
	}
	return fmt.Errorf("tenant_id is required for security isolation")
}

type AIImageDailyQuota struct {
	ID        uuid.UUID `json:"id" gorm:"type:char(36);primaryKey"`
	UserID    uuid.UUID `json:"user_id" gorm:"type:char(36);not null;uniqueIndex:idx_ai_image_quota_day,priority:2"`
	QuotaDate string    `json:"quota_date" gorm:"type:char(10);not null;uniqueIndex:idx_ai_image_quota_day,priority:3"`
	Used      int       `json:"used" gorm:"not null;default:0"`
	CreatedAt time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt time.Time `json:"updated_at" gorm:"autoUpdateTime"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);not null;uniqueIndex:idx_ai_image_quota_day,priority:1;index"`
}

func (m *AIImageDailyQuota) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	if m.TenantID != nil {
		return nil
	}
	if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
		m.TenantID = &tenant.ID
		return nil
	}
	return fmt.Errorf("tenant_id is required for security isolation")
}
