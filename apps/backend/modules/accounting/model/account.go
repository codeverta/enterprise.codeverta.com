package model

import "time"

type Account struct {
	ID              string    `gorm:"primaryKey;size:64" json:"id"`
	TenantID        string    `gorm:"size:64;not null;index;uniqueIndex:idx_account_tenant_company_number" json:"tenant_id"`
	CompanyID       string    `gorm:"size:64;not null;index;uniqueIndex:idx_account_tenant_company_number" json:"company_id"`
	ParentAccountID *string   `gorm:"size:64;index" json:"parent_account_id"`
	AccountName     string    `gorm:"size:220;not null;index" json:"account_name" binding:"required"`
	AccountNumber   string    `gorm:"size:40;not null;index;uniqueIndex:idx_account_tenant_company_number" json:"account_number" binding:"required"`
	IsGroup         bool      `gorm:"default:false;index" json:"is_group"`
	AccountType     string    `gorm:"size:80;index" json:"account_type"`
	AccountCategory string    `gorm:"size:120;index" json:"account_category"`
	AccountCurrency string    `gorm:"size:10;not null;default:'IDR'" json:"account_currency"`
	Balance         float64   `gorm:"type:decimal(20,2);not null;default:0" json:"balance"`
	Disabled        bool      `gorm:"default:false;index" json:"disabled"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

func (Account) TableName() string { return "accounting_accounts" }
