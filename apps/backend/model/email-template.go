package model

import (
	"fmt"
	"gin-template/common"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Definisi Enum untuk Type
type TemplateType string

const (
	TypePaymentLink      TemplateType = "PAYMENT_LINK"
	TypePaymentSuccess   TemplateType = "PAYMENT_SUCCESS"
	TypeRacepackReminder TemplateType = "RACEPACK_REMINDER"
	TypeEmailRejection   TemplateType = "EMAIL_REJECTION_TEMPLATE"
	TypeActivation       TemplateType = "ACTIVATION"
	TypePasswordReset    TemplateType = "PASSWORD_RESET"
)

type EmailTemplate struct {
	ID                uuid.UUID `json:"id" gorm:"type:char(36);primaryKey"`
	TencentTemplateID uint64    `json:"tencent_template_id"`
	// Status: PENDING, APPROVED, REJECTED (String di DB lokal)
	TemplateStatus string `json:"template_status" gorm:"default:'PENDING'"`

	// FIELD BARU: Tipe Template
	Type TemplateType `json:"type" gorm:"type:varchar(50);not null"`

	FromAddress string `json:"from_address" gorm:"size:100;null"`
	Name        string `gorm:"size:100;not null;unique" json:"name"`
	Subject     string `gorm:"size:255;not null" json:"subject"`
	Body        string `gorm:"type:text" json:"body"`

	LogoPath string `json:"logo_path" gorm:"size:255;null"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   *Tenant    `json:"tenant,omitempty" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

// TableName overrides default table name (optional)
func (EmailTemplate) TableName() string {
	return "email_templates"
}

func (et *EmailTemplate) BeforeCreate(tx *gorm.DB) (err error) {
	if et.ID == uuid.Nil {
		et.ID = uuid.New()
	}
	// Pastikan et.ID adalah uuid.Nil (nol/kosong)
	if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
		et.TenantID = &tenant.ID
	} else {
		// Dalam riset Cybersecurity, ini penting:
		// Jangan biarkan record dibuat tanpa TenantID jika dalam mode multi-tenant
		return fmt.Errorf("tenant_id is required for security isolation")
	}
	return nil
}
