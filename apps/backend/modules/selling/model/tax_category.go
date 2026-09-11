package model

import (
	"time"
)

type TaxCategory struct {
	ID        string    `gorm:"primaryKey;size:64" json:"id"`
	TenantID  string    `gorm:"size:64;index" json:"tenant_id"`
	Title     string    `gorm:"size:140;not null" json:"title" binding:"required"`
	Disabled  bool      `gorm:"default:false" json:"disabled"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (TaxCategory) TableName() string {
	return "selling_tax_categories"
}
