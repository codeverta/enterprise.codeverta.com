package crm

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"gin-template/model"
	crmmodel "gin-template/model/crm"

	"github.com/gin-gonic/gin"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type integrationResponse struct {
	ID         interface{}     `json:"id,omitempty"`
	Provider   string          `json:"provider"`
	Enabled    bool            `json:"enabled"`
	Config     json.RawMessage `json:"config"`
	HasSecrets bool            `json:"has_secrets"`
	LastSyncAt *time.Time      `json:"last_sync_at"`
	LastError  string          `json:"last_error,omitempty"`
}

func integrationView(value crmmodel.Integration) integrationResponse {
	config := json.RawMessage(value.Config)
	if len(config) == 0 {
		config = json.RawMessage(`{}`)
	}
	return integrationResponse{
		ID: value.ID, Provider: value.Provider, Enabled: value.Enabled, Config: config,
		HasSecrets: value.SecretEncrypted != "", LastSyncAt: value.LastSyncAt, LastError: value.LastError,
	}
}

func (h *Controller) ListIntegrations(c *gin.Context) {
	db := model.GetDB(c).WithContext(c.Request.Context())
	var rows []crmmodel.Integration
	if err := db.Order("provider ASC").Find(&rows).Error; err != nil {
		writeDBError(c, err)
		return
	}
	byProvider := make(map[string]crmmodel.Integration, len(rows))
	for _, row := range rows {
		byProvider[row.Provider] = row
	}
	result := make([]integrationResponse, 0, 4)
	for _, provider := range []string{"google_analytics", "meta_ads", "tiktok_ads", "meta_messaging"} {
		if row, ok := byProvider[provider]; ok {
			result = append(result, integrationView(row))
		} else if provider == "meta_messaging" && metaMessagingEnvConfigured() {
			config, _ := json.Marshal(metaMessagingEnvConfig())
			result = append(result, integrationResponse{Provider: provider, Enabled: true, Config: config, HasSecrets: true})
		} else {
			result = append(result, integrationResponse{Provider: provider, Config: json.RawMessage(`{}`)})
		}
	}
	c.JSON(http.StatusOK, result)
}

