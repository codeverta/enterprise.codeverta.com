package model

import (
	"fmt"
	"gin-template/common"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ResolveActiveCompanyName resolves a company default from the current user's
// preference without relying on an installation-specific company name.
func ResolveActiveCompanyName(db *gorm.DB, rawUserID interface{}) string {
	var userID uuid.UUID
	switch value := rawUserID.(type) {
	case uuid.UUID:
		userID = value
	case string:
		userID, _ = uuid.Parse(value)
	}
	if userID != uuid.Nil {
		var preference UserAppPreference
		if db.Where("user_id = ?", userID).First(&preference).Error == nil && preference.ActiveCompanyID != nil {
			var preferred Company
			if db.Where("id = ? AND is_active = ?", *preference.ActiveCompanyID, true).First(&preferred).Error == nil {
				return preferred.Name
			}
		}
	}
	var first Company
	if db.Where("is_active = ?", true).Order("name asc").First(&first).Error == nil {
		return first.Name
	}
	return ""
}

type Organization struct {
	ID           uuid.UUID      `json:"id" gorm:"type:char(36);primaryKey"`
	Name         string         `json:"name" gorm:"type:varchar(200);not null"`
	Slug         string         `json:"slug" gorm:"type:varchar(100);not null;uniqueIndex"`
	LogoURL      string         `json:"logo_url" gorm:"type:text"`
	Description  string         `json:"description" gorm:"type:text"`
	ContactEmail string         `json:"contact_email" gorm:"type:varchar(200)"`
	ContactPhone string         `json:"contact_phone" gorm:"type:varchar(50)"`
	IsActive     bool           `json:"is_active" gorm:"default:true"`
	CreatedAt    time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt    time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt    gorm.DeletedAt `json:"deleted_at" gorm:"index"`

	TenantID uuid.UUID `json:"tenant_id" gorm:"type:char(36);not null;index"`
	Tenant   Tenant    `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;"`
}

func (o *Organization) BeforeCreate(tx *gorm.DB) error {
	if o.ID == uuid.Nil {
		o.ID = uuid.New()
	}
	if o.TenantID == uuid.Nil {
		if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
			o.TenantID = tenant.ID
		} else {
			return fmt.Errorf("tenant_id is required for security isolation")
		}
	}
	return nil
}

// Company represents an enterprise corporate entity (Multi-Company)
type Company struct {
	ID              uuid.UUID      `json:"id" gorm:"type:char(36);primaryKey"`
	Name            string         `json:"name" gorm:"type:varchar(200);not null"`
	Abbreviation    string         `json:"abbreviation" gorm:"type:varchar(50);not null"`
	TaxID           string         `json:"tax_id" gorm:"type:varchar(100)"` // NPWP / Tax Registration
	Domain          string         `json:"domain" gorm:"type:varchar(200)"`
	Email           string         `json:"email" gorm:"type:varchar(200)"`
	Phone           string         `json:"phone" gorm:"type:varchar(50)"`
	Address         string         `json:"address" gorm:"type:text"`
	Currency        string         `json:"currency" gorm:"type:varchar(10);default:'IDR'"`
	IsGroup         bool           `json:"is_group" gorm:"default:false"`
	ParentCompanyID *uuid.UUID     `json:"parent_company_id" gorm:"type:char(36)"`
	IsActive        bool           `json:"is_active" gorm:"default:true"`
	CreatedAt       time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt       time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt       gorm.DeletedAt `json:"deleted_at" gorm:"index"`

	TenantID uuid.UUID `json:"tenant_id" gorm:"type:char(36);not null;index"`
	Tenant   Tenant    `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;"`
}

func (c *Company) BeforeCreate(tx *gorm.DB) error {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	if c.TenantID == uuid.Nil {
		if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
			c.TenantID = tenant.ID
		}
	}
	return nil
}

