package crm

import (
	"time"

	"github.com/google/uuid"
)

type Campaign struct {
	Base
	Name      string     `json:"name" gorm:"type:varchar(150);not null;index" binding:"required,max=150"`
	Type      string     `json:"type" gorm:"type:varchar(50);index" binding:"omitempty,oneof=email event social_ads other"`
	StartDate *time.Time `json:"start_date" gorm:"type:date;index"`
	EndDate   *time.Time `json:"end_date" gorm:"type:date;index"`
	Budget    float64    `json:"budget" gorm:"type:decimal(18,2);not null;default:0" binding:"min=0"`
	Status    string     `json:"status" gorm:"type:varchar(20);not null;default:'planned';index" binding:"omitempty,oneof=planned active paused completed cancelled"`
	CreatedBy uuid.UUID  `json:"created_by" gorm:"type:char(36);not null;index"`
}

func (Campaign) TableName() string { return "crm_campaigns" }

type CampaignMember struct {
	Base
	CampaignID uuid.UUID  `json:"campaign_id" gorm:"type:char(36);not null;index" binding:"required"`
	LeadID     *uuid.UUID `json:"lead_id" gorm:"type:char(36);index"`
	ContactID  *uuid.UUID `json:"contact_id" gorm:"type:char(36);index"`
	Status     string     `json:"status" gorm:"type:varchar(30);not null;default:'sent';index" binding:"omitempty,oneof=sent opened clicked converted bounced unsubscribed"`
}

func (CampaignMember) TableName() string { return "crm_campaign_members" }
