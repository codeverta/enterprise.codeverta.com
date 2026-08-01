package controller

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"time"

	"gin-template/common" // Import model package
	"gin-template/model"  // Import model package

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// SESWebhookController handles Tencent SES callbacks
type SESWebhookController struct {
	db             *gorm.DB
	discordWebhook string
	enabledEvents  map[string]bool
}

// NewSESWebhookController creates a new SES webhook controller
func NewSESWebhookController(db *gorm.DB, discordWebhookURL string) *SESWebhookController {
	return &SESWebhookController{
		db:             db,
		discordWebhook: discordWebhookURL,
		enabledEvents: map[string]bool{
			"delivered":   true,
			"bounce":      true,
			"open":        false,
			"click":       false,
			"unsubscribe": true,
			"reject":      true,
		},
	}
}

// TencentSESCallback represents the callback data from Tencent SES
type TencentSESCallback struct {
	Event      string `json:"event"`
	Email      string `json:"email"`
	Timestamp  int64  `json:"timestamp"`
	Reason     string `json:"reason,omitempty"`
	ClickURL   string `json:"clickUrl,omitempty"`
	BounceType string `json:"bounceType,omitempty"`
	Subject    string `json:"subject,omitempty"`
	MessageID  string `json:"messageId,omitempty"`
}

// HandleSESCallback processes Tencent SES callback and sends to Discord
func (ctrl *SESWebhookController) HandleSESCallback(c *gin.Context) {
	var callback TencentSESCallback

	// Parse JSON body
	if err := c.ShouldBindJSON(&callback); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body",
		})
		return
	}

	// Log callback untuk debugging
	fmt.Printf("Received SES Callback: %+v\n", callback)

	// Simpan log ke database terlebih dahulu
	if err := ctrl.saveCallbackLog(callback); err != nil {
		fmt.Printf("Error saving callback log: %v\n", err)
		// Lanjutkan kirim ke Discord meskipun gagal save log
	}

	if enabled, ok := ctrl.enabledEvents[callback.Event]; !ok || !enabled {
		c.JSON(http.StatusOK, gin.H{
			"message": fmt.Sprintf("Event %s is disabled, skipped Discord notification", callback.Event),
		})
		return
	}
	// Buat Discord embed
	embed := ctrl.createDiscordEmbed(callback)
	if err := ctrl.sendToDiscord(embed); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "Discord notification failed"})
		return
	}
	// Kirim ke Discord
	if err := ctrl.sendToDiscord(embed); err != nil {
		fmt.Printf("Error sending to Discord: %v\n", err)
		// Tetap return 200 agar Tencent tidak retry terus
		c.JSON(http.StatusOK, gin.H{
			"message": "Callback received but Discord notification failed",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Callback processed successfully",
	})
}

// createDiscordEmbed creates a Discord embed based on SES event type
func (ctrl *SESWebhookController) createDiscordEmbed(callback TencentSESCallback) common.DiscordWebhook {
	var color int
	var title string
	var emoji string

	// Set color dan emoji berdasarkan event type
	switch callback.Event {
	case "delivered":
		color = 0x00ff00 // Hijau
		emoji = "✅"
		title = "Email Delivered"
	case "bounce":
		color = 0xff0000 // Merah
		emoji = "❌"
		title = "Email Bounced"
	case "open":
		color = 0x0099ff // Biru
		emoji = "👁️"
		title = "Email Opened"
	case "click":
		color = 0xff9900 // Orange
		emoji = "🖱️"
		title = "Link Clicked"
	case "unsubscribe":
		color = 0x999999 // Abu-abu
		emoji = "🚫"
		title = "Unsubscribed"
	case "reject":
		color = 0xff0000 // Merah
		emoji = "⛔"
		title = "Email Rejected"
	default:
		color = 0x808080 // Default abu-abu
		emoji = "📧"
		title = fmt.Sprintf("Email Event: %s", callback.Event)
	}

	// Buat fields
	fields := []common.DiscordEmbedField{
		{
			Name:   "Recipient",
			Value:  callback.Email,
			Inline: true,
		},
		{
			Name:   "Event Type",
			Value:  callback.Event,
			Inline: true,
		},
	}

	// Tambahkan subject jika ada
	if callback.Subject != "" {
		fields = append(fields, common.DiscordEmbedField{
			Name:   "Subject",
			Value:  callback.Subject,
			Inline: false,
		})
	}

	// Tambahkan timestamp
	if callback.Timestamp > 0 {
		eventTime := time.Unix(callback.Timestamp, 0)
		fields = append(fields, common.DiscordEmbedField{
			Name:   "Time",
			Value:  eventTime.Format("2006-01-02 15:04:05 MST"),
			Inline: false,
		})
	}

	// Tambahkan reason jika ada (untuk bounce/reject)
	if callback.Reason != "" {
		fields = append(fields, common.DiscordEmbedField{
			Name:   "Reason",
			Value:  callback.Reason,
			Inline: false,
		})
	}

	// Tambahkan bounce type jika ada
	if callback.BounceType != "" {
		fields = append(fields, common.DiscordEmbedField{
			Name:   "Bounce Type",
			Value:  callback.BounceType,
			Inline: true,
		})
	}

	// Tambahkan clicked URL jika ada
	if callback.ClickURL != "" {
		fields = append(fields, common.DiscordEmbedField{
			Name:   "Clicked URL",
			Value:  callback.ClickURL,
			Inline: false,
		})
	}

	// Tambahkan message ID jika ada
	if callback.MessageID != "" {
		fields = append(fields, common.DiscordEmbedField{
			Name:   "Message ID",
			Value:  fmt.Sprintf("`%s`", callback.MessageID),
			Inline: false,
		})
	}
	loc, _ := time.LoadLocation("Asia/Jakarta")
	embed := common.DiscordWebhook{
		Embeds: []common.DiscordEmbed{
			{
				Title:  fmt.Sprintf("%s %s", emoji, title),
				Color:  color,
				Fields: fields,
				Footer: &common.DiscordEmbedFooter{
					Text: "Malabar Trail Run - Tencent SES",
				},
				Timestamp: time.Now().UTC().In(loc).Format(time.RFC3339),
			},
		},
	}

	return embed
}

