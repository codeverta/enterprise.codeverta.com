package services

import (
	"context"
	"encoding/json"
	"fmt"
	"gin-template/common"
	"net/http"
	"os"
	"time"

	// Import untuk v7
	xendit "github.com/xendit/xendit-go/v7"
	"github.com/xendit/xendit-go/v7/invoice"
)

var xenditClient *xendit.APIClient

// InitXenditClient menginisialisasi klien Xendit saat aplikasi dimulai.
func InitXenditClient() {
	secretKey := os.Getenv("XENDIT_SECRET_KEY")
	if secretKey == "" {
		panic("XENDIT_SECRET_KEY environment variable not set")
	}

	// Konfigurasi Xendit
	xenditClient = xendit.NewClient(secretKey)
}

// GenerateInvoice membuat Invoice baru di Xendit dan mengembalikan payment URL.
func GenerateInvoice(
	registrationID string,
	email string,
	category string,
	name string,
	amount float64,
) (string, error) {

	// 2. Tentukan External ID (ID unik dari sistem Anda)
	externalID := registrationID

	// 3. Tentukan deskripsi invoice
	description := fmt.Sprintf("Payment for %s Category - %s", category, name)

	// Durasi invoice (24 jam) dalam detik
	const invoiceDurationSeconds = 24 * 60 * 60

	// 4. Siapkan Request Body
	// Menggunakan Go SDK, kita menggunakan struct CreateInvoiceRequest
	createInvoiceRequest := *invoice.NewCreateInvoiceRequest(externalID, amount)
	createInvoiceRequest.SetPayerEmail(email)
	createInvoiceRequest.SetDescription(description)
	createInvoiceRequest.SetInvoiceDuration(float32(invoiceDurationSeconds))
	// Kita set 'should_send_email' ke false karena Anda sudah mengirimkannya sendiri di controller
	createInvoiceRequest.SetShouldSendEmail(false)

	// 5. Panggil API Create Invoice
	common.SysLog(fmt.Sprintf("Calling Xendit API to create Invoice for ID: %s, Amount: %.2f", registrationID, amount))

	resp, r, err := xenditClient.InvoiceApi.CreateInvoice(context.Background()).
		CreateInvoiceRequest(createInvoiceRequest).
		Execute()

	// 6. Error Handling dan Logging
	if err != nil {
		// Log error secara detail (termasuk body response jika tersedia)
		errMsg := fmt.Sprintf("Xendit CreateInvoice API call failed for ID %s. Error: %v", registrationID, err.Error())
		common.SysLog(errMsg)

		// Jika response HTTP ada, log status code dan body (r.Body) untuk debugging
		if r != nil {
			common.SysLog(fmt.Sprintf("HTTP Status: %d", r.StatusCode))
		}

		// Kembalikan error yang lebih jelas ke controller
		return "", fmt.Errorf("xendit API failed to create invoice: %w", err)
	}

	// 7. Success: Ambil Payment URL
	// Payment URL ada di field 'InvoiceUrl' (pastikan referensi ke tipe data Invoice yang benar)
	paymentURL := resp.GetInvoiceUrl()

	// 8. CRITICAL CHECK: Pastikan URL tidak kosong
	if paymentURL == "" {
		errMsg := fmt.Sprintf("Xendit API succeeded but returned an empty Invoice URL for ID: %s", registrationID)
		common.SysLog(errMsg)
		return "", fmt.Errorf("xendit returned empty payment URL")
	}

	// Optional: Log detail invoice
	common.SysLog(fmt.Sprintf("Successfully created Invoice ID: %s, External ID: %s, URL: %s", resp.GetId(), externalID, paymentURL))

	return paymentURL, nil
}

// StoreInvoiceResult contains only the hosted-checkout data that is safe to
// persist and return to the storefront. The secret API key never leaves this
// service and is loaded by InitXenditClient from XENDIT_SECRET_KEY.
type StoreInvoiceResult struct {
	ID        string
	URL       string
	ExpiresAt time.Time
}

type StoreInvoiceStatus struct {
	ID         string
	ExternalID string
	Status     string
	Amount     float64
	ExpiresAt  time.Time
}

// GenerateStoreInvoice creates a hosted Xendit checkout for a storefront
// order. Xendit handles the concrete channel selection (QRIS, VA, e-wallet,
// card) on its own secure page.
func GenerateStoreInvoice(orderID, email, customerName string, amount float64, successURL, failureURL string) (*StoreInvoiceResult, error) {
	if xenditClient == nil {
		return nil, fmt.Errorf("xendit client is not initialized")
	}
	const invoiceDurationSeconds = 24 * 60 * 60
	request := *invoice.NewCreateInvoiceRequest(orderID, amount)
	request.SetPayerEmail(email)
	request.SetDescription(fmt.Sprintf("Pembayaran pesanan %s - %s", orderID, customerName))
	request.SetInvoiceDuration(float32(invoiceDurationSeconds))
	request.SetShouldSendEmail(false)
	if successURL != "" {
		request.SetSuccessRedirectUrl(successURL)
	}
	if failureURL != "" {
		request.SetFailureRedirectUrl(failureURL)
	}

	resp, httpResponse, err := xenditClient.InvoiceApi.CreateInvoice(context.Background()).
		CreateInvoiceRequest(request).
		Execute()
	if err != nil {
		status := 0
		if httpResponse != nil {
			status = httpResponse.StatusCode
		}
		return nil, fmt.Errorf("xendit create storefront invoice failed (status %d): %w", status, err)
	}
	if resp.GetInvoiceUrl() == "" || resp.GetId() == "" {
		return nil, fmt.Errorf("xendit returned incomplete storefront invoice data")
	}

	return &StoreInvoiceResult{
		ID:        resp.GetId(),
		URL:       resp.GetInvoiceUrl(),
		ExpiresAt: time.Now().UTC().Add(invoiceDurationSeconds * time.Second),
	}, nil
}

// GetStoreInvoiceStatus provides a server-side reconciliation fallback when a
// webhook is delayed or cannot reach a local/staging backend.
func GetStoreInvoiceStatus(ctx context.Context, invoiceID string) (*StoreInvoiceStatus, error) {
	if xenditClient == nil {
		return nil, fmt.Errorf("xendit client is not initialized")
	}
	invoiceData, httpResponse, err := xenditClient.InvoiceApi.GetInvoiceById(ctx, invoiceID).Execute()
	if err != nil {
		status := 0
		if httpResponse != nil {
			status = httpResponse.StatusCode
		}
		return nil, fmt.Errorf("xendit get storefront invoice failed (status %d): %w", status, err)
	}
	if invoiceData.GetId() == "" {
		return nil, fmt.Errorf("xendit returned an invoice without an id")
	}
	return &StoreInvoiceStatus{
		ID:         invoiceData.GetId(),
		ExternalID: invoiceData.GetExternalId(),
		Status:     invoiceData.GetStatus().String(),
		Amount:     invoiceData.GetAmount(),
		ExpiresAt:  invoiceData.GetExpiryDate(),
	}, nil
}

// services/xendit.go
func GetXenditPaymentStatus(paymentRequestID string) (string, error) {
	req, err := http.NewRequest("GET", xenditBaseURL+"/payment_requests/"+paymentRequestID, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", getXenditAuth())

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var v3Resp xenditV3Response
	if err := json.NewDecoder(resp.Body).Decode(&v3Resp); err != nil {
		return "", err
	}

	return v3Resp.Status, nil // SUCCEEDED, PENDING, FAILED, VOIDED
}
