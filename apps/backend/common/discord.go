package common

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

// DiscordWebhook represents Discord webhook payload
type DiscordWebhook struct {
	Content string         `json:"content,omitempty"`
	Embeds  []DiscordEmbed `json:"embeds,omitempty"`
}

// DiscordEmbed represents a Discord embed
type DiscordEmbed struct {
	Title       string              `json:"title,omitempty"`
	Description string              `json:"description,omitempty"`
	Color       int                 `json:"color,omitempty"`
	Fields      []DiscordEmbedField `json:"fields,omitempty"`
	Footer      *DiscordEmbedFooter `json:"footer,omitempty"`
	Timestamp   string              `json:"timestamp,omitempty"`
}

// DiscordEmbedField represents a field in Discord embed
type DiscordEmbedField struct {
	Name   string `json:"name"`
	Value  string `json:"value"`
	Inline bool   `json:"inline,omitempty"`
}

// DiscordEmbedFooter represents footer in Discord embed
type DiscordEmbedFooter struct {
	Text string `json:"text"`
}

func StartDiscordWorker() {
	if !RedisEnabled {
		return
	}

	url := os.Getenv("DISCORD_WEBHOOK_URL")
	ctx := context.Background()

	for {
		// Blocking pop dari queue khusus discord
		result, err := RDB.BLPop(ctx, 0, "discord_queue").Result()
		if err != nil {
			time.Sleep(2 * time.Second)
			continue
		}

		var data struct {
			FullName  string  `json:"full_name"`
			Category  string  `json:"category"`
			Amount    float64 `json:"amount"`
			IsEB      bool    `json:"is_eb"`
			PromoCode string  `json:"promo_code"`
			Email     string  `json:"email"`
		}

		json.Unmarshal([]byte(result[1]), &data)

		// Konstruk Payload Embed
		ebStatus := "No"
		if data.IsEB {
			ebStatus = "✅ Yes"
		}

		promoCode := "None"
		if data.PromoCode != "" {
			promoCode = data.PromoCode
		}

		payload := DiscordWebhook{
			Embeds: []DiscordEmbed{
				{
					Title: "🏃 New Participant Registered!",
					Color: 0x3498db, // Biru
					Fields: []DiscordEmbedField{
						{Name: "Name", Value: data.FullName, Inline: true},
						{Name: "Category", Value: data.Category, Inline: true},
						{Name: "Early Bird", Value: ebStatus, Inline: true},
						{Name: "Promo", Value: promoCode, Inline: true},
						{Name: "Total Amount", Value: fmt.Sprintf("Rp %.0f", data.Amount), Inline: false},
					},
					Timestamp: time.Now().UTC().Format(time.RFC3339),
				},
			},
		}

		// Kirim HTTP Post (Sudah aman dilakukan di sini karena tidak mengganggu user)
		SendWebhook(url, payload)
	}
}

func SendWebhook(url string, payload interface{}) {
	jsonData, _ := json.Marshal(payload)
	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err == nil {
		defer resp.Body.Close()
	}
}

type ParticipantItem struct {
	Code      string `json:"Code"`
	Name      string `json:"Name"`
	Category  string `json:"Category"`
	BibName   string `json:"BibName"`
	Price     string `json:"Price"`     // Harga per orang (Formatted)
	PriceType string `json:"PriceType"` // "Early Bird" atau "Normal"
	Discount  string `json:"Discount"`  // Jika ada diskon per peserta
}
type PaymentSuccessEmailData struct {
	PICName            string            `json:"PICName"`
	OrderID            string            `json:"OrderID"`
	TotalOriginalPrice string            `json:"TotalOriginalPrice"` // Total sebelum diskon
	TotalDiscount      string            `json:"TotalDiscount"`      // Total potongan
	AdminFee           string            `json:"AdminFee"`
	HandlingFee        string            `json:"HandlingFee"`
	FinalAmount        string            `json:"FinalAmount"` // Yang dibayar
	PaidAt             string            `json:"PaidAt"`
	Participants       []ParticipantItem `json:"Participants"`
	LogoImageBase64    string            `json:"LogoImageBase64"`
}
