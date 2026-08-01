package controller

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"gin-template/common"
	"gin-template/model"
	"gin-template/services"
	"math"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type GuestCheckoutRequest struct {
	ParentName      string `json:"parent_name"`
	ParentUsername  string `json:"parent_username"`
	ParentEmail     string `json:"parent_email"`
	ParentPhone     string `json:"parent_phone"`
	StudentName     string `json:"student_name"`
	StudentNisn     string `json:"student_nisn"`
	TeacherName     string `json:"teacher_name"`
	TeacherUsername string `json:"teacher_username"`
	TeacherEmail    string `json:"teacher_email"`
	Whatsapp        string `json:"whatsapp"`
	City            string `json:"city"`
	Institution     string `json:"institution"`
	TeachingStatus  string `json:"teaching_status"`
	Simpkb          string `json:"simpkb"`
	Nuptk           string `json:"nuptk"`
	Gtk             string `json:"gtk"`
	Declaration     bool   `json:"declaration"`
	PlanID          string `json:"plan_id" binding:"required"`
	PaymentMethod   string `json:"payment_method" binding:"required"`
	PromoCode       string `json:"promo_code"`
}

type ActivateAccountRequest struct {
	Token    string `json:"token" binding:"required"`
	Password string `json:"password" binding:"required,min=8"`
}

type ValidateGuestPromoRequest struct {
	PlanID    string `json:"plan_id" binding:"required"`
	PromoCode string `json:"promo_code" binding:"required"`
}

type checkoutPromoDiscount struct {
	ID             uuid.UUID `json:"id"`
	Code           string    `json:"code"`
	DiscountAmount float64   `json:"discount_amount"`
	OriginalAmount float64   `json:"original_amount"`
	FinalAmount    float64   `json:"final_amount"`
}

func saveTeacherVerificationProfile(db *gorm.DB, user model.User, req GuestCheckoutRequest, tenantID *uuid.UUID) error {
	var profile model.Profile
	err := db.Where("user_id = ?", user.ID).First(&profile).Error
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		profile = model.Profile{
			ID:          uuid.New(),
			UserID:      user.ID,
			FullName:    req.TeacherName,
			DisplayName: req.TeacherName,
			PhoneNumber: req.Whatsapp,
			TenantID:    tenantID,
		}
	} else {
		profile.FullName = req.TeacherName
		profile.DisplayName = req.TeacherName
		profile.PhoneNumber = req.Whatsapp
	}

	metadata := jsonMetadata(profile.Metadata)
	verification := map[string]interface{}{
		"status":          "submitted",
		"checkout_type":   "teacher",
		"teacher_name":    req.TeacherName,
		"teacher_email":   req.TeacherEmail,
		"whatsapp":        req.Whatsapp,
		"city":            req.City,
		"institution":     req.Institution,
		"teaching_status": req.TeachingStatus,
		"simpkb":          req.Simpkb,
		"nuptk":           req.Nuptk,
		"gtk":             req.Gtk,
		"declaration":     req.Declaration,
		"submitted_at":    time.Now().UTC().Format(time.RFC3339),
		"source":          "guru2digit_checkout",
	}
	metadata["teacher_verification"] = verification
	metadata["checkout_type"] = "teacher"
	metadata["city"] = req.City
	metadata["institution"] = req.Institution
	metadata["teaching_status"] = req.TeachingStatus
	metadata["whatsapp"] = req.Whatsapp

	raw, err := json.Marshal(metadata)
	if err != nil {
		return err
	}
	profile.Metadata = raw
	return db.Save(&profile).Error
}

func normalizePromoCode(code string) string {
	return strings.ToUpper(strings.TrimSpace(code))
}

func calculateCheckoutPromoDiscount(promo model.PromoCode, amount float64) float64 {
	if amount <= 0 {
		return 0
	}

	discount := 0.0
	switch promo.DiscountType {
	case model.DiscountPercent:
		discount = amount * (promo.DiscountValue / 100)
		if promo.MaxDiscount > 0 && discount > promo.MaxDiscount {
			discount = promo.MaxDiscount
		}
	case model.DiscountFixed:
		discount = promo.DiscountValue
	}

	if discount > amount {
		discount = amount
	}
	return math.Round(discount)
}

