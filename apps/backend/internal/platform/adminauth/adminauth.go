package adminauth

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"gin-template/internal/tenancy"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type Admin struct {
	ID           uuid.UUID `gorm:"type:char(36);primaryKey" json:"id"`
	Email        string    `gorm:"size:254;uniqueIndex;not null" json:"email"`
	PasswordHash string    `gorm:"size:255;not null" json:"-"`
	TokenVersion string    `gorm:"size:64;not null" json:"-"`
	Active       bool      `gorm:"not null;default:true" json:"active"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

func (Admin) TableName() string { return "platform_admins" }

type Session struct {
	ID        uuid.UUID  `gorm:"type:char(36);primaryKey"`
	AdminID   uuid.UUID  `gorm:"type:char(36);not null;index"`
	ExpiresAt time.Time  `gorm:"not null;index"`
	RevokedAt *time.Time `gorm:"index"`
	CreatedAt time.Time
}

func (Session) TableName() string { return "platform_admin_sessions" }

type Claims struct {
	TokenVersion string `json:"token_version"`
	SessionID    string `json:"session_id"`
	jwt.RegisteredClaims
}

type Service struct {
	db     *gorm.DB
	secret []byte
	issuer string
	ttl    time.Duration
}

func New(db *gorm.DB, secret string) (*Service, error) {
	if len(secret) < 64 {
		return nil, errors.New("PLATFORM_JWT_SECRET must contain at least 64 characters")
	}
	return &Service{db: db, secret: []byte(secret), issuer: "codeverta-platform", ttl: 15 * time.Minute}, nil
}

func Migrate(db *gorm.DB) error { return db.AutoMigrate(&Admin{}, &Session{}) }

func CreateAdmin(db *gorm.DB, email, password string) error {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" || len(password) < 12 {
		return errors.New("email and a password of at least 12 characters are required")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	admin := Admin{ID: uuid.New(), Email: email, PasswordHash: string(hash), TokenVersion: uuid.NewString(), Active: true}
	return db.Create(&admin).Error
}

func (s *Service) Login(email, password string) (string, error) {
	var admin Admin
	if err := s.db.First(&admin, "email = ? AND active = ?", strings.ToLower(strings.TrimSpace(email)), true).Error; err != nil {
		return "", errors.New("invalid platform credentials")
	}
	if bcrypt.CompareHashAndPassword([]byte(admin.PasswordHash), []byte(password)) != nil {
		return "", errors.New("invalid platform credentials")
	}
	now := time.Now().UTC()
	session := Session{ID: uuid.New(), AdminID: admin.ID, CreatedAt: now, ExpiresAt: now.Add(s.ttl)}
	if err := s.db.Create(&session).Error; err != nil {
		return "", err
	}
	claims := Claims{TokenVersion: admin.TokenVersion, SessionID: session.ID.String(), RegisteredClaims: jwt.RegisteredClaims{
		Subject: admin.ID.String(), Issuer: s.issuer, Audience: jwt.ClaimStrings{"platform-admin"},
		IssuedAt: jwt.NewNumericDate(now), ExpiresAt: jwt.NewNumericDate(session.ExpiresAt),
	}}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(s.secret)
}

func (s *Service) Authenticate() gin.HandlerFunc {
	return func(c *gin.Context) {
		header := strings.TrimSpace(c.GetHeader("Authorization"))
		parts := strings.SplitN(header, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			platformError(c, http.StatusUnauthorized, "UNAUTHORIZED", "Platform authentication is required")
			return
		}
		claims := &Claims{}
		token, err := jwt.ParseWithClaims(parts[1], claims, func(*jwt.Token) (any, error) { return s.secret, nil },
			jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}), jwt.WithIssuer(s.issuer), jwt.WithAudience("platform-admin"))
		if err != nil || !token.Valid {
			platformError(c, http.StatusUnauthorized, "UNAUTHORIZED", "Invalid platform token")
			return
		}
		adminID, adminErr := uuid.Parse(claims.Subject)
		sessionID, sessionErr := uuid.Parse(claims.SessionID)
		if adminErr != nil || sessionErr != nil {
			platformError(c, http.StatusUnauthorized, "UNAUTHORIZED", "Invalid platform token")
			return
		}
		var admin Admin
		if err := s.db.First(&admin, "id = ? AND active = ? AND token_version = ?", adminID, true, claims.TokenVersion).Error; err != nil {
			platformError(c, http.StatusUnauthorized, "UNAUTHORIZED", "Platform session is no longer valid")
			return
		}
		var count int64
		if err := s.db.Model(&Session{}).Where("id = ? AND admin_id = ? AND revoked_at IS NULL AND expires_at > ?", sessionID, adminID, time.Now().UTC()).Count(&count).Error; err != nil || count != 1 {
			platformError(c, http.StatusUnauthorized, "UNAUTHORIZED", "Platform session is no longer valid")
			return
		}
		c.Set("platform_admin_id", adminID)
		c.Next()
	}
}

func RequireHost(expected string) gin.HandlerFunc {
	expected, _ = tenancy.NormalizeHost(expected)
	return func(c *gin.Context) {
		host, err := tenancy.NormalizeHost(c.Request.Host)
		if expected == "" || err != nil || host != expected {
			platformError(c, http.StatusNotFound, "TENANT_NOT_FOUND", "Not found")
			return
		}
		c.Next()
	}
}

func platformError(c *gin.Context, status int, code, message string) {
	c.AbortWithStatusJSON(status, gin.H{"error": gin.H{"code": code, "message": message, "request_id": c.GetString("request_id")}})
}
