package controller

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"gin-template/common"
	"gin-template/model"
	"gin-template/repository"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type PaymentXenditController struct {
	DB                       *gorm.DB
	DashboardRepo            repository.DashboardRepository
	ParticipantDashboardRepo repository.ParticipantStatRepository
}

func NewPaymentXenditController(db *gorm.DB, dashRepo repository.DashboardRepository, participantDashRepository repository.ParticipantStatRepository) *PaymentXenditController {
	return &PaymentXenditController{
		DB:                       db,
		DashboardRepo:            dashRepo,
		ParticipantDashboardRepo: participantDashRepository,
	}
}

// XenditWebhook — DIUPDATE untuk format Xendit v3
func (pc *PaymentXenditController) XenditWebhook(c *gin.Context) {
	log := zap.L().With(zap.String("controller", "PaymentXenditController"), zap.String("function", "XenditWebhook"))
	// 1. Verifikasi token
	token := c.GetHeader("x-callback-token")
	expectedToken := os.Getenv("XENDIT_WEBHOOK_TOKEN")
	if expectedToken != "" && token != expectedToken {
		log.Warn("Unauthorized webhook attempt", zap.String("provided_token", token))
		c.JSON(http.StatusUnauthorized, gin.H{"status": "unauthorized"})
		return
	}

	// 2. Parse payload Xendit v3
	var payload struct {
		Event      string `json:"event"`
		BusinessID string `json:"business_id"`
		Created    string `json:"created"`
		ID         string `json:"id"`
		ExternalID string `json:"external_id"`
		Status     string `json:"status"`
		Data       struct {
			ID               string  `json:"id"`
			ReferenceID      string  `json:"reference_id"`
			Status           string  `json:"status"`
			Amount           float64 `json:"amount"`
			Currency         string  `json:"currency"`
			Country          string  `json:"country"`
			PaymentRequestID string  `json:"payment_request_id"`
			PaymentMethod    struct {
				ID   string `json:"id"`
				Type string `json:"type"`
			} `json:"payment_method"`
		} `json:"data"`
	}

	if err := c.ShouldBindJSON(&payload); err != nil {
		log.Error("Failed to parse webhook payload", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": err.Error()})
		return
	}

	log.Info("Received Xendit webhook", zap.String("event", payload.Event), zap.String("payment_request_id", payload.Data.PaymentRequestID), zap.Float64("amount", payload.Data.Amount), zap.String("status", payload.Data.Status))

	if payload.ExternalID != "" {
		if handleLMSPaymentWebhook(c, payload.ExternalID, payload.Status) {
			c.JSON(http.StatusOK, gin.H{"status": "ok", "source": "lms_payment", "payment_status": payload.Status})
			return
		}
	}
	if payload.Data.ReferenceID != "" {
		if handleLMSPaymentWebhook(c, payload.Data.ReferenceID, payload.Data.Status) {
			c.JSON(http.StatusOK, gin.H{"status": "ok", "source": "lms_payment_request", "payment_status": payload.Data.Status})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"status": "ignored", "message": "Not an LMS payment"})
}

func handleLMSPaymentWebhook(c *gin.Context, externalID string, status string) bool {
	normalizedStatus := strings.ToUpper(status)
	db := model.GetDB(c).Set("skip_tenant_scope", true)

	var payment model.LMSPayment
	if err := db.Session(&gorm.Session{}).Where("external_id = ?", externalID).First(&payment).Error; err == nil {
		switch normalizedStatus {
		case "PAID", "SETTLED", "SUCCEEDED":
			if payment.Status == model.LMSPaymentPaid {
				return true
			}
			now := time.Now()
			err := processLMSPaymentSuccess(db, &payment, now)
			return err == nil
		case "EXPIRED", "FAILED", "VOIDED":
			db.Model(&payment).Update("status", model.LMSPaymentExpired)
			return true
		default:
			return true
		}
	}

	// Fallback to CoursePurchase
	purchaseID, err := uuid.Parse(externalID)
	if err == nil {
		var purchase model.CoursePurchase
		if err := db.Session(&gorm.Session{}).Where("id = ?", purchaseID).First(&purchase).Error; err == nil {
			switch normalizedStatus {
			case "PAID", "SETTLED", "SUCCEEDED":
				if purchase.Status == model.PurchasePaid {
					return true
				}
				now := time.Now()
				err := processCoursePurchaseSuccess(db, &purchase, now)
				return err == nil
			case "EXPIRED", "FAILED", "VOIDED":
				db.Model(&purchase).Update("status", model.PurchaseFailed)
				return true
			default:
				return true
			}
		}
	}

	return false
}

func processCoursePurchaseSuccess(db *gorm.DB, purchase *model.CoursePurchase, now time.Time) error {
	return db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(purchase).Updates(map[string]interface{}{
			"status":  model.PurchasePaid,
			"paid_at": &now,
		}).Error; err != nil {
			return err
		}

		var course model.Course
		if err := tx.Preload("Mentors").First(&course, "id = ?", purchase.CourseID).Error; err != nil {
			return err
		}

		target, err := ResolveCourseRevenueWallet(tx, &course)
		if err != nil {
			return err
		}

		tenantID := uuid.Nil
		if purchase.TenantID != nil {
			tenantID = *purchase.TenantID
		}
		targetWallet, err := EnsureWallet(tx, target.OwnerType, target.OwnerID, tenantID)
		if err != nil {
			return err
		}

		platformWallet, err := EnsureWallet(tx, model.WalletOwnerPlatform, uuid.Nil, tenantID)
		if err != nil {
			return err
		}

		feeResult, err := CalculateFee(purchase.Amount, "course_sale", tx)
		if err != nil {
			return err
		}

		purchaseUUID := purchase.ID
		if _, err := CreditWallet(tx, targetWallet.ID, feeResult.NetAmount,
			model.LedgerReasonCourseSale, "course_purchase", &purchaseUUID,
			fmt.Sprintf("Penjualan kursus: %s", course.Title)); err != nil {
			return err
		}

		if feeResult.FeeAmount > 0 {
			if _, err := CreditWallet(tx, platformWallet.ID, feeResult.FeeAmount,
				model.LedgerReasonPlatformFee, "course_purchase", &purchaseUUID,
				fmt.Sprintf("Biaya platform kursus: %s", course.Title)); err != nil {
				return err
			}
		}

		return nil
	})
}