func validateCheckoutPromo(db *gorm.DB, code string, amount float64, participants int) (*checkoutPromoDiscount, error) {
	code = normalizePromoCode(code)
	if code == "" {
		return nil, nil
	}
	if participants < 1 {
		participants = 1
	}

	var promo model.PromoCode
	if err := db.Where("UPPER(code) = ?", code).First(&promo).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("kode promo tidak valid")
		}
		return nil, fmt.Errorf("gagal memvalidasi kode promo: %w", err)
	}

	now := time.Now().UTC()
	if !promo.IsActive {
		return nil, errors.New("kode promo sudah tidak aktif")
	}
	if promo.StartAt != nil && now.Before(promo.StartAt.UTC()) {
		return nil, errors.New("kode promo belum berlaku")
	}
	if promo.EndAt != nil && now.After(promo.EndAt.UTC()) {
		return nil, errors.New("kode promo sudah kedaluwarsa")
	}
	if participants < promo.MinParticipants {
		return nil, fmt.Errorf("kode promo '%s' membutuhkan minimal %d peserta", promo.Code, promo.MinParticipants)
	}
	if promo.UsedQuota+participants > promo.Quota {
		return nil, errors.New("kuota kode promo tidak mencukupi")
	}

	discount := calculateCheckoutPromoDiscount(promo, amount)
	if discount <= 0 {
		return nil, errors.New("kode promo tidak dapat digunakan untuk paket ini")
	}

	return &checkoutPromoDiscount{
		ID:             promo.ID,
		Code:           promo.Code,
		DiscountAmount: discount,
		OriginalAmount: amount,
		FinalAmount:    amount - discount,
	}, nil
}

func incrementPromoUsage(db *gorm.DB, discount *checkoutPromoDiscount, participants int) error {
	if discount == nil {
		return nil
	}
	if participants < 1 {
		participants = 1
	}
	result := db.Model(&model.PromoCode{}).
		Where("id = ? AND used_quota + ? <= quota", discount.ID, participants).
		UpdateColumn("used_quota", gorm.Expr("used_quota + ?", participants))
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("kuota kode promo tidak mencukupi")
	}
	return nil
}

// checkoutEmailExists mirrors the global unique constraints on users. Guest
// checkout uses the email as both email and username, so soft-deleted users and
// users from another tenant must also make the address unavailable.
func checkoutEmailExists(db *gorm.DB, email string) (bool, error) {
	var count int64
	err := db.Set("skip_tenant_scope", true).
		Unscoped().
		Model(&model.User{}).
		Where("LOWER(email) = ? OR LOWER(username) = ?", email, email).
		Count(&count).Error
	return count > 0, err
}

var checkoutUsernamePattern = regexp.MustCompile(`^[a-z0-9._-]{3,30}$`)

func normalizeCheckoutUsername(username string) string {
	return strings.ToLower(strings.TrimSpace(username))
}

func checkoutUsernameExists(db *gorm.DB, username string) (bool, error) {
	var count int64
	err := db.Set("skip_tenant_scope", true).
		Unscoped().
		Model(&model.User{}).
		Where("LOWER(username) = ?", normalizeCheckoutUsername(username)).
		Count(&count).Error
	return count > 0, err
}

func promoGatewayData(siteURL string, discount *checkoutPromoDiscount) []byte {
	payload := map[string]interface{}{}
	if siteURL != "" {
		payload["checkout_site_url"] = siteURL
	}
	if discount != nil {
		payload["promo_code"] = discount.Code
		payload["promo_discount_amount"] = discount.DiscountAmount
		payload["promo_original_amount"] = discount.OriginalAmount
		payload["promo_final_amount"] = discount.FinalAmount
	}
	if len(payload) == 0 {
		return nil
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return nil
	}
	return raw
}

func (ctrl *LMSController) ValidateGuestPromo(c *gin.Context) {
	var req ValidateGuestPromoRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}

	db := lmsDB(c, ctrl.DB).WithContext(c)
	var plan model.SubscriptionPlan
	if err := db.Where("id = ? AND is_active = ?", req.PlanID, true).First(&plan).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			sendError(c, http.StatusNotFound, "Subscription plan not found", nil)
			return
		}
		sendInternalError(c, err)
		return
	}

	discount, err := validateCheckoutPromo(db, req.PromoCode, plan.Amount, 1)
	if err != nil {
		sendBadRequest(c, err.Error(), nil)
		return
	}

	sendSuccess(c, discount, "Promo code applied successfully")
}

func trialAccountIdentity(prefix string) (string, string) {
	compactID := strings.ReplaceAll(uuid.NewString(), "-", "")
	username := prefix + compactID[:10]
	return username, username + "@trial.kitafuture.local"
}

