package model

import (
	"fmt"
	"gin-template/common"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

const DefaultRoundingMethod = "Banker's Rounding"

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

	// 1. Details
	Country                     string `json:"country" gorm:"type:varchar(100);default:'Indonesia'"`
	Language                    string `json:"language" gorm:"type:varchar(50);default:'English'"`
	TimeZone                    string `json:"time_zone" gorm:"type:varchar(100);default:'Asia/Jakarta'"`
	Currency                    string `json:"currency" gorm:"type:varchar(10);default:'IDR'"`
	EnableOnboarding            bool   `json:"enable_onboarding" gorm:"default:true"`
	DisableDocumentSharing      bool   `json:"disable_document_sharing" gorm:"default:false"`
	DateFormat                  string `json:"date_format" gorm:"type:varchar(30);default:'yyyy-mm-dd'"`
	TimeFormat                  string `json:"time_format" gorm:"type:varchar(30);default:'HH:mm:ss'"`
	NumberFormat                string `json:"number_format" gorm:"type:varchar(50);default:'#,###.##'"`
	UseNumberFormatFromCurrency bool   `json:"use_number_format_from_currency" gorm:"default:false"`
	FirstDayOfTheWeek           string `json:"first_day_of_the_week" gorm:"type:varchar(20);default:'Sunday'"`
	FloatPrecision              int    `json:"float_precision" gorm:"default:2"`
	CurrencyPrecision           int    `json:"currency_precision" gorm:"default:2"`
	// The default is applied in BeforeCreate and the additive migration below.
	// Keeping the apostrophe out of the GORM DDL tag avoids invalid MariaDB
	// ALTER TABLE statements when this column is added to an existing database.
	RoundingMethod                 string `json:"rounding_method" gorm:"type:varchar(50)"`
	ShowAbsoluteDatetimeInTimeline bool   `json:"show_absolute_datetime_in_timeline" gorm:"default:false"`
	ApplyStrictUserPermissions     bool   `json:"apply_strict_user_permissions" gorm:"default:false"`
	ShowExternalLinkWarning        string `json:"show_external_link_warning" gorm:"type:varchar(20);default:'Ask'"`

	// 2. Login
	SessionExpiry                 string `json:"session_expiry" gorm:"type:varchar(20);default:'170:00'"`
	DocumentShareKeyExpiry        int    `json:"document_share_key_expiry" gorm:"default:30"`
	DenyMultipleSessions          bool   `json:"deny_multiple_sessions" gorm:"default:false"`
	DisableUserPassLogin          bool   `json:"disable_user_pass_login" gorm:"default:false"`
	MaxSignupsAllowedPerHour      int    `json:"max_signups_allowed_per_hour" gorm:"default:300"`
	AllowLoginUsingMobileNumber   bool   `json:"allow_login_using_mobile_number" gorm:"default:true"`
	AllowLoginUsingUserName       bool   `json:"allow_login_using_user_name" gorm:"default:true"`
	LoginWithEmailLink            bool   `json:"login_with_email_link" gorm:"default:false"`
	LoginWithEmailLinkExpiry      int    `json:"login_with_email_link_expiry" gorm:"default:10"`
	RateLimitEmailLinkLogin       int    `json:"rate_limit_email_link_login" gorm:"default:0"`
	AllowConsecutiveLoginAttempts int    `json:"allow_consecutive_login_attempts" gorm:"default:10"`
	AllowLoginAfterFail           int    `json:"allow_login_after_fail" gorm:"default:60"`
	EnableTwoFactorAuth           bool   `json:"enable_two_factor_auth" gorm:"default:false"`

	// 3. Password
	LogoutOnPasswordReset           bool   `json:"logout_on_password_reset" gorm:"default:true"`
	ForceUserToResetPassword        int    `json:"force_user_to_reset_password" gorm:"default:0"`
	ResetPasswordLinkExpiryDuration string `json:"reset_password_link_expiry_duration" gorm:"type:varchar(20);default:'20m'"`
	PasswordResetLimit              int    `json:"password_reset_limit" gorm:"default:3"`
	EnablePasswordPolicy            bool   `json:"enable_password_policy" gorm:"default:true"`
	MinimumPasswordScore            int    `json:"minimum_password_score" gorm:"default:2"`

	// 4. Email
	EmailFooterAddress           string `json:"email_footer_address" gorm:"type:text"`
	EmailRetryLimit              int    `json:"email_retry_limit" gorm:"default:3"`
	DisableStandardEmailFooter   bool   `json:"disable_standard_email_footer" gorm:"default:false"`
	HideFooterInAutoEmailReports bool   `json:"hide_footer_in_auto_email_reports" gorm:"default:false"`
	AttachViewLink               bool   `json:"attach_view_link" gorm:"default:true"`
	StoreAttachedPdfDocument     bool   `json:"store_attached_pdf_document" gorm:"default:false"`
	WelcomeEmailTemplate         string `json:"welcome_email_template" gorm:"type:varchar(150)"`
	ResetPasswordTemplate        string `json:"reset_password_template" gorm:"type:varchar(150)"`

	// 5. Files
	MaxFileSize                                int    `json:"max_file_size" gorm:"default:0"`
	AllowGuestsToUploadFiles                   bool   `json:"allow_guests_to_upload_files" gorm:"default:false"`
	ForceWebCaptureModeForUploads              bool   `json:"force_web_capture_mode_for_uploads" gorm:"default:false"`
	StripExifMetadataFromUploadedImages        bool   `json:"strip_exif_metadata_from_uploaded_images" gorm:"default:true"`
	OnlyAllowSystemManagersToUploadPublicFiles bool   `json:"only_allow_system_managers_to_upload_public_files" gorm:"default:false"`
	DeleteBackgroundExportedReportsAfter       int    `json:"delete_background_exported_reports_after" gorm:"default:48"`
	AllowedFileExtensions                      string `json:"allowed_file_extensions" gorm:"type:text"`

	// 6. App
	DefaultApp string `json:"default_app" gorm:"type:varchar(50);default:'Desk'"`

	// 7. Display
	DisableSystemUpdateNotification bool `json:"disable_system_update_notification" gorm:"default:false"`
	DisableChangeLogNotification    bool `json:"disable_change_log_notification" gorm:"default:false"`
	HideEmptyReadOnlyFields         bool `json:"hide_empty_read_only_fields" gorm:"default:false"`
	DisableProductSuggestion        bool `json:"disable_product_suggestion" gorm:"default:false"`

	// 8. Backups
	BackupLimit    int  `json:"backup_limit" gorm:"default:3"`
	EncryptBackups bool `json:"encrypt_backups" gorm:"default:false"`

	// 9. Advanced
	MaxAutoEmailReportPerUser int  `json:"max_auto_email_report_per_user" gorm:"default:20"`
	MaxReportRows             int  `json:"max_report_rows" gorm:"default:100000"`
	DormantDays               int  `json:"dormant_days" gorm:"default:4"`
	AllowErrorTraceback       bool `json:"allow_error_traceback" gorm:"default:true"`
	EnableTelemetry           bool `json:"enable_telemetry" gorm:"default:false"`
	LinkFieldResultsLimit     int  `json:"link_field_results_limit" gorm:"default:10"`
	LogAPIRequests            bool `json:"log_api_requests" gorm:"default:false"`

	TenantID  *uuid.UUID     `json:"tenant_id" gorm:"type:char(36);uniqueIndex:idx_tenant_settings"`
	Tenant    Tenant         `gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"deleted_at" gorm:"index"`
}