func processLMSPaymentSuccess(db *gorm.DB, payment *model.LMSPayment, now time.Time) error {
	var parentUser model.User
	var parentUserFound bool
	var shouldSendActivationEmail bool
	var activationToken string
	var finalAmount float64
	log := zap.L().With(
		zap.String("func", "processLMSPaymentSuccess"),
		zap.String("payment_id", payment.ID.String()),
	)

	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(payment).Updates(map[string]interface{}{
			"status":  model.LMSPaymentPaid,
			"paid_at": &now,
		}).Error; err != nil {
			return err
		}
		payment.Status = model.LMSPaymentPaid
		payment.PaidAt = &now

		if payment.CourseID != nil {
			// COURSE PURCHASE ROUTING (USES WALLET ENGINE)
			var purchase model.CoursePurchase
			purchaseID, err := uuid.Parse(payment.ExternalID)
			if err == nil {
				if err := tx.First(&purchase, "id = ?", purchaseID).Error; err == nil {
					if err := tx.Model(&purchase).Updates(map[string]interface{}{
						"status":  model.PurchasePaid,
						"paid_at": &now,
					}).Error; err != nil {
						return err
					}

					var course model.Course
					if err := tx.Preload("Mentors").First(&course, "id = ?", purchase.CourseID).Error; err != nil {
						return err
					}

					target, err := ResolveCourseRevenueWallet(tx, &course)
					if err != nil {
						return err
					}

					tenantID := uuid.Nil
					if purchase.TenantID != nil {
						tenantID = *purchase.TenantID
					}
					targetWallet, err := EnsureWallet(tx, target.OwnerType, target.OwnerID, tenantID)
					if err != nil {
						return err
					}

					platformWallet, err := EnsureWallet(tx, model.WalletOwnerPlatform, uuid.Nil, tenantID)
					if err != nil {
						return err
					}

					feeResult, err := CalculateFee(purchase.Amount, "course_sale", tx)
					if err != nil {
						return err
					}

					purchaseUUID := purchase.ID
					if _, err := CreditWallet(tx, targetWallet.ID, feeResult.NetAmount,
						model.LedgerReasonCourseSale, "course_purchase", &purchaseUUID,
						fmt.Sprintf("Penjualan kursus: %s", course.Title)); err != nil {
						return err
					}

					if feeResult.FeeAmount > 0 {
						if _, err := CreditWallet(tx, platformWallet.ID, feeResult.FeeAmount,
							model.LedgerReasonPlatformFee, "course_purchase", &purchaseUUID,
							fmt.Sprintf("Biaya platform kursus: %s", course.Title)); err != nil {
							return err
						}
					}
				}
			}
		} else if payment.SubscriptionID != nil {
			// SUBSCRIPTION ROUTING (USES TENANT BALANCE LOG)
			var subscription model.Subscription
			if err := tx.First(&subscription, "id = ?", *payment.SubscriptionID).Error; err == nil {
				if err := tx.Model(&subscription).Updates(paidSubscriptionUpdates(subscription, now)).Error; err != nil {
					return err
				}
			}

			// Record revenue stats, update balance and write balance log
			if payment.TenantID != nil {
				// Update Tenant Balance atomically
				if err := tx.Model(&model.Tenant{}).Where("id = ?", *payment.TenantID).
					UpdateColumn("balance", gorm.Expr("balance + ?", payment.Amount)).Error; err != nil {
					return err
				}

				// Write BalanceLog
				balanceLog := model.BalanceLog{
					ID:            uuid.New(),
					TransactionID: payment.TransactionID,
					Category:      model.CategorySubscribe,
					Description:   fmt.Sprintf("LMS Subscription payment %s", payment.ExternalID),
					GatewayAmount: payment.Amount,
					SystemAmount:  payment.Amount,
					Diff:          0,
					Status:        "MATCH",
					TenantID:      payment.TenantID,
				}
				if err := tx.Create(&balanceLog).Error; err != nil {
					return err
				}
			}
		}

		// Generate an activation/password setup token for the paid parent account.
		if err := tx.First(&parentUser, "id = ?", payment.ParentID).Error; err == nil {
			parentUserFound = true
			finalAmount = payment.Amount
			shouldSendActivationEmail = true
			token := common.GenerateVerificationCode(32)
			activation := model.UserActivation{
				ID:        uuid.New(),
				UserID:    parentUser.ID,
				Token:     token,
				ExpiresAt: time.Now().Add(24 * time.Hour),
				Used:      false,
				TenantID:  payment.TenantID,
			}
			if err := tx.Create(&activation).Error; err != nil {
				return err
			}
			activationToken = token
		}

		// Push Notification on Success
		var planName = "LMS Subscription"
		if payment.SubscriptionID != nil {
			var subscription model.Subscription
			if err := tx.First(&subscription, "id = ?", *payment.SubscriptionID).Error; err == nil {
				var plan model.SubscriptionPlan
				if err := tx.First(&plan, "id = ?", subscription.ProviderPlanID).Error; err == nil {
					planName = plan.Name
				}
			}
		}

		// Format Amount
		amountStr := strconv.FormatFloat(payment.Amount, 'f', 0, 64)
		var formattedAmount []rune
		for i, digit := range amountStr {
			if i > 0 && (len(amountStr)-i)%3 == 0 {
				formattedAmount = append(formattedAmount, '.')
			}
			formattedAmount = append(formattedAmount, digit)
		}
		amountFmt := string(formattedAmount)

		// Push to Parent
		title := "Pembayaran Berhasil"
		content := fmt.Sprintf("Pembayaran untuk paket %s sebesar Rp%s berhasil diproses.", planName, amountFmt)
		if payment.CourseID != nil {
			var course model.Course
			if err := tx.First(&course, "id = ?", *payment.CourseID).Error; err == nil {
				title = "Pembayaran Kelas Berhasil"
				content = fmt.Sprintf("Pembayaran untuk pembelian kelas %s sebesar Rp%s berhasil diproses.", course.Title, amountFmt)
			}
		}
		_ = model.PushNotification(tx, payment.ParentID, payment.TenantID, title, content, "success")

		if payment.SubscriptionID != nil && payment.CourseID == nil {
			pushSubscriptionPaymentAdminNotifications(tx, payment, parentUser, planName, amountFmt)
		}

		// Push to Student if different from Parent
		if payment.StudentID != uuid.Nil && payment.StudentID != payment.ParentID {
			studentTitle := "Langganan Aktif"
			studentContent := fmt.Sprintf("Masa langganan paket belajar %s Anda telah aktif.", planName)
			if payment.CourseID != nil {
				var course model.Course
				if err := tx.First(&course, "id = ?", *payment.CourseID).Error; err == nil {
					studentTitle = "Akses Kelas Aktif"
					studentContent = fmt.Sprintf("Anda sekarang telah terdaftar dan memiliki akses ke kelas %s.", course.Title)
				}
			}
			_ = model.PushNotification(tx, payment.StudentID, payment.TenantID, studentTitle, studentContent, "success")
		}

		return nil
	})
	if err != nil {
		return err
	}

	// Dispatch emails out of transaction
	if parentUserFound {
		// 1. Send Payment Success / Receipt Email
		var receiptTemplate model.EmailTemplate
		if err := db.Session(&gorm.Session{}).Model(&model.EmailTemplate{}).Where("type = ?", model.TypePaymentSuccess).First(&receiptTemplate).Error; err == nil {
			// Format final amount
			amountStr := strconv.FormatFloat(finalAmount, 'f', 0, 64)
			var formattedAmount []rune
			for i, digit := range amountStr {
				if i > 0 && (len(amountStr)-i)%3 == 0 {
					formattedAmount = append(formattedAmount, '.')
				}
				formattedAmount = append(formattedAmount, digit)
			}

			loc, err := time.LoadLocation("Asia/Jakarta")
			if err != nil {
				loc = time.UTC
			}
			paidAtStr := now.In(loc).Format("02 Jan 2006 15:04 WIB")

			receiptData := common.LMSPaymentReceiptEmailData{
				PICName:       parentUser.DisplayName,
				OrderID:       payment.ID.String(),
				PaidAt:        paidAtStr,
				TotalDiscount: "0",
				FinalAmount:   fmt.Sprintf("Rp %s", string(formattedAmount)),
			}

			if err := common.QueueLMSPaymentReceiptEmail(
				receiptTemplate.FromAddress,
				parentUser.Email,
				receiptTemplate.Subject,
				receiptData,
				receiptTemplate.TencentTemplateID,
			); err != nil {
				log.Error("failed to queue LMS payment receipt email", zap.Error(err), zap.String("email", parentUser.Email))
			} else {
				log.Info("LMS payment receipt email queued", zap.String("email", parentUser.Email))
			}
		} else {
			log.Error("payment success email template not found", zap.Error(err), zap.String("template_type", string(model.TypePaymentSuccess)))
		}

		// 2. Send Activation Link Email
		if shouldSendActivationEmail && activationToken != "" {
			var activationTemplate model.EmailTemplate
			if err := db.Session(&gorm.Session{}).Model(&model.EmailTemplate{}).Where("type = ?", model.TypeActivation).First(&activationTemplate).Error; err == nil {
				siteURL := paymentSiteURL(db, payment)
				activationLink := fmt.Sprintf("%s/aktivasi?token=%s", siteURL, activationToken)

				common.SysLog("==========================================================")
				common.SysLog(fmt.Sprintf("ACTIVATION LINK FOR %s: %s", parentUser.Email, activationLink))
				common.SysLog("==========================================================")
				fmt.Printf("ACTIVATION LINK FOR %s: %s\n", parentUser.Email, activationLink)

				activationData := common.LMSActivationEmailData{
					Name:           parentUser.DisplayName,
					ActivationLink: activationLink,
				}

				if err := common.QueueLMSActivationEmail(
					activationTemplate.FromAddress,
					parentUser.Email,
					activationTemplate.Subject,
					activationData,
					activationTemplate.TencentTemplateID,
				); err != nil {
					log.Error("failed to queue LMS activation email", zap.Error(err), zap.String("email", parentUser.Email))
				} else {
					log.Info("LMS activation email queued", zap.String("email", parentUser.Email))
				}
			} else {
				log.Error("activation email template not found", zap.Error(err), zap.String("template_type", string(model.TypeActivation)))
			}
		}
	}

	return nil
}