func (ctrl *LMSController) createEmailFreeTrialCheckout(
	c *gin.Context,
	db *gorm.DB,
	plan model.SubscriptionPlan,
	req GuestCheckoutRequest,
	tenantID *uuid.UUID,
) {
	if tenantID == nil || *tenantID == uuid.Nil {
		sendInternalError(c, errors.New("tenant_id is required for security isolation"))
		return
	}
	if plan.RequiresApproval {
		sendBadRequest(c, "Paket ini membutuhkan persetujuan admin dan tidak mendukung coba gratis otomatis", nil)
		return
	}

	parentUsername := req.ParentUsername
	parentInternalEmail := parentUsername + "@trial.kitafuture.local"
	studentUsername, studentInternalEmail := trialAccountIdentity("ts")
	parentPassword, err := common.Password2Hash(uuid.NewString() + uuid.NewString())
	if err != nil {
		sendInternalError(c, err)
		return
	}
	studentPassword, err := common.Password2Hash(uuid.NewString() + uuid.NewString())
	if err != nil {
		sendInternalError(c, err)
		return
	}

	now := time.Now().UTC()
	expiresAt := now.Add(7 * 24 * time.Hour)
	parent := model.User{
		ID:          uuid.New(),
		Username:    parentUsername,
		Email:       parentInternalEmail,
		Password:    parentPassword,
		DisplayName: req.ParentName,
		PhoneNumber: req.ParentPhone,
		Role:        model.RoleParent,
		Status:      common.UserStatusEnabled,
		TenantID:    tenantID,
	}
	student := model.User{
		ID:          uuid.New(),
		Username:    studentUsername,
		Email:       studentInternalEmail,
		Password:    studentPassword,
		DisplayName: req.StudentName,
		Role:        model.RoleStudent,
		Status:      common.UserStatusEnabled,
		TenantID:    tenantID,
	}

	var subscription model.Subscription
	var payment model.LMSPayment
	var handoffToken string
	var handoffExpiresAt time.Time

	err = db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&parent).Error; err != nil {
			return err
		}
		if err := tx.Create(&student).Error; err != nil {
			return err
		}
		if err := tx.Model(&model.Profile{}).
			Where("user_id = ?", student.ID).
			Update("nisn", req.StudentNisn).Error; err != nil {
			return err
		}

		membership := model.Membership{
			ParentID:  parent.ID,
			StudentID: student.ID,
			Status:    "active",
			TenantID:  tenantID,
		}
		if err := tx.Create(&membership).Error; err != nil {
			return err
		}

		subscription = model.Subscription{
			ID:                     uuid.New(),
			ParentID:               parent.ID,
			StudentID:              student.ID,
			Status:                 model.SubscriptionStatusTrialing,
			Provider:               "internal",
			ProviderPlanID:         plan.ID.String(),
			PlanID:                 &plan.ID,
			ProviderSubscriptionID: "free-trial-" + uuid.NewString(),
			Amount:                 0,
			Currency:               defaultCurrency(plan.Currency),
			Interval:               plan.Interval,
			CurrentPeriodStart:     &now,
			CurrentPeriodEnd:       &expiresAt,
			TenantID:               tenantID,
		}
		if err := tx.Create(&subscription).Error; err != nil {
			return err
		}

		paymentID := uuid.New()
		paidAt := now
		payment = model.LMSPayment{
			ID:             paymentID,
			SubscriptionID: &subscription.ID,
			ParentID:       parent.ID,
			StudentID:      student.ID,
			Provider:       "internal",
			ExternalID:     paymentID.String(),
			PaymentType:    "free_trial",
			Amount:         0,
			Currency:       defaultCurrency(plan.Currency),
			Status:         model.LMSPaymentPaid,
			PaidAt:         &paidAt,
			ExpiryDate:     &expiresAt,
			TenantID:       tenantID,
		}
		if err := tx.Create(&payment).Error; err != nil {
			return err
		}

		handoffToken, handoffExpiresAt, err = createAuthHandoff(tx, parent.ID, tenantID)
		return err
	})
	if err != nil {
		sendInternalError(c, err)
		return
	}

	sendSuccess(c, gin.H{
		"plan":         plan,
		"subscription": subscription,
		"payment":      payment,
		"payment_data": gin.H{
			"transaction_id": payment.ID.String(),
			"payment_type":   "free_trial",
			"expiry_date":    expiresAt.Format(time.RFC3339),
			"total_amount":   0,
		},
		"requires_payment":   false,
		"is_new_parent":      true,
		"auth_handoff":       handoffToken,
		"handoff_expires_at": handoffExpiresAt.Format(time.RFC3339),
	}, "Free trial account created successfully")
}

