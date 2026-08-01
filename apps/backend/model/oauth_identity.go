package model

import (
	"fmt"
	"gin-template/common"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// OAuthIdentity links a verified identity-provider subject to one local user.
// Password and provider tokens are intentionally never stored here.
type OAuthIdentity struct {
	ID              uuid.UUID  `json:"id" gorm:"type:char(36);primaryKey"`
	UserID          uuid.UUID  `json:"user_id" gorm:"type:char(36);not null;index"`
	Provider        string     `json:"provider" gorm:"type:varchar(30);not null;uniqueIndex:idx_oauth_provider_subject"`
	ProviderSubject string     `json:"provider_subject" gorm:"type:varchar(255);not null;uniqueIndex:idx_oauth_provider_subject"`
	Email           string     `json:"email" gorm:"type:varchar(255);index"`
	CreatedAt       time.Time  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt       time.Time  `json:"updated_at" gorm:"autoUpdateTime"`
	TenantID        *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
}

func (m *OAuthIdentity) BeforeCreate(tx *gorm.DB) error {
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