func pushSubscriptionPaymentAdminNotifications(tx *gorm.DB, payment *model.LMSPayment, parentUser model.User, planName string, amountFmt string) {
	var admins []model.User
	query := tx.Set("skip_tenant_scope", true).
		Where("role IN ? AND status = ?", []int{common.RoleAdminUser, common.RoleSuperAdminUser}, common.UserStatusEnabled)
	if payment.TenantID != nil {
		query = query.Where("(tenant_id = ? OR (role = ? AND tenant_id IS NULL))", *payment.TenantID, common.RoleSuperAdminUser)
	}
	if err := query.Find(&admins).Error; err != nil || len(admins) == 0 {
		return
	}

	buyerName := userNotificationName(parentUser)
	studentInfo := ""
	if payment.StudentID != uuid.Nil && payment.StudentID != payment.ParentID {
		var student model.User
		if err := tx.Set("skip_tenant_scope", true).First(&student, "id = ?", payment.StudentID).Error; err == nil {
			studentInfo = fmt.Sprintf(" untuk siswa %s", userNotificationName(student))
		}
	}

	title := "Pembelian Paket Berhasil"
	content := fmt.Sprintf("%s berhasil membeli atau memperpanjang paket %s%s sebesar Rp%s.", buyerName, planName, studentInfo, amountFmt)
	for _, admin := range admins {
		_ = model.PushNotification(tx, admin.ID, admin.TenantID, title, content, "success")
	}
}