func (ctrl *LMSController) GuestCheckout(c *gin.Context) {
	var req GuestCheckoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}

	db := lmsDB(c, ctrl.DB).WithContext(c)
	var plan model.SubscriptionPlan
	if err := db.Preload("PricingCategory").Where("id = ? AND is_active = ?", req.PlanID, true).First(&plan).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			sendError(c, http.StatusNotFound, "Subscription plan not found", nil)
			return
		}
		sendInternalError(c, err)
		return
	}
	planAmount := plan.Amount
	planCurrency := defaultCurrency(plan.Currency)

	checkoutType := "parent_child"
	if plan.PricingCategory != nil && plan.PricingCategory.CheckoutType != "" {
		checkoutType = plan.PricingCategory.CheckoutType
	}
	isTrial := req.PaymentMethod == "free_trial"

	if checkoutType == "teacher" {
		if isTrial {
			sendBadRequest(c, "Coba gratis tanpa email hanya tersedia untuk akun merchant dan partner", nil)
			return
		}
		req.TeacherName = strings.TrimSpace(req.TeacherName)
		req.TeacherUsername = normalizeCheckoutUsername(req.TeacherUsername)
		req.TeacherEmail = strings.TrimSpace(strings.ToLower(req.TeacherEmail))
		req.Whatsapp = strings.TrimSpace(req.Whatsapp)
		req.City = strings.TrimSpace(req.City)
		req.Institution = strings.TrimSpace(req.Institution)
		req.TeachingStatus = strings.TrimSpace(req.TeachingStatus)
		req.Simpkb = strings.TrimSpace(req.Simpkb)
		req.Nuptk = strings.TrimSpace(req.Nuptk)
		req.Gtk = strings.TrimSpace(req.Gtk)
		if req.TeacherName == "" || req.TeacherUsername == "" || req.TeacherEmail == "" || req.Whatsapp == "" || req.City == "" || req.Institution == "" || req.TeachingStatus == "" {
			sendBadRequest(c, "Informasi tenaga pendidik wajib diisi lengkap", nil)
			return
		}
		if req.Simpkb == "" && req.Nuptk == "" && req.Gtk == "" {
			sendBadRequest(c, "Wajib mengisi minimal salah satu metode verifikasi (SIMPKB / NUPTK / No GTK)", nil)
			return
		}
		if !req.Declaration {
			sendBadRequest(c, "Pernyataan kebenaran data wajib disetujui", nil)
			return
		}
	} else {
		req.ParentName = strings.TrimSpace(req.ParentName)
		req.ParentUsername = normalizeCheckoutUsername(req.ParentUsername)
		req.ParentEmail = strings.TrimSpace(strings.ToLower(req.ParentEmail))
		req.ParentPhone = strings.TrimSpace(req.ParentPhone)
		req.StudentName = strings.TrimSpace(req.StudentName)
		req.StudentNisn = strings.TrimSpace(req.StudentNisn)
		if req.ParentName == "" || req.ParentUsername == "" || (!isTrial && req.ParentEmail == "") || req.ParentPhone == "" || req.StudentName == "" || req.StudentNisn == "" {
			sendBadRequest(c, "Informasi Merchant dan Partner wajib diisi lengkap", nil)
			return
		}
	}

	checkoutUsername := req.ParentUsername
	if checkoutType == "teacher" {
		checkoutUsername = req.TeacherUsername
	}
	if !checkoutUsernamePattern.MatchString(checkoutUsername) {
		sendBadRequest(c, "Username harus 3-30 karakter dan hanya boleh berisi huruf kecil, angka, titik, garis bawah, atau tanda hubung", nil)
		return
	}
	usernameTaken, err := checkoutUsernameExists(db, checkoutUsername)
	if err != nil {
		sendInternalError(c, err)
		return
	}
	if usernameTaken {
		sendBadRequest(c, "Username sudah digunakan", nil)
		return
	}

	var primaryUser model.User
	var secondaryUser model.User
	isNewParent := false

	// Get tenant from context
	var tenantID *uuid.UUID
	if tenant, ok := c.Get(common.CtxTenantKey); ok {
		if tObj, ok := tenant.(model.Tenant); ok {
			tenantID = &tObj.ID
		}
	}
	checkoutSiteURL := checkoutSiteURLFromRequest(c, db, tenantID)

	if isTrial {
		ctrl.createEmailFreeTrialCheckout(c, db, plan, req, tenantID)
		return
	}

	statusVal := 3
	if plan.RequiresApproval {
		statusVal = 4
	}

	if checkoutType == "teacher" {
		teacherEmail := req.TeacherEmail
		err := db.Set("skip_tenant_scope", true).Unscoped().Where("LOWER(email) = ?", teacherEmail).First(&primaryUser).Error
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				usernameTaken, lookupErr := checkoutEmailExists(db, teacherEmail)
				if lookupErr != nil {
					sendInternalError(c, lookupErr)
					return
				}
				if usernameTaken {
					sendBadRequest(c, "Email sudah terdaftar", nil)
					return
				}
				isNewParent = true
				primaryUser = model.User{
					ID:          uuid.New(),
					Username:    req.TeacherUsername,
					Email:       teacherEmail,
					DisplayName: req.TeacherName,
					Role:        model.RoleGuruExternal,
					Status:      statusVal,
					Password:    "placeholder_temp_pass_will_be_set_on_activation",
					TenantID:    tenantID,
				}
				if err := primaryUser.Insert(c); err != nil {
					sendInternalError(c, err)
					return
				}
			} else {
				sendInternalError(c, err)
				return
			}
		}
		if primaryUser.DeletedAt.Valid {
			sendBadRequest(c, "Email sudah terdaftar", nil)
			return
		}
		secondaryUser = primaryUser
		if err := saveTeacherVerificationProfile(db, primaryUser, req, tenantID); err != nil {
			sendInternalError(c, err)
			return
		}
	} else {
		parentEmail := strings.TrimSpace(strings.ToLower(req.ParentEmail))
		err := db.Set("skip_tenant_scope", true).Unscoped().Where("LOWER(email) = ?", parentEmail).First(&primaryUser).Error
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				usernameTaken, lookupErr := checkoutEmailExists(db, parentEmail)
				if lookupErr != nil {
					sendInternalError(c, lookupErr)
					return
				}
				if usernameTaken {
					sendBadRequest(c, "Email sudah terdaftar", nil)
					return
				}
				isNewParent = true
				primaryUser = model.User{
					ID:          uuid.New(),
					Username:    req.ParentUsername,
					Email:       parentEmail,
					DisplayName: req.ParentName,
					PhoneNumber: req.ParentPhone,
					Role:        model.RoleParent,
					Status:      statusVal,
					Password:    "placeholder_temp_pass_will_be_set_on_activation",
					TenantID:    tenantID,
				}
				if err := primaryUser.Insert(c); err != nil {
					sendInternalError(c, err)
					return
				}
			} else {
				sendInternalError(c, err)
				return
			}
		}
		if primaryUser.DeletedAt.Valid {
			sendBadRequest(c, "Email sudah terdaftar", nil)
			return
		}

		studentName := strings.TrimSpace(req.StudentName)
		studentUsername := strings.ToLower(strings.ReplaceAll(studentName, " ", "")) + "_" + common.GenerateRandomString(4)
		secondaryUser = model.User{
			ID:          uuid.New(),
			Username:    studentUsername,
			Email:       studentUsername + "@gmail.com",
			DisplayName: studentName,
			Role:        model.RoleStudent,
			Status:      statusVal,
			Password:    "placeholder_temp_pass_will_be_set_on_activation",
			TenantID:    tenantID,
		}
		if err := secondaryUser.Insert(c); err != nil {
			sendInternalError(c, err)
			return
		}

		// Update profile with student's NISN
		var studentProfile model.Profile
		if err := db.Where("user_id = ?", secondaryUser.ID).First(&studentProfile).Error; err == nil {
			studentProfile.Nisn = req.StudentNisn
			if err := db.Save(&studentProfile).Error; err != nil {
				sendInternalError(c, err)
				return
			}
		}

		membership := model.Membership{
			ID:        uuid.New(),
			ParentID:  primaryUser.ID,
			StudentID: secondaryUser.ID,
			Status:    "active",
			TenantID:  tenantID,
		}
		if err := db.Create(&membership).Error; err != nil {
			sendInternalError(c, err)
			return
		}
	}

	now := time.Now()
	isApproval := req.PaymentMethod == "approval" || plan.RequiresApproval
	var promoDiscount *checkoutPromoDiscount
	chargeAmount := planAmount
	if !isTrial && !isApproval && strings.TrimSpace(req.PromoCode) != "" {
		var err error
		promoDiscount, err = validateCheckoutPromo(db, req.PromoCode, planAmount, 1)
		if err != nil {
			sendBadRequest(c, err.Error(), nil)
			return
		}
		chargeAmount = promoDiscount.FinalAmount
	}

	var subStatus model.SubscriptionStatus
	var currentPeriodEnd *time.Time
	var paymentStatus model.LMSPaymentStatus
	var providerName string
	var amountValue float64
	var subProviderID string

	if isApproval {
		subStatus = "pending_approval"
		paymentStatus = model.LMSPaymentPending
		providerName = "approval"
		amountValue = 0
		subProviderID = "approval-" + uuid.NewString()
	} else if isTrial {
		subStatus = model.SubscriptionStatusTrialing
		expiry := now.Add(7 * 24 * time.Hour)
		currentPeriodEnd = &expiry
		paymentStatus = model.LMSPaymentPaid
		providerName = "internal"
		amountValue = 0
		subProviderID = "free-trial-" + uuid.NewString()
	} else {
		subStatus = model.SubscriptionStatusPastDue
		paymentStatus = model.LMSPaymentPending
		providerName = "xendit"
		amountValue = chargeAmount
		subProviderID = "checkout-" + uuid.NewString()
		if chargeAmount <= 0 {
			providerName = "promo"
			subProviderID = "promo-" + uuid.NewString()
		}
	}

	subscription := model.Subscription{
		ID:                     uuid.New(),
		ParentID:               primaryUser.ID,
		StudentID:              secondaryUser.ID,
		Status:                 subStatus,
		Provider:               providerName,
		ProviderPlanID:         plan.ID.String(),
		PlanID:                 &plan.ID,
		ProviderSubscriptionID: subProviderID,
		Amount:                 amountValue,
		Currency:               planCurrency,
		Interval:               plan.Interval,
		CurrentPeriodStart:     &now,
		CurrentPeriodEnd:       currentPeriodEnd,
		TenantID:               tenantID,
	}
	if err := db.Create(&subscription).Error; err != nil {
		sendInternalError(c, err)
		return
	}

	paymentID := uuid.New()
	payment := model.LMSPayment{
		ID:             paymentID,
		SubscriptionID: &subscription.ID,
		ParentID:       primaryUser.ID,
		StudentID:      secondaryUser.ID,
		Provider:       providerName,
		ExternalID:     paymentID.String(),
		Amount:         amountValue,
		Currency:       planCurrency,
		Status:         paymentStatus,
		GatewayData:    promoGatewayData(checkoutSiteURL, promoDiscount),
		TenantID:       tenantID,
	}
	if err := db.Create(&payment).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	if err := incrementPromoUsage(db, promoDiscount, 1); err != nil {
		sendBadRequest(c, err.Error(), nil)
		return
	}

	var paymentResult *services.XenditPaymentResult
	if isApproval {
		paymentResult = &services.XenditPaymentResult{
			TransactionID: payment.ID.String(),
			PaymentType:   "approval",
			ExpiryDate:    "",
			TotalAmount:   0,
		}
	} else if isTrial {
		paymentResult = &services.XenditPaymentResult{
			TransactionID: payment.ID.String(),
			PaymentType:   "free_trial",
			ExpiryDate:    time.Now().Add(7 * 24 * time.Hour).Format("2006-01-02T15:04:05Z"),
			TotalAmount:   0,
		}
		// Send activation email immediately
		_ = setPaymentCheckoutSiteURL(db, &payment, checkoutSiteURL)
		_ = ensureLMSActivationEmail(db, &payment)
	} else if chargeAmount <= 0 {
		paidAt := time.Now().UTC()
		payment.PaidAt = &paidAt
		paymentResult = &services.XenditPaymentResult{
			TransactionID: payment.ID.String(),
			PaymentType:   "promo",
			ExpiryDate:    "",
			PlanAmount:    planAmount,
			CreditAmount:  0,
			ChargeAmount:  0,
			FinalAmount:   0,
			TotalAmount:   0,
		}
		if promoDiscount != nil {
			paymentResult.CreditAmount = promoDiscount.DiscountAmount
			paymentResult.PromoCode = promoDiscount.Code
		}
		_ = setPaymentCheckoutSiteURL(db, &payment, checkoutSiteURL)
		_ = setPaymentPromoData(db, &payment, promoDiscount)
		_ = processLMSPaymentSuccess(db, &payment, paidAt)
	} else {
		res, err := services.CreateLMSXenditPaymentRequest(c, db, &payment, primaryUser, req.PaymentMethod)
		if err != nil {
			sendError(c, http.StatusBadGateway, err.Error(), nil)
			return
		}
		paymentResult = res
		paymentResult.PlanAmount = planAmount
		paymentResult.CreditAmount = 0
		if promoDiscount != nil {
			paymentResult.CreditAmount = promoDiscount.DiscountAmount
			paymentResult.PromoCode = promoDiscount.Code
		}
		paymentResult.ChargeAmount = payment.Amount
		paymentResult.FinalAmount = payment.Amount
		paymentResult.TotalAmount = payment.TotalAmount
		_ = setPaymentCheckoutSiteURL(db, &payment, checkoutSiteURL)
		_ = setPaymentPromoData(db, &payment, promoDiscount)

		// Format price for email
		priceStr := strconv.FormatFloat(payment.Amount, 'f', 0, 64)
		var formattedPrice []rune
		for i, digit := range priceStr {
			if i > 0 && (len(priceStr)-i)%3 == 0 {
				formattedPrice = append(formattedPrice, '.')
			}
			formattedPrice = append(formattedPrice, digit)
		}

		// Fetch template and queue email
		var emailTemplate model.EmailTemplate
		err = db.Model(&model.EmailTemplate{}).
			Where("type = ?", model.TypePaymentLink).
			First(&emailTemplate).Error
		if err == nil {
			siteURL := paymentSiteURL(db, &payment)
			paymentLink := fmt.Sprintf("%s/pembayaran?payment_id=%s", siteURL, payment.ID.String())
			expiryStr := paymentResult.ExpiryDate
			if expiryStr == "" {
				expiryStr = time.Now().Add(24 * time.Hour).Format("02 Jan 2006 15:04 WIB")
			}

			emailData := common.LMSPaymentLinkEmailData{
				Name:       primaryUser.DisplayName,
				OrderID:    payment.ID.String(),
				Amount:     string(formattedPrice),
				PaymentURL: paymentLink,
				ExpiryDate: expiryStr,
			}

			_ = common.QueueLMSPaymentLinkEmail(
				emailTemplate.FromAddress,
				primaryUser.Email,
				emailTemplate.Subject,
				emailData,
				emailTemplate.TencentTemplateID,
			)
		}
	}

	methods, _ := services.BuildPaymentMethodOptions(db, planAmount)

	sendSuccess(c, gin.H{
		"plan":             plan,
		"subscription":     subscription,
		"payment":          payment,
		"payment_data":     paymentResult,
		"payment_methods":  methods,
		"requires_payment": !isTrial,
		"is_new_parent":    isNewParent,
	}, "Guest checkout created successfully")
}

