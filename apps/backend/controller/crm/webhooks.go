package crm

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"gin-template/model"
	crmmodel "gin-template/model/crm"

	"github.com/gin-gonic/gin"
)

func (h *Controller) VerifyAdWebhook(c *gin.Context) {
	provider := c.Param("provider")
	if provider != "meta_ads" {
		c.JSON(http.StatusNotFound, gin.H{"error": "webhook provider not found"})
		return
	}
	integration, secrets, err := webhookIntegration(c, provider)
	if err != nil || !integration.Enabled || c.Query("hub.mode") != "subscribe" || !hmac.Equal([]byte(c.Query("hub.verify_token")), []byte(secrets["webhook_verify_token"])) {
		c.JSON(http.StatusForbidden, gin.H{"error": "webhook verification failed"})
		return
	}
	c.String(http.StatusOK, c.Query("hub.challenge"))
}

func (h *Controller) ReceiveAdWebhook(c *gin.Context) {
	provider := c.Param("provider")
	if provider != "meta_ads" && provider != "tiktok_ads" {
		c.JSON(http.StatusNotFound, gin.H{"error": "webhook provider not found"})
		return
	}
	integration, secrets, err := webhookIntegration(c, provider)
	if err != nil || !integration.Enabled {
		c.JSON(http.StatusForbidden, gin.H{"error": "integration is not enabled"})
		return
	}
	body, err := io.ReadAll(io.LimitReader(c.Request.Body, 2*1024*1024))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid webhook payload"})
		return
	}
	if !validWebhookSignature(c, provider, body, secrets) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid webhook signature"})
		return
	}
	var leads []crmmodel.Lead
	if provider == "meta_ads" {
		leads, err = fetchMetaWebhookLeads(c, integration, secrets, body)
	} else {
		leads, err = parseTikTokWebhookLeads(body)
	}
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	db := model.GetDB(c).WithContext(c.Request.Context())
	created, duplicates := 0, 0
	for i := range leads {
		lead := &leads[i]
		if lead.ExternalID != "" {
			var count int64
			if err := db.Model(&crmmodel.Lead{}).Where("source = ? AND external_id = ?", lead.Source, lead.ExternalID).Count(&count).Error; err != nil {
				continue
			}
			if count > 0 {
				duplicates++
				continue
			}
		}
		if lead.Name == "" {
			lead.Name = firstNonEmpty(lead.Email, lead.Phone, "Advertising lead")
		}
		if err := prepareLead(db, lead); err != nil {
			continue
		}
		if err := db.Create(lead).Error; err == nil {
			created++
		}
	}
	c.JSON(http.StatusOK, gin.H{"received": len(leads), "created": created, "duplicates": duplicates})
}

func webhookIntegration(c *gin.Context, provider string) (crmmodel.Integration, map[string]string, error) {
	var integration crmmodel.Integration
	err := model.GetDB(c).WithContext(c.Request.Context()).Where("provider = ?", provider).First(&integration).Error
	if err != nil {
		return integration, nil, err
	}
	secrets, err := decryptIntegrationSecrets(integration)
	return integration, secrets, err
}

func validWebhookSignature(c *gin.Context, provider string, body []byte, secrets map[string]string) bool {
	if provider == "meta_ads" {
		appSecret := secrets["app_secret"]
		signature := strings.TrimPrefix(c.GetHeader("X-Hub-Signature-256"), "sha256=")
		if appSecret == "" || signature == "" {
			return false
		}
		provided, err := hex.DecodeString(signature)
		if err != nil {
			return false
		}
		mac := hmac.New(sha256.New, []byte(appSecret))
		_, _ = mac.Write(body)
		return hmac.Equal(provided, mac.Sum(nil))
	}
	provided := c.GetHeader("X-CRM-Webhook-Secret")
	if provided == "" {
		provided = c.Query("webhook_secret")
	}
	return secrets["webhook_secret"] != "" && hmac.Equal([]byte(provided), []byte(secrets["webhook_secret"]))
}

