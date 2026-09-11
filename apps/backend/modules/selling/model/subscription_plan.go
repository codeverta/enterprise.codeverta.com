package model

import (
	"time"
)

type SubscriptionPlanMaster struct {
	ID                   string    `gorm:"primaryKey;size:64" json:"id"`
	TenantID             string    `gorm:"size:64;index" json:"tenant_id"`
	PlanName             string    `gorm:"size:140;not null;index" json:"plan_name"`
	Currency             string    `gorm:"size:20;default:'IDR'" json:"currency"`
	Item                 string    `gorm:"size:140" json:"item"`
	PriceDetermination   string    `gorm:"size:60;default:'Fixed Rate'" json:"price_determination"`
	Cost                 float64   `gorm:"default:0" json:"cost"`
	PriceList            string    `gorm:"size:140" json:"price_list"`
	BillingInterval      string    `gorm:"size:40;default:'Month'" json:"billing_interval"`
	BillingIntervalCount int       `gorm:"default:1" json:"billing_interval_count"`
	ProductPriceID       string    `gorm:"size:140" json:"product_price_id"`
	PaymentGateway       string    `gorm:"size:140" json:"payment_gateway"`
	CostCenter           string    `gorm:"size:140" json:"cost_center"`
	Disabled             bool      `gorm:"default:false" json:"disabled"`
	Status               string    `gorm:"size:40;default:'Active'" json:"status"`
	CreatedAt            time.Time `json:"created_at"`
	UpdatedAt            time.Time `json:"updated_at"`
}

func (SubscriptionPlanMaster) TableName() string {
	return "selling_subscription_plan_masters"
}
