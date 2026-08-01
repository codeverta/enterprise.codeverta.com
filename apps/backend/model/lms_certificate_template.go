package model

import (
	"fmt"
	"gin-template/common"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// CertificateTemplate stores per-course certificate configuration.
type CertificateTemplate struct {
	ID       uuid.UUID `json:"id" gorm:"type:char(36);primaryKey"`
	CourseID uuid.UUID `json:"course_id" gorm:"type:char(36);not null;uniqueIndex:idx_cert_tpl_course"`
	Course   Course    `json:"course,omitempty" gorm:"foreignKey:CourseID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`

	// Whether the certificate feature is enabled for this course
	IsEnabled bool `json:"is_enabled" gorm:"default:false"`

	// Template image URL (uploaded JPG/PNG)
	TemplateURL string `json:"template_url" gorm:"type:text"`

	// Name text positioning (percentage of image dimensions, 0-100)
	NameX float64 `json:"name_x" gorm:"type:decimal(6,2);default:50"`
	NameY float64 `json:"name_y" gorm:"type:decimal(6,2);default:40"`

	// Name text style
	NameFontSize int    `json:"name_font_size" gorm:"default:48"`
	NameColor    string `json:"name_color" gorm:"type:varchar(20);default:'#0F172A'"` // hex color

	// Optional: additional text fields
	CourseTitleX float64 `json:"course_title_x" gorm:"type:decimal(6,2);default:50"`
	CourseTitleY float64 `json:"course_title_y" gorm:"type:decimal(6,2);default:55"`
	DateX        float64 `json:"date_x" gorm:"type:decimal(6,2);default:50"`
	DateY        float64 `json:"date_y" gorm:"type:decimal(6,2);default:70"`

	CreatedAt time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt gorm.DeletedAt `json:"deleted_at" gorm:"index"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (m *CertificateTemplate) BeforeCreate(tx *gorm.DB) error {
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

// StudentCertificate records when a student earns a certificate.
type StudentCertificate struct {
	ID             uuid.UUID `json:"id" gorm:"type:char(36);primaryKey"`
	StudentID      uuid.UUID `json:"student_id" gorm:"type:char(36);not null;index:idx_stud_cert_pair,unique"`
	Student        User      `json:"student,omitempty" gorm:"foreignKey:StudentID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	CourseID       uuid.UUID `json:"course_id" gorm:"type:char(36);not null;index:idx_stud_cert_pair,unique"`
	Course         Course    `json:"course,omitempty" gorm:"foreignKey:CourseID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	CertificateURL string    `json:"certificate_url" gorm:"type:text"` // generated certificate image URL
	IssuedAt       time.Time `json:"issued_at" gorm:"autoCreateTime"`

	CreatedAt time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt gorm.DeletedAt `json:"deleted_at" gorm:"index"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (m *StudentCertificate) BeforeCreate(tx *gorm.DB) error {
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
