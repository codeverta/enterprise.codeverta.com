package model

import (
	"time"
)

type Brand struct {
	ID          string    `gorm:"primaryKey;size:64" json:"id"`
	TenantID    string    `gorm:"size:64;not null;index" json:"tenant_id"`
	BrandName   string    `gorm:"size:140;not null;index" json:"brand_name"`
	Description string    `gorm:"type:text" json:"description"`
	Enabled     bool      `gorm:"default:true;index" json:"enabled"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (Brand) TableName() string {
	return "stock_brands"
}