// sendToDiscord sends the embed to Discord webhook
func (ctrl *SESWebhookController) sendToDiscord(webhook common.DiscordWebhook) error {
	jsonData, err := json.Marshal(webhook)
	if err != nil {
		return fmt.Errorf("failed to marshal webhook: %w", err)
	}

	resp, err := http.Post(ctrl.discordWebhook, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to send webhook: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("discord webhook returned status: %d", resp.StatusCode)
	}

	return nil
}

// saveCallbackLog saves callback to database
func (ctrl *SESWebhookController) saveCallbackLog(callback TencentSESCallback) error {
	log := model.SESCallbackLog{
		Event:     callback.Event,
		Email:     callback.Email,
		Subject:   callback.Subject,
		Reason:    callback.Reason,
		ClickURL:  callback.ClickURL,
		MessageID: callback.MessageID,
		Timestamp: callback.Timestamp,
	}

	if err := ctrl.db.Create(&log).Error; err != nil {
		return fmt.Errorf("failed to save callback log: %w", err)
	}

	return nil
}

// GetCallbackLogs retrieves SES callback logs
func (ctrl *SESWebhookController) GetCallbackLogs(c *gin.Context) {
	var logs []model.SESCallbackLog

	// 1. Ambil Query Params
	page := c.DefaultQuery("page", "1")
	limit := c.DefaultQuery("limit", "10") // Default limit disesuaikan
	event := c.Query("event")              // Filter tipe event (Delivery, Bounce, dll)
	search := c.Query("search")            // Input pencarian

	db := model.GetDB(c)
	query := db.Set("skip_tenant_scope", true).Model(&model.SESCallbackLog{})
	query = query.Where("event = ?", event)

	// 2. Logic Filter
	if event != "" && event != "ALL" {
		query = query.Where("event = ?", event)
	}

	// 3. Logic Search (Cari berdasarkan Email atau Subject jika ada kolomnya)
	if search != "" {
		// Menggunakan ILIKE untuk case-insensitive (PostgreSQL)
		query = query.Where("email ILIKE ?", "%"+search+"%")
		// Jika ingin cari subject juga, gunakan:
		// query = query.Where("email ILIKE ? OR subject ILIKE ?", "%"+search+"%", "%"+search+"%")
	}

	// 4. Hitung Total Data (Untuk Pagination)
	var total int64
	query.Count(&total)

	// 5. Setup Pagination
	var pageInt, limitInt int
	fmt.Sscanf(page, "%d", &pageInt)
	fmt.Sscanf(limit, "%d", &limitInt)
	if pageInt < 1 {
		pageInt = 1
	}
	offset := (pageInt - 1) * limitInt

	// 6. Eksekusi Query
	if err := query.Order("created_at DESC").
		Limit(limitInt).
		Offset(offset).
		Find(&logs).Error; err != nil {
		zap.L().Fatal("Failed to fetch callback logs", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch logs"})
		return
	}

	ctx := common.RDB.Context()
	pendingCount, err := common.RDB.LLen(ctx, common.RDB.GetKey("bulk_email_queue")).Result()
	if err != nil {
		pendingCount = 0 // Jika redis error, anggap 0 agar tidak blocking UI
		// Opsional: Log error redis
	}
	// ------------------------------------

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    logs,
		"meta": gin.H{
			"current_page": pageInt,
			"total":        total,
			"per_page":     limitInt,
			"last_page":    int(math.Ceil(float64(total) / float64(limitInt))),

			// Tambahkan field ini untuk UX:
			"queue_pending": pendingCount,
			"is_processing": pendingCount > 0,
		},
	})
}

// GetCallbackLogByID retrieves a specific SES callback log by ID
func (ctrl *SESWebhookController) GetCallbackLogByID(c *gin.Context) {
	id := c.Param("id")

	var log model.SESCallbackLog
	if err := ctrl.db.First(&log, "id = ?", id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Log not found",
			})
			return
		}
		common.SysError("Failed to fetch callback log by ID" + err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to fetch log",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    log,
	})
}

// GetCallbackStats retrieves statistics of SES callbacks
func (ctrl *SESWebhookController) GetCallbackStats(c *gin.Context) {
	var stats []struct {
		Event string `json:"event"`
		Count int64  `json:"count"`
	}

	// Get count by event type
	if err := ctrl.db.Model(&model.SESCallbackLog{}).
		Select("event, COUNT(*) as count").
		Group("event").
		Order("count DESC").
		Find(&stats).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to fetch statistics",
		})
		return
	}

	// Get total count
	var total int64
	ctrl.db.Model(&model.SESCallbackLog{}).Count(&total)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"total":    total,
			"by_event": stats,
		},
	})
}