func userNotificationName(user model.User) string {
	name := strings.TrimSpace(user.DisplayName)
	if name == "" {
		name = strings.TrimSpace(user.FirstName + " " + user.LastName)
	}
	if name == "" {
		name = strings.TrimSpace(user.Email)
	}
	if name == "" {
		name = strings.TrimSpace(user.Username)
	}
	if name == "" {
		return "User"
	}
	return name
}

func ensureLMSActivationEmail(db *gorm.DB, payment *model.LMSPayment) error {
	log := zap.L().With(
		zap.String("func", "ensureLMSActivationEmail"),
		zap.String("payment_id", payment.ID.String()),
	)

	var parentUser model.User
	if err := db.First(&parentUser, "id = ?", payment.ParentID).Error; err != nil {
		log.Error("parent user not found for LMS activation email", zap.Error(err))
		return err
	}

	var activeTokenCount int64
	if err := db.Model(&model.UserActivation{}).
		Where("user_id = ? AND used = ? AND expires_at > ?", parentUser.ID, false, time.Now()).
		Count(&activeTokenCount).Error; err != nil {
		log.Error("failed to check existing LMS activation token", zap.Error(err), zap.String("email", parentUser.Email))
		return err
	}
	if activeTokenCount > 0 {
		log.Info("active LMS activation token already exists", zap.String("email", parentUser.Email))
		return nil
	}

	token := common.GenerateVerificationCode(32)
	activation := model.UserActivation{
		ID:        uuid.New(),
		UserID:    parentUser.ID,
		Token:     token,
		ExpiresAt: time.Now().Add(24 * time.Hour),
		Used:      false,
		TenantID:  payment.TenantID,
	}
	if err := db.Create(&activation).Error; err != nil {
		log.Error("failed to create LMS activation token", zap.Error(err), zap.String("email", parentUser.Email))
		return err
	}

	return queueLMSActivationEmail(db, payment, parentUser, token, log)
}

