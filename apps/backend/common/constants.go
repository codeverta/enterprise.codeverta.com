package common

import (
	"os"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/joho/godotenv"
)

// Helper sederhana untuk membaca Environment Variable
func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}

var JWTSecret = ""

func init() {
	// Load .env before checking JWT_SECRET (godotenv in main() is too late)
	_ = godotenv.Load()
	_ = godotenv.Load("apps/backend/.env")
	JWTSecret = getEnv("JWT_SECRET", "")
	if JWTSecret == "" {
		panic("CRITICAL: JWT_SECRET environment variable is not set. Generate a secure random string (64+ chars) and set it in .env or system environment.")
	}
}

var StartTime = time.Now().Unix() // unit: second
var Version = "v1.0.53"
var SystemName = "Codeverta Enterprise Resource System App"
var ServerAddress = "http://localhost:3000"
var Footer = ""
var HomePageLink = ""

// Any options with "Secret", "Token" in its key won't be return by GetOptions

var SessionSecret = uuid.New().String()
var SQLitePath = "gin-template.db"

var OptionMap map[string]string
var OptionMapRWMutex sync.RWMutex

var ItemsPerPage = 10

var PasswordLoginEnabled = true
var PasswordRegisterEnabled = true
var EmailVerificationEnabled = false
var GitHubOAuthEnabled = false
var WeChatAuthEnabled = false
var TurnstileCheckEnabled = false
var RegisterEnabled = true

var SMTPServer = ""
var SMTPPort = 587
var SMTPAccount = ""
var SMTPToken = ""

var GitHubClientId = ""
var GitHubClientSecret = ""

var WeChatServerAddress = ""
var WeChatServerToken = ""
var WeChatAccountQRCodeImageURL = ""

var TurnstileSiteKey = ""
var TurnstileSecretKey = ""

const (
	RoleGuestUser      = 0
	RoleCommonUser     = 1
	RoleMentor         = 30
	RoleGuruExternal   = 40
	RoleAdminUser      = 99
	RoleSuperAdminUser = 100
	// RoleRootUser is kept as an alias for backward compatibility.
	RoleRootUser = RoleSuperAdminUser
)

var (
	FileUploadPermission    = RoleGuestUser
	FileDownloadPermission  = RoleGuestUser
	ImageUploadPermission   = RoleGuestUser
	ImageDownloadPermission = RoleGuestUser
)

// All duration's unit is seconds
// Shouldn't larger then RateLimitKeyExpirationDuration
var (
	GlobalApiRateLimitNum            = 3000
	GlobalApiRateLimitDuration int64 = 30

	GlobalWebRateLimitNum            = 600
	GlobalWebRateLimitDuration int64 = 60

	UploadRateLimitNum            = 10
	UploadRateLimitDuration int64 = 60

	DownloadRateLimitNum            = 10
	DownloadRateLimitDuration int64 = 60

	CriticalRateLimitNum            = 200
	CriticalRateLimitDuration int64 = 1 * 60
)

var RateLimitKeyExpirationDuration = 20 * time.Minute

const (
	UserStatusEnabled  = 1 // don't use 0, 0 is the default value!
	UserStatusDisabled = 2 // also don't use 0
)

const (
	CtxTenantKey = "current_tenant" // Key untuk c.Get nanti
)
