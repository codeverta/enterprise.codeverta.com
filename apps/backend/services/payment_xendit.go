package services

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"gin-template/model"
	"io"
	"math"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	qrcode "github.com/skip2/go-qrcode"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// bankVACodes adalah daftar metode yang menggunakan Xendit VA
var bankVACodes = map[string]bool{
	"BNI":     true,
	"BRI":     true,
	"MANDIRI": true,
	"PERMATA": true,
	"CIMB":    true,
	"BJB":     true,
}

func isBankVA(method string) bool {
	return bankVACodes[strings.ToUpper(method)]
}

// =========================================================
// XENDIT v3 API BASE URL
// =========================================================
const xenditBaseURL = "https://api.xendit.co"

// =========================================================
// STRUCT RESPONSE v3 (unified /payment_requests)
// =========================================================

type xenditV3Response struct {
	ID          string  `json:"id"`
	ReferenceID string  `json:"reference_id"`
	Status      string  `json:"status"` // PENDING, SUCCEEDED, FAILED, VOIDED
	Amount      float64 `json:"amount"`
	Currency    string  `json:"currency"`
	ErrorCode   string  `json:"error_code"`
	Message     string  `json:"message"`
	Actions     []struct {
		Action string `json:"action"`
		URL    string `json:"url"`
	} `json:"actions"`
	PaymentMethod struct {
		Type           string `json:"type"`
		Reusability    string `json:"reusability"`
		VirtualAccount struct {
			ChannelCode       string `json:"channel_code"`
			ChannelProperties struct {
				VirtualAccountNumber string `json:"virtual_account_number"`
				ExpiresAt            string `json:"expires_at"`
				CustomerName         string `json:"customer_name"`
			} `json:"channel_properties"`
		} `json:"virtual_account"`
		QrCode struct {
			ChannelCode       string `json:"channel_code"`
			ChannelProperties struct {
				QrString  string `json:"qr_string"`
				ExpiresAt string `json:"expires_at"`
			} `json:"channel_properties"`
		} `json:"qr_code"`
	} `json:"payment_method"`
}

// =========================================================
// XenditPaymentResult (tidak berubah, tetap kompatibel)
// =========================================================

type XenditPaymentResult struct {
	TransactionID string  `json:"transaction_id"`
	InvoiceUrl    string  `json:"invoice_url"`
	PaymentType   string  `json:"payment_type"`
	PaymentNumber string  `json:"payment_number"`
	QRCodeBase64  string  `json:"qr_code_base64,omitempty"`
	HandlingFee   float64 `json:"handling_fee"`
	AdminFee      float64 `json:"admin_fee"`
	PlanAmount    float64 `json:"plan_amount"`
	CreditAmount  float64 `json:"credit_amount"`
	ChargeAmount  float64 `json:"charge_amount"`
	PromoCode     string  `json:"promo_code,omitempty"`
	ExpiryDate    string  `json:"expiry_date"`
	FinalAmount   float64 `json:"final_amount"`
	TotalAmount   float64 `json:"total_amount"`
}

func BuildPaymentMethodOptions(db *gorm.DB, amount float64) ([]map[string]interface{}, error) {
	log := zap.L().With(zap.String("service", "XenditService"), zap.String("function", "BuildPaymentMethodOptions"), zap.Float64("amount", amount))
	var activeMethods []model.PaymentMethod
	if err := db.Set("skip_tenant_scope", true).Where("is_active = ?", true).Find(&activeMethods).Error; err != nil {
		log.Error("Failed to fetch active payment methods", zap.Error(err))
		return nil, err
	}

	options := make([]map[string]interface{}, 0, len(activeMethods))
	for _, method := range activeMethods {
		adminFee := method.AdminFee
		if method.IsPercentage {
			adminFee = math.Ceil(amount * method.AdminFee)
		}
		options = append(options, map[string]interface{}{
			"id":            method.Code,
			"code":          method.Code,
			"name":          method.Name,
			"type":          method.Type,
			"logo":          method.Logo,
			"admin_fee":     adminFee,
			"handling_fee":  method.HandlingFee,
			"total_amount":  amount + adminFee + method.HandlingFee,
			"is_percentage": method.IsPercentage,
		})
	}
	log.Debug("Built payment method options", zap.Int("options_count", len(options)))
	return options, nil
}