func queueLMSActivationEmail(db *gorm.DB, payment *model.LMSPayment, parentUser model.User, activationToken string, log *zap.Logger) error {
	var activationTemplate model.EmailTemplate
	if err := db.Session(&gorm.Session{}).Model(&model.EmailTemplate{}).Where("type = ?", model.TypeActivation).First(&activationTemplate).Error; err != nil {
		log.Error("activation email template not found", zap.Error(err), zap.String("template_type", string(model.TypeActivation)))
		return err
	}

	siteURL := paymentSiteURL(db, payment)
	activationLink := fmt.Sprintf("%s/aktivasi?token=%s", siteURL, activationToken)

	common.SysLog("==========================================================")
	common.SysLog(fmt.Sprintf("ACTIVATION LINK FOR %s: %s", parentUser.Email, activationLink))
	common.SysLog("==========================================================")
	fmt.Printf("ACTIVATION LINK FOR %s: %s\n", parentUser.Email, activationLink)

	activationData := common.LMSActivationEmailData{
		Name:           parentUser.DisplayName,
		ActivationLink: activationLink,
	}

	if err := common.QueueLMSActivationEmail(
		activationTemplate.FromAddress,
		parentUser.Email,
		activationTemplate.Subject,
		activationData,
		activationTemplate.TencentTemplateID,
	); err != nil {
		log.Error("failed to queue LMS activation email", zap.Error(err), zap.String("email", parentUser.Email))
		return err
	}

	log.Info("LMS activation email queued", zap.String("email", parentUser.Email), zap.String("payment_id", payment.ID.String()))
	return nil
}