func checkoutSiteURLFromRequest(c *gin.Context, db *gorm.DB, tenantID *uuid.UUID) string {
	for _, raw := range []string{
		c.GetHeader("Origin"),
		c.GetHeader("Referer"),
		forwardedHostURL(c),
		requestHostURL(c),
	} {
		if siteURL := normalizeCheckoutSiteURL(raw); siteURL != "" {
			return siteURL
		}
	}
	return getTenantURL(db, tenantID)
}

func forwardedHostURL(c *gin.Context) string {
	host := strings.TrimSpace(c.GetHeader("X-Forwarded-Host"))
	if host == "" {
		return ""
	}
	proto := strings.TrimSpace(c.GetHeader("X-Forwarded-Proto"))
	if proto == "" {
		proto = "https"
	}
	return proto + "://" + host
}

func requestHostURL(c *gin.Context) string {
	host := strings.TrimSpace(c.Request.Host)
	if host == "" {
		return ""
	}
	scheme := "https"
	if c.Request.TLS == nil {
		scheme = "http"
	}
	return scheme + "://" + host
}

func normalizeCheckoutSiteURL(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		return ""
	}
	if parsed.Scheme == "" {
		parsed, err = url.Parse("https://" + raw)
		if err != nil {
			return ""
		}
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return ""
	}
	if parsed.Host == "" {
		return ""
	}
	return strings.TrimRight(parsed.Scheme+"://"+parsed.Host, "/")
}

