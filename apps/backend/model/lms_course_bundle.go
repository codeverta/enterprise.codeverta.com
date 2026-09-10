package model

import (
	"fmt"
	"gin-template/common"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type CourseBundle struct {
	ID                          uuid.UUID          `json:"id" gorm:"type:char(36);primaryKey"`
	Name                        string             `json:"name" gorm:"type:varchar(160);not null;index"`
	Slug                        string             `json:"slug" gorm:"type:varchar(180);not null;uniqueIndex"`
	Description                 string             `json:"description" gorm:"type:text"`
	AgeRange                    string             `json:"age_range" gorm:"type:varchar(80)"`
	GradeRange                  string             `json:"grade_range" gorm:"type:varchar(80)"`
	Pillar                      string             `json:"pillar" gorm:"type:varchar(120);index"`
	IsActive                    bool               `json:"is_active" gorm:"default:true;index"`
	RequireSequentialCompletion bool               `json:"require_sequential_completion" gorm:"default:false"`
	CourseCount                 int                `json:"course_count" gorm:"default:0"`
	Items                       []CourseBundleItem `json:"items,omitempty" gorm:"foreignKey:BundleID"`
	CreatedAt                   time.Time          `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt                   time.Time          `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt                   gorm.DeletedAt     `json:"deleted_at" gorm:"index"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (m *CourseBundle) BeforeCreate(tx *gorm.DB) error {
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

type CourseBundleItem struct {
	ID        uuid.UUID      `json:"id" gorm:"type:char(36);primaryKey"`
	BundleID  uuid.UUID      `json:"bundle_id" gorm:"type:char(36);not null;index:idx_bundle_course,unique"`
	Bundle    CourseBundle   `json:"-" gorm:"foreignKey:BundleID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	CourseID  uuid.UUID      `json:"course_id" gorm:"type:char(36);not null;index:idx_bundle_course,unique"`
	Course    Course         `json:"course,omitempty" gorm:"foreignKey:CourseID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	SortOrder int            `json:"sort_order" gorm:"default:0;index"`
	CreatedAt time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt gorm.DeletedAt `json:"deleted_at" gorm:"index"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (m *CourseBundleItem) BeforeCreate(tx *gorm.DB) error {
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

func (m *CourseBundleItem) AfterSave(tx *gorm.DB) error {
	if m.BundleID != uuid.Nil {
		var count int64
		tx.Model(&CourseBundleItem{}).Where("bundle_id = ? AND deleted_at IS NULL", m.BundleID).Count(&count)
		return tx.Model(&CourseBundle{}).Where("id = ?", m.BundleID).Update("course_count", count).Error
	}
	return nil
}

func (m *CourseBundleItem) AfterDelete(tx *gorm.DB) error {
	if m.BundleID != uuid.Nil {
		var count int64
		tx.Model(&CourseBundleItem{}).Where("bundle_id = ? AND deleted_at IS NULL", m.BundleID).Count(&count)
		return tx.Model(&CourseBundle{}).Where("id = ?", m.BundleID).Update("course_count", count).Error
	}
	return nil
}
