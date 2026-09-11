package model

import (
	"time"
)

type Subscription struct {
	ID                             string                 `gorm:"primaryKey;size:64" json:"id"`
	TenantID                       string                 `gorm:"size:64;index" json:"tenant_id"`
	SubscriptionNumber             string                 `gorm:"size:64;index" json:"subscription_number"`
	PartyType                      string                 `gorm:"size:40;default:'Customer'" json:"party_type"`
	Party                          string                 `gorm:"size:140;index" json:"party"`
	Company                        string                 `gorm:"size:140" json:"company"`
	StartDate                      string                 `gorm:"size:20" json:"start_date"`
	EndDate                        string                 `gorm:"size:20" json:"end_date"`
	TrialPeriodStart               string                 `gorm:"size:20" json:"trial_period_start"`
	TrialPeriodEnd                 string                 `gorm:"size:20" json:"trial_period_end"`
	FollowCalendarMonths           bool                   `gorm:"default:false" json:"follow_calendar_months"`
	GenerateNewInvoicesPastDueDate bool                   `gorm:"default:false" json:"generate_new_invoices_past_due_date"`
	SubmitInvoice                  bool                   `gorm:"default:false" json:"submit_invoice"`
	DaysUntilDue                   int                    `gorm:"default:0" json:"days_until_due"`
	GenerateInvoiceAt              string                 `gorm:"size:80;default:'End of the current subscription period'" json:"generate_invoice_at"`
	CancelAtPeriodEnd              bool                   `gorm:"default:false" json:"cancel_at_period_end"`
	ApplyAdditionalDiscount        string                 `gorm:"size:40;default:'Grand Total'" json:"apply_additional_discount"`
	AdditionalDiscountPercentage   float64                `gorm:"default:0" json:"additional_discount_percentage"`
	AdditionalDiscountAmount       float64                `gorm:"default:0" json:"additional_discount_amount"`
	CostCenter                     string                 `gorm:"size:140" json:"cost_center"`
	Status                         string                 `gorm:"size:40;default:'Draft'" json:"status"`
	Plans                          []SubscriptionPlanItem `gorm:"foreignKey:SubscriptionID;constraint:OnDelete:CASCADE" json:"plans"`
	CreatedAt                      time.Time              `json:"created_at"`
	UpdatedAt                      time.Time              `json:"updated_at"`
}

func (Subscription) TableName() string {
	return "selling_subscriptions"
}

type SubscriptionPlanItem struct {
	ID             string    `gorm:"primaryKey;size:64" json:"id"`
	TenantID       string    `gorm:"size:64;index" json:"tenant_id"`
	SubscriptionID string    `gorm:"size:64;index;not null" json:"subscription_id"`
	Plan           string    `gorm:"size:140;not null" json:"plan"`
	Quantity       float64   `gorm:"default:1" json:"qty"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

func (SubscriptionPlanItem) TableName() string {
	return "selling_subscription_plans"
}