func setPaymentCheckoutSiteURL(db *gorm.DB, payment *model.LMSPayment, siteURL string) error {
	siteURL = normalizeCheckoutSiteURL(siteURL)
	if siteURL == "" {
		return nil
	}
	payload := map[string]interface{}{}
	if len(payment.GatewayData) > 0 {
		_ = json.Unmarshal(payment.GatewayData, &payload)
	}
	payload["checkout_site_url"] = siteURL
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	payment.GatewayData = raw
	return db.Model(payment).Update("gateway_data", payment.GatewayData).Error
}

func setPaymentPromoData(db *gorm.DB, payment *model.LMSPayment, discount *checkoutPromoDiscount) error {
	if discount == nil {
		return nil
	}
	payload := map[string]interface{}{}
	if len(payment.GatewayData) > 0 {
		_ = json.Unmarshal(payment.GatewayData, &payload)
	}
	payload["promo_code"] = discount.Code
	payload["promo_discount_amount"] = discount.DiscountAmount
	payload["promo_original_amount"] = discount.OriginalAmount
	payload["promo_final_amount"] = discount.FinalAmount
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	payment.GatewayData = raw
	return db.Model(payment).Update("gateway_data", payment.GatewayData).Error
}

func (ctrl *LMSController) ActivateAccount(c *gin.Context) {
	var req ActivateAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}

	db := lmsDB(c, ctrl.DB).WithContext(c)
	var activation model.UserActivation
	if err := db.Set("skip_tenant_scope", true).Where("token = ? AND used = ? AND expires_at > ?", req.Token, false, time.Now()).First(&activation).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			sendBadRequest(c, "Token aktivasi tidak valid atau sudah kadaluarsa", nil)
			return
		}
		sendInternalError(c, err)
		return
	}

	if activation.TenantID != nil {
		var tenant model.Tenant
		if err := db.Set("skip_tenant_scope", true).First(&tenant, "id = ?", *activation.TenantID).Error; err == nil {
			c.Set(common.CtxTenantKey, tenant)
			ctx := context.WithValue(c.Request.Context(), common.CtxTenantKey, tenant)
			db = db.WithContext(ctx)
		}
	}

	var user model.User
	if err := db.Set("skip_tenant_scope", true).First(&user, "id = ?", activation.UserID).Error; err != nil {
		sendInternalError(c, err)
		return
	}

	hashedPassword, err := common.Password2Hash(req.Password)
	if err != nil {
		sendInternalError(c, err)
		return
	}

	err = db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Set("skip_tenant_scope", true).Model(&user).Updates(map[string]interface{}{
			"password": hashedPassword,
			"status":   common.UserStatusEnabled,
		}).Error; err != nil {
			return err
		}

		if err := tx.Set("skip_tenant_scope", true).Model(&activation).Update("used", true).Error; err != nil {
			return err
		}

		// Activate associated student accounts too
		var memberships []model.Membership
		if err := tx.Set("skip_tenant_scope", true).Where("parent_id = ?", user.ID).Find(&memberships).Error; err == nil {
			var studentIDs []uuid.UUID
			for _, m := range memberships {
				studentIDs = append(studentIDs, m.StudentID)
			}
			if len(studentIDs) > 0 {
				if err := tx.Set("skip_tenant_scope", true).Model(&model.User{}).Where("id IN ?", studentIDs).Update("status", common.UserStatusEnabled).Error; err != nil {
					return err
				}
			}
		}

		return nil
	})

	if err != nil {
		sendInternalError(c, err)
		return
	}

	accessToken, refreshToken, err := generateTokens(&user)
	if err != nil {
		sendInternalError(c, err)
		return
	}

	sendSuccess(c, gin.H{
		"token":         accessToken,
		"refresh_token": refreshToken,
		"user":          user.ToResponse(false),
	}, "Account activated and logged in successfully")
}

