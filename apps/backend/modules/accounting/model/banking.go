package model

import (
	"time"

	"gorm.io/datatypes"
)

type Bank struct {
	ID                     string         `gorm:"primaryKey;size:64" json:"id"`
	TenantID               string         `gorm:"size:64;not null;index" json:"tenant_id"`
	BankName               string         `gorm:"size:180;not null;index" json:"bank_name" binding:"required"`
	SWIFTNumber            string         `gorm:"column:swift_number;size:40" json:"swift_number"`
	Website                string         `gorm:"size:255" json:"website"`
	BankTransactionMapping datatypes.JSON `gorm:"type:json" json:"bank_transaction_mapping"`
	CreatedAt              time.Time      `json:"created_at"`
	UpdatedAt              time.Time      `json:"updated_at"`
}

func (Bank) TableName() string { return "accounting_banks" }

type BankAccountType struct {
	ID        string    `gorm:"primaryKey;size:64" json:"id"`
	TenantID  string    `gorm:"size:64;not null;index;uniqueIndex:idx_bank_account_type_tenant_name" json:"tenant_id"`
	Name      string    `gorm:"size:120;not null;uniqueIndex:idx_bank_account_type_tenant_name" json:"name" binding:"required"`
	Disabled  bool      `gorm:"default:false;index" json:"disabled"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (BankAccountType) TableName() string { return "accounting_bank_account_types" }

type BankAccount struct {
	ID                  string     `gorm:"primaryKey;size:64" json:"id"`
	TenantID            string     `gorm:"size:64;not null;index" json:"tenant_id"`
	AccountName         string     `gorm:"size:180;not null;index" json:"account_name" binding:"required"`
	BankID              string     `gorm:"size:64;index" json:"bank"`
	AccountTypeID       string     `gorm:"size:64;index" json:"account_type"`
	AccountSubtype      string     `gorm:"size:120" json:"account_subtype"`
	Disabled            bool       `gorm:"default:false;index" json:"disabled"`
	IsDefault           bool       `gorm:"default:false" json:"is_default"`
	IsCompanyAccount    bool       `gorm:"default:false" json:"is_company_account"`
	PartyType           string     `gorm:"size:80" json:"party_type"`
	Party               string     `gorm:"size:180" json:"party"`
	IBAN                string     `gorm:"size:80" json:"iban"`
	BranchCode          string     `gorm:"size:80" json:"branch_code"`
	BankAccountNo       string     `gorm:"size:100" json:"bank_account_no"`
	LastIntegrationDate *time.Time `json:"last_integration_date"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`
}

func (BankAccount) TableName() string { return "accounting_bank_accounts" }
