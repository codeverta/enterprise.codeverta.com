package controller

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"gin-template/common"
	"gin-template/model"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

const (
	googleAuthorizeURL  = "https://accounts.google.com/o/oauth2/v2/auth"
	googleTokenURL      = "https://oauth2.googleapis.com/token"
	googleUserInfoURL   = "https://openidconnect.googleapis.com/v1/userinfo"
	googleStateCookie   = "codeverta_google_oauth_state"
	googleStateLifetime = 10 * time.Minute
)

var googleUsernameCleaner = regexp.MustCompile(`[^a-z0-9]+`)

type googleOAuthState struct {
	Nonce       string `json:"nonce"`
	TenantID    string `json:"tenant_id"`
	Redirect    string `json:"redirect"`
	CallbackURL string `json:"callback_url"`
	ExpiresAt   int64  `json:"expires_at"`
}

type googleTokenResponse struct {
	AccessToken string `json:"access_token"`
	Error       string `json:"error"`
	Description string `json:"error_description"`
}

type googleUserInfo struct {
	Subject       string `json:"sub"`
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
}

func googleOAuthConfigured() bool {
	return strings.TrimSpace(os.Getenv("GOOGLE_OAUTH_CLIENT_ID")) != "" && strings.TrimSpace(os.Getenv("GOOGLE_OAUTH_CLIENT_SECRET")) != ""
}

func googleFrontendURL() string {
	value := strings.TrimRight(strings.TrimSpace(os.Getenv("GOOGLE_OAUTH_FRONTEND_URL")), "/")
	if value == "" {
		return "http://localhost:5173"
	}
	return value
}

func safeGoogleRedirect(value string) string {
	value = strings.TrimSpace(value)
	if value == "" || !strings.HasPrefix(value, "/") || strings.HasPrefix(value, "//") {
		return "/"
	}
	return value
}

func googleCallbackURL(c *gin.Context) string {
	if configured := strings.TrimSpace(os.Getenv("GOOGLE_OAUTH_REDIRECT_URL")); configured != "" {
		return configured
	}
	scheme := "http"
	if forwarded := strings.TrimSpace(c.GetHeader("X-Forwarded-Proto")); forwarded != "" {
		scheme = strings.Split(forwarded, ",")[0]
	} else if c.Request.TLS != nil {
		scheme = "https"
	}
	return scheme + "://" + c.Request.Host + "/api/auth/google/callback"
}

func randomGoogleStateValue() (string, error) {
	data := make([]byte, 32)
	if _, err := rand.Read(data); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(data), nil
}

func signGoogleState(state googleOAuthState) (string, error) {
	payload, err := json.Marshal(state)
	if err != nil {
		return "", err
	}
	encoded := base64.RawURLEncoding.EncodeToString(payload)
	mac := hmac.New(sha256.New, []byte(common.JWTSecret))
	_, _ = mac.Write([]byte(encoded))
	signature := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return encoded + "." + signature, nil
}

func parseGoogleState(value string) (googleOAuthState, error) {
	parts := strings.Split(value, ".")
	if len(parts) != 2 {
		return googleOAuthState{}, errors.New("invalid oauth state")
	}
	mac := hmac.New(sha256.New, []byte(common.JWTSecret))
	_, _ = mac.Write([]byte(parts[0]))
	expected := mac.Sum(nil)
	received, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil || !hmac.Equal(received, expected) {
		return googleOAuthState{}, errors.New("invalid oauth state signature")
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return googleOAuthState{}, err
	}
	var state googleOAuthState
	if err := json.Unmarshal(payload, &state); err != nil {
		return googleOAuthState{}, err
	}
	if state.ExpiresAt < time.Now().UTC().Unix() {
		return googleOAuthState{}, errors.New("oauth state expired")
	}
	state.Redirect = safeGoogleRedirect(state.Redirect)
	return state, nil
}

func redirectGoogleError(c *gin.Context, message string) {
	location := googleFrontendURL() + "/login?google_error=" + url.QueryEscape(message)
	c.Redirect(http.StatusFound, location)
}

func (ac *AuthController) GoogleOAuthStatus(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"enabled": googleOAuthConfigured()}})
}

