package services

import (
	"strconv"
	"strings"
)

func formatIDR(amount float64) string {
	// Konversi ke string tanpa desimal
	amountStr := strconv.FormatFloat(amount, 'f', 0, 64)

	// Tambahkan pemisah ribuan (titik)
	var result []rune
	for i, digit := range amountStr {
		if i > 0 && (len(amountStr)-i)%3 == 0 {
			result = append(result, '.')
		}
		result = append(result, digit)
	}

	return string(result)
}

func formatRibuanTanpaRp(amount float64) string {
	return formatIDR(amount)
}

// --- Structs ---
type PaymentResult struct {
	TransactionID string  `json:"transaction_id"`
	InvoiceUrl    string  `json:"invoice_url,omitempty"`
	PaymentType   string  `json:"payment_type"`
	PaymentNumber string  `json:"payment_number"`
	QRCodeBase64  string  `json:"qr_code_base64,omitempty"`
	ExpiryDate    string  `json:"expiry_date"`
	HandlingFee   float64 `json:"handling_fee"`
	AdminFee      float64 `json:"admin_fee"`
	FinalAmount   float64 `json:"final_amount,omitempty"`
}

func splitName(fullName string) (firstName, lastName string) {
	// Trim whitespace
	fullName = strings.TrimSpace(fullName)

	// Split berdasarkan spasi
	parts := strings.Fields(fullName)

	if len(parts) == 0 {
		return "", ""
	}

	if len(parts) == 1 {
		// Jika hanya satu kata, jadikan sebagai first name
		return parts[0], parts[0]
	}

	// First name adalah kata pertama
	firstName = parts[0]

	// Last name adalah gabungan kata sisanya
	lastName = strings.Join(parts[1:], " ")

	return firstName, lastName
}

const (
	FeeQrisPercent = 0.0072 // 0.72%
	FeeVaFlat      = 5000.0
	FeeHandling    = 10000.0
)

