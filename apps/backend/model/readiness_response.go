package model

import (
	"fmt"
	"gin-template/common"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

const (
	ReadinessTestParent  = "parent"
	ReadinessTestStudent = "student"
)

type ReadinessResponse struct {
	ID              uuid.UUID      `json:"id" gorm:"type:char(36);primaryKey"`
	SessionID       *string        `json:"session_id,omitempty" gorm:"type:char(36);uniqueIndex:uidx_readiness_tenant_session,priority:2"`
	TestType        string         `json:"test_type" gorm:"type:varchar(24);not null;index"`
	RespondentType  string         `json:"respondent_type" gorm:"type:varchar(32);index"`
	RespondentName  string         `json:"respondent_name" gorm:"type:varchar(160);index"`
	RespondentEmail string         `json:"respondent_email" gorm:"type:varchar(190);index"`
	Language        string         `json:"language" gorm:"type:varchar(8);default:'id'"`
	Score           int            `json:"score" gorm:"default:0;index"`
	ResultLabel     string         `json:"result_label" gorm:"type:varchar(190);index"`
	Profile         datatypes.JSON `json:"profile" gorm:"type:json"`
	Answers         datatypes.JSON `json:"answers" gorm:"type:json"`
	Result          datatypes.JSON `json:"result" gorm:"type:json"`
	Status          string         `json:"status" gorm:"type:varchar(20);not null;default:'completed';index"`
	CurrentQuestion int            `json:"current_question" gorm:"default:0"`
	CompletedAt     *time.Time     `json:"completed_at,omitempty" gorm:"index"`
	CreatedAt       time.Time      `json:"created_at" gorm:"autoCreateTime;index"`
	UpdatedAt       time.Time      `json:"updated_at" gorm:"autoUpdateTime"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index;uniqueIndex:uidx_readiness_tenant_session,priority:1"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (m *ReadinessResponse) BeforeCreate(tx *gorm.DB) error {
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
