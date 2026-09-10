package model

import (
	"time"
)

type StockEntryType struct {
	ID          string    `gorm:"primaryKey;size:64" json:"id"`
	TenantID    string    `gorm:"size:64;not null;index" json:"tenant_id"`
	Name        string    `gorm:"size:140;not null;index" json:"name"`
	Purpose     string    `gorm:"size:80;not null;index" json:"purpose"`
	IsStandard  bool      `gorm:"default:false" json:"is_standard"`
	Disabled    bool      `gorm:"default:false;index" json:"disabled"`
	Description string    `gorm:"type:text" json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (StockEntryType) TableName() string {
	return "stock_entry_types"
}
