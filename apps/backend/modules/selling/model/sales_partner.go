package model

import "time"

type SalesPartnerType struct {
	ID              string    `gorm:"primaryKey;size:64" json:"id"`
	TenantID        string    `gorm:"size:64;index" json:"tenant_id"`
	PartnerTypeName string    `gorm:"size:120;not null;index" json:"partner_type_name" binding:"required"`
	Description     string    `gorm:"size:255" json:"description"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

func (SalesPartnerType) TableName() string { return "selling_sales_partner_types" }

type ItemGroup struct {
	ID              string    `gorm:"primaryKey;size:64" json:"id"`
	TenantID        string    `gorm:"size:64;index" json:"tenant_id"`
	ItemGroupName   string    `gorm:"size:120;not null;index" json:"item_group_name" binding:"required"`
	ParentItemGroup string    `gorm:"size:120;index" json:"parent_item_group"`
	IsGroup         bool      `gorm:"default:false" json:"is_group"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

func (ItemGroup) TableName() string { return "selling_item_groups" }

type FiscalYear struct {
	ID        string    `gorm:"primaryKey;size:64" json:"id"`
	TenantID  string    `gorm:"size:64;index" json:"tenant_id"`
	YearName  string    `gorm:"size:60;not null;index" json:"year_name" binding:"required"`
	StartDate string    `gorm:"size:20" json:"start_date"`
	EndDate   string    `gorm:"size:20" json:"end_date"`
	Disabled  bool      `gorm:"default:false" json:"disabled"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (FiscalYear) TableName() string { return "selling_fiscal_years" }

type SalesPartner struct {
	ID             string               `gorm:"primaryKey;size:64" json:"id"`
	TenantID       string               `gorm:"size:64;index" json:"tenant_id"`
	PartnerName    string               `gorm:"size:180;not null;index" json:"partner_name" binding:"required"`
	PartnerType    string               `gorm:"size:120;not null;index" json:"partner_type" binding:"required"`
	Territory      string               `gorm:"size:180;index" json:"territory"`
	CommissionRate float64              `gorm:"default:0" json:"commission_rate"`
	ShowInWebsite  bool                 `gorm:"default:false" json:"show_in_website"`
	ReferralCode   string               `gorm:"size:120" json:"referral_code"`
	Disabled       bool                 `gorm:"default:false;index" json:"disabled"`
	Targets        []SalesPartnerTarget `gorm:"foreignKey:SalesPartnerID;constraint:OnDelete:CASCADE" json:"targets"`
	CreatedAt      time.Time            `json:"created_at"`
	UpdatedAt      time.Time            `json:"updated_at"`
}

func (SalesPartner) TableName() string { return "selling_sales_partners" }

type SalesPartnerTarget struct {
	ID             string    `gorm:"primaryKey;size:64" json:"id"`
	SalesPartnerID string    `gorm:"size:64;index;not null" json:"sales_partner_id"`
	TenantID       string    `gorm:"size:64;index" json:"tenant_id"`
	ItemGroup      string    `gorm:"size:120;not null" json:"item_group"`
	FiscalYear     string    `gorm:"size:60;not null" json:"fiscal_year"`
	TargetQty      float64   `gorm:"default:0" json:"target_qty"`
	TargetAmount   float64   `gorm:"default:0" json:"target_amount"`
	DistributionID string    `gorm:"size:120" json:"distribution_id"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

func (SalesPartnerTarget) TableName() string { return "selling_sales_partner_targets" }
