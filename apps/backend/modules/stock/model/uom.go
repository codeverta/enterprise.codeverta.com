package model

import (
	"time"
)

type UOM struct {
	ID                string    `gorm:"primaryKey;size:64" json:"id"`
	TenantID          string    `gorm:"size:64;not null;index" json:"tenant_id"`
	UOMName           string    `gorm:"size:120;not null;index" json:"uom_name"`
	Symbol            string    `gorm:"size:32" json:"symbol"`
	CommonCode        string    `gorm:"size:32" json:"common_code"`
	Description       string    `gorm:"type:text" json:"description"`
	Enabled           bool      `gorm:"default:true;index" json:"enabled"`
	MustBeWholeNumber bool      `gorm:"default:false" json:"must_be_whole_number"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

func (UOM) TableName() string {
	return "stock_uoms"
}