func CreateLMSXenditPaymentRequest(c *gin.Context, db *gorm.DB, payment *model.LMSPayment, user model.User, method string) (*XenditPaymentResult, error) {
	log := zap.L().With(
		zap.String("service", "XenditService"),
		zap.String("function", "CreateLMSXenditPaymentRequest"),
		zap.String("payment_id", payment.ID.String()),
		zap.String("method", method),
		zap.Float64("amount", payment.Amount),
	)

	var paymentMethod model.PaymentMethod
	if err := db.Set("skip_tenant_scope", true).Where("code = ? AND is_active = ?", method, true).First(&paymentMethod).Error; err != nil {
		errMsg := fmt.Errorf("metode pembayaran tidak valid atau tidak aktif")
		log.Warn("Inactive or invalid payment method selected", zap.Error(errMsg))
		return nil, errMsg
	}

	originalAmount := payment.Amount
	handlingFee := paymentMethod.HandlingFee
	adminFee := paymentMethod.AdminFee
	if paymentMethod.IsPercentage {
		adminFee = math.Ceil(originalAmount * paymentMethod.AdminFee)
	}
	totalAmount := originalAmount + handlingFee + adminFee

	referenceID := payment.ExternalID
	if referenceID == "" {
		referenceID = payment.ID.String()
	}
	expiryDate := time.Now().UTC().Add(24 * time.Hour)

	var reqBody map[string]interface{}
	switch {
	case method == "QRIS":
		reqBody = map[string]interface{}{
			"reference_id": referenceID,
			"currency":     "IDR",
			"amount":       int(totalAmount),
			"country":      "ID",
			"payment_method": map[string]interface{}{
				"type":        "QR_CODE",
				"reusability": "ONE_TIME_USE",
				"qr_code": map[string]interface{}{
					"channel_code": "QRIS",
				},
			},
		}
	case isBankVA(method):
		customerName := strings.TrimSpace(user.FirstName + " " + user.LastName)
		if customerName == "" {
			customerName = user.DisplayName
		}
		if customerName == "" {
			customerName = user.Username
		}
		reqBody = map[string]interface{}{
			"reference_id": referenceID,
			"currency":     "IDR",
			"amount":       int(totalAmount),
			"country":      "ID",
			"payment_method": map[string]interface{}{
				"type":        "VIRTUAL_ACCOUNT",
				"reusability": "ONE_TIME_USE",
				"virtual_account": map[string]interface{}{
					"channel_code": method,
					"channel_properties": map[string]interface{}{
						"customer_name": customerName,
						"expires_at":    expiryDate.Format(time.RFC3339),
					},
				},
			},
		}
	default:
		errMsg := fmt.Errorf("metode pembayaran tidak didukung: %s", method)
		log.Warn("Unsupported payment method", zap.Error(errMsg))
		return nil, errMsg
	}

	log.Info("Sending payment request to Xendit", zap.String("reference_id", referenceID), zap.Float64("total_amount", totalAmount))

	v3Resp, rawBody, err := postXenditPaymentRequest(reqBody, referenceID)
	if err != nil {
		log.Error("Xendit API request error", zap.Error(err))
		return nil, err
	}
	if v3Resp.ID == "" || v3Resp.ErrorCode != "" {
		errMsg := fmt.Errorf("xendit payment request failed [%s]: %s", v3Resp.ErrorCode, v3Resp.Message)
		log.Error("Xendit API returned error payload", zap.String("error_code", v3Resp.ErrorCode), zap.String("message", v3Resp.Message))
		return nil, errMsg
	}

	transactionID := v3Resp.ID
	var paymentNumber string
	switch {
	case method == "QRIS":
		paymentNumber = v3Resp.PaymentMethod.QrCode.ChannelProperties.QrString
		if exp, err := time.Parse(time.RFC3339, v3Resp.PaymentMethod.QrCode.ChannelProperties.ExpiresAt); err == nil {
			expiryDate = exp
		}
	case isBankVA(method):
		paymentNumber = v3Resp.PaymentMethod.VirtualAccount.ChannelProperties.VirtualAccountNumber
		if paymentNumber == "" {
			errMsg := fmt.Errorf("xendit VA response tidak mengandung virtual_account_number untuk bank %s", method)
			log.Error("Missing virtual account number in Xendit response", zap.Error(errMsg))
			return nil, errMsg
		}
		if exp, err := time.Parse(time.RFC3339, v3Resp.PaymentMethod.VirtualAccount.ChannelProperties.ExpiresAt); err == nil {
			expiryDate = exp
		}
	}

	payment.TransactionID = transactionID
	payment.PaymentType = method
	payment.PaymentNumber = paymentNumber
	payment.AdminFee = adminFee
	payment.HandlingFee = handlingFee
	payment.TotalAmount = totalAmount
	payment.ExpiryDate = &expiryDate
	payment.Status = model.LMSPaymentPending
	payment.GatewayData = []byte(rawBody)

	result := &XenditPaymentResult{
		TransactionID: transactionID,
		InvoiceUrl:    "",
		PaymentType:   method,
		HandlingFee:   handlingFee,
		AdminFee:      adminFee,
		PaymentNumber: paymentNumber,
		ExpiryDate:    expiryDate.Format(time.RFC3339),
		PlanAmount:    originalAmount,
		ChargeAmount:  originalAmount,
		FinalAmount:   originalAmount,
		TotalAmount:   totalAmount,
	}
	if method == "QRIS" && paymentNumber != "" {
		png, _ := qrcode.Encode(paymentNumber, qrcode.Medium, 256)
		result.QRCodeBase64 = "data:image/png;base64," + base64.StdEncoding.EncodeToString(png)
	}

	if err := db.WithContext(c).Save(payment).Error; err != nil {
		log.Error("Failed to save updated LMSPayment status to DB", zap.Error(err))
		return nil, err
	}

	log.Info("Successfully created Xendit payment request",
		zap.String("xendit_id", transactionID),
		zap.String("payment_number", paymentNumber),
	)

	return result, nil
}

