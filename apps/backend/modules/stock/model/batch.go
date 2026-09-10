package model

import (
	"time"
)

type Batch struct {
	ID                string     `gorm:"primaryKey;size:64" json:"id"`
	TenantID          string     `gorm:"size:64;not null;index" json:"tenant_id"`
	BatchID           string     `gorm:"size:140;not null;index" json:"batch_id"`
	ItemCode          string     `gorm:"size:120;not null;index" json:"item_code"`
	ItemName          string     `gorm:"size:180" json:"item_name"`
	BatchQty          float64    `gorm:"type:decimal(18,2);default:0" json:"batch_qty"`
	ManufacturingDate *time.Time `json:"manufacturing_date"`
	ExpiryDate        *time.Time `gorm:"index" json:"expiry_date"`
	ShelfLifeInDays   int        `gorm:"default:0" json:"shelf_life_in_days"`
	ReferenceDoctype  string     `gorm:"size:80" json:"reference_doctype"`
	ReferenceName     string     `gorm:"size:120" json:"reference_name"`
	Supplier          string     `gorm:"size:180" json:"supplier"`
	Disabled          bool       `gorm:"default:false;index" json:"disabled"`
	Description       string     `gorm:"type:text" json:"description"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

func (Batch) TableName() string {
	return "stock_batches"
}
