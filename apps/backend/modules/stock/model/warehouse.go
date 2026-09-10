package model

import (
	"time"
)

type Warehouse struct {
	ID              string     `gorm:"primaryKey;size:64" json:"id"`
	TenantID        string     `gorm:"size:64;not null;index" json:"tenant_id"`
	WarehouseName   string     `gorm:"size:180;not null;index" json:"warehouse_name"`
	IsGroup         bool       `gorm:"default:false;index" json:"is_group"`
	ParentWarehouse string     `gorm:"size:180;index" json:"parent_warehouse"`
	Company         string     `gorm:"size:180;not null;index" json:"company"`
	WarehouseType   string     `gorm:"size:80" json:"warehouse_type"`
	Account         string     `gorm:"size:180" json:"account"`
	AddressLine1    string     `gorm:"type:text" json:"address_line_1"`
	City            string     `gorm:"size:100" json:"city"`
	PhoneNo         string     `gorm:"size:50" json:"phone_no"`
	Disabled        bool       `gorm:"default:false;index" json:"disabled"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

func (Warehouse) TableName() string {
	return "stock_warehouses"
}
