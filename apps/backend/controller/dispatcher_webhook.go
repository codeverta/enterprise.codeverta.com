package controller

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"gin-template/model"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

// WebhookPayload merepresentasikan payload JSON dari webhook dispatcher.
type WebhookPayload struct {
	ID         string      `json:"id"`
	Event      string      `json:"event"`
	Created    time.Time   `json:"created"`
	BusinessID string      `json:"business_id"`
	Data       PaymentData `json:"data"`
}

// PaymentData merepresentasikan detail informasi pembayaran di dalam payload.
type PaymentData struct {
	ID               string    `json:"id"`
	Type             string    `json:"type"`
	Status           string    `json:"status"`
	ReferenceID      string    `json:"reference_id"`
	PaymentRequestID string    `json:"payment_request_id"`
	Created          time.Time `json:"created"`
	Updated          time.Time `json:"updated"`
	BusinessID       string    `json:"business_id"`
}

// HandleWebhook mengembalikan http.HandlerFunc untuk memproses callback webhook secara aman.
func HandleWebhook(db *gorm.DB, webhookSecret string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		log := zap.L().With(zap.String("context", "WebhookHandler"))

		// 1. Verifikasi Method Request
		if r.Method != http.MethodPost {
			log.Warn("Method not allowed", zap.String("method", r.Method))
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		// 2. Baca Raw Request Body
		body, err := io.ReadAll(r.Body)
		if err != nil {
			log.Error("Failed to read request body", zap.Error(err))
			http.Error(w, `{"status":"error","message":"failed to read body"}`, http.StatusBadRequest)
			return
		}
		// Selalu tutup body stream setelah dibaca
		defer r.Body.Close()

		// 3. Verifikasi Signature (X-Dispatcher-Signature)
		sigHeader := r.Header.Get("X-Dispatcher-Signature")
		if sigHeader == "" {
			log.Warn("Unauthorized: X-Dispatcher-Signature header is missing")
			http.Error(w, `{"status":"unauthorized","message":"missing signature"}`, http.StatusUnauthorized)
			return
		}

		// Parse format signature header, misal: "sha256=<signature-hash>" atau langsung hex-hash
		const prefix = "sha256="
		var expectedHexSig string
		if strings.HasPrefix(sigHeader, prefix) {
			expectedHexSig = sigHeader[len(prefix):]
		} else {
			expectedHexSig = sigHeader
		}

		expectedSig, err := hex.DecodeString(expectedHexSig)
		if err != nil || len(expectedSig) == 0 {
			log.Warn("Unauthorized: signature is invalid hex format", zap.Error(err))
			http.Error(w, `{"status":"unauthorized","message":"invalid signature format"}`, http.StatusUnauthorized)
			return
		}

		// Hitung HMAC-SHA256 dari raw body menggunakan webhookSecret
		mac := hmac.New(sha256.New, []byte(webhookSecret))
		mac.Write(body)
		computedSig := mac.Sum(nil)

		// Bandingkan signature secara konstan untuk menghindari timing attack
		if subtle.ConstantTimeCompare(computedSig, expectedSig) != 1 {
			log.Warn("Unauthorized: signature verification failed")
			http.Error(w, `{"status":"unauthorized","message":"signature mismatch"}`, http.StatusUnauthorized)
			return
		}

		// 4. Parse JSON Payload
		var payload WebhookPayload
		if err := json.Unmarshal(body, &payload); err != nil {
			log.Error("Failed to unmarshal JSON payload", zap.Error(err))
			http.Error(w, `{"status":"error","message":"invalid json"}`, http.StatusBadRequest)
			return
		}

		log.Info("Webhook received",
			zap.String("event", payload.Event),
			zap.String("reference_id", payload.Data.ReferenceID),
		)

		switch payload.Event {

		// 5a. Event: Payment Succeeded
		case "payment.succeeded":
			referenceID := strings.TrimSpace(payload.Data.ReferenceID)
			paymentRequestID := strings.TrimSpace(payload.Data.PaymentRequestID)
			if referenceID == "" && paymentRequestID == "" {
				log.Warn("Reference ID is empty in payment.succeeded payload")
				http.Error(w, `{"status":"error","message":"missing reference_id"}`, http.StatusBadRequest)
				return
			}

			var payment model.LMSPayment
			query := db.Set("skip_tenant_scope", true)
			if referenceID != "" && paymentRequestID != "" {
				query = query.Where("external_id = ? OR transaction_id = ?", referenceID, paymentRequestID)
			} else if referenceID != "" {
				query = query.Where("external_id = ?", referenceID)
			} else {
				query = query.Where("transaction_id = ?", paymentRequestID)
			}
			if err := query.First(&payment).Error; err != nil {
				log.Warn("LMS payment not found for reference_id", zap.String("reference_id", referenceID))
				// Not found — return 200 so dispatcher doesn't retry infinitely
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write([]byte(`{"status":"accepted","message":"payment not found, skipped"}`))
				return
			}

			if payment.Status == model.LMSPaymentPaid {
				log.Info("Payment already paid, skipping", zap.String("reference_id", referenceID))
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write([]byte(`{"status":"accepted","message":"already paid"}`))
				return
			}

			now := time.Now()
			if err := processLMSPaymentSuccess(db.Set("skip_tenant_scope", true), &payment, now); err != nil {
				log.Error("Failed to process LMS payment success",
					zap.String("reference_id", referenceID),
					zap.Error(err),
				)
				http.Error(w, `{"status":"error","message":"internal database error"}`, http.StatusInternalServerError)
				return
			}

			log.Info("Payment marked as paid successfully", zap.String("reference_id", referenceID))
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"status":"accepted","message":"payment marked as paid"}`))
			return

		// 5b. Event: Payment Method Expired
		case "payment_method.expired":
			referenceID := strings.TrimSpace(payload.Data.ReferenceID)
			if referenceID == "" {
				log.Warn("Reference ID is empty in payment_method.expired payload")
				http.Error(w, `{"status":"error","message":"missing reference_id"}`, http.StatusBadRequest)
				return
			}

			tx1 := db.Set("skip_tenant_scope", true).Table("payments").
				Where("reference_id = ? OR id = ? OR transaction_id = ?", referenceID, referenceID, referenceID).
				Update("status", "EXPIRED")

			tx2 := db.Set("skip_tenant_scope", true).Table("lms_payments").
				Where("external_id = ? OR transaction_id = ?", referenceID, referenceID).
				Update("status", "expired")

			if tx1.Error != nil && tx2.Error != nil {
				log.Error("Database update failed for both payments and lms_payments",
					zap.String("reference_id", referenceID),
					zap.Error(tx2.Error),
				)
				http.Error(w, `{"status":"error","message":"internal database error"}`, http.StatusInternalServerError)
				return
			}

			rowsAffected := tx1.RowsAffected + tx2.RowsAffected
			if rowsAffected == 0 {
				log.Warn("No payment record updated", zap.String("reference_id", referenceID))
			} else {
				log.Info("Payment marked as expired successfully",
					zap.String("reference_id", referenceID),
					zap.Int64("rows_affected", rowsAffected),
				)
			}

			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"status":"accepted","message":"payment marked as expired"}`))
			return

		// 5c. Event lain — log dan return 200 agar dispatcher tidak retry
		default:
			log.Info("Unhandled webhook event, ignoring", zap.String("event", payload.Event))
		}

		// 6. Default Response
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"accepted","message":"event received"}`))
	}
}
