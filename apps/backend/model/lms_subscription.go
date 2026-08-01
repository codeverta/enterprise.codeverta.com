package model

import (
	"fmt"
	"gin-template/common"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Subscription struct {
	ID                     uuid.UUID          `json:"id" gorm:"type:char(36);primaryKey"`
	ParentID               uuid.UUID          `json:"parent_id" gorm:"type:char(36);not null;index;index:idx_sub_tenant_parent_status,priority:2"`
	StudentID              uuid.UUID          `json:"student_id" gorm:"type:char(36);not null;index;index:idx_sub_tenant_student_status,priority:2"`
	CourseID               *uuid.UUID         `json:"course_id" gorm:"type:char(36);index"`
	Status                 SubscriptionStatus `json:"status" gorm:"type:varchar(24);not null;default:'active';index;index:idx_sub_tenant_parent_status,priority:3;index:idx_sub_tenant_student_status,priority:3"`
	Provider               string             `json:"provider" gorm:"type:varchar(40);default:'xendit';index"`
	ProviderCustomerID     string             `json:"provider_customer_id" gorm:"type:varchar(120);index"`
	ProviderPlanID         string             `json:"provider_plan_id" gorm:"type:varchar(120);index"`
	PlanID                 *uuid.UUID         `json:"plan_id" gorm:"type:char(36);index"`
	Plan                   *SubscriptionPlan  `json:"plan,omitempty" gorm:"foreignKey:PlanID"`
	ProviderSubscriptionID string             `json:"provider_subscription_id" gorm:"type:varchar(120);uniqueIndex"`
	Amount                 float64            `json:"amount" gorm:"type:decimal(16,2);not null"`
	Currency               string             `json:"currency" gorm:"type:varchar(8);default:'IDR'"`
	Interval               string             `json:"interval" gorm:"type:varchar(20);default:'month'"`
	PendingChangeType      string             `json:"pending_change_type" gorm:"type:varchar(24);index"`
	PendingProviderPlanID  string             `json:"pending_provider_plan_id" gorm:"type:varchar(120);index"`
	PendingAmount          float64            `json:"pending_amount" gorm:"type:decimal(16,2);default:0"`
	PendingCurrency        string             `json:"pending_currency" gorm:"type:varchar(8)"`
	PendingInterval        string             `json:"pending_interval" gorm:"type:varchar(20)"`
	PendingChangeAt        *time.Time         `json:"pending_change_at"`
	CurrentPeriodStart     *time.Time         `json:"current_period_start"`
	CurrentPeriodEnd       *time.Time         `json:"current_period_end" gorm:"index;index:idx_sub_tenant_parent_status,priority:5;index:idx_sub_tenant_student_status,priority:5"`
	CancelAtPeriodEnd      bool               `json:"cancel_at_period_end" gorm:"default:false"`
	CanceledAt             *time.Time         `json:"canceled_at"`
	CreatedAt              time.Time          `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt              time.Time          `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt              gorm.DeletedAt     `json:"deleted_at" gorm:"index;index:idx_sub_tenant_parent_status,priority:4;index:idx_sub_tenant_student_status,priority:4"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index;index:idx_sub_tenant_parent_status,priority:1;index:idx_sub_tenant_student_status,priority:1"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (m *Subscription) BeforeCreate(tx *gorm.DB) error {
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