// Branch represents an operational office location / branch of a company (Multi-Branch)
type Branch struct {
	ID         uuid.UUID      `json:"id" gorm:"type:char(36);primaryKey"`
	CompanyID  uuid.UUID      `json:"company_id" gorm:"type:char(36);not null;index"`
	Company    *Company       `json:"company,omitempty" gorm:"foreignKey:CompanyID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;"`
	Name       string         `json:"name" gorm:"type:varchar(200);not null"`
	BranchCode string         `json:"branch_code" gorm:"type:varchar(50)"`
	Address    string         `json:"address" gorm:"type:text"`
	Phone      string         `json:"phone" gorm:"type:varchar(50)"`
	Email      string         `json:"email" gorm:"type:varchar(200)"`
	IsActive   bool           `json:"is_active" gorm:"default:true"`
	CreatedAt  time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt  time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt  gorm.DeletedAt `json:"deleted_at" gorm:"index"`

	TenantID uuid.UUID `json:"tenant_id" gorm:"type:char(36);not null;index"`
	Tenant   Tenant    `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;"`
}

func (b *Branch) BeforeCreate(tx *gorm.DB) error {
	if b.ID == uuid.Nil {
		b.ID = uuid.New()
	}
	if b.TenantID == uuid.Nil {
		if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
			b.TenantID = tenant.ID
		}
	}
	return nil
}

// Department represents a department unit within a company/branch (Multi-Department with Parent-Child Tree)
type Department struct {
	ID                 uuid.UUID      `json:"id" gorm:"type:char(36);primaryKey"`
	CompanyID          *uuid.UUID     `json:"company_id" gorm:"type:char(36);index"`
	Company            *Company       `json:"company,omitempty" gorm:"foreignKey:CompanyID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
	BranchID           *uuid.UUID     `json:"branch_id" gorm:"type:char(36);index"`
	Branch             *Branch        `json:"branch,omitempty" gorm:"foreignKey:BranchID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
	Name               string         `json:"name" gorm:"type:varchar(200);not null"`
	DepartmentCode     string         `json:"department_code" gorm:"type:varchar(50)"`
	ParentDepartmentID *uuid.UUID     `json:"parent_department_id" gorm:"type:char(36);index"`
	ParentDepartment   *Department    `json:"parent_department,omitempty" gorm:"foreignKey:ParentDepartmentID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
	IsGroup            bool           `json:"is_group" gorm:"default:false"`
	IsActive           bool           `json:"is_active" gorm:"default:true"`
	CreatedAt          time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt          time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt          gorm.DeletedAt `json:"deleted_at" gorm:"index"`

	TenantID uuid.UUID `json:"tenant_id" gorm:"type:char(36);not null;index"`
	Tenant   Tenant    `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;"`
}

func (d *Department) BeforeCreate(tx *gorm.DB) error {
	if d.ID == uuid.Nil {
		d.ID = uuid.New()
	}
	if d.TenantID == uuid.Nil {
		if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
			d.TenantID = tenant.ID
		}
	}
	return nil
}

// LetterHead represents official corporate headers and footers for PDF documents
type LetterHead struct {
	ID         uuid.UUID      `json:"id" gorm:"type:char(36);primaryKey"`
	CompanyID  *uuid.UUID     `json:"company_id" gorm:"type:char(36);index"`
	Company    *Company       `json:"company,omitempty" gorm:"foreignKey:CompanyID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
	Name       string         `json:"name" gorm:"type:varchar(200);not null"`
	HeaderHTML string         `json:"header_html" gorm:"type:text"`
	FooterHTML string         `json:"footer_html" gorm:"type:text"`
	LogoURL    string         `json:"logo_url" gorm:"type:text"`
	IsDefault  bool           `json:"is_default" gorm:"default:false"`
	IsActive   bool           `json:"is_active" gorm:"default:true"`
	CreatedAt  time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt  time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt  gorm.DeletedAt `json:"deleted_at" gorm:"index"`

	TenantID uuid.UUID `json:"tenant_id" gorm:"type:char(36);not null;index"`
	Tenant   Tenant    `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;"`
}

func (lh *LetterHead) BeforeCreate(tx *gorm.DB) error {
	if lh.ID == uuid.Nil {
		lh.ID = uuid.New()
	}
	if lh.TenantID == uuid.Nil {
		if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
			lh.TenantID = tenant.ID
		}
	}
	return nil
}
