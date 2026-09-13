package controller

import (
	"errors"
	"fmt"
	"gin-template/common"
	"gin-template/internal/tenancy"
	"gin-template/model"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type AuthController struct {
	DB *gorm.DB
	Wn *webauthn.WebAuthn
}

func NewAuthController(db *gorm.DB) *AuthController {

	// Ambil dari ENV, dengan fallback default
	rpID := os.Getenv("WEBAUTHN_RP_ID")
	if rpID == "" {
		rpID = "localhost" // manglayangacademia.id
	}

	rpOrigins := []string{
		"http://localhost:8084",            // Backend/API Port (kalau serve static file dari sini)
		"http://localhost:5173",            // Frontend Dev (Vite)
		"http://localhost:5174",            // Frontend Dev (Vite)
		"http://localhost:3000",            // Frontend Dev (CRA)
		"https://admin.malabartrailrun.id", // Production Domain
		// Tambahkan URL yang sedang kamu pakai di browser sekarang
	}

	if envOrigin := os.Getenv("WEBAUTHN_RP_ORIGIN"); envOrigin != "" {
		rpOrigins = append(rpOrigins, envOrigin)
	}
	wconfig := &webauthn.Config{
		RPDisplayName: "Trail Running App",
		RPID:          rpID,      // Domain saja (tanpa port/scheme)
		RPOrigins:     rpOrigins, // Full URL dengan scheme & port
	}
	wn, _ := webauthn.New(wconfig)

	return &AuthController{
		DB: db,
		Wn: wn,
	}
}

// Konfigurasi JWT (Sebaiknya dipindahkan ke config/env)
var (
	JWTSecretKey       = []byte(common.JWTSecret)
	AccessTokenExpiry  = 5 * time.Minute    // 15 menit
	RefreshTokenExpiry = 7 * 24 * time.Hour // 7 hari
)

// Struct untuk JWT Claims
type Claims struct {
	UserId                 string `json:"id"`
	TenantID               string `json:"tenant_id"`
	Username               string `json:"username"`
	Role                   int    `json:"role"`
	TokenVersion           string `json:"token_version"`
	ImpersonatorID         string `json:"impersonator_id,omitempty"`
	ImpersonatorRole       int    `json:"impersonator_role,omitempty"`
	ImpersonationSessionID string `json:"impersonation_session_id,omitempty"`
	jwt.RegisteredClaims
}

// Struct request baru untuk Refresh Token
type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

// Request/Response types
type LoginRequest struct {
	Identifier string `json:"identifier"`
	Email      string `json:"email"`
	Password   string `json:"password" binding:"required"`
	LoginType  string `json:"login_type"`
}

// Perbaikan: Mengganti Email menjadi UserID (string UUID) agar konsisten dengan ManageUser di file lain
type ManageRequest struct {
	UserID string `json:"user_id" binding:"required"`
	Action string `json:"action" binding:"required"`
}

// --- Error messages (dibiarkan tetap) ---
const (
	ErrInvalidParameters         = "Invalid parameters"
	ErrPasswordLoginDisabled     = "Password login has been disabled by administrator"
	ErrRegistrationDisabled      = "New user registration has been disabled by administrator"
	ErrPasswordRegDisabled       = "Password registration disabled. Please use third-party authentication"
	ErrEmailVerificationReq      = "Email verification is required. Please provide email and verification code"
	ErrInvalidVerificationCode   = "Invalid or expired verification code"
	ErrTokenGenerationFailed     = "Failed to generate authentication token"
	ErrInvalidToken              = "Invalid or expired token"
	ErrInsufficientPermission    = "Insufficient permission to perform this action"
	ErrCannotModifyHigherRole    = "Cannot modify users with equal or higher role"
	ErrCannotPromoteToHigherRole = "Cannot promote user to role equal or higher than yours"
	ErrUUIDCollision             = "UUID collision detected. Please try again"
	ErrCannotModifyRootUser      = "Cannot modify root administrator"
	ErrCannotDeleteRootUser      = "Cannot delete root administrator"
	ErrCannotDisableRootUser     = "Cannot disable root administrator"
	ErrCannotDemoteRootUser      = "Cannot demote root administrator"
	ErrUserNotFound              = "User not found"
	ErrUserAlreadyAdmin          = "User is already an administrator"
	ErrUserAlreadyCommon         = "User is already a common user"
	ErrOnlyRootCanPromote        = "Only root administrator can promote users to admin"
	ErrCannotCreateHigherRole    = "Cannot create user with role equal or higher than yours"
)

// --- Helper Functions untuk JWT ---

func generateTokens(user *model.User) (string, string, error) {
	return generateTokenPair(user, nil)
}

func generateImpersonationTokens(user *model.User, session *model.ImpersonationSession) (string, string, error) {
	return generateTokenPair(user, session)
}

func generateTokenPair(user *model.User, session *model.ImpersonationSession) (string, string, error) {
	// KONVERSI UUID ke STRING
	userIdStr := user.ID.String()
	tenantID := ""
	if user.TenantID != nil {
		tenantID = user.TenantID.String()
	}
	impersonatorID := ""
	impersonatorRole := 0
	impersonationSessionID := ""
	refreshExpiry := RefreshTokenExpiry
	if session != nil {
		impersonatorID = session.ImpersonatorID.String()
		impersonatorRole = session.ImpersonatorRole
		impersonationSessionID = session.ID.String()
		refreshExpiry = time.Until(session.ExpiresAt)
		if refreshExpiry <= 0 {
			return "", "", errors.New("impersonation session has expired")
		}
	}

	// 1. Create Access Token
	accessClaims := &Claims{
		UserId:                 userIdStr,
		TenantID:               tenantID,
		Username:               user.Username,
		Role:                   user.Role,
		TokenVersion:           user.Token,
		ImpersonatorID:         impersonatorID,
		ImpersonatorRole:       impersonatorRole,
		ImpersonationSessionID: impersonationSessionID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().UTC().Add(AccessTokenExpiry)),
			Issuer:    "gin-template",
		},
	}
	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessTokenString, err := accessToken.SignedString(JWTSecretKey)
	if err != nil {
		return "", "", err
	}

	// 2. Create Refresh Token
	refreshClaims := &Claims{
		UserId:                 userIdStr,
		TenantID:               tenantID,
		TokenVersion:           user.Token,
		ImpersonatorID:         impersonatorID,
		ImpersonatorRole:       impersonatorRole,
		ImpersonationSessionID: impersonationSessionID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().UTC().Add(refreshExpiry)),
			Issuer:    "gin-template",
		},
	}
	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshTokenString, err := refreshToken.SignedString(JWTSecretKey)
	if err != nil {
		return "", "", err
	}

	return accessTokenString, refreshTokenString, nil
}

func validateToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		return JWTSecretKey, nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}))

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		if strings.EqualFold(strings.TrimSpace(os.Getenv("TENANCY_MODE")), "database-per-tenant") && claims.Issuer != "gin-template" {
			return nil, errors.New(ErrInvalidToken)
		}
		return claims, nil
	}

	return nil, errors.New(ErrInvalidToken)
}

// --- Auth Handlers ---

// Login handles user authentication and returns JWT
func (ac *AuthController) Login(c *gin.Context) {
	log := zap.L().With(zap.String("controller", "AuthController"), zap.String("function", "Login"))
	if !common.PasswordLoginEnabled {
		log.Warn("Password login is disabled")
		sendBadRequest(c, ErrPasswordLoginDisabled, nil)
		return
	}

	var loginRequest LoginRequest
	if err := c.ShouldBindJSON(&loginRequest); err != nil {
		log.Warn("Invalid login JSON payload", zap.Error(err))
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}

	identifier := strings.TrimSpace(loginRequest.Identifier)
	if identifier == "" {
		identifier = strings.TrimSpace(loginRequest.Email)
	}
	if identifier == "" || strings.TrimSpace(loginRequest.Password) == "" {
		log.Warn("Missing identifier or password")
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}

	log = log.With(zap.String("identifier", identifier), zap.String("login_type", loginRequest.LoginType))

	var user model.User
	if err := user.ValidateAndFillByIdentifier(c, identifier, loginRequest.Password); err != nil {
		log.Warn("Authentication failed: invalid credentials", zap.Error(err))
		sendBadRequest(c, "Email, username, or password incorrect", nil)
		return
	}

	switch strings.ToLower(strings.TrimSpace(loginRequest.LoginType)) {
	case "":
		// Backward compatibility for clients that do not expose role-specific login.
	case "merchant", "parent":
		if user.Role != model.RoleMerchant && user.Role < model.RoleAdmin {
			log.Warn("Login rejected: user is not a merchant", zap.String("user_id", user.ID.String()), zap.Int("role", user.Role))
			sendBadRequest(c, "Akun ini bukan akun merchant", nil)
			return
		}
	case "partner", "student":
		if user.Role != model.RolePartner && user.Role < model.RoleAdmin {
			log.Warn("Login rejected: user is not a partner", zap.String("user_id", user.ID.String()), zap.Int("role", user.Role))
			sendBadRequest(c, "Akun ini bukan akun partner", nil)
			return
		}
	default:
		log.Warn("Login rejected: invalid login_type")
		sendBadRequest(c, "Tipe login tidak valid", nil)
		return
	}

	// Generate JWT Tokens instead of Session
	accessToken, refreshToken, err := generateTokens(&user)
	if err != nil {
		log.Error("Failed to generate JWT tokens", zap.Error(err))
		sendBadRequest(c, ErrTokenGenerationFailed, nil)
		return
	}

	cleanUser := model.User{
		ID:          user.ID,
		Email:       user.Email,
		DisplayName: user.DisplayName,
		Role:        user.Role,
		Status:      user.Status,
		TenantID:    user.TenantID,
	}

	c.Set("id", user.ID)

	log.Info("User logged in successfully",
		zap.String("user_id", user.ID.String()),
		zap.String("email", user.Email),
		zap.Int("role", user.Role),
	)

	// Return user info + tokens
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Login successful",
		"data": gin.H{
			"user":          cleanUser,
			"access_token":  accessToken,
			"refresh_token": refreshToken,
		},
	})
}

