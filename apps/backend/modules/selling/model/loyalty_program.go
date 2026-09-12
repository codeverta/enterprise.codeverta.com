package model

import (
	"time"
)

type LoyaltyProgram struct {
	ID                 string           `gorm:"primaryKey;size:64" json:"id"`
	TenantID           string           `gorm:"size:64;index" json:"tenant_id"`
	LoyaltyProgramName string           `gorm:"size:255;not null" json:"loyalty_program_name"`
	LoyaltyProgramType string           `gorm:"size:64;default:'Single Tier Program'" json:"loyalty_program_type"`
	FromDate           *time.Time       `json:"from_date,omitempty"`
	ToDate             *time.Time       `json:"to_date,omitempty"`
	CustomerGroup      string           `gorm:"size:255" json:"customer_group"`
	CustomerTerritory  string           `gorm:"size:255" json:"customer_territory"`
	AutoOptIn          bool             `gorm:"default:true" json:"auto_opt_in"`
	CollectionRules    []CollectionRule `gorm:"foreignKey:LoyaltyProgramID;constraint:OnDelete:CASCADE" json:"collection_rules"`
	ConversionFactor   float64          `gorm:"default:1" json:"conversion_factor"`
	ExpiryDuration     int              `gorm:"default:365" json:"expiry_duration"`
	ExpenseAccount     string           `gorm:"size:255" json:"expense_account"`
	Company            string           `gorm:"size:255" json:"company"`
	CostCenter         string           `gorm:"size:255" json:"cost_center"`
	Project            string           `gorm:"size:255" json:"project"`
	CreatedAt          time.Time        `json:"created_at"`
	UpdatedAt          time.Time        `json:"updated_at"`
}

type CollectionRule struct {
	ID               string  `gorm:"primaryKey;size:64" json:"id"`
	LoyaltyProgramID string  `gorm:"size:64;index" json:"loyalty_program_id"`
	TierName         string  `gorm:"size:255;not null" json:"tier_name"`
	MinSpent         float64 `gorm:"default:0" json:"min_spent"`
	CollectionFactor float64 `gorm:"default:10" json:"collection_factor"`
}

type LoyaltyPointEntry struct {
	ID             string     `gorm:"primaryKey;size:64" json:"id"`
	TenantID       string     `gorm:"size:64;index" json:"tenant_id"`
	LoyaltyProgram string     `gorm:"size:255" json:"loyalty_program"`
	Customer       string     `gorm:"size:255" json:"customer"`
	SalesInvoice   string     `gorm:"size:255" json:"sales_invoice"`
	ReferenceType  string     `gorm:"size:32;default:'Sales Invoice'" json:"reference_type"`
	LoyaltyPoints  float64    `gorm:"default:0" json:"loyalty_points"`
	PurchaseAmount float64    `gorm:"default:0" json:"purchase_amount"`
	ExpiryDate     *time.Time `json:"expiry_date,omitempty"`
	PostingDate    time.Time  `json:"posting_date"`
	Type           string     `gorm:"size:32;default:'Earned'" json:"type"`
	CreatedAt      time.Time  `json:"created_at"`
}