func paymentSiteURL(db *gorm.DB, payment *model.LMSPayment) string {
	if payment != nil && len(payment.GatewayData) > 0 {
		var payload map[string]interface{}
		if err := json.Unmarshal(payment.GatewayData, &payload); err == nil {
			if raw, ok := payload["checkout_site_url"].(string); ok {
				if siteURL := normalizeCheckoutSiteURL(raw); siteURL != "" {
					return siteURL
				}
			}
		}
	}
	if payment == nil {
		return "http://localhost:8080"
	}
	return getTenantURL(db, payment.TenantID)
}

func getTenantURL(db *gorm.DB, tenantID *uuid.UUID) string {
	if tenantID == nil {
		return "http://localhost:8080"
	}
	var tenant model.Tenant
	if err := db.Session(&gorm.Session{}).Set("skip_tenant_scope", true).First(&tenant, "id = ?", *tenantID).Error; err != nil {
		return "http://localhost:8080"
	}
	domain := tenant.Domain
	if domain == "" {
		return "http://localhost:8080"
	}
	if !strings.HasPrefix(domain, "http://") && !strings.HasPrefix(domain, "https://") {
		if strings.Contains(domain, "localhost") || strings.Contains(domain, ".local") || !strings.Contains(domain, ".") {
			domain = "http://" + domain
		} else {
			domain = "https://" + domain
		}
	}
	return strings.TrimRight(domain, "/")
}