func fetchMetaWebhookLeads(c *gin.Context, integration crmmodel.Integration, secrets map[string]string, body []byte) ([]crmmodel.Lead, error) {
	var webhook struct {
		Entry []struct {
			Changes []struct {
				Field string `json:"field"`
				Value struct {
					LeadgenID string `json:"leadgen_id"`
				} `json:"value"`
			} `json:"changes"`
		} `json:"entry"`
	}
	if err := json.Unmarshal(body, &webhook); err != nil {
		return nil, fmt.Errorf("invalid Meta webhook payload")
	}
	var config map[string]interface{}
	_ = json.Unmarshal(integration.Config, &config)
	version := strings.TrimSpace(fmt.Sprint(config["api_version"]))
	if version == "" {
		version = "v24.0"
	}
	client := &http.Client{Timeout: 6 * time.Second}
	leads := make([]crmmodel.Lead, 0)
	for _, entry := range webhook.Entry {
		for _, change := range entry.Changes {
			if change.Field != "leadgen" || change.Value.LeadgenID == "" {
				continue
			}
			endpoint := "https://graph.facebook.com/" + url.PathEscape(version) + "/" + url.PathEscape(change.Value.LeadgenID) + "?fields=created_time,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,field_data&access_token=" + url.QueryEscape(secrets["access_token"])
			request, _ := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, endpoint, nil)
			response, err := client.Do(request)
			if err != nil {
				return nil, fmt.Errorf("failed to retrieve Meta lead")
			}
			var detail struct {
				ID           string `json:"id"`
				CampaignName string `json:"campaign_name"`
				AdName       string `json:"ad_name"`
				FieldData    []struct {
					Name   string   `json:"name"`
					Values []string `json:"values"`
				} `json:"field_data"`
			}
			decodeErr := json.NewDecoder(io.LimitReader(response.Body, 1024*1024)).Decode(&detail)
			response.Body.Close()
			if response.StatusCode < 200 || response.StatusCode >= 300 || decodeErr != nil {
				return nil, fmt.Errorf("Meta lead retrieval returned HTTP %d", response.StatusCode)
			}
			fields := make(map[string]string)
			for _, field := range detail.FieldData {
				if len(field.Values) > 0 {
					fields[strings.ToLower(field.Name)] = field.Values[0]
				}
			}
			leads = append(leads, crmmodel.Lead{
				ExternalID: detail.ID, Name: firstNonEmpty(fields["full_name"], strings.TrimSpace(fields["first_name"]+" "+fields["last_name"])),
				Email: fields["email"], Phone: firstNonEmpty(fields["phone_number"], fields["phone"]), CompanyName: fields["company_name"],
				Region: firstNonEmpty(fields["city"], fields["state"], fields["province"]), ProductInterest: firstNonEmpty(fields["product"], fields["product_interest"]),
				Source: "meta_ads", SourceDetail: firstNonEmpty(detail.AdName, detail.CampaignName), UTMCampaign: detail.CampaignName,
			})
		}
	}
	return leads, nil
}

func parseTikTokWebhookLeads(body []byte) ([]crmmodel.Lead, error) {
	var payload interface{}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("invalid TikTok webhook payload")
	}
	objects := collectLeadObjects(payload)
	leads := make([]crmmodel.Lead, 0, len(objects))
	for _, data := range objects {
		leads = append(leads, crmmodel.Lead{
			ExternalID: mapString(data, "lead_id", "leadgen_id", "id"), Name: mapString(data, "full_name", "name"),
			Email: mapString(data, "email"), Phone: mapString(data, "phone_number", "phone"), CompanyName: mapString(data, "company_name", "company"),
			Region: mapString(data, "city", "region", "province"), ProductInterest: mapString(data, "product_interest", "product"),
			Source: "tiktok_ads", SourceDetail: mapString(data, "ad_name", "form_name"), UTMCampaign: mapString(data, "campaign_name"), TTCLID: mapString(data, "ttclid"),
		})
	}
	return leads, nil
}

func collectLeadObjects(value interface{}) []map[string]interface{} {
	switch typed := value.(type) {
	case []interface{}:
		result := make([]map[string]interface{}, 0)
		for _, item := range typed {
			result = append(result, collectLeadObjects(item)...)
		}
		return result
	case map[string]interface{}:
		for _, key := range []string{"leads", "data", "lead_data", "event"} {
			if nested, ok := typed[key]; ok {
				if result := collectLeadObjects(nested); len(result) > 0 {
					return result
				}
			}
		}
		return []map[string]interface{}{typed}
	default:
		return nil
	}
}

func mapString(values map[string]interface{}, keys ...string) string {
	for _, key := range keys {
		if value := strings.TrimSpace(fmt.Sprint(values[key])); value != "" && value != "<nil>" {
			return value
		}
	}
	return ""
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}