func (p *SystemSetting) BeforeCreate(tx *gorm.DB) (err error) {
	if strings.TrimSpace(p.RoundingMethod) == "" {
		p.RoundingMethod = DefaultRoundingMethod
	}
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

		// 1. Details
		"country":                            r.Country,
		"language":                           r.Language,
		"time_zone":                          r.TimeZone,
		"currency":                           r.Currency,
		"enable_onboarding":                  r.EnableOnboarding,
		"disable_document_sharing":           r.DisableDocumentSharing,
		"date_format":                        r.DateFormat,
		"time_format":                        r.TimeFormat,
		"number_format":                      r.NumberFormat,
		"use_number_format_from_currency":    r.UseNumberFormatFromCurrency,
		"first_day_of_the_week":              r.FirstDayOfTheWeek,
		"float_precision":                    r.FloatPrecision,
		"currency_precision":                 r.CurrencyPrecision,
		"rounding_method":                    r.RoundingMethod,
		"show_absolute_datetime_in_timeline": r.ShowAbsoluteDatetimeInTimeline,
		"apply_strict_user_permissions":      r.ApplyStrictUserPermissions,
		"show_external_link_warning":         r.ShowExternalLinkWarning,

		// 2. Login
		"session_expiry":                   r.SessionExpiry,
		"document_share_key_expiry":        r.DocumentShareKeyExpiry,
		"deny_multiple_sessions":           r.DenyMultipleSessions,
		"disable_user_pass_login":          r.DisableUserPassLogin,
		"max_signups_allowed_per_hour":     r.MaxSignupsAllowedPerHour,
		"allow_login_using_mobile_number":  r.AllowLoginUsingMobileNumber,
		"allow_login_using_user_name":      r.AllowLoginUsingUserName,
		"login_with_email_link":            r.LoginWithEmailLink,
		"login_with_email_link_expiry":     r.LoginWithEmailLinkExpiry,
		"rate_limit_email_link_login":      r.RateLimitEmailLinkLogin,
		"allow_consecutive_login_attempts": r.AllowConsecutiveLoginAttempts,
		"allow_login_after_fail":           r.AllowLoginAfterFail,
		"enable_two_factor_auth":           r.EnableTwoFactorAuth,

		// 3. Password
		"logout_on_password_reset":            r.LogoutOnPasswordReset,
		"force_user_to_reset_password":        r.ForceUserToResetPassword,
		"reset_password_link_expiry_duration": r.ResetPasswordLinkExpiryDuration,
		"password_reset_limit":                r.PasswordResetLimit,
		"enable_password_policy":              r.EnablePasswordPolicy,
		"minimum_password_score":              r.MinimumPasswordScore,

		// 4. Email
		"email_footer_address":              r.EmailFooterAddress,
		"email_retry_limit":                 r.EmailRetryLimit,
		"disable_standard_email_footer":     r.DisableStandardEmailFooter,
		"hide_footer_in_auto_email_reports": r.HideFooterInAutoEmailReports,
		"attach_view_link":                  r.AttachViewLink,
		"store_attached_pdf_document":       r.StoreAttachedPdfDocument,
		"welcome_email_template":            r.WelcomeEmailTemplate,
		"reset_password_template":           r.ResetPasswordTemplate,

		// 5. Files
		"max_file_size":                                     r.MaxFileSize,
		"allow_guests_to_upload_files":                      r.AllowGuestsToUploadFiles,
		"force_web_capture_mode_for_uploads":                r.ForceWebCaptureModeForUploads,
		"strip_exif_metadata_from_uploaded_images":          r.StripExifMetadataFromUploadedImages,
		"only_allow_system_managers_to_upload_public_files": r.OnlyAllowSystemManagersToUploadPublicFiles,
		"delete_background_exported_reports_after":          r.DeleteBackgroundExportedReportsAfter,
		"allowed_file_extensions":                           r.AllowedFileExtensions,

		// 6. App
		"default_app": r.DefaultApp,

		// 7. Display
		"disable_system_update_notification": r.DisableSystemUpdateNotification,
		"disable_change_log_notification":    r.DisableChangeLogNotification,
		"hide_empty_read_only_fields":        r.HideEmptyReadOnlyFields,
		"disable_product_suggestion":         r.DisableProductSuggestion,

		// 8. Backups
		"backup_limit":    r.BackupLimit,
		"encrypt_backups": r.EncryptBackups,

		// 9. Advanced
		"max_auto_email_report_per_user": r.MaxAutoEmailReportPerUser,
		"max_report_rows":                r.MaxReportRows,
		"dormant_days":                   r.DormantDays,
		"allow_error_traceback":          r.AllowErrorTraceback,
		"enable_telemetry":               r.EnableTelemetry,
		"link_field_results_limit":       r.LinkFieldResultsLimit,
		"log_api_requests":               r.LogAPIRequests,
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