// RefreshToken handles generating new access token using refresh token
func (ac *AuthController) RefreshToken(c *gin.Context) {
	var req RefreshTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}

	// Validate Refresh Token
	claims, err := validateToken(req.RefreshToken)
	if err != nil {
		sendBadRequest(c, ErrInvalidToken, nil)
		return
	}
	if tenant, scoped := tenancy.FromContext(c.Request.Context()); scoped && claims.TenantID != tenant.ID.String() {
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": gin.H{
			"code": "FORBIDDEN", "message": "Token does not belong to this tenant", "request_id": c.GetString("request_id"),
		}})
		return
	}

	// Perbaikan: Konversi claims.UserId (string) ke uuid.UUID
	userID, err := uuid.Parse(claims.UserId)
	if err != nil {
		sendBadRequest(c, ErrInvalidToken, nil) // ID dari token rusak
		return
	}

	// In database-per-tenant mode the hostname resolver has already selected the
	// database. Legacy mode retains the former controller DB path for compatibility.
	authDB := ac.DB.Session(&gorm.Session{}).Set("skip_tenant_scope", true).WithContext(c.Request.Context())
	if scopedDB, scopedErr := tenancy.DBFromContext(c.Request.Context()); scopedErr == nil {
		authDB = scopedDB.Session(&gorm.Session{}).WithContext(c.Request.Context())
	} else if strings.EqualFold(strings.TrimSpace(os.Getenv("TENANCY_MODE")), "database-per-tenant") {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": gin.H{
			"code": "UNAUTHORIZED", "message": "Tenant context is missing", "request_id": c.GetString("request_id"),
		}})
		return
	}

	var user model.User
	if err := authDB.
		Select("id", "username", "display_name", "role", "status", "email", "token", "tenant_id").
		First(&user, "id = ?", userID).Error; err != nil {
		sendBadRequest(c, ErrUserNotFound, nil)
		return
	}

	if user.Status == common.UserStatusDisabled {
		sendBadRequest(c, "User account is disabled", nil)
		return
	}
	if claims.TokenVersion != user.Token {
		sendBadRequest(c, ErrInvalidToken, nil)
		return
	}

	// Generate NEW tokens
	var newAccessToken, newRefreshToken string
	if claims.ImpersonationSessionID != "" {
		sessionID, parseErr := uuid.Parse(claims.ImpersonationSessionID)
		if parseErr != nil {
			sendBadRequest(c, ErrInvalidToken, nil)
			return
		}
		session, _, validationErr := model.ValidateActiveImpersonationSession(authDB, sessionID, user.ID)
		if validationErr != nil || session.ImpersonatorID.String() != claims.ImpersonatorID {
			sendBadRequest(c, ErrInvalidToken, nil)
			return
		}
		newAccessToken, newRefreshToken, err = generateImpersonationTokens(&user, session)
	} else {
		newAccessToken, newRefreshToken, err = generateTokens(&user)
	}
	if err != nil {
		sendBadRequest(c, ErrTokenGenerationFailed, nil)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Token refreshed successfully", // Tambahkan pesan sukses
		"data": gin.H{
			"access_token":  newAccessToken,
			"refresh_token": newRefreshToken,
		},
	})
}

