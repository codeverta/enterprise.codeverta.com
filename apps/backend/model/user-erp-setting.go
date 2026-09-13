package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// ModuleProfile groups modules that are hidden for assigned desk users.
type ModuleProfile struct {
	ID             uuid.UUID      `json:"id" gorm:"type:char(36);primaryKey"`
	TenantID       uuid.UUID      `json:"tenant_id" gorm:"type:char(36);not null;index:idx_module_profile_name,unique"`
	Name           string         `json:"name" gorm:"size:120;not null;index:idx_module_profile_name,unique"`
	Description    string         `json:"description" gorm:"type:text"`
	BlockedModules datatypes.JSON `json:"blocked_modules" gorm:"type:json"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
}

// UserERPSetting stores desk preferences without coupling them to login data.
type UserERPSetting struct {
	UserID          uuid.UUID      `json:"user_id" gorm:"type:char(36);primaryKey"`
	TenantID        uuid.UUID      `json:"tenant_id" gorm:"type:char(36);not null;index"`
	ModuleProfileID *uuid.UUID     `json:"module_profile_id" gorm:"type:char(36);index"`
	Settings        datatypes.JSON `json:"settings" gorm:"type:json"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
}
