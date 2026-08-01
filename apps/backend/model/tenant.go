package model

import (
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

const (
	DefaultTenantIDString = "7c3f1a5e-9b2e-4f6a-8d1e-2a4c6b8f9e21"
	DefaultTenantName     = "Codeverta ERP"
	DefaultTenantDomain   = "erp.codeverta.com"
)

var DefaultTenantID = uuid.MustParse(DefaultTenantIDString)

// 1. Context Key (Unexported agar aman dari collision)
type contextKey string

const TenantIDKey contextKey = "tenantID"

// 3. Model Tenant (Sesuaikan dengan tabel tenants Anda)
type Tenant struct {
	ID        uuid.UUID      `json:"id" gorm:"type:char(36);primaryKey"`
	Name      string         `json:"name" gorm:"uniqueIndex;type:varchar(100)"`
	Domain    string         `json:"domain" gorm:"uniqueIndex;type:varchar(100)"`
	IsActive  bool           `json:"is_active" gorm:"default:true"`
	Balance   float64        `json:"balance" gorm:"type:decimal(16,2);default:0"`
	CreatedAt *time.Time     `json:"created_at"`
	UpdatedAt *time.Time     `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"deleted_at" gorm:"index"`
}

// EnsureDefaultTenant makes an extracted ERP installation immediately usable
// as a single-tenant application without mutating existing user ownership.
func EnsureDefaultTenant(db *gorm.DB) error {
	tenant := Tenant{ID: DefaultTenantID}
	err := db.Set("skip_tenant_scope", true).First(&tenant, "id = ?", DefaultTenantID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		now := time.Now()
		tenant = Tenant{
			ID:        DefaultTenantID,
			Name:      DefaultTenantName,
			Domain:    DefaultTenantDomain,
			IsActive:  true,
			CreatedAt: &now,
			UpdatedAt: &now,
		}
		if err := db.Set("skip_tenant_scope", true).Create(&tenant).Error; err != nil {
			return err
		}
	} else if err != nil {
		return err
	}

	return nil
}
