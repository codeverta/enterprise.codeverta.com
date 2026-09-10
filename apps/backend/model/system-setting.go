package model

import (
	"fmt"
	"gin-template/common"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

func GetSettingCacheKey(id string) string {
	if common.RDB == nil {
		return fmt.Sprintf("setting:%s", id)
	}
	return common.RDB.GetKey(fmt.Sprintf("setting:%s", id))
}

type SystemSetting struct {
	ID                       uuid.UUID `gorm:"type:char(36);primaryKey"`
	AppName                  string    `json:"app_name"`
	AppTagline               string    `json:"app_tagline"`
	AppLogo                  string    `json:"app_logo"`
	DiscordPaymentWebhook    string    `json:"discord_payment_webhook"`
	DiscordEmailWebhook      string    `json:"discord_email_webhook"`
	DiscordRegisterWebhook   string    `json:"discord_register_webhook"`
	DiscordWithdrawalWebhook string    `json:"discord_withdrawal_webhook"`
	BannerText               string    `json:"banner_text"`
	IsDevMode                bool      `json:"is_dev_mode"`
	IsRegistrationOpen       bool      `json:"is_registration_open"`
	IsMaintenanceMode        bool      `json:"is_maintenance_mode"`
	EventStartTime           time.Time `json:"event_start_time"`
	EmailQuota               int       `json:"email_quota"`
	EmailUsed                int       `json:"email_used"`
	ParticipantQuota         int       `json:"participant_quota"`
	ParticipantUsed          int       `json:"participant_used"`

	TenantID  *uuid.UUID `json:"tenant_id" gorm:"type:char(36);uniqueIndex:idx_tenant_settings"`
	Tenant    Tenant     `gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt gorm.DeletedAt `gorm:"index"`
}

func (p *SystemSetting) BeforeCreate(tx *gorm.DB) (err error) {
	// Pastikan p.ID adalah uuid.Nil (nol/kosong)
	if p.ID == uuid.Nil {
		// Generate UUID baru
		p.ID = uuid.New()
	}
	if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
		p.TenantID = &tenant.ID
	} else {
		// Dalam riset Cybersecurity, ini penting:
		// Jangan biarkan record dibuat tanpa TenantID jika dalam mode multi-tenant
		return fmt.Errorf("tenant_id is required for security isolation")
	}
	return nil
}

func (r *SystemSetting) ToResponse(isUser bool) map[string]interface{} {
	resp := map[string]interface{}{
		"app_name":             r.AppName,
		"app_tagline":          r.AppTagline,
		"app_logo":             r.AppLogo,
		"banner_text":          r.BannerText,
		"is_dev_mode":          r.IsDevMode,
		"is_registration_open": r.IsRegistrationOpen,
		"is_maintenance_mode":  r.IsMaintenanceMode,
		"event_start_time":     r.EventStartTime,
	}

	if isUser {
		// Tambahkan field admin-only
		resp["email_quota"] = r.EmailQuota
		resp["email_used"] = r.EmailUsed
		resp["participant_quota"] = r.ParticipantQuota
		resp["participant_used"] = r.ParticipantUsed
		resp["discord_payment_webhook"] = r.DiscordPaymentWebhook
		resp["discord_email_webhook"] = r.DiscordEmailWebhook
		resp["discord_register_webhook"] = r.DiscordRegisterWebhook
		resp["discord_withdrawal_webhook"] = r.DiscordWithdrawalWebhook
	}

	return resp
}
