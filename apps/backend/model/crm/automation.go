package crm

import (
	"time"

	"gorm.io/datatypes"
)

type LeadAutomationConfig struct {
	Base
	AssignmentMethod string         `json:"assignment_method" gorm:"type:varchar(30);not null;default:'round_robin'" binding:"omitempty,oneof=round_robin territory product manual"`
	SalesRepIDs      datatypes.JSON `json:"sales_rep_ids" gorm:"type:json"`
	TerritoryRules   datatypes.JSON `json:"territory_rules" gorm:"type:json"`
	ProductRules     datatypes.JSON `json:"product_rules" gorm:"type:json"`
	ScoringRules     datatypes.JSON `json:"scoring_rules" gorm:"type:json"`
	LastAssigned     int            `json:"-" gorm:"not null;default:-1"`
	CaptureEnabled   bool           `json:"capture_enabled" gorm:"not null;default:true"`
}

func (LeadAutomationConfig) TableName() string { return "crm_lead_automation_configs" }

type Integration struct {
	Base
	Provider        string         `json:"provider" gorm:"type:varchar(30);not null;index" binding:"required,oneof=google_analytics meta_ads tiktok_ads meta_messaging"`
	Enabled         bool           `json:"enabled" gorm:"not null;default:false;index"`
	Config          datatypes.JSON `json:"config" gorm:"type:json"`
	SecretEncrypted string         `json:"-" gorm:"type:text"`
	LastSyncAt      *time.Time     `json:"last_sync_at"`
	LastError       string         `json:"last_error" gorm:"type:text"`
}

func (Integration) TableName() string { return "crm_integrations" }