func (ac *AuthController) BeginGoogleOAuth(c *gin.Context) {
	if !googleOAuthConfigured() {
		redirectGoogleError(c, "Login Google belum dikonfigurasi oleh administrator")
		return
	}
	tenantID := strings.TrimSpace(c.Query("tenant_id"))
	if tenantID == "" || tenantID == "belum-di-set" {
		tenantID = model.DefaultTenantIDString
	}
	var tenant model.Tenant
	if err := ac.DB.Set("skip_tenant_scope", true).Where("id = ? AND is_active = ?", tenantID, true).First(&tenant).Error; err != nil {
		redirectGoogleError(c, "Tenant untuk login Google tidak ditemukan")
		return
	}
	nonce, err := randomGoogleStateValue()
	if err != nil {
		redirectGoogleError(c, "Tidak dapat memulai login Google")
		return
	}
	callbackURL := googleCallbackURL(c)
	state, err := signGoogleState(googleOAuthState{
		Nonce: nonce, TenantID: tenant.ID.String(), Redirect: safeGoogleRedirect(c.Query("redirect")),
		CallbackURL: callbackURL, ExpiresAt: time.Now().UTC().Add(googleStateLifetime).Unix(),
	})
	if err != nil {
		redirectGoogleError(c, "Tidak dapat memulai login Google")
		return
	}
	secure := strings.HasPrefix(strings.ToLower(callbackURL), "https://")
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(googleStateCookie, nonce, int(googleStateLifetime.Seconds()), "/api/auth/google/callback", "", secure, true)

	params := url.Values{
		"client_id":     {strings.TrimSpace(os.Getenv("GOOGLE_OAUTH_CLIENT_ID"))},
		"redirect_uri":  {callbackURL},
		"response_type": {"code"},
		"scope":         {"openid email profile"},
		"state":         {state},
		"prompt":        {"select_account"},
	}
	c.Redirect(http.StatusFound, googleAuthorizeURL+"?"+params.Encode())
}

func exchangeGoogleCode(ctx context.Context, code, callbackURL string) (string, error) {
	requestBody := url.Values{
		"code":          {code},
		"client_id":     {strings.TrimSpace(os.Getenv("GOOGLE_OAUTH_CLIENT_ID"))},
		"client_secret": {strings.TrimSpace(os.Getenv("GOOGLE_OAUTH_CLIENT_SECRET"))},
		"redirect_uri":  {callbackURL},
		"grant_type":    {"authorization_code"},
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, googleTokenURL, strings.NewReader(requestBody.Encode()))
	if err != nil {
		return "", err
	}
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	response, err := (&http.Client{Timeout: 12 * time.Second}).Do(request)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()
	var token googleTokenResponse
	if err := json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(&token); err != nil {
		return "", err
	}
	if response.StatusCode != http.StatusOK || token.AccessToken == "" {
		return "", fmt.Errorf("google token exchange failed: %s %s", token.Error, token.Description)
	}
	return token.AccessToken, nil
}

func fetchGoogleUser(ctx context.Context, accessToken string) (googleUserInfo, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, googleUserInfoURL, nil)
	if err != nil {
		return googleUserInfo{}, err
	}
	request.Header.Set("Authorization", "Bearer "+accessToken)
	response, err := (&http.Client{Timeout: 12 * time.Second}).Do(request)
	if err != nil {
		return googleUserInfo{}, err
	}
	defer response.Body.Close()
	var user googleUserInfo
	if err := json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(&user); err != nil {
		return googleUserInfo{}, err
	}
	if response.StatusCode != http.StatusOK || user.Subject == "" || user.Email == "" || !user.EmailVerified {
		return googleUserInfo{}, errors.New("google did not return a verified email identity")
	}
	user.Email = strings.ToLower(strings.TrimSpace(user.Email))
	return user, nil
}

func uniqueGoogleUsername(tx *gorm.DB, email string) (string, error) {
	base := googleUsernameCleaner.ReplaceAllString(strings.ToLower(strings.Split(email, "@")[0]), "")
	if len(base) > 7 {
		base = base[:7]
	}
	if base == "" {
		base = "buyer"
	}
	for attempt := 0; attempt < 10; attempt++ {
		candidate := base + strings.ToLower(strings.ReplaceAll(uuid.NewString()[:5], "-", ""))
		var count int64
		if err := tx.Set("skip_tenant_scope", true).Model(&model.User{}).Where("username = ?", candidate).Count(&count).Error; err != nil {
			return "", err
		}
		if count == 0 {
			return candidate, nil
		}
	}
	return "", errors.New("failed to generate unique username")
}

