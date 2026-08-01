package services

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"gin-template/common"
	"gin-template/model"
	"net/smtp"
	"os"
	"strings"
	"time"

	"go.uber.org/zap"
)

// StartEmailWorker memproses antrian email dari Redis secara terus menerus
func StartEmailWorker() {
	const MaxRetries = 3
	const DLQKey = "email_dead_letter_queue"

	log := zap.L().With(zap.String("service", "email_worker"))

	defer func() {
		if r := recover(); r != nil {
			log.Error("🔥 CRITICAL PANIC IN WORKER MAIN", zap.Any("recover_info", r))
		}
	}()

	if !common.RedisEnabled {
		log.Warn("Worker aborted: Redis is NOT enabled in configuration")
		return
	}

	if common.RDB == nil {
		log.Fatal("FATAL: common.RDB is NIL. Worker cannot start.")
		return
	}

	ctxTest, cancelTest := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancelTest()
	if err := common.RDB.Ping(ctxTest).Err(); err != nil {
		log.Fatal("FATAL: Worker cannot ping Redis", zap.Error(err))
		return
	}

	queueKey := common.RDB.GetKey("email_queue")
	log.Info("Email Worker started and listening", zap.String("listening_on_key", queueKey))

	for {
		// Proteksi Ganda: Context Timeout Go + Timeout Redis
		// Ini garansi 100% worker lu gak bakal nge-hang selamanya
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)

		// Pakai BRPop (Right Pop) karena API lu pakai LPush (Left Push) -> Biar FIFO
		result, err := common.RDB.BRPop(ctx, 5*time.Second, queueKey).Result()
		cancel() // Wajib dipanggil biar nggak memory leak

		if err != nil {
			errStr := err.Error()
			// Abaikan timeout wajar dari Redis atau Go Context
			if errStr == "redis: nil" || errStr == "context deadline exceeded" {
				continue
			}
			log.Error("Redis Queue Error (BRPop failed)", zap.Error(err))
			time.Sleep(2 * time.Second)
			continue
		}

		if len(result) < 2 {
			continue
		}

		// Isolasi eksekusi per job biar worker gak mati kalau 1 email gagal
		func() {
			defer func() {
				if r := recover(); r != nil {
					log.Error("🔥 PANIC DURING JOB PROCESSING", zap.Any("recover_info", r), zap.String("raw_payload", result[1]))
				}
			}()

			rawPayload := result[1]

			previewLength := len(rawPayload)
			if previewLength > 100 {
				previewLength = 100
			}
			log.Info("📥 Job received from queue", zap.String("payload_preview", rawPayload[:previewLength]))

			start := time.Now()

			var job struct {
				From       string          `json:"from"`
				To         string          `json:"to"`
				Subject    string          `json:"subject"`
				TemplateID uint64          `json:"template_id"`
				Data       json.RawMessage `json:"data"`
				RetryCount int             `json:"retry_count"`
			}

			if err := json.Unmarshal([]byte(rawPayload), &job); err != nil {
				log.Error("❌ JSON Unmarshal Error (Job dropped)", zap.Error(err))
				return
			}

			jobLog := log.With(
				zap.String("to", job.To),
				zap.Uint64("template_id", job.TemplateID),
				zap.Int("retry_count", job.RetryCount),
			)

			jobLog.Info("⚙️ Processing email job...")

			var tmpl model.EmailTemplate
			var pdfAttachment []byte

			if err := model.DB.Set("skip_tenant_scope", true).Where("tencent_template_id = ?", job.TemplateID).First(&tmpl).Error; err != nil {
				jobLog.Warn("⚠️ Failed to find template in DB; sending without specific template", zap.Error(err))
			} else {
				if tmpl.Type == model.TypePaymentSuccess {
					var successData common.PaymentSuccessEmailData
					if err := json.Unmarshal(job.Data, &successData); err == nil {
						if len(successData.Participants) == 0 {
							jobLog.Info("Skipping event invoice PDF for LMS payment receipt")
						} else {
							if tmpl.LogoPath == "" {
								tmpl.LogoPath = "images/logo-default.png"
							}

							pdfAttachment, err = common.GenerateInvoiceFromHTML(successData, tmpl.LogoPath)

							if err != nil {
								jobLog.Error("❌ Failed to generate Invoice PDF", zap.Error(err))
								pdfAttachment = nil
							} else {
								jobLog.Info("✅ Invoice PDF generated")
							}
						}
					} else {
						jobLog.Error("❌ Failed to unmarshal PaymentSuccessEmailData", zap.Error(err))
					}
				}
			}

			jobLog.Info("🚀 Sending email via Tencent SES...")
			err = common.SendGenericEmail(job.From, job.To, job.Subject, job.TemplateID, job.Data, pdfAttachment)

			if err != nil {
				jobLog.Warn("⚠️ Tencent SES failed, attempting SMTP fallback...", zap.Error(err))
				if tmpl.Body != "" {
					interpolatedBody := interpolateTemplate(tmpl.Body, job.Data)
					err = sendEmailSMTP(job.From, job.To, job.Subject, interpolatedBody, pdfAttachment)
					if err == nil {
						jobLog.Info("✅ Email sent successfully via SMTP fallback", zap.Duration("process_duration", time.Since(start)))
					} else {
						jobLog.Error("❌ SMTP fallback also failed", zap.Error(err))
					}
				} else {
					jobLog.Warn("⚠️ SMTP fallback skipped: database template Body is empty")
				}
			}

			if err != nil {
				jobLog.Error("❌ Worker failed to send email via both Tencent SES and SMTP", zap.Error(err))

				if job.RetryCount >= MaxRetries {
					jobLog.Error("💀 Max retries reached. Moving to DLQ.", zap.Int("attempts", job.RetryCount))
					failedJobJson, _ := json.Marshal(job)
					// Push back dengan Redis Context background karena ctx yang atas udah di-cancel
					common.RDB.RPush(context.Background(), common.RDB.GetKey(DLQKey), failedJobJson)
				} else {
					job.RetryCount++
					jobLog.Warn("🔄 Re-queuing job for retry", zap.Int("next_attempt", job.RetryCount))
					retryPayload, _ := json.Marshal(job)
					common.RDB.LPush(context.Background(), queueKey, retryPayload)
				}
			} else {
				// Only print this if we haven't logged SMTP success already
				if tmpl.Body == "" || err == nil {
					jobLog.Info("✅ Email sent successfully", zap.Duration("process_duration", time.Since(start)))
				}
			}
		}()
	}
}

