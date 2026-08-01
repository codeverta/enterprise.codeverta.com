package common

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common"
	"github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common/profile"
	ses "github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/ses/v20201002"
	"go.uber.org/zap"
)

// Struct data untuk template
type EmailData struct {
	Name       string `json:"Name"`
	Email      string `json:"Email"`
	OrderID    string `json:"OrderID"`
	Category   string `json:"Category"`
	Amount     string `json:"Amount"`
	PaymentURL string `json:"PaymentURL"`
	ExpiryDate string `json:"ExpiryDate"`

	LocationName    string `json:"LocationName"`
	LocationAddress string `json:"LocationAddress"`
	RPCDate         string `json:"RPCDate"`
	RPCTime         string `json:"RPCTime"`
}

// Updated function signature to accept dynamic subject and body
func SendGenericEmail(fromAddress string, toAddress string, subject string, tencentTemplateID uint64, data interface{}, attachment []byte) error {

	log := zap.L().With(
		zap.String("func", "SendGenericEmail"),
		zap.String("to", toAddress),
		zap.Uint64("template_id", tencentTemplateID),
	)

	secretID := os.Getenv("TENCENTCLOUD_SECRET_ID")
	secretKey := os.Getenv("TENCENTCLOUD_SECRET_KEY")
	if secretID == "" || secretKey == "" {
		err := fmt.Errorf("missing TENCENTCLOUD_SECRET_ID or KEY in env")
		log.Error("Environment configuration error", zap.Error(err))
		return err
	}

	jsonData, err := json.Marshal(data)
	if err != nil {
		return err
	}

	log.Debug("Preparing payload for Tencent SES", zap.String("payload_json", string(jsonData)))

	credential := common.NewCredential(secretID, secretKey)
	cpf := profile.NewClientProfile()
	cpf.HttpProfile.Endpoint = "ses.tencentcloudapi.com"
	client, err := ses.NewClient(credential, "ap-singapore", cpf)
	if err != nil {
		log.Error("Failed to create SES client", zap.Error(err))
		return err
	}

	request := ses.NewSendEmailRequest()
	request.FromEmailAddress = common.StringPtr(fromAddress)
	request.Destination = common.StringPtrs([]string{toAddress})
	request.Template = &ses.Template{
		TemplateID:   common.Uint64Ptr(tencentTemplateID),
		TemplateData: common.StringPtr(string(jsonData)),
	}
	request.Subject = common.StringPtr(subject)
	if len(attachment) > 0 {
		currentTime := time.Now().Format("20060102_150405")
		fileName := fmt.Sprintf("Receipt_%s.pdf", currentTime)
		request.Attachments = []*ses.Attachment{
			{
				FileName: common.StringPtr(fileName),
				Content:  common.StringPtr(base64.StdEncoding.EncodeToString(attachment)),
			},
		}
	}
	resp, err := client.SendEmail(request)
	if err != nil {
		// Tencent errors often contain specific codes (e.g., "FailedOperation.TemplateDataNotMatch")
		log.Error("Tencent API returned error",
			zap.Error(err),
			zap.String("raw_response", err.Error()),
		)
		return err
	}

	log.Info("Email sent successfully via Tencent",
		zap.String("request_id", *resp.Response.RequestId),
	)
	return err
}

// Struct data khusus untuk template rejection
type RejectionEmailData struct {
	Name           string `json:"Name"`
	OrderID        string `json:"OrderID"`
	RejectedReason string `json:"RejectedReason"`
}

func SendRejectionEmail(from string, to string, subject string, templateID uint64, name string, orderID string, reason string) {
	if !RedisEnabled {
		return
	}

	job := map[string]interface{}{
		"from":        from,
		"to":          to,
		"subject":     subject,
		"template_id": templateID,
		"data": map[string]string{
			"Name":           name,
			"OrderID":        orderID,
			"RejectedReason": reason,
		},
	}

	payload, _ := json.Marshal(job)
	RDB.LPush(context.Background(), RDB.GetKey("email_queue"), payload)
}

