package crm

import (
	"time"

	"github.com/google/uuid"
)

type Lead struct {
	Base
	Name                   string     `json:"name" gorm:"type:varchar(150);not null;index" binding:"required,max=150"`
	ExternalID             string     `json:"external_id" gorm:"type:varchar(128);index" binding:"max=128"`
	Email                  string     `json:"email" gorm:"type:varchar(150);index" binding:"omitempty,email,max=150"`
	Phone                  string     `json:"phone" gorm:"type:varchar(30);index" binding:"max=30"`
	CompanyName            string     `json:"company_name" gorm:"type:varchar(150);index" binding:"max=150"`
	Source                 string     `json:"source" gorm:"type:varchar(50);index" binding:"max=50"`
	SourceDetail           string     `json:"source_detail" gorm:"type:varchar(150);index" binding:"max=150"`
	Region                 string     `json:"region" gorm:"type:varchar(100);index" binding:"max=100"`
	ProductInterest        string     `json:"product_interest" gorm:"type:varchar(150);index" binding:"max=150"`
	UTMSource              string     `json:"utm_source" gorm:"type:varchar(100);index" binding:"max=100"`
	UTMMedium              string     `json:"utm_medium" gorm:"type:varchar(100);index" binding:"max=100"`
	UTMCampaign            string     `json:"utm_campaign" gorm:"type:varchar(150);index" binding:"max=150"`
	GCLID                  string     `json:"gclid" gorm:"type:varchar(255);index" binding:"max=255"`
	FBCLID                 string     `json:"fbclid" gorm:"type:varchar(255);index" binding:"max=255"`
	TTCLID                 string     `json:"ttclid" gorm:"type:varchar(255);index" binding:"max=255"`
	AnalyticsClientID      string     `json:"analytics_client_id" gorm:"type:varchar(128);index" binding:"max=128"`
	Status                 string     `json:"status" gorm:"type:varchar(30);not null;default:'new';index" binding:"omitempty,oneof=new contacted qualified unqualified converted"`
	Score                  int        `json:"score" gorm:"not null;default:0" binding:"min=0"`
	AssignedTo             *uuid.UUID `json:"assigned_to" gorm:"type:char(36);index"`
	ConvertedAccountID     *uuid.UUID `json:"converted_account_id" gorm:"type:char(36);index"`
	ConvertedContactID     *uuid.UUID `json:"converted_contact_id" gorm:"type:char(36);index"`
	ConvertedOpportunityID *uuid.UUID `json:"converted_opportunity_id" gorm:"type:char(36);index"`
	Notes                  string     `json:"notes" gorm:"type:text"`
	ConvertedAt            *time.Time `json:"converted_at"`
}

func (Lead) TableName() string { return "crm_leads" }

type Account struct {
	Base
	Name            string     `json:"name" gorm:"type:varchar(150);not null;index" binding:"required,max=150"`
	Industry        string     `json:"industry" gorm:"type:varchar(100);index" binding:"max=100"`
	CompanySize     string     `json:"company_size" gorm:"type:varchar(30);index" binding:"omitempty,oneof=micro small medium large enterprise"`
	Region          string     `json:"region" gorm:"type:varchar(100);index" binding:"max=100"`
	Website         string     `json:"website" gorm:"type:varchar(255)" binding:"omitempty,url,max=255"`
	Phone           string     `json:"phone" gorm:"type:varchar(30);index" binding:"max=30"`
	Address         string     `json:"address" gorm:"type:text"`
	ParentAccountID *uuid.UUID `json:"parent_account_id" gorm:"type:char(36);index"`
	OwnerID         *uuid.UUID `json:"owner_id" gorm:"type:char(36);index"`
	Status          string     `json:"status" gorm:"type:varchar(30);not null;default:'prospect';index" binding:"omitempty,oneof=prospect customer churned"`
}

func (Account) TableName() string { return "crm_accounts" }

type Contact struct {
	Base
	AccountID *uuid.UUID `json:"account_id" gorm:"type:char(36);index"`
	FirstName string     `json:"first_name" gorm:"type:varchar(100);not null;index" binding:"required,max=100"`
	LastName  string     `json:"last_name" gorm:"type:varchar(100);index" binding:"max=100"`
	Email     string     `json:"email" gorm:"type:varchar(150);index" binding:"omitempty,email,max=150"`
	Phone     string     `json:"phone" gorm:"type:varchar(30);index" binding:"max=30"`
	Position  string     `json:"position" gorm:"type:varchar(100)" binding:"max=100"`
	OwnerID   *uuid.UUID `json:"owner_id" gorm:"type:char(36);index"`
}

func (Contact) TableName() string { return "crm_contacts" }

type PipelineStage struct {
	Base
	Name               string  `json:"name" gorm:"type:varchar(50);not null;index" binding:"required,max=50"`
	StageType          string  `json:"stage_type" gorm:"type:varchar(20);not null;default:'open';index" binding:"omitempty,oneof=open won lost"`
	SortOrder          int     `json:"sort_order" gorm:"not null;index" binding:"min=0"`
	DefaultProbability float64 `json:"default_probability" gorm:"type:decimal(5,2);not null;default:0" binding:"min=0,max=100"`
}

func (PipelineStage) TableName() string { return "crm_pipeline_stages" }

type Opportunity struct {
	Base
	Name              string     `json:"name" gorm:"type:varchar(150);not null;index" binding:"required,max=150"`
	AccountID         *uuid.UUID `json:"account_id" gorm:"type:char(36);index"`
	ContactID         *uuid.UUID `json:"contact_id" gorm:"type:char(36);index"`
	StageID           *uuid.UUID `json:"stage_id" gorm:"type:char(36);index"`
	Amount            float64    `json:"amount" gorm:"type:decimal(18,2);not null;default:0" binding:"min=0"`
	Probability       float64    `json:"probability" gorm:"type:decimal(5,2);not null;default:0" binding:"min=0,max=100"`
	ExpectedCloseDate *time.Time `json:"expected_close_date" gorm:"type:date;index"`
	OwnerID           *uuid.UUID `json:"owner_id" gorm:"type:char(36);index"`
	Source            string     `json:"source" gorm:"type:varchar(50);index" binding:"max=50"`
	Status            string     `json:"status" gorm:"type:varchar(20);not null;default:'open';index" binding:"omitempty,oneof=open won lost"`
	LostReason        string     `json:"lost_reason" gorm:"type:varchar(255)" binding:"max=255"`
	ClosedAt          *time.Time `json:"closed_at"`
}

func (Opportunity) TableName() string { return "crm_opportunities" }
