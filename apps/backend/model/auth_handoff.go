package model

import (
	"fmt"
	"gin-template/common"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// AuthHandoff stores only a hash of a short-lived, one-time login code. It is
// used to transfer an authenticated session from the landing site to the app
// without putting access or refresh JWTs in the URL.
type AuthHandoff struct {
	ID        uuid.UUID  `json:"id" gorm:"type:char(36);primaryKey"`
	UserID    uuid.UUID  `json:"user_id" gorm:"type:char(36);not null;index"`
	TokenHash string     `json:"-" gorm:"type:char(64);not null;uniqueIndex"`
	ExpiresAt time.Time  `json:"expires_at" gorm:"not null;index"`
	UsedAt    *time.Time `json:"used_at"`
	CreatedAt time.Time  `json:"created_at" gorm:"autoCreateTime"`
	TenantID  *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
}

func (m *AuthHandoff) BeforeCreate(tx *gorm.DB) error {
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
