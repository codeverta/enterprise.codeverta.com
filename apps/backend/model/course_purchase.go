package model

import (
	"fmt"
	"gin-template/common"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type CoursePurchaseStatus string

const (
	PurchasePending  CoursePurchaseStatus = "pending"
	PurchasePaid     CoursePurchaseStatus = "paid"
	PurchaseFailed   CoursePurchaseStatus = "failed"
	PurchaseRefunded CoursePurchaseStatus = "refunded"
)

type CoursePurchase struct {
	ID        uuid.UUID            `json:"id" gorm:"type:char(36);primaryKey"`
	CourseID  uuid.UUID            `json:"course_id" gorm:"type:char(36);not null;index"`
	Course    Course               `json:"course,omitempty" gorm:"foreignKey:CourseID"`
	StudentID uuid.UUID            `json:"student_id" gorm:"type:char(36);not null;index"`
	Student   User                 `json:"student,omitempty" gorm:"foreignKey:StudentID"`
	Amount    float64              `json:"amount" gorm:"type:decimal(16,2);not null"`
	Status    CoursePurchaseStatus `json:"status" gorm:"type:varchar(20);default:'pending';index"`
	PaidAt    *time.Time           `json:"paid_at"`
	ExpiresAt *time.Time           `json:"expires_at"`
	CreatedAt time.Time            `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt time.Time            `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt gorm.DeletedAt       `json:"deleted_at" gorm:"index"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (m *CoursePurchase) BeforeCreate(tx *gorm.DB) error {
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
