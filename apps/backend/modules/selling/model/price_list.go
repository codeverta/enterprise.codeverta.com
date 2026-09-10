package model

import (
	"time"
)

type PriceList struct {
	ID            string    `gorm:"primaryKey;size:64" json:"id"`
	TenantID      string    `gorm:"size:64;not null;index" json:"tenant_id"`
	PriceListName string    `gorm:"size:180;not null;index" json:"price_list_name"`
	Currency      string    `gorm:"size:10;not null;default:'IDR'" json:"currency"`
	Buying        bool      `gorm:"default:false" json:"buying"`
	Selling       bool      `gorm:"default:true" json:"selling"`
	Enabled       bool      `gorm:"default:true;index" json:"enabled"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

func (PriceList) TableName() string { return "selling_price_lists" }

type ItemPrice struct {
	ID            string     `gorm:"primaryKey;size:64" json:"id"`
	TenantID      string     `gorm:"size:64;not null;index" json:"tenant_id"`
	ItemCode      string     `gorm:"size:120;not null;index" json:"item_code"`
	ItemName      string     `gorm:"size:180;not null" json:"item_name"`
	PriceList     string     `gorm:"size:180;not null;index" json:"price_list"`
	PriceListRate float64    `gorm:"type:decimal(18,2);not null;default:0" json:"price_list_rate"`
	Currency      string     `gorm:"size:10;not null;default:'IDR'" json:"currency"`
	UOM           string     `gorm:"size:32" json:"uom"`
	PackingUnit   float64    `gorm:"type:decimal(18,2);default:1" json:"packing_unit"`
	BatchNo       string     `gorm:"size:120" json:"batch_no"`
	Buying        bool       `gorm:"default:false" json:"buying"`
	Selling       bool       `gorm:"default:true" json:"selling"`
	LeadTimeDays  int        `gorm:"default:0" json:"lead_time_days"`
	ValidFrom     *time.Time `json:"valid_from"`
	ValidUpto     *time.Time `json:"valid_upto"`
	Note          string     `gorm:"type:text" json:"note"`
	Reference     string     `gorm:"size:255" json:"reference"`
	IsActive      bool       `gorm:"default:true;index" json:"is_active"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

func (ItemPrice) TableName() string { return "selling_item_prices" }
