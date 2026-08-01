package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

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