func interpolateTemplate(body string, data []byte) string {
	var m map[string]interface{}
	if err := json.Unmarshal(data, &m); err != nil {
		return body
	}
	result := body
	for k, v := range m {
		placeholder := fmt.Sprintf("{{%s}}", k)
		valStr := fmt.Sprintf("%v", v)
		result = strings.ReplaceAll(result, placeholder, valStr)
	}
	return result
}

func sendEmailSMTP(from, to, subject, body string, pdfAttachment []byte) error {
	smtpHost := os.Getenv("SMTP_HOST")
	smtpPort := os.Getenv("SMTP_PORT")
	smtpUser := os.Getenv("SMTP_USER")
	smtpPass := os.Getenv("SMTP_PASS")

	if smtpHost == "" {
		smtpHost = "sg-smtp.qcloudmail.com"
	}
	if smtpPort == "" {
		smtpPort = "465"
	}
	if smtpUser == "" || smtpPass == "" {
		return fmt.Errorf("SMTP_USER and SMTP_PASS are required for SMTP fallback")
	}

	var msg bytes.Buffer
	boundary := "my-boundary-123456789"

	msg.WriteString(fmt.Sprintf("From: %s\r\n", from))
	msg.WriteString(fmt.Sprintf("To: %s\r\n", to))
	msg.WriteString(fmt.Sprintf("Subject: %s\r\n", subject))
	msg.WriteString("MIME-Version: 1.0\r\n")

	if len(pdfAttachment) > 0 {
		msg.WriteString(fmt.Sprintf("Content-Type: multipart/mixed; boundary=%s\r\n\r\n", boundary))

		// Body part
		msg.WriteString(fmt.Sprintf("--%s\r\n", boundary))
		msg.WriteString("Content-Type: text/html; charset=UTF-8\r\n")
		msg.WriteString("Content-Transfer-Encoding: 7bit\r\n\r\n")
		msg.WriteString(body)
		msg.WriteString("\r\n")

		// Attachment part
		msg.WriteString(fmt.Sprintf("--%s\r\n", boundary))
		msg.WriteString("Content-Type: application/pdf\r\n")
		msg.WriteString("Content-Transfer-Encoding: base64\r\n")
		msg.WriteString("Content-Disposition: attachment; filename=\"Receipt.pdf\"\r\n\r\n")

		encodedPdf := make([]byte, base64.StdEncoding.EncodedLen(len(pdfAttachment)))
		base64.StdEncoding.Encode(encodedPdf, pdfAttachment)
		msg.Write(encodedPdf)
		msg.WriteString("\r\n")
		msg.WriteString(fmt.Sprintf("--%s--\r\n", boundary))
	} else {
		msg.WriteString("Content-Type: text/html; charset=UTF-8\r\n\r\n")
		msg.WriteString(body)
	}

	auth := smtp.PlainAuth("", smtpUser, smtpPass, smtpHost)

	conn, err := tls.Dial("tcp", smtpHost+":"+smtpPort, &tls.Config{
		InsecureSkipVerify: true,
		ServerName:         smtpHost,
	})
	if err != nil {
		return fmt.Errorf("failed to dial SMTP TLS: %w", err)
	}
	defer conn.Close()

	c, err := smtp.NewClient(conn, smtpHost)
	if err != nil {
		return fmt.Errorf("failed to create SMTP client: %w", err)
	}
	defer c.Close()

	if err = c.Auth(auth); err != nil {
		return fmt.Errorf("failed SMTP Auth: %w", err)
	}

	if err = c.Mail(from); err != nil {
		return fmt.Errorf("failed MAIL FROM: %w", err)
	}

	if err = c.Rcpt(to); err != nil {
		return fmt.Errorf("failed RCPT TO: %w", err)
	}

	w, err := c.Data()
	if err != nil {
		return fmt.Errorf("failed DATA command: %w", err)
	}
	defer w.Close()

	_, err = w.Write(msg.Bytes())
	if err != nil {
		return fmt.Errorf("failed to write body: %w", err)
	}

	return nil
}
