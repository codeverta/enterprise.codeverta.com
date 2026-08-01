package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type PasswordResetToken struct {
	ID          uuid.UUID  `json:"id" gorm:"type:char(36);primaryKey"`
	UserID      uuid.UUID  `json:"user_id" gorm:"type:char(36);not null;index"`
	TenantID    *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	TokenHash   string     `json:"-" gorm:"type:char(64);not null;uniqueIndex"`
	ExpiresAt   time.Time  `json:"expires_at" gorm:"not null;index"`
	UsedAt      *time.Time `json:"used_at" gorm:"index"`
	RequestedIP string     `json:"requested_ip" gorm:"type:varchar(64)"`
	CreatedAt   time.Time  `json:"created_at" gorm:"autoCreateTime"`
}

func (token *PasswordResetToken) BeforeCreate(_ *gorm.DB) error {
	if token.ID == uuid.Nil {
		token.ID = uuid.New()
	}
	return nil
}
