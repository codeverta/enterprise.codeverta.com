package model

import "time"

type CustomerGroup struct {
	ID                          string    `gorm:"primaryKey;size:64" json:"id"`
	TenantID                    string    `gorm:"size:64;index" json:"tenant_id"`
	GroupName                   string    `gorm:"size:180;not null;index" json:"group_name" binding:"required"`
	ParentGroup                 string    `gorm:"size:180;index" json:"parent_group"`
	IsGroup                     bool      `json:"is_group"`
	DefaultPriceList            string    `gorm:"size:120" json:"default_price_list"`
	PaymentTerms                string    `gorm:"size:180" json:"payment_terms"`
	DefaultReceivableAccount    string    `gorm:"size:180" json:"default_receivable_account"`
	AdvanceAccount              string    `gorm:"size:180" json:"advance_account"`
	CreditLimit                 float64   `gorm:"default:0" json:"credit_limit"`
	BypassCreditLimitSalesOrder bool      `json:"bypass_credit_limit_sales_order"`
	CreatedAt                   time.Time `json:"created_at"`
	UpdatedAt                   time.Time `json:"updated_at"`
}

func (CustomerGroup) TableName() string { return "selling_customer_groups" }

type Address struct {
	ID                   string    `gorm:"primaryKey;size:64" json:"id"`
	TenantID             string    `gorm:"size:64;index" json:"tenant_id"`
	AddressTitle         string    `gorm:"size:180;not null;index" json:"address_title" binding:"required"`
	AddressType          string    `gorm:"size:40;default:'Billing';index" json:"address_type"`
	AddressLine1         string    `gorm:"size:255;not null" json:"address_line1" binding:"required"`
	AddressLine2         string    `gorm:"size:255" json:"address_line2"`
	City                 string    `gorm:"size:120;not null;index" json:"city" binding:"required"`
	County               string    `gorm:"size:120" json:"county"`
	State                string    `gorm:"size:120" json:"state"`
	Country              string    `gorm:"size:120;default:'Indonesia';index" json:"country"`
	PostalCode           string    `gorm:"size:30" json:"postal_code"`
	Phone                string    `gorm:"size:40" json:"phone"`
	Fax                  string    `gorm:"size:40" json:"fax"`
	Email                string    `gorm:"size:180" json:"email"`
	TaxCategory          string    `gorm:"size:120" json:"tax_category"`
	LinkedDoctype        string    `gorm:"size:40;index" json:"linked_doctype"`
	LinkedName           string    `gorm:"size:180;index" json:"linked_name"`
	IsPrimaryAddress     bool      `json:"is_primary_address"`
	IsShippingAddress    bool      `json:"is_shipping_address"`
	IsYourCompanyAddress bool      `json:"is_your_company_address"`
	Disabled             bool      `gorm:"index" json:"disabled"`
	CreatedAt            time.Time `json:"created_at"`
	UpdatedAt            time.Time `json:"updated_at"`
}

func (Address) TableName() string { return "selling_addresses" }

type Contact struct {
	ID               string    `gorm:"primaryKey;size:64" json:"id"`
	TenantID         string    `gorm:"size:64;index" json:"tenant_id"`
	FirstName        string    `gorm:"size:120;not null;index" json:"first_name" binding:"required"`
	MiddleName       string    `gorm:"size:120" json:"middle_name"`
	LastName         string    `gorm:"size:120;index" json:"last_name"`
	Status           string    `gorm:"size:40;default:'Open';index" json:"status"`
	Designation      string    `gorm:"size:120" json:"designation"`
	CompanyName      string    `gorm:"size:180" json:"company_name"`
	EmailID          string    `gorm:"size:180;index" json:"email_id"`
	AlternateEmailID string    `gorm:"size:180" json:"alternate_email_id"`
	Phone            string    `gorm:"size:40" json:"phone"`
	MobileNo         string    `gorm:"size:40;index" json:"mobile_no"`
	LinkedDoctype    string    `gorm:"size:40;index" json:"linked_doctype"`
	LinkedName       string    `gorm:"size:180;index" json:"linked_name"`
	UserID           string    `gorm:"size:180" json:"user_id"`
	IsPrimaryContact bool      `json:"is_primary_contact"`
	Disabled         bool      `gorm:"index" json:"disabled"`
	Notes            string    `gorm:"type:text" json:"notes"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

func (Contact) TableName() string { return "selling_contacts" }
