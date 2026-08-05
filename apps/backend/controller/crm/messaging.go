package crm

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"gin-template/model"
	crmmodel "gin-template/model/crm"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type conversationView struct {
	crmmodel.Conversation
	LastMessage *crmmodel.Message `json:"last_message,omitempty"`
}

func (h *Controller) ListConversations(c *gin.Context) {
	db := model.GetDB(c).WithContext(c.Request.Context())
	query := db.Session(&gorm.Session{}).Model(&crmmodel.Conversation{})
	if channel := strings.TrimSpace(c.Query("channel")); channel != "" && channel != "all" {
		query = query.Where("channel = ?", channel)
	}
	if search := strings.TrimSpace(c.Query("q")); search != "" {
		like := "%" + search + "%"
		query = query.Where("participant_name LIKE ? OR external_participant_id LIKE ? OR preview LIKE ?", like, like, like)
	}
	var conversations []crmmodel.Conversation
	if err := query.Order("last_message_at DESC, created_at DESC").Limit(200).Find(&conversations).Error; err != nil {
		writeDBError(c, err)
		return
	}
	result := make([]conversationView, 0, len(conversations))
	for i := range conversations {
		view := conversationView{Conversation: conversations[i]}
		var message crmmodel.Message
		if err := db.Session(&gorm.Session{}).Where("conversation_id = ?", conversations[i].ID).Order("sent_at DESC").First(&message).Error; err == nil {
			view.LastMessage = &message
		}
		result = append(result, view)
	}
	c.JSON(http.StatusOK, result)
}

func (h *Controller) ListConversationMessages(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid conversation id"})
		return
	}
	db := model.GetDB(c).WithContext(c.Request.Context())
	var conversation crmmodel.Conversation
	if err := db.Session(&gorm.Session{}).First(&conversation, "id = ?", id).Error; err != nil {
		writeLookupError(c, err)
		return
	}
	pageSize := positiveInt(c.DefaultQuery("page_size", "100"), 100)
	if pageSize > 200 {
		pageSize = 200
	}
	var messages []crmmodel.Message
	if err := db.Session(&gorm.Session{}).Where("conversation_id = ?", id).Order("sent_at ASC").Limit(pageSize).Find(&messages).Error; err != nil {
		writeDBError(c, err)
		return
	}
	_ = db.Session(&gorm.Session{}).Model(&conversation).Update("unread_count", 0).Error
	c.JSON(http.StatusOK, messages)
}

func (h *Controller) SendConversationMessage(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid conversation id"})
		return
	}
	var input struct {
		Text string `json:"text" binding:"required,max=4096"`
	}
	if err := c.ShouldBindJSON(&input); err != nil || strings.TrimSpace(input.Text) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "text is required"})
		return
	}
	db := model.GetDB(c).WithContext(c.Request.Context())
	var conversation crmmodel.Conversation
	if err := db.Session(&gorm.Session{}).First(&conversation, "id = ?", id).Error; err != nil {
		writeLookupError(c, err)
		return
	}
	integration, secrets, err := metaMessagingCredentials(c)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Meta Messaging belum dikonfigurasi"})
		return
	}
	externalID, err := sendMetaChatMessage(c, integration, secrets, conversation, strings.TrimSpace(input.Text))
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	now := time.Now().UTC()
	message := crmmodel.Message{ConversationID: conversation.ID, ExternalID: externalID, Direction: "outbound", Type: "text", Text: strings.TrimSpace(input.Text), Status: "sent", SentAt: now}
	if err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&message).Error; err != nil {
			return err
		}
		return tx.Model(&conversation).Updates(map[string]interface{}{"preview": message.Text, "last_message_at": now}).Error
	}); err != nil {
		writeDBError(c, err)
		return
	}
	c.JSON(http.StatusCreated, message)
}