func QueueEmailJob(from string, to string, subject string, templateID uint64, data interface{}, logFields ...zap.Field) error {
	log := zap.L().With(
		append([]zap.Field{
			zap.String("func", "QueueEmailJob"),
			zap.String("email", to),
			zap.Uint64("template_id", templateID),
		}, logFields...)...,
	)

	if !RedisEnabled {
		err := fmt.Errorf("redis is disabled")
		log.Error("Email job was NOT queued", zap.Error(err))
		return err
	}

	if RDB == nil {
		err := fmt.Errorf("redis client is nil")
		log.Error("Email job was NOT queued", zap.Error(err))
		return err
	}

	job := map[string]interface{}{
		"from":        from,
		"to":          to,
		"subject":     subject,
		"template_id": templateID,
		"data":        data,
	}

	payload, err := json.Marshal(job)
	if err != nil {
		log.Error("Failed to marshal email job", zap.Error(err))
		return err
	}

	queueKey := RDB.GetKey("email_queue")
	if err := RDB.LPush(context.Background(), queueKey, payload).Err(); err != nil {
		log.Error("Failed to push email job to Redis", zap.Error(err), zap.String("queue_key", queueKey))
		return err
	}

	log.Info("Email job successfully queued in Redis", zap.String("queue_key", queueKey))
	return nil
}

// Helper: Push Email Job ke Redis
func QueueSuccessEmail(from string, to string, data PaymentSuccessEmailData, templateID uint64) error {
	log := zap.L().With(
		zap.String("func", "QueueSuccessEmail"),
		zap.String("email", to),
		zap.String("order_id", data.OrderID),
	)

	if !RedisEnabled {
		log.Warn("Redis is DISABLED. Email will NOT be queued.")
		return fmt.Errorf("redis is disabled")
	}

	if RDB == nil {
		log.Error("Redis client (RDB) is nil. Cannot queue email.")
		return fmt.Errorf("redis client is nil")
	}

	return QueueEmailJob(
		from,
		to,
		"Pembayaran Berhasil - #"+data.OrderID,
		templateID,
		data,
		zap.String("order_id", data.OrderID),
	)
}

// Structs for LMS email template data
type LMSPaymentLinkEmailData struct {
	Name       string `json:"Name"`
	OrderID    string `json:"OrderID"`
	Amount     string `json:"Amount"`
	PaymentURL string `json:"PaymentURL"`
	ExpiryDate string `json:"ExpiryDate"`
}

type LMSActivationEmailData struct {
	Name           string `json:"Name"`
	ActivationLink string `json:"ActivationLink"`
}

type PasswordResetEmailData struct {
	Name      string `json:"Name"`
	ResetLink string `json:"ResetLink"`
}

type LMSPaymentReceiptEmailData struct {
	PICName       string `json:"PICName"`
	OrderID       string `json:"OrderID"`
	PaidAt        string `json:"PaidAt"`
	TotalDiscount string `json:"TotalDiscount"`
	FinalAmount   string `json:"FinalAmount"`
}

// Helpers to enqueue LMS emails
func QueueLMSPaymentLinkEmail(from string, to string, subject string, data LMSPaymentLinkEmailData, templateID uint64) error {
	return QueueEmailJob(
		from,
		to,
		subject,
		templateID,
		data,
		zap.String("order_id", data.OrderID),
	)
}

func QueueLMSActivationEmail(from string, to string, subject string, data LMSActivationEmailData, templateID uint64) error {
	return QueueEmailJob(
		from,
		to,
		subject,
		templateID,
		data,
	)
}

func QueuePasswordResetEmail(from string, to string, subject string, data PasswordResetEmailData, templateID uint64) error {
	return QueueEmailJob(from, to, subject, templateID, data)
}

func QueueLMSPaymentReceiptEmail(from string, to string, subject string, data LMSPaymentReceiptEmailData, templateID uint64) error {
	return QueueEmailJob(
		from,
		to,
		subject,
		templateID,
		data,
		zap.String("order_id", data.OrderID),
	)
}
