package model

import "time"

type Customer struct {
	ID               string    `gorm:"primaryKey;size:64" json:"id"`
	TenantID         string    `gorm:"size:64;index" json:"tenant_id"`
	CustomerName     string    `gorm:"size:180;not null;index" json:"customer_name" binding:"required"`
	CustomerType     string    `gorm:"size:32;default:'Company'" json:"customer_type"`
	CustomerGroup    string    `gorm:"size:120;index" json:"customer_group"`
	Territory        string    `gorm:"size:120;index" json:"territory"`
	TaxID            string    `gorm:"size:100" json:"tax_id"`
	Email            string    `gorm:"size:180" json:"email"`
	Phone            string    `gorm:"size:40" json:"phone"`
	MobileNo         string    `gorm:"size:40" json:"mobile_no"`
	Website          string    `gorm:"size:255" json:"website"`
	Address          string    `gorm:"type:text" json:"address"`
	DefaultCurrency  string    `gorm:"size:8;default:'IDR'" json:"default_currency"`
	DefaultPriceList string    `gorm:"size:120;default:'Standard Selling'" json:"default_price_list"`
	PaymentTerms     string    `gorm:"size:120" json:"payment_terms"`
	CreditLimit      float64   `gorm:"default:0" json:"credit_limit"`
	Notes            string    `gorm:"type:text" json:"notes"`
	Disabled         bool      `gorm:"index" json:"disabled"`
	IsDefaultForPOS  bool      `gorm:"default:false;index" json:"is_default_for_pos"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

func (Customer) TableName() string { return "selling_customers" }