func (ac *AuthController) FinishGoogleOAuth(c *gin.Context) {
	if oauthError := strings.TrimSpace(c.Query("error")); oauthError != "" {
		redirectGoogleError(c, "Login Google dibatalkan")
		return
	}
	state, err := parseGoogleState(c.Query("state"))
	if err != nil {
		redirectGoogleError(c, "Sesi login Google tidak valid atau kedaluwarsa")
		return
	}
	cookieNonce, cookieErr := c.Cookie(googleStateCookie)
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(googleStateCookie, "", -1, "/api/auth/google/callback", "", strings.HasPrefix(strings.ToLower(state.CallbackURL), "https://"), true)
	if cookieErr != nil || !hmac.Equal([]byte(cookieNonce), []byte(state.Nonce)) {
		redirectGoogleError(c, "Sesi browser untuk login Google tidak cocok")
		return
	}
	code := strings.TrimSpace(c.Query("code"))
	if code == "" {
		redirectGoogleError(c, "Google tidak mengirimkan kode login")
		return
	}
	accessToken, err := exchangeGoogleCode(c.Request.Context(), code, state.CallbackURL)
	if err != nil {
		redirectGoogleError(c, "Gagal memverifikasi login ke Google")
		return
	}
	googleUser, err := fetchGoogleUser(c.Request.Context(), accessToken)
	if err != nil {
		redirectGoogleError(c, "Akun Google tidak memiliki email terverifikasi")
		return
	}
	tenantID, err := uuid.Parse(state.TenantID)
	if err != nil {
		redirectGoogleError(c, "Tenant login Google tidak valid")
		return
	}

	db := ac.DB.Session(&gorm.Session{}).Set("skip_tenant_scope", true).WithContext(c.Request.Context())
	var user model.User
	var handoff string
	err = db.Transaction(func(tx *gorm.DB) error {
		var identity model.OAuthIdentity
		identityErr := tx.Where("provider = ? AND provider_subject = ?", "google", googleUser.Subject).First(&identity).Error
		switch {
		case identityErr == nil:
			if err := tx.Where("id = ? AND status = ?", identity.UserID, common.UserStatusEnabled).First(&user).Error; err != nil {
				return err
			}
		case errors.Is(identityErr, gorm.ErrRecordNotFound):
			userErr := tx.Where("LOWER(email) = ?", googleUser.Email).First(&user).Error
			if errors.Is(userErr, gorm.ErrRecordNotFound) {
				username, usernameErr := uniqueGoogleUsername(tx, googleUser.Email)
				if usernameErr != nil {
					return usernameErr
				}
				password, passwordErr := common.Password2Hash(uuid.NewString() + uuid.NewString())
				if passwordErr != nil {
					return passwordErr
				}
				name := strings.TrimSpace(googleUser.Name)
				if name == "" {
					name = strings.Split(googleUser.Email, "@")[0]
				}
				user = model.User{Username: username, Password: password, DisplayName: name, Email: googleUser.Email, Role: common.RoleCommonUser, Status: common.UserStatusEnabled, TenantID: &tenantID}
				if err := tx.Create(&user).Error; err != nil {
					return err
				}
			} else if userErr != nil {
				return userErr
			}
			if user.Status != common.UserStatusEnabled {
				return errors.New("google account is linked to a disabled user")
			}
			if user.TenantID == nil || *user.TenantID != tenantID {
				return errors.New("google account belongs to another tenant")
			}
			identity = model.OAuthIdentity{UserID: user.ID, Provider: "google", ProviderSubject: googleUser.Subject, Email: googleUser.Email, TenantID: &tenantID}
			if err := tx.Create(&identity).Error; err != nil {
				return err
			}
		default:
			return identityErr
		}
		if user.TenantID == nil || *user.TenantID != tenantID {
			return errors.New("google account belongs to another tenant")
		}
		if googleUser.Picture != "" {
			if err := tx.Model(&model.Profile{}).Where("user_id = ? AND (avatar_url = '' OR avatar_url IS NULL)", user.ID).Update("avatar_url", googleUser.Picture).Error; err != nil {
				return err
			}
		}
		var handoffErr error
		handoff, _, handoffErr = createAuthHandoff(tx, user.ID, &tenantID)
		return handoffErr
	})
	if err != nil {
		redirectGoogleError(c, "Akun Google tidak dapat ditautkan ke akun buyer")
		return
	}

	params := url.Values{"handoff": {handoff}, "redirect": {safeGoogleRedirect(state.Redirect)}}
	c.Redirect(http.StatusFound, googleFrontendURL()+"/auth/google/callback?"+params.Encode())
}
