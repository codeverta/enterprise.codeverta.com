package model

import (
	"time"
)

type PricingRule struct {
	ID                       string            `gorm:"primaryKey;size:64" json:"id"`
	TenantID                 string            `gorm:"size:64;not null;index" json:"tenant_id"`
	NamingSeries             string            `gorm:"size:64;default:'PRLE-.####'" json:"naming_series"`
	Title                    string            `gorm:"size:180;not null;index" json:"title"`
	Disable                  bool              `gorm:"default:false;index" json:"disable"`
	ApplyOn                  string            `gorm:"size:64;default:'Item Code'" json:"apply_on"`
	PriceOrProductDiscount   string            `gorm:"size:64;default:'Price'" json:"price_or_product_discount"`
	Warehouse                string            `gorm:"size:180" json:"warehouse"`
	MixedConditions          bool              `gorm:"default:false" json:"mixed_conditions"`
	IsCumulative             bool              `gorm:"default:false" json:"is_cumulative"`
	CouponCodeBased          bool              `gorm:"default:false" json:"coupon_code_based"`
	Selling                  bool              `gorm:"default:true" json:"selling"`
	Buying                   bool              `gorm:"default:false" json:"buying"`
	ApplicableFor            string            `gorm:"size:64;default:'Customer'" json:"applicable_for"`
	Party                    string            `gorm:"size:180" json:"party"`
	MinQty                   float64           `gorm:"type:decimal(18,2);default:0" json:"min_qty"`
	MaxQty                   float64           `gorm:"type:decimal(18,2);default:0" json:"max_qty"`
	MinAmt                   float64           `gorm:"type:decimal(18,2);default:0" json:"min_amt"`
	MaxAmt                   float64           `gorm:"type:decimal(18,2);default:0" json:"max_amt"`
	ValidFrom                *time.Time        `json:"valid_from"`
	ValidUpto                *time.Time        `json:"valid_upto"`
	Company                  string            `gorm:"size:180" json:"company"`
	Currency                 string            `gorm:"size:10;default:'IDR'" json:"currency"`
	MarginType               string            `gorm:"size:32" json:"margin_type"`
	MarginRateOrAmount       float64           `gorm:"type:decimal(18,2);default:0" json:"margin_rate_or_amount"`
	RateOrDiscount           string            `gorm:"size:32;default:'Discount Percentage'" json:"rate_or_discount"`
	Rate                     float64           `gorm:"type:decimal(18,2);default:0" json:"rate"`
	DiscountPercentage       float64           `gorm:"type:decimal(18,2);default:0" json:"discount_percentage"`
	DiscountAmount           float64           `gorm:"type:decimal(18,2);default:0" json:"discount_amount"`
	ForPriceList             string            `gorm:"size:180" json:"for_price_list"`
	Condition                string            `gorm:"type:text" json:"condition"`
	ApplyMultiplePricingRules bool             `gorm:"default:false" json:"apply_multiple_pricing_rules"`
	ThresholdPercentage      float64           `gorm:"type:decimal(18,2);default:0" json:"threshold_percentage"`
	ValidateAppliedRule      bool              `gorm:"default:false" json:"validate_applied_rule"`
	HasPriority              bool              `gorm:"default:false" json:"has_priority"`
	Priority                 int               `gorm:"default:0" json:"priority"`
	Items                    []PricingRuleItem `gorm:"foreignKey:PricingRuleID;constraint:OnDelete:CASCADE" json:"items"`
	CreatedAt                time.Time         `json:"created_at"`
	UpdatedAt                time.Time         `json:"updated_at"`
}

func (PricingRule) TableName() string { return "selling_pricing_rules" }

type PricingRuleItem struct {
	ID            string    `gorm:"primaryKey;size:64" json:"id"`
	PricingRuleID string    `gorm:"size:64;not null;index" json:"pricing_rule_id"`
	ItemCode      string    `gorm:"size:120;index" json:"item_code"`
	ItemGroup     string    `gorm:"size:120;index" json:"item_group"`
	Brand         string    `gorm:"size:120;index" json:"brand"`
	UOM           string    `gorm:"size:32" json:"uom"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

func (PricingRuleItem) TableName() string { return "selling_pricing_rule_items" }
