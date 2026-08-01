package model

import (
	"errors"
	"fmt"
	"gin-template/common"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

const ImpersonationSessionDuration = 8 * time.Hour

type ImpersonationSession struct {
	ID               uuid.UUID  `json:"id" gorm:"type:char(36);primaryKey"`
	ImpersonatorID   uuid.UUID  `json:"impersonator_id" gorm:"type:char(36);not null;index"`
	ImpersonatorRole int        `json:"impersonator_role" gorm:"not null"`
	TargetUserID     uuid.UUID  `json:"target_user_id" gorm:"type:char(36);not null;index"`
	TargetRole       int        `json:"target_role" gorm:"not null"`
	Reason           string     `json:"reason" gorm:"type:varchar(500);not null"`
	ExpiresAt        time.Time  `json:"expires_at" gorm:"not null;index"`
	RevokedAt        *time.Time `json:"revoked_at" gorm:"index"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
}

func (session *ImpersonationSession) BeforeCreate(tx *gorm.DB) error {
	if session.ID == uuid.Nil {
		session.ID = uuid.New()
	}
	if session.ExpiresAt.IsZero() {
		session.ExpiresAt = time.Now().UTC().Add(ImpersonationSessionDuration)
	}
	if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
		session.TenantID = &tenant.ID
	} else {
		return fmt.Errorf("tenant_id is required for security isolation")
	}
	return nil
}

func ValidateActiveImpersonationSession(db *gorm.DB, sessionID, targetUserID uuid.UUID) (*ImpersonationSession, *User, error) {
	var session ImpersonationSession
	if err := db.Where(
		"id = ? AND target_user_id = ? AND revoked_at IS NULL AND expires_at > ?",
		sessionID,
		targetUserID,
		time.Now().UTC(),
	).First(&session).Error; err != nil {
		return nil, nil, err
	}

	var actor User
	if err := db.Select("id", "role", "status").First(&actor, "id = ?", session.ImpersonatorID).Error; err != nil {
		return nil, nil, err
	}
	if actor.Status != common.UserStatusEnabled || actor.Role < RoleAdmin || actor.Role <= session.TargetRole {
		return nil, nil, errors.New("impersonation authorization is no longer valid")
	}
	return &session, &actor, nil
}
