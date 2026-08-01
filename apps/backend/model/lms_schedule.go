package model

import (
	"fmt"
	"gin-template/common"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ScheduleResourceType string

const (
	ScheduleResourceCourse ScheduleResourceType = "course"
	ScheduleResourceModule ScheduleResourceType = "module"
	ScheduleResourceLesson ScheduleResourceType = "lesson"
	ScheduleResourceQuiz   ScheduleResourceType = "quiz"
)

type ScheduleTemplate struct {
	ID          uuid.UUID              `json:"id" gorm:"type:char(36);primaryKey"`
	Title       string                 `json:"title" gorm:"type:varchar(180);not null;index"`
	Description string                 `json:"description" gorm:"type:text"`
	CreatedByID uuid.UUID              `json:"created_by" gorm:"type:char(36);not null;index"`
	CreatedBy   User                   `json:"created_by_user,omitempty" gorm:"foreignKey:CreatedByID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;"`
	Items       []ScheduleTemplateItem `json:"items,omitempty" gorm:"foreignKey:ScheduleTemplateID"`
	CreatedAt   time.Time              `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt   time.Time              `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt   gorm.DeletedAt         `json:"deleted_at" gorm:"index"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (m *ScheduleTemplate) BeforeCreate(tx *gorm.DB) error {
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

type ScheduleTemplateItem struct {
	ID                 uuid.UUID            `json:"id" gorm:"type:char(36);primaryKey"`
	ScheduleTemplateID uuid.UUID            `json:"schedule_template_id" gorm:"type:char(36);not null;index"`
	ScheduleTemplate   ScheduleTemplate     `json:"-" gorm:"foreignKey:ScheduleTemplateID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Title              string               `json:"title" gorm:"type:varchar(180);not null;index"`
	Description        string               `json:"description" gorm:"type:text"`
	StartTime          time.Time            `json:"start_time" gorm:"not null;index"`
	EndTime            time.Time            `json:"end_time" gorm:"not null;index"`
	AllDay             bool                 `json:"all_day" gorm:"default:false"`
	Color              string               `json:"color" gorm:"type:varchar(32);default:'#2563eb'"`
	ResourceType       ScheduleResourceType `json:"resource_type" gorm:"type:varchar(24);index"`
	ResourceID         *uuid.UUID           `json:"resource_id" gorm:"type:char(36);index"`
	CreatedAt          time.Time            `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt          time.Time            `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt          gorm.DeletedAt       `json:"deleted_at" gorm:"index"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (m *ScheduleTemplateItem) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	if m.Color == "" {
		m.Color = "#2563eb"
	}
	if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
		m.TenantID = &tenant.ID
	} else {
		return fmt.Errorf("tenant_id is required for security isolation")
	}
	return nil
}

type StudentSchedule struct {
	ID                 uuid.UUID             `json:"id" gorm:"type:char(36);primaryKey"`
	StudentID          uuid.UUID             `json:"student_id" gorm:"type:char(36);not null;index"`
	Student            User                  `json:"student,omitempty" gorm:"foreignKey:StudentID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	ScheduleTemplateID *uuid.UUID            `json:"schedule_template_id" gorm:"type:char(36);index"`
	ScheduleTemplate   *ScheduleTemplate     `json:"schedule_template,omitempty" gorm:"foreignKey:ScheduleTemplateID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
	Title              string                `json:"title" gorm:"type:varchar(180);not null"`
	Items              []StudentScheduleItem `json:"items,omitempty" gorm:"foreignKey:StudentScheduleID"`
	CreatedAt          time.Time             `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt          time.Time             `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt          gorm.DeletedAt        `json:"deleted_at" gorm:"index"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (m *StudentSchedule) BeforeCreate(tx *gorm.DB) error {
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

type StudentScheduleItem struct {
	ID                uuid.UUID            `json:"id" gorm:"type:char(36);primaryKey"`
	StudentScheduleID uuid.UUID            `json:"student_schedule_id" gorm:"type:char(36);not null;index"`
	StudentSchedule   StudentSchedule      `json:"-" gorm:"foreignKey:StudentScheduleID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	StudentID         uuid.UUID            `json:"student_id" gorm:"type:char(36);not null;index"`
	Student           User                 `json:"student,omitempty" gorm:"foreignKey:StudentID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Title             string               `json:"title" gorm:"type:varchar(180);not null;index"`
	Description       string               `json:"description" gorm:"type:text"`
	StartTime         time.Time            `json:"start_time" gorm:"not null;index"`
	EndTime           time.Time            `json:"end_time" gorm:"not null;index"`
	AllDay            bool                 `json:"all_day" gorm:"default:false"`
	Color             string               `json:"color" gorm:"type:varchar(32);default:'#2563eb'"`
	ResourceType      ScheduleResourceType `json:"resource_type" gorm:"type:varchar(24);index"`
	ResourceID        *uuid.UUID           `json:"resource_id" gorm:"type:char(36);index"`
	CreatedAt         time.Time            `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt         time.Time            `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt         gorm.DeletedAt       `json:"deleted_at" gorm:"index"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (m *StudentScheduleItem) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	if m.Color == "" {
		m.Color = "#2563eb"
	}
	if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
		m.TenantID = &tenant.ID
	} else {
		return fmt.Errorf("tenant_id is required for security isolation")
	}
	return nil
}
