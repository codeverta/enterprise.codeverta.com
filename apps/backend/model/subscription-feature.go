package model

import (
	"fmt"
	"gin-template/common"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Contoh feature_key: "access_all_courses", "download_material", "certificate", "max_courses"
type SubscriptionFeature struct {
	ID           uuid.UUID `json:"id" gorm:"type:char(36);primaryKey"`
	PlanID       uuid.UUID `json:"plan_id" gorm:"type:char(36);not null;index"`
	FeatureKey   string    `json:"feature_key" gorm:"type:varchar(100);not null"`
	FeatureValue string    `json:"feature_value" gorm:"type:varchar(255)"` // "true", "unlimited", "10"
	Description  string    `json:"description" gorm:"type:text"`

	Plan     *SubscriptionPlan `json:"plan,omitempty" gorm:"foreignKey:PlanID"`
	TenantID *uuid.UUID        `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   *Tenant           `json:"tenant,omitempty" gorm:"foreignKey:TenantID"`
}

func (f *SubscriptionFeature) BeforeCreate(tx *gorm.DB) error {
	if f.ID == uuid.Nil {
		f.ID = uuid.New()
	}
	if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
		f.TenantID = &tenant.ID
	} else {
		return fmt.Errorf("tenant_id is required")
	}
	return nil
}
