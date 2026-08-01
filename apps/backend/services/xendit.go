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
