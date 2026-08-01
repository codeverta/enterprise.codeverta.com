package model

import (
	"fmt"
	"gin-template/common"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AssignmentStatus string

const (
	AssignmentStatusSubmitted AssignmentStatus = "submitted"
	AssignmentStatusGraded    AssignmentStatus = "graded"
	AssignmentStatusReturned  AssignmentStatus = "returned"
)

type Assignment struct {
	ID        uuid.UUID        `json:"id" gorm:"type:char(36);primaryKey"`
	LessonID  uuid.UUID        `json:"lesson_id" gorm:"type:char(36);not null;index"`
	Lesson    Lesson           `json:"-" gorm:"foreignKey:LessonID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	StudentID uuid.UUID        `json:"student_id" gorm:"type:char(36);not null;index;idx_assignment_lesson_student,unique"`
	Student   User             `json:"student" gorm:"foreignKey:StudentID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	FileURL   string           `json:"file_url" gorm:"type:text;not null"`
	FileName  string           `json:"file_name" gorm:"type:varchar(255);not null"`
	Note      string           `json:"note" gorm:"type:text"`
	Status    AssignmentStatus `json:"status" gorm:"type:varchar(24);default:'submitted';index"`
	Score     *float64         `json:"score" gorm:"type:decimal(5,2)"`
	MaxScore  float64          `json:"max_score" gorm:"type:decimal(5,2);default:100"`
	Feedback  string           `json:"feedback" gorm:"type:text"`
	GradedAt  *time.Time       `json:"graded_at"`
	GradedBy  *uuid.UUID       `json:"graded_by" gorm:"type:char(36)"`
	CreatedAt time.Time        `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt time.Time        `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt gorm.DeletedAt   `json:"deleted_at" gorm:"index"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (m *Assignment) BeforeCreate(tx *gorm.DB) error {
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
