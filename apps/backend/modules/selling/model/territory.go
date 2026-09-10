package model

import "time"

type Territory struct {
	ID               string            `gorm:"primaryKey;size:64" json:"id"`
	TenantID         string            `gorm:"size:64;index" json:"tenant_id"`
	TerritoryName    string            `gorm:"size:180;not null;index" json:"territory_name" binding:"required"`
	ParentTerritory  string            `gorm:"size:180;index" json:"parent_territory"`
	IsGroup          bool              `gorm:"default:false" json:"is_group"`
	TerritoryManager string            `gorm:"size:180" json:"territory_manager"`
	Disabled         bool              `gorm:"default:false;index" json:"disabled"`
	Targets          []TerritoryTarget `gorm:"foreignKey:TerritoryID;constraint:OnDelete:CASCADE" json:"targets"`
	CreatedAt        time.Time         `json:"created_at"`
	UpdatedAt        time.Time         `json:"updated_at"`
}

func (Territory) TableName() string { return "selling_territories" }

type TerritoryTarget struct {
	ID                 string    `gorm:"primaryKey;size:64" json:"id"`
	TerritoryID        string    `gorm:"size:64;index;not null" json:"territory_id"`
	TenantID           string    `gorm:"size:64;index" json:"tenant_id"`
	ItemGroup          string    `gorm:"size:120;not null" json:"item_group"`
	FiscalYear         string    `gorm:"size:40;not null" json:"fiscal_year"`
	TargetQty          float64   `gorm:"default:0" json:"target_qty"`
	TargetAmount       float64   `gorm:"default:0" json:"target_amount"`
	TargetDistribution string    `gorm:"size:120" json:"target_distribution"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

func (TerritoryTarget) TableName() string { return "selling_territory_targets" }