func sendMetaChatMessage(c *gin.Context, integration crmmodel.Integration, secrets map[string]string, conversation crmmodel.Conversation, text string) (string, error) {
	var config map[string]interface{}
	if err := json.Unmarshal(integration.Config, &config); err != nil {
		return "", fmt.Errorf("konfigurasi Meta Messaging tidak valid")
	}
	version := firstNonEmpty(strings.TrimSpace(fmt.Sprint(config["api_version"])), "v24.0")
	accessToken := strings.TrimSpace(secrets[conversation.Channel+"_access_token"])
	if conversation.Channel == "facebook" {
		accessToken = firstNonEmpty(accessToken, strings.TrimSpace(secrets["facebook_page_access_token"]))
	}
	accessToken = firstNonEmpty(accessToken, strings.TrimSpace(secrets["access_token"]))
	if accessToken == "" {
		return "", fmt.Errorf("META_ACCESS_TOKEN belum dikonfigurasi")
	}
	var endpoint string
	var payload interface{}
	switch conversation.Channel {
	case "whatsapp":
		accountID := firstNonEmpty(conversation.ExternalAccountID, strings.TrimSpace(fmt.Sprint(config["whatsapp_phone_number_id"])))
		if accountID == "" {
			return "", fmt.Errorf("WhatsApp phone number ID belum dikonfigurasi")
		}
		endpoint = fmt.Sprintf("https://graph.facebook.com/%s/%s/messages", url.PathEscape(version), url.PathEscape(accountID))
		payload = map[string]interface{}{"messaging_product": "whatsapp", "recipient_type": "individual", "to": conversation.ExternalParticipantID, "type": "text", "text": map[string]string{"body": text}}
	case "instagram", "facebook":
		accountID := conversation.ExternalAccountID
		if accountID == "" {
			key := "facebook_page_id"
			if conversation.Channel == "instagram" {
				key = "instagram_account_id"
			}
			accountID = strings.TrimSpace(fmt.Sprint(config[key]))
		}
		if accountID == "" {
			return "", fmt.Errorf("account ID %s belum dikonfigurasi", conversation.Channel)
		}
		endpoint = fmt.Sprintf("https://graph.facebook.com/%s/%s/messages", url.PathEscape(version), url.PathEscape(accountID))
		payload = map[string]interface{}{"recipient": map[string]string{"id": conversation.ExternalParticipantID}, "message": map[string]string{"text": text}}
	default:
		return "", fmt.Errorf("channel tidak didukung")
	}
	body, _ := json.Marshal(payload)
	request, err := http.NewRequestWithContext(c.Request.Context(), http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+accessToken)
	response, err := (&http.Client{Timeout: 8 * time.Second}).Do(request)
	if err != nil {
		return "", fmt.Errorf("gagal menghubungi Meta: %w", err)
	}
	defer response.Body.Close()
	responseBody, _ := io.ReadAll(io.LimitReader(response.Body, 1024*1024))
	var result struct {
		MessageID   string `json:"message_id"`
		RecipientID string `json:"recipient_id"`
		Messages    []struct {
			ID string `json:"id"`
		} `json:"messages"`
		Error *struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	_ = json.Unmarshal(responseBody, &result)
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		message := fmt.Sprintf("Meta mengembalikan HTTP %d", response.StatusCode)
		if result.Error != nil && result.Error.Message != "" {
			message = result.Error.Message
		}
		return "", fmt.Errorf("%s", message)
	}
	if len(result.Messages) > 0 {
		return result.Messages[0].ID, nil
	}
	if result.MessageID != "" {
		return result.MessageID, nil
	}
	return "meta-" + uuid.NewString(), nil
}

func (h *Controller) ReceiveMessagingWebhook(c *gin.Context) {
	integration, secrets, err := metaMessagingCredentials(c)
	if err != nil || !integration.Enabled {
		c.JSON(http.StatusForbidden, gin.H{"error": "Meta Messaging integration is not enabled"})
		return
	}
	body, err := io.ReadAll(io.LimitReader(c.Request.Body, 2*1024*1024))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid webhook payload"})
		return
	}
	if !validWebhookSignature(c, "meta_messaging", body, secrets) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid webhook signature"})
		return
	}
	var payload metaMessagingWebhook
	if err := json.Unmarshal(body, &payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid Meta Messaging payload"})
		return
	}
	db := model.GetDB(c).WithContext(c.Request.Context())
	received, updated := ingestMetaMessagingWebhook(db, payload)
	c.JSON(http.StatusOK, gin.H{"received": received, "updated": updated})
}