func (h *Controller) UpdateIntegration(c *gin.Context) {
	provider := c.Param("provider")
	if provider != "google_analytics" && provider != "meta_ads" && provider != "tiktok_ads" && provider != "meta_messaging" {
		c.JSON(http.StatusNotFound, gin.H{"error": "integration provider not found"})
		return
	}
	var input struct {
		Enabled bool                   `json:"enabled"`
		Config  map[string]interface{} `json:"config"`
		Secrets map[string]string      `json:"secrets"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	configJSON, err := json.Marshal(input.Config)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid integration config"})
		return
	}
	db := model.GetDB(c).WithContext(c.Request.Context())
	var integration crmmodel.Integration
	err = db.Where("provider = ?", provider).First(&integration).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		integration.Provider = provider
	} else if err != nil {
		writeDBError(c, err)
		return
	}
	integration.Enabled = input.Enabled
	integration.Config = datatypes.JSON(configJSON)
	if len(input.Secrets) > 0 {
		if len(os.Getenv("DB_ENCRYPTION_KEY")) != 32 {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "DB_ENCRYPTION_KEY must be configured before saving CRM credentials"})
			return
		}
		mergedSecrets := make(map[string]string)
		if integration.SecretEncrypted != "" {
			if existing, decryptErr := decryptIntegrationSecrets(integration); decryptErr == nil {
				for key, value := range existing {
					mergedSecrets[key] = value
				}
			}
		}
		for key, value := range input.Secrets {
			if strings.TrimSpace(value) != "" {
				mergedSecrets[key] = value
			}
		}
		secretJSON, _ := json.Marshal(mergedSecrets)
		encrypted, encryptErr := model.Encrypt(string(secretJSON))
		if encryptErr != nil {
			writeDBError(c, encryptErr)
			return
		}
		integration.SecretEncrypted = encrypted
	}
	if integration.ID.String() == "00000000-0000-0000-0000-000000000000" {
		err = db.Create(&integration).Error
	} else {
		err = db.Save(&integration).Error
	}
	if err != nil {
		writeDBError(c, err)
		return
	}
	c.JSON(http.StatusOK, integrationView(integration))
}

func metaMessagingEnvConfig() map[string]interface{} {
	return map[string]interface{}{
		"api_version":              firstNonEmpty(os.Getenv("META_GRAPH_API_VERSION"), "v24.0"),
		"whatsapp_phone_number_id": strings.TrimSpace(os.Getenv("META_WHATSAPP_PHONE_NUMBER_ID")),
		"facebook_page_id":         strings.TrimSpace(os.Getenv("META_FACEBOOK_PAGE_ID")),
		"instagram_account_id":     strings.TrimSpace(os.Getenv("META_INSTAGRAM_ACCOUNT_ID")),
	}
}

func metaMessagingEnvSecrets() map[string]string {
	return map[string]string{
		"access_token":           strings.TrimSpace(os.Getenv("META_ACCESS_TOKEN")),
		"whatsapp_access_token":  strings.TrimSpace(os.Getenv("META_WHATSAPP_ACCESS_TOKEN")),
		"facebook_access_token":  strings.TrimSpace(os.Getenv("META_FACEBOOK_PAGE_ACCESS_TOKEN")),
		"instagram_access_token": strings.TrimSpace(os.Getenv("META_INSTAGRAM_ACCESS_TOKEN")),
		"app_secret":             strings.TrimSpace(os.Getenv("META_APP_SECRET")),
		"webhook_verify_token":   strings.TrimSpace(os.Getenv("META_WEBHOOK_VERIFY_TOKEN")),
	}
}

func metaMessagingEnvConfigured() bool {
	secrets := metaMessagingEnvSecrets()
	hasAccessToken := secrets["access_token"] != "" || secrets["whatsapp_access_token"] != "" || secrets["facebook_access_token"] != "" || secrets["instagram_access_token"] != ""
	return hasAccessToken && secrets["app_secret"] != "" && secrets["webhook_verify_token"] != ""
}

func metaMessagingCredentials(c *gin.Context) (crmmodel.Integration, map[string]string, error) {
	var integration crmmodel.Integration
	err := model.GetDB(c).WithContext(c.Request.Context()).Where("provider = ?", "meta_messaging").First(&integration).Error
	if err == nil {
		if !integration.Enabled {
			return integration, nil, fmt.Errorf("Meta Messaging integration is disabled")
		}
		secrets, decryptErr := decryptIntegrationSecrets(integration)
		return integration, secrets, decryptErr
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) || !metaMessagingEnvConfigured() {
		return integration, nil, err
	}
	config, _ := json.Marshal(metaMessagingEnvConfig())
	integration.Provider = "meta_messaging"
	integration.Enabled = true
	integration.Config = datatypes.JSON(config)
	return integration, metaMessagingEnvSecrets(), nil
}

func dispatchLeadCreated(db *gorm.DB, lead *crmmodel.Lead) {
	var integrations []crmmodel.Integration
	if err := db.Where("enabled = ?", true).Find(&integrations).Error; err != nil {
		return
	}
	for i := range integrations {
		integration := integrations[i]
		ctx, cancel := context.WithTimeout(context.Background(), 4*time.Second)
		err := sendLeadEvent(ctx, integration, lead)
		cancel()
		now := time.Now()
		updates := map[string]interface{}{"last_sync_at": &now, "last_error": ""}
		if err != nil {
			updates["last_error"] = err.Error()
		}
		_ = db.Model(&integration).Updates(updates).Error
	}
}

func sendLeadEvent(ctx context.Context, integration crmmodel.Integration, lead *crmmodel.Lead) error {
	secrets, err := decryptIntegrationSecrets(integration)
	if err != nil {
		return err
	}
	var config map[string]interface{}
	if err := json.Unmarshal(integration.Config, &config); err != nil {
		return fmt.Errorf("invalid integration config")
	}
	switch integration.Provider {
	case "google_analytics":
		return sendGoogleLead(ctx, config, secrets, lead)
	case "meta_ads":
		return sendMetaLead(ctx, config, secrets, lead)
	case "tiktok_ads":
		return sendTikTokLead(ctx, config, secrets, lead)
	default:
		return fmt.Errorf("unsupported provider")
	}
}

func decryptIntegrationSecrets(integration crmmodel.Integration) (map[string]string, error) {
	if integration.SecretEncrypted == "" {
		return nil, fmt.Errorf("credentials are not configured")
	}
	if len(os.Getenv("DB_ENCRYPTION_KEY")) != 32 {
		return nil, fmt.Errorf("DB_ENCRYPTION_KEY is not configured")
	}
	plaintext, err := model.Decrypt(integration.SecretEncrypted)
	if err != nil {
		return nil, fmt.Errorf("cannot decrypt credentials")
	}
	var result map[string]string
	if err := json.Unmarshal([]byte(plaintext), &result); err != nil {
		return nil, fmt.Errorf("invalid encrypted credentials")
	}
	return result, nil
}

func sendGoogleLead(ctx context.Context, config map[string]interface{}, secrets map[string]string, lead *crmmodel.Lead) error {
	measurementID := strings.TrimSpace(fmt.Sprint(config["measurement_id"]))
	apiSecret := strings.TrimSpace(secrets["api_secret"])
	if measurementID == "" || apiSecret == "" {
		return fmt.Errorf("measurement_id and api_secret are required")
	}
	clientID := lead.AnalyticsClientID
	if clientID == "" {
		clientID = lead.ID.String()
	}
	payload := map[string]interface{}{
		"client_id": clientID,
		"events": []interface{}{map[string]interface{}{"name": "generate_lead", "params": map[string]interface{}{
			"lead_source": lead.Source, "lead_score": lead.Score, "campaign_name": lead.UTMCampaign,
		}}},
	}
	endpoint := "https://www.google-analytics.com/mp/collect?measurement_id=" + url.QueryEscape(measurementID) + "&api_secret=" + url.QueryEscape(apiSecret)
	return postJSON(ctx, endpoint, nil, payload)
}

func sendMetaLead(ctx context.Context, config map[string]interface{}, secrets map[string]string, lead *crmmodel.Lead) error {
	pixelID := strings.TrimSpace(fmt.Sprint(config["pixel_id"]))
	version := strings.TrimSpace(fmt.Sprint(config["api_version"]))
	if version == "" {
		version = "v24.0"
	}
	if pixelID == "" || secrets["access_token"] == "" {
		return fmt.Errorf("pixel_id and access_token are required")
	}
	userData := map[string]interface{}{}
	if lead.Email != "" {
		userData["em"] = []string{sha256Hex(strings.ToLower(strings.TrimSpace(lead.Email)))}
	}
	if lead.Phone != "" {
		userData["ph"] = []string{sha256Hex(normalizePhone(lead.Phone))}
	}
	payload := map[string]interface{}{"data": []interface{}{map[string]interface{}{
		"event_name": "Lead", "event_time": time.Now().Unix(), "event_id": lead.ID.String(),
		"action_source": "website", "user_data": userData,
		"custom_data": map[string]interface{}{"lead_source": lead.Source, "lead_score": lead.Score},
	}}}
	endpoint := "https://graph.facebook.com/" + url.PathEscape(version) + "/" + url.PathEscape(pixelID) + "/events?access_token=" + url.QueryEscape(secrets["access_token"])
	return postJSON(ctx, endpoint, nil, payload)
}

func sendTikTokLead(ctx context.Context, config map[string]interface{}, secrets map[string]string, lead *crmmodel.Lead) error {
	pixelCode := strings.TrimSpace(fmt.Sprint(config["pixel_code"]))
	accessToken := strings.TrimSpace(secrets["access_token"])
	if pixelCode == "" || accessToken == "" {
		return fmt.Errorf("pixel_code and access_token are required")
	}
	userData := map[string]interface{}{}
	if lead.Email != "" {
		userData["email"] = sha256Hex(strings.ToLower(strings.TrimSpace(lead.Email)))
	}
	if lead.Phone != "" {
		userData["phone_number"] = sha256Hex(normalizePhone(lead.Phone))
	}
	payload := map[string]interface{}{
		"pixel_code": pixelCode, "event": "SubmitForm", "event_id": lead.ID.String(),
		"timestamp":  time.Now().UTC().Format(time.RFC3339),
		"context":    map[string]interface{}{"user": userData},
		"properties": map[string]interface{}{"lead_source": lead.Source, "lead_score": lead.Score},
	}
	return postJSON(ctx, "https://business-api.tiktok.com/open_api/v1.3/event/track/", map[string]string{"Access-Token": accessToken}, payload)
}

func postJSON(ctx context.Context, endpoint string, headers map[string]string, payload interface{}) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", "application/json")
	for key, value := range headers {
		request.Header.Set(key, value)
	}
	response, err := (&http.Client{Timeout: 4 * time.Second}).Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return fmt.Errorf("provider returned HTTP %d", response.StatusCode)
	}
	return nil
}

func sha256Hex(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}

func normalizePhone(value string) string {
	return strings.Map(func(r rune) rune {
		if r >= '0' && r <= '9' || r == '+' {
			return r
		}
		return -1
	}, value)
}