// =========================================================
// HELPER: Xendit Basic Auth
// =========================================================

func getXenditAuth() string {
	apiKey := os.Getenv("XENDIT_SECRET_KEY")
	encoded := base64.StdEncoding.EncodeToString([]byte(apiKey + ":"))
	return "Basic " + encoded
}

// =========================================================
// HELPER: POST ke Xendit /payment_requests (v3)
// =========================================================

func postXenditPaymentRequest(reqBody map[string]interface{}, idempotencyKey string) (*xenditV3Response, []byte, error) {
	log := zap.L().With(zap.String("service", "XenditService"), zap.String("function", "postXenditPaymentRequest"), zap.String("idempotency_key", idempotencyKey))

	jsonValue, err := json.Marshal(reqBody)
	if err != nil {
		log.Error("Failed to marshal request body", zap.Error(err))
		return nil, nil, fmt.Errorf("failed to marshal request body: %w", err)
	}

	req, err := http.NewRequest("POST", xenditBaseURL+"/payment_requests", bytes.NewBuffer(jsonValue))
	if err != nil {
		log.Error("Failed to construct HTTP request", zap.Error(err))
		return nil, nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", getXenditAuth())
	if idempotencyKey != "" {
		req.Header.Set("Idempotency-key", idempotencyKey)
	}

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Error("Failed HTTP request to Xendit gateway", zap.Error(err))
		return nil, nil, fmt.Errorf("gagal menghubungi Xendit: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Error("Failed to read response body from Xendit", zap.Error(err))
		return nil, nil, fmt.Errorf("failed to read Xendit response: %w", err)
	}

	log.Debug("Xendit HTTP response received", zap.Int("status_code", resp.StatusCode))

	var v3Resp xenditV3Response
	if err := json.Unmarshal(body, &v3Resp); err != nil {
		log.Error("Failed to parse JSON response from Xendit", zap.Error(err), zap.String("raw_body", string(body)))
		return nil, body, fmt.Errorf("failed to parse Xendit response: %w", err)
	}

	return &v3Resp, body, nil
}

// =========================================================
// HELPER: GET /payment_requests/{id} untuk status check
// =========================================================

func getXenditPaymentRequest(transactionID string) (*xenditV3Response, error) {
	log := zap.L().With(zap.String("service", "XenditService"), zap.String("function", "getXenditPaymentRequest"), zap.String("transaction_id", transactionID))

	apiURL := fmt.Sprintf("%s/payment_requests/%s", xenditBaseURL, transactionID)

	req, err := http.NewRequest("GET", apiURL, nil)
	if err != nil {
		log.Error("Failed to construct HTTP request", zap.Error(err))
		return nil, err
	}
	req.Header.Set("Authorization", getXenditAuth())

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Error("Failed HTTP request to query Xendit payment status", zap.Error(err))
		return nil, fmt.Errorf("gagal menghubungi Xendit: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Error("Failed to read Xendit response body", zap.Error(err))
		return nil, err
	}

	var v3Resp xenditV3Response
	if err := json.Unmarshal(body, &v3Resp); err != nil {
		log.Error("Failed to parse Xendit status response JSON", zap.Error(err))
		return nil, fmt.Errorf("failed to parse Xendit response: %w", err)
	}

	log.Info("Successfully queried Xendit payment status", zap.String("status", v3Resp.Status))

	return &v3Resp, nil
}

// =========================================================
// HELPER: Normalize status Xendit v3 ke status internal
// =========================================================

func normalizeXenditV3Status(status string) string {
	switch strings.ToUpper(status) {
	case "SUCCEEDED":
		return "PAID"
	case "FAILED", "VOIDED":
		return "EXPIRED"
	case "PENDING", "REQUIRES_ACTION":
		return "PENDING"
	default:
		return status
	}
}