func (ctrl *LMSController) GetGuestSubscriptionPayment(c *gin.Context) {
	id, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}

	db := lmsDB(c, ctrl.DB).WithContext(c)
	query := db.Where("id = ?", id)

	// Optional email check — adds a second factor for guest payment lookups
	// without breaking the guest (unauthenticated) checkout flow.
	if email := strings.TrimSpace(strings.ToLower(c.Query("email"))); email != "" {
		query = query.Where("parent_id IN (SELECT id FROM users WHERE LOWER(email) = ? AND deleted_at IS NULL)", email)
	}

	var payment model.LMSPayment
	if err := query.First(&payment).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			sendError(c, http.StatusNotFound, "Payment not found", nil)
			return
		}
		sendInternalError(c, err)
		return
	}

	if err := ctrl.syncLMSPaymentWithXendit(c, &payment); err != nil {
		sendInternalError(c, err)
		return
	}
	if payment.Status == model.LMSPaymentPaid {
		_ = ensureLMSActivationEmail(db, &payment)
	}

	planAmount := payment.Amount
	creditAmount := 0.0
	var subscription *model.Subscription
	var plan *model.SubscriptionPlan
	if payment.SubscriptionID != nil {
		var nextSubscription model.Subscription
		if err := db.Preload("Plan").First(&nextSubscription, "id = ?", *payment.SubscriptionID).Error; err == nil {
			subscription = &nextSubscription
			if nextSubscription.PendingChangeType == "upgrade" {
				planAmount = nextSubscription.PendingAmount
				if planAmount > payment.Amount {
					creditAmount = planAmount - payment.Amount
				}
			}
			if nextSubscription.Plan != nil {
				plan = nextSubscription.Plan
			} else if nextSubscription.PlanID != nil {
				var nextPlan model.SubscriptionPlan
				if err := db.First(&nextPlan, "id = ?", *nextSubscription.PlanID).Error; err == nil {
					plan = &nextPlan
				}
			} else if providerPlanID, err := uuid.Parse(nextSubscription.ProviderPlanID); err == nil {
				var nextPlan model.SubscriptionPlan
				if err := db.First(&nextPlan, "id = ?", providerPlanID).Error; err == nil {
					plan = &nextPlan
				}
			}
		}
	}

	paymentData, _ := buildSubscriptionPaymentData(payment, planAmount, creditAmount)

	sendSuccess(c, gin.H{
		"payment":      payment,
		"payment_data": paymentData,
		"plan":         plan,
		"subscription": subscription,
	}, "Subscription payment retrieved successfully")
}

