package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// LoginAttempt is deliberately independent from AuditLog: failed authentication
// often has no trusted user or tenant yet, but still needs durable security history.
type LoginAttempt struct {
	ID                  uuid.UUID  `json:"id" gorm:"type:char(36);primaryKey"`
	UserID              *uuid.UUID `json:"user_id" gorm:"type:char(36);index"`
	TenantID            *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	AttemptedIdentifier string     `json:"attempted_identifier" gorm:"type:varchar(255);index"`
	AuthMethod          string     `json:"auth_method" gorm:"type:varchar(40);index"`
	Success             bool       `json:"success" gorm:"index"`
	HTTPStatus          int        `json:"http_status"`
	FailureReason       string     `json:"failure_reason" gorm:"type:varchar(255)"`
	IPAddress           string     `json:"ip_address" gorm:"type:varchar(64);index"`
	UserAgent           string     `json:"user_agent" gorm:"type:text"`
	CreatedAt           time.Time  `json:"created_at" gorm:"index"`
}

func (attempt *LoginAttempt) BeforeCreate(_ *gorm.DB) error {
	if attempt.ID == uuid.Nil {
		attempt.ID = uuid.New()
	}
	return nil
}