type metaMessagingWebhook struct {
	Object string `json:"object"`
	Entry  []struct {
		ID        string `json:"id"`
		Messaging []struct {
			Sender struct {
				ID string `json:"id"`
			} `json:"sender"`
			Recipient struct {
				ID string `json:"id"`
			} `json:"recipient"`
			Timestamp int64 `json:"timestamp"`
			Message   *struct {
				Mid         string `json:"mid"`
				Text        string `json:"text"`
				IsEcho      bool   `json:"is_echo"`
				Attachments []struct {
					Type    string `json:"type"`
					Payload struct {
						URL string `json:"url"`
					} `json:"payload"`
				} `json:"attachments"`
			} `json:"message"`
			Delivery *struct {
				Mids []string `json:"mids"`
			} `json:"delivery"`
			Read *struct {
				Watermark int64 `json:"watermark"`
			} `json:"read"`
		} `json:"messaging"`
		Changes []struct {
			Field string `json:"field"`
			Value struct {
				Metadata struct {
					PhoneNumberID string `json:"phone_number_id"`
				} `json:"metadata"`
				Contacts []struct {
					WAID    string `json:"wa_id"`
					Profile struct {
						Name string `json:"name"`
					} `json:"profile"`
				} `json:"contacts"`
				Messages []struct {
					From      string `json:"from"`
					ID        string `json:"id"`
					Timestamp string `json:"timestamp"`
					Type      string `json:"type"`
					Text      struct {
						Body string `json:"body"`
					} `json:"text"`
					Image struct {
						ID      string `json:"id"`
						Caption string `json:"caption"`
					} `json:"image"`
					Audio struct {
						ID string `json:"id"`
					} `json:"audio"`
					Video struct {
						ID      string `json:"id"`
						Caption string `json:"caption"`
					} `json:"video"`
					Document struct {
						ID       string `json:"id"`
						Filename string `json:"filename"`
						Caption  string `json:"caption"`
					} `json:"document"`
				} `json:"messages"`
				Statuses []struct {
					ID        string `json:"id"`
					Status    string `json:"status"`
					Timestamp string `json:"timestamp"`
				} `json:"statuses"`
			} `json:"value"`
		} `json:"changes"`
	} `json:"entry"`
}

func ingestMetaMessagingWebhook(db *gorm.DB, payload metaMessagingWebhook) (int, int) {
	received, updated := 0, 0
	if payload.Object == "whatsapp_business_account" {
		for _, entry := range payload.Entry {
			for _, change := range entry.Changes {
				for _, status := range change.Value.Statuses {
					if status.ID != "" && db.Session(&gorm.Session{}).Model(&crmmodel.Message{}).Where("external_id = ?", status.ID).Update("status", normalizeMessageStatus(status.Status)).RowsAffected > 0 {
						updated++
					}
				}
				for _, incoming := range change.Value.Messages {
					name := incoming.From
					for _, contact := range change.Value.Contacts {
						if contact.WAID == incoming.From && contact.Profile.Name != "" {
							name = contact.Profile.Name
						}
					}
					text, mediaURL := whatsappMessageContent(incoming)
					if storeInboundMessage(db, "whatsapp", change.Value.Metadata.PhoneNumberID, incoming.From, name, incoming.ID, incoming.Type, text, mediaURL, unixStringTime(incoming.Timestamp)) {
						received++
					}
				}
			}
		}
		return received, updated
	}
	channel := "facebook"
	if payload.Object == "instagram" {
		channel = "instagram"
	}
	for _, entry := range payload.Entry {
		for _, event := range entry.Messaging {
			if event.Delivery != nil {
				for _, mid := range event.Delivery.Mids {
					if db.Session(&gorm.Session{}).Model(&crmmodel.Message{}).Where("external_id = ?", mid).Update("status", "delivered").RowsAffected > 0 {
						updated++
					}
				}
				continue
			}
			if event.Read != nil {
				conversationIDs := db.Session(&gorm.Session{}).Model(&crmmodel.Conversation{}).Select("id").Where("channel = ? AND external_participant_id = ?", channel, event.Sender.ID)
				if db.Session(&gorm.Session{}).Model(&crmmodel.Message{}).Where("conversation_id IN (?) AND direction = ?", conversationIDs, "outbound").Update("status", "read").RowsAffected > 0 {
					updated++
				}
				continue
			}
			if event.Message == nil || event.Message.Mid == "" || event.Message.IsEcho {
				continue
			}
			messageType, text, mediaURL := "text", event.Message.Text, ""
			if len(event.Message.Attachments) > 0 {
				messageType = normalizeMessageType(event.Message.Attachments[0].Type)
				mediaURL = event.Message.Attachments[0].Payload.URL
			}
			if storeInboundMessage(db, channel, entry.ID, event.Sender.ID, event.Sender.ID, event.Message.Mid, messageType, text, mediaURL, unixMillisTime(event.Timestamp)) {
				received++
			}
		}
	}
	return received, updated
}

