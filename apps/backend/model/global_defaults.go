package model

import (
	"gin-template/common"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// GlobalDefaults stores system-wide default settings per tenant.
type GlobalDefaults struct {
	ID                                   uuid.UUID      `json:"id" gorm:"type:char(36);primaryKey"`
	TenantID                             *uuid.UUID     `json:"tenant_id" gorm:"type:char(36);uniqueIndex:idx_tenant_global_defaults"`
	Tenant                               Tenant         `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
	DefaultCompany                       string         `json:"default_company" gorm:"type:varchar(200)"`
	Country                              string         `json:"country" gorm:"type:varchar(100);default:'Indonesia'"`
	DefaultDistanceUnit                  string         `json:"default_distance_unit" gorm:"type:varchar(50);default:'Kilometer'"`
	DefaultCurrency                      string         `json:"default_currency" gorm:"type:varchar(10);default:'IDR'"`
	HideCurrencySymbol                   string         `json:"hide_currency_symbol" gorm:"type:varchar(10);default:'No'"`
	DisableRoundedTotal                  bool           `json:"disable_rounded_total" gorm:"default:false"`
	DisableInWords                       bool           `json:"disable_in_words" gorm:"default:false"`
	UsePostingDatetimeForNamingDocuments bool           `json:"use_posting_datetime_for_naming_documents" gorm:"default:false"`
	CreatedAt                            time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt                            time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt                            gorm.DeletedAt `json:"deleted_at" gorm:"index"`
}

func (g *GlobalDefaults) TableName() string {
	return "global_defaults"
}

func (g *GlobalDefaults) BeforeCreate(tx *gorm.DB) error {
	if g.ID == uuid.Nil {
		g.ID = uuid.New()
	}
	if g.TenantID == nil || *g.TenantID == uuid.Nil {
		if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
			g.TenantID = &tenant.ID
		}
	}
	return nil
}