// Logout handles user logout
func (ac *AuthController) Logout(c *gin.Context) {
	sendSuccessNoData(c)
}

// --- Other Handlers (Updated imports/logic) ---

// Register handles new user registration
func (ac *AuthController) Register(c *gin.Context) {
	if !common.RegisterEnabled {
		sendBadRequest(c, ErrRegistrationDisabled, nil)
		return
	}

	if !common.PasswordRegisterEnabled {
		sendBadRequest(c, ErrPasswordRegDisabled, nil)
		return
	}

	var user model.User
	if err := c.ShouldBindJSON(&user); err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}

	user.Username = strings.TrimSpace(user.Username)
	user.Email = strings.TrimSpace(strings.ToLower(user.Email))

	if err := common.Validate.Struct(&user); err != nil {
		sendBadRequest(c, fmt.Sprintf("Invalid input: %v", err), nil)
		return
	}

	if common.EmailVerificationEnabled {
		if user.Email == "" || user.VerificationCode == "" {
			sendBadRequest(c, ErrEmailVerificationReq, nil)
			return
		}
		if !common.VerifyCodeWithKey(user.Email, user.VerificationCode, common.EmailVerificationPurpose) {
			sendBadRequest(c, ErrInvalidVerificationCode, nil)
			return
		}
	}

	cleanUser := model.User{
		Username:    user.Username,
		Password:    user.Password,
		DisplayName: user.Username,
		Role:        common.RoleCommonUser, // Tetapkan Role default
	}

	if common.EmailVerificationEnabled {
		cleanUser.Email = user.Email
	}

	if err := cleanUser.Insert(c); err != nil {
		sendBadRequest(c, "Terjadi kesalahan ketika menambahkan pengguna.", err.Error())
		return
	}

	// Setelah Insert, buat respons dengan informasi yang aman
	responseUser := gin.H{
		"username":     cleanUser.Username,
		"display_name": cleanUser.DisplayName,
		"email":        cleanUser.Email,
	}

	sendSuccess(c, responseUser, "Participant successful")
}