func storeInboundMessage(db *gorm.DB, channel, accountID, participantID, participantName, externalID, messageType, text, mediaURL string, sentAt time.Time) bool {
	if participantID == "" || externalID == "" {
		return false
	}
	var existing int64
	if db.Session(&gorm.Session{}).Model(&crmmodel.Message{}).Where("external_id = ?", externalID).Count(&existing).Error != nil || existing > 0 {
		return false
	}
	var conversation crmmodel.Conversation
	err := db.Session(&gorm.Session{}).Where("channel = ? AND external_account_id = ? AND external_participant_id = ?", channel, accountID, participantID).First(&conversation).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		conversation = crmmodel.Conversation{Channel: channel, ExternalAccountID: accountID, ExternalParticipantID: participantID, ParticipantName: participantName, Status: "open"}
		if err = db.Session(&gorm.Session{}).Create(&conversation).Error; err != nil {
			return false
		}
	} else if err != nil {
		return false
	}
	preview := strings.TrimSpace(text)
	if preview == "" {
		preview = "[" + normalizeMessageType(messageType) + "]"
	}
	message := crmmodel.Message{ConversationID: conversation.ID, ExternalID: externalID, Direction: "inbound", Type: normalizeMessageType(messageType), Text: text, MediaURL: mediaURL, Status: "received", SentAt: sentAt}
	return db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&message).Error; err != nil {
			return err
		}
		return tx.Model(&conversation).Updates(map[string]interface{}{"participant_name": firstNonEmpty(participantName, conversation.ParticipantName), "preview": preview, "last_message_at": sentAt, "unread_count": gorm.Expr("unread_count + 1")}).Error
	}) == nil
}

func whatsappMessageContent(message struct {
	From      string `json:"from"`
	ID        string `json:"id"`
	Timestamp string `json:"timestamp"`
	Type      string `json:"type"`
	Text      struct {
		Body string `json:"body"`
	} `json:"text"`
	Image struct {
		ID      string `json:"id"`
		Caption string `json:"caption"`
	} `json:"image"`
	Audio struct {
		ID string `json:"id"`
	} `json:"audio"`
	Video struct {
		ID      string `json:"id"`
		Caption string `json:"caption"`
	} `json:"video"`
	Document struct {
		ID       string `json:"id"`
		Filename string `json:"filename"`
		Caption  string `json:"caption"`
	} `json:"document"`
}) (string, string) {
	switch message.Type {
	case "text":
		return message.Text.Body, ""
	case "image":
		return message.Image.Caption, message.Image.ID
	case "audio":
		return "", message.Audio.ID
	case "video":
		return message.Video.Caption, message.Video.ID
	case "document":
		return firstNonEmpty(message.Document.Caption, message.Document.Filename), message.Document.ID
	}
	return "", ""
}

func normalizeMessageType(value string) string {
	switch strings.ToLower(value) {
	case "text", "image", "audio", "video", "file", "sticker":
		return strings.ToLower(value)
	case "document":
		return "file"
	default:
		return "unknown"
	}
}
func normalizeMessageStatus(value string) string {
	switch strings.ToLower(value) {
	case "sent", "delivered", "read", "failed":
		return strings.ToLower(value)
	default:
		return "sent"
	}
}
func unixStringTime(value string) time.Time {
	seconds, _ := strconv.ParseInt(value, 10, 64)
	if seconds <= 0 {
		return time.Now().UTC()
	}
	return time.Unix(seconds, 0).UTC()
}
func unixMillisTime(value int64) time.Time {
	if value <= 0 {
		return time.Now().UTC()
	}
	return time.UnixMilli(value).UTC()
}
