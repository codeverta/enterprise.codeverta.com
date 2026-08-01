package controller

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"gin-template/common"
	"gin-template/model"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
)

func TestHandleWebhook(t *testing.T) {
	db, tenant := setupControllerTestDB(t)

	// Create lms_payments table in sqlite for test
	if err := db.Migrator().CreateTable(&model.LMSPayment{}); err != nil {
		t.Fatalf("failed to create lms_payments table: %v", err)
	}

	secret := "test_webhook_secret_key_12345"

	t.Run("missing signature header", func(t *testing.T) {
		handler := HandleWebhook(db, secret)
		req := httptest.NewRequest("POST", "/webhooks/dispatcher", bytes.NewBuffer([]byte("{}")))
		w := httptest.NewRecorder()

		handler.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d", w.Code)
		}
	})

	t.Run("invalid signature header", func(t *testing.T) {
		handler := HandleWebhook(db, secret)
		req := httptest.NewRequest("POST", "/webhooks/dispatcher", bytes.NewBuffer([]byte("{}")))
		req.Header.Set("X-Dispatcher-Signature", "sha256=invalidhash")
		w := httptest.NewRecorder()

		handler.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d", w.Code)
		}
	})

	t.Run("successful processing and status update", func(t *testing.T) {
		// Insert mock payment
		refID := uuid.New().String()
		payment := model.LMSPayment{
			ID:         uuid.New(),
			ExternalID: refID,
			Amount:     150000,
			Status:     model.LMSPaymentPending,
			TenantID:   &tenant.ID,
		}
		ctx := context.WithValue(context.Background(), common.CtxTenantKey, tenant)
		if err := db.WithContext(ctx).Create(&payment).Error; err != nil {
			t.Fatalf("failed to seed mock payment: %v", err)
		}

		payload := map[string]interface{}{
			"id": "pm-c526295f-bd9e-4614-a5dd-1daa33cf9dea",
			"data": map[string]interface{}{
				"id":           "pm-c526295f-bd9e-4614-a5dd-1daa33cf9dea",
				"type":         "QR_CODE",
				"status":       "EXPIRED",
				"reference_id": refID,
			},
			"event": "payment_method.expired",
		}
		bodyBytes, _ := json.Marshal(payload)

		// Compute HMAC-SHA256 signature
		mac := hmac.New(sha256.New, []byte(secret))
		mac.Write(bodyBytes)
		signature := hex.EncodeToString(mac.Sum(nil))

		handler := HandleWebhook(db, secret)
		req := httptest.NewRequest("POST", "/webhooks/dispatcher", bytes.NewBuffer(bodyBytes))
		req.Header.Set("X-Dispatcher-Signature", "sha256="+signature)
		w := httptest.NewRecorder()

		handler.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("expected 200, got %d", w.Code)
		}

		// Verify db is updated
		var updatedPayment model.LMSPayment
		if err := db.First(&updatedPayment, "id = ?", payment.ID).Error; err != nil {
			t.Fatalf("failed to fetch updated payment: %v", err)
		}
		if updatedPayment.Status != model.LMSPaymentExpired {
			t.Errorf("expected status to be %q, got %q", model.LMSPaymentExpired, updatedPayment.Status)
		}
	})

	t.Run("payment.succeeded marks payment as paid", func(t *testing.T) {
		// Insert mock payment with pending status
		refID := uuid.New().String()
		payment := model.LMSPayment{
			ID:         uuid.New(),
			ExternalID: refID,
			Amount:     3002,
			Status:     model.LMSPaymentPending,
			TenantID:   &tenant.ID,
		}
		ctx := context.WithValue(context.Background(), common.CtxTenantKey, tenant)
		if err := db.WithContext(ctx).Create(&payment).Error; err != nil {
			t.Fatalf("failed to seed mock payment: %v", err)
		}

		payload := map[string]interface{}{
			"created":     "2026-07-12T13:49:14.491Z",
			"business_id": "69737dcc64b14aeab040b46f",
			"event":       "payment.succeeded",
			"data": map[string]interface{}{
				"id":           "qrpy_9e23f8c4-7944-44d5-acbf-07abf520f830",
				"amount":       3002,
				"status":       "SUCCEEDED",
				"reference_id": refID,
			},
		}
		bodyBytes, _ := json.Marshal(payload)

		mac := hmac.New(sha256.New, []byte(secret))
		mac.Write(bodyBytes)
		signature := hex.EncodeToString(mac.Sum(nil))

		handler := HandleWebhook(db, secret)
		req := httptest.NewRequest("POST", "/webhooks/dispatcher", bytes.NewBuffer(bodyBytes))
		req.Header.Set("X-Dispatcher-Signature", "sha256="+signature)
		w := httptest.NewRecorder()

		handler.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("expected 200, got %d — body: %s", w.Code, w.Body.String())
		}

		// Verify payment status updated to paid
		var updatedPayment model.LMSPayment
		if err := db.First(&updatedPayment, "id = ?", payment.ID).Error; err != nil {
			t.Fatalf("failed to fetch updated payment: %v", err)
		}
		if updatedPayment.Status != model.LMSPaymentPaid {
			t.Errorf("expected status to be %q, got %q", model.LMSPaymentPaid, updatedPayment.Status)
		}
	})
}