func (ctrl *LMSController) CheckEmailAvailability(c *gin.Context) {
	email := strings.TrimSpace(strings.ToLower(c.Query("email")))
	if email == "" {
		sendBadRequest(c, "Email query parameter is required", nil)
		return
	}

	db := lmsDB(c, ctrl.DB).WithContext(c)
	taken, err := checkoutEmailExists(db, email)
	if err != nil {
		sendInternalError(c, err)
		return
	}

	sendSuccess(c, gin.H{
		"available": !taken,
	}, "Email availability checked successfully")
}

func (ctrl *LMSController) CheckUsernameAvailability(c *gin.Context) {
	username := normalizeCheckoutUsername(c.Query("username"))
	if username == "" {
		sendBadRequest(c, "Username query parameter is required", nil)
		return
	}
	if !checkoutUsernamePattern.MatchString(username) {
		sendSuccess(c, gin.H{
			"available": false,
			"valid":     false,
		}, "Username format is invalid")
		return
	}

	excludeIDStr := c.Query("exclude_id")

	db := lmsDB(c, ctrl.DB).WithContext(c)
	var count int64
	query := db.Set("skip_tenant_scope", true).
		Unscoped().
		Model(&model.User{}).
		Where("LOWER(username) = ?", username)

	if excludeIDStr != "" {
		if exID, err := uuid.Parse(excludeIDStr); err == nil {
			query = query.Where("id != ?", exID)
		}
	}

	if err := query.Count(&count).Error; err != nil {
		sendInternalError(c, err)
		return
	}

	available := count == 0
	sendSuccess(c, gin.H{
		"available": available,
		"valid":     true,
	}, "Username availability checked successfully")
}
