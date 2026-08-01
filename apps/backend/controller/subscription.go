package controller

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"gin-template/model"
	"gin-template/services"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/skip2/go-qrcode"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

func (ctrl *LMSController) CheckoutSubscription(c *gin.Context) {
	log := zap.L().With(zap.String("controller", "LMSController"), zap.String("function", "CheckoutSubscription"))
	userID, role, ok := currentLMSUser(c)
	if !ok {
		log.Warn("Failed to extract current user context")
		return
	}

	var req subscriptionCheckoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Warn("Invalid subscription checkout payload", zap.Error(err))
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}

	pricingID, err := uuid.Parse(req.PricingID)
	if err != nil {
		log.Warn("Invalid pricing ID string", zap.String("raw_pricing_id", req.PricingID))
		sendBadRequest(c, "pricing_id is invalid", nil)
		return
	}

	log = log.With(
		zap.String("user_id", userID.String()),
		zap.Int("role", role),
		zap.String("pricing_id", pricingID.String()),
		zap.String("payment_method", req.PaymentMethod),
	)

	db := lmsDB(c, ctrl.DB).WithContext(c)
	var plan model.SubscriptionPlan
	if err := db.Preload("PricingCategory").First(&plan, "id = ? AND is_active = ?", pricingID, true).Error; err != nil {
		log.Warn("Subscription pricing plan not found or inactive", zap.Error(err))
		if errors.Is(err, gorm.ErrRecordNotFound) {
			sendError(c, http.StatusNotFound, "Subscription plan not found", nil)
			return
		}
		sendInternalError(c, err)
		return
	}

	log.Info("Initiating subscription checkout", zap.String("plan_name", plan.Name), zap.Float64("amount", plan.Amount))

	isParentPlan := plan.PricingCategory != nil && plan.PricingCategory.CheckoutType == "parent"

	studentID := userID
	if req.StudentID != "" && !isParentPlan {
		studentID, err = uuid.Parse(req.StudentID)
		if err != nil {
			sendBadRequest(c, "student_id is invalid", nil)
			return
		}
	}

	if role == 10 {
		if !isParentPlan {
			if req.StudentID == "" || studentID == userID {
				sendBadRequest(c, "target student is required for parent checkout", nil)
				return
			}
			var count int64
			if err := db.Model(&model.Membership{}).
				Where("parent_id = ? AND student_id = ? AND status = ?", userID, studentID, "active").
				Count(&count).Error; err != nil {
				sendInternalError(c, err)
				return
			}
			if count == 0 {
				sendError(c, http.StatusForbidden, "Student does not belong to this parent", nil)
				return
			}
		}
	} else if role < 99 && studentID != userID {
		sendError(c, http.StatusForbidden, "Student does not belong to this account", nil)
		return
	}

	var courseID *uuid.UUID
	if req.CourseID != "" {
		parsedCourseID, err := uuid.Parse(req.CourseID)
		if err != nil {
			sendBadRequest(c, "course_id is invalid", nil)
			return
		}
		courseID = &parsedCourseID
	}

	var user model.User
	if err := db.First(&user, "id = ?", userID).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	if err := ConsolidateSubscriptionStack(db, userID, studentID, courseID, time.Now()); err != nil {
		sendInternalError(c, err)
		return
	}

	subscription, err := ctrl.findReusableSubscription(db, userID, studentID, courseID)
	if err != nil {
		sendInternalError(c, err)
		return
	}
	if subscription != nil {
		if err := applyPendingDowngradeIfDue(db, subscription, time.Now()); err != nil {
			sendInternalError(c, err)
			return
		}
	}
	if subscription == nil {
		now := time.Now()
		checkoutReference := "checkout-" + uuid.NewString()
		subscription = &model.Subscription{
			ParentID:               userID,
			StudentID:              studentID,
			CourseID:               courseID,
			Status:                 model.SubscriptionStatusPastDue,
			Provider:               "xendit",
			ProviderPlanID:         plan.ID.String(),
			ProviderSubscriptionID: checkoutReference,
			Amount:                 plan.Amount,
			Currency:               plan.Currency,
			Interval:               plan.Interval,
			CurrentPeriodStart:     &now,
		}
		if subscription.Currency == "" {
			subscription.Currency = "IDR"
		}
		if subscription.Interval == "" {
			subscription.Interval = "month"
		}

		if err := db.Create(subscription).Error; err != nil {
			sendInternalError(c, err)
			return
		}
	}

	now := time.Now()
	currentPlanAmount := subscription.Amount
	if currentPlanAmount <= 0 {
		currentPlanAmount = plan.Amount
	}
	isCurrentActive := (subscription.Status == model.SubscriptionStatusActive || subscription.Status == model.SubscriptionStatusTrialing) &&
		subscription.CurrentPeriodEnd != nil && subscription.CurrentPeriodEnd.After(now)
	isPlanChange := subscription.ProviderPlanID != "" && subscription.ProviderPlanID != plan.ID.String()

	// Update reused subscription properties if it is not currently active, or if it is a renewal/same plan ID
	if !isCurrentActive || !isPlanChange {
		updates := map[string]interface{}{
			"provider_plan_id": plan.ID.String(),
			"plan_id":          &plan.ID,
			"amount":           plan.Amount,
			"currency":         plan.Currency,
			"interval":         plan.Interval,
		}
		if err := db.Model(subscription).Updates(updates).Error; err != nil {
			sendInternalError(c, err)
			return
		}
		subscription.ProviderPlanID = plan.ID.String()
		subscription.PlanID = &plan.ID
		subscription.Amount = plan.Amount
		subscription.Currency = plan.Currency
		subscription.Interval = plan.Interval
	}

	if isCurrentActive && isPlanChange && plan.Amount < currentPlanAmount {
		if err := db.Model(subscription).Updates(map[string]interface{}{
			"pending_change_type":      "downgrade",
			"pending_provider_plan_id": plan.ID.String(),
			"pending_amount":           plan.Amount,
			"pending_currency":         plan.Currency,
			"pending_interval":         plan.Interval,
			"pending_change_at":        subscription.CurrentPeriodEnd,
		}).Error; err != nil {
			sendInternalError(c, err)
			return
		}
		subscription.PendingChangeType = "downgrade"
		subscription.PendingProviderPlanID = plan.ID.String()
		subscription.PendingAmount = plan.Amount
		subscription.PendingCurrency = plan.Currency
		subscription.PendingInterval = plan.Interval
		subscription.PendingChangeAt = subscription.CurrentPeriodEnd

		sendSuccess(c, gin.H{
			"plan":             plan,
			"subscription":     *subscription,
			"requires_payment": false,
			"change_type":      "downgrade_scheduled",
			"effective_at":     subscription.CurrentPeriodEnd,
		}, "Downgrade scheduled successfully")
		return
	}

	chargeAmount := plan.Amount
	creditAmount := 0.0
	changeType := "new"
	if isCurrentActive && isPlanChange && plan.Amount > currentPlanAmount {
		creditAmount = proratedSubscriptionCredit(*subscription, now)
		chargeAmount = math.Ceil(plan.Amount - creditAmount)
		if chargeAmount < 0 {
			chargeAmount = 0
		}
		changeType = "upgrade"
	}
	if isCurrentActive && !isPlanChange {
		changeType = "renewal"
	}

	if changeType == "upgrade" {
		if err := db.Model(subscription).Updates(map[string]interface{}{
			"pending_change_type":      "upgrade",
			"pending_provider_plan_id": plan.ID.String(),
			"pending_amount":           plan.Amount,
			"pending_currency":         plan.Currency,
			"pending_interval":         plan.Interval,
			"pending_change_at":        &now,
		}).Error; err != nil {
			sendInternalError(c, err)
			return
		}
		subscription.PendingChangeType = "upgrade"
		subscription.PendingProviderPlanID = plan.ID.String()
		subscription.PendingAmount = plan.Amount
		subscription.PendingCurrency = plan.Currency
		subscription.PendingInterval = plan.Interval
		subscription.PendingChangeAt = &now
	}

	if chargeAmount <= 0 {
		periodStart, periodEnd := planPeriodFrom(now, plan.Interval)
		var periodEndPtr *time.Time
		if strings.ToLower(plan.Interval) != "lifetime" {
			periodEndPtr = &periodEnd
		}
		if err := db.Model(subscription).Updates(map[string]interface{}{
			"status":                   model.SubscriptionStatusActive,
			"provider_plan_id":         plan.ID.String(),
			"plan_id":                  &plan.ID,
			"amount":                   plan.Amount,
			"currency":                 defaultCurrency(plan.Currency),
			"interval":                 defaultInterval(plan.Interval),
			"current_period_start":     &periodStart,
			"current_period_end":       periodEndPtr,
			"cancel_at_period_end":     false,
			"pending_change_type":      "",
			"pending_provider_plan_id": "",
			"pending_amount":           0,
			"pending_currency":         "",
			"pending_interval":         "",
			"pending_change_at":        nil,
		}).Error; err != nil {
			sendInternalError(c, err)
			return
		}
		sendSuccess(c, gin.H{
			"plan":             plan,
			"subscription":     *subscription,
			"requires_payment": false,
			"change_type":      "upgrade_applied",
		}, "Subscription upgraded successfully")
		return
	}
	if strings.TrimSpace(req.PaymentMethod) == "" {
		sendBadRequest(c, "payment_method is required", nil)
		return
	}

	var pendingPayment model.LMSPayment
	if err := db.
		Where("subscription_id = ? AND student_id = ? AND status = ? AND amount = ?", subscription.ID, studentID, model.LMSPaymentPending, chargeAmount).
		Order("created_at DESC").
		First(&pendingPayment).Error; err == nil {
		if err := ctrl.syncLMSPaymentWithXendit(c, &pendingPayment); err != nil {
			sendInternalError(c, err)
			return
		}
		if pendingPayment.Status == model.LMSPaymentPending {
			methods, _ := services.BuildPaymentMethodOptions(db, chargeAmount)
			paymentData, _ := buildSubscriptionPaymentData(pendingPayment, plan.Amount, math.Max(0, plan.Amount-chargeAmount))
			sendSuccess(c, gin.H{
				"plan":             plan,
				"subscription":     *subscription,
				"payment":          pendingPayment,
				"payment_data":     paymentData,
				"payment_methods":  methods,
				"requires_payment": true,
				"change_type":      changeType,
				"reused_pending":   true,
			}, "Pending subscription checkout retrieved successfully")
			return
		}
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		sendInternalError(c, err)
		return
	}

	paymentID := uuid.New()
	externalID := paymentID.String()
	payment := model.LMSPayment{
		ID:             paymentID,
		SubscriptionID: &subscription.ID,
		ParentID:       userID,
		StudentID:      studentID,
		CourseID:       courseID,
		Provider:       "xendit",
		ExternalID:     externalID,
		Amount:         chargeAmount,
		Currency:       plan.Currency,
		Status:         model.LMSPaymentPending,
	}
	if payment.Currency == "" {
		payment.Currency = "IDR"
	}
	if err := db.Create(&payment).Error; err != nil {
		if changeType == "upgrade" {
			_ = db.Model(subscription).Updates(ClearPendingSubscriptionChange()).Error
		}
		sendInternalError(c, err)
		return
	}

	paymentResult, err := services.CreateLMSXenditPaymentRequest(c, db, &payment, user, req.PaymentMethod)
	if err != nil {
		if changeType == "upgrade" {
			_ = db.Model(subscription).Updates(ClearPendingSubscriptionChange()).Error
		}
		sendError(c, http.StatusBadGateway, err.Error(), nil)
		return
	}
	paymentResult.PlanAmount = plan.Amount
	paymentResult.CreditAmount = math.Max(0, plan.Amount-chargeAmount)
	paymentResult.ChargeAmount = chargeAmount
	paymentResult.FinalAmount = chargeAmount
	paymentResult.TotalAmount = payment.TotalAmount

	methods, _ := services.BuildPaymentMethodOptions(db, chargeAmount)

	sendSuccess(c, gin.H{
		"plan":             plan,
		"subscription":     *subscription,
		"payment":          payment,
		"payment_data":     paymentResult,
		"payment_methods":  methods,
		"requires_payment": true,
		"change_type":      changeType,
	}, "Subscription checkout created successfully")
}

func (ctrl *LMSController) GetSubscriptionPayment(c *gin.Context) {
	id, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	userID, role, ok := currentLMSUser(c)
	if !ok {
		return
	}

	var payment model.LMSPayment
	query := lmsDB(c, ctrl.DB).Where("id = ?", id)
	if role < 99 {
		if role == 10 {
			query = query.Where("parent_id = ?", userID)
		} else {
			query = query.Where("student_id = ?", userID)
		}
	}
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
	planAmount := payment.Amount
	creditAmount := 0.0
	if payment.SubscriptionID != nil {
		var subscription model.Subscription
		if err := lmsDB(c, ctrl.DB).First(&subscription, "id = ?", *payment.SubscriptionID).Error; err == nil && subscription.PendingChangeType == "upgrade" {
			planAmount = subscription.PendingAmount
			if planAmount > payment.Amount {
				creditAmount = planAmount - payment.Amount
			}
		}
	}

	paymentData, _ := buildSubscriptionPaymentData(payment, planAmount, creditAmount)

	sendSuccess(c, gin.H{
		"payment":      payment,
		"payment_data": paymentData,
	}, "Subscription payment retrieved successfully")
}

func buildSubscriptionPaymentData(payment model.LMSPayment, planAmount float64, creditAmount float64) (gin.H, error) {
	var qrCodeBase64 string
	if payment.PaymentType == "QRIS" && payment.PaymentNumber != "" {
		if png, err := qrcode.Encode(payment.PaymentNumber, qrcode.Medium, 256); err == nil {
			qrCodeBase64 = "data:image/png;base64," + base64.StdEncoding.EncodeToString(png)
		}
	}
	if len(payment.GatewayData) > 0 {
		var gatewayData map[string]interface{}
		if err := json.Unmarshal(payment.GatewayData, &gatewayData); err == nil {
			if code, ok := gatewayData["promo_code"].(string); ok && code != "" {
				creditAmount = numberFromGatewayData(gatewayData["promo_discount_amount"], creditAmount)
				planAmount = numberFromGatewayData(gatewayData["promo_original_amount"], planAmount)
			}
		}
	}
	return gin.H{
		"transaction_id": payment.TransactionID,
		"invoice_url":    payment.InvoiceURL,
		"payment_type":   payment.PaymentType,
		"payment_number": payment.PaymentNumber,
		"qr_code_base64": qrCodeBase64,
		"handling_fee":   payment.HandlingFee,
		"admin_fee":      payment.AdminFee,
		"expiry_date":    payment.ExpiryDate,
		"plan_amount":    planAmount,
		"credit_amount":  creditAmount,
		"charge_amount":  payment.Amount,
		"final_amount":   payment.Amount,
		"total_amount":   payment.TotalAmount,
		"promo_code":     promoCodeFromGatewayData(payment.GatewayData),
	}, nil
}

func promoCodeFromGatewayData(raw []byte) string {
	if len(raw) == 0 {
		return ""
	}
	var gatewayData map[string]interface{}
	if err := json.Unmarshal(raw, &gatewayData); err != nil {
		return ""
	}
	code, _ := gatewayData["promo_code"].(string)
	return code
}

func numberFromGatewayData(value interface{}, fallback float64) float64 {
	switch v := value.(type) {
	case float64:
		return v
	case int:
		return float64(v)
	case json.Number:
		if parsed, err := v.Float64(); err == nil {
			return parsed
		}
	}
	return fallback
}

func (ctrl *LMSController) findReusableSubscription(db *gorm.DB, parentID uuid.UUID, studentID uuid.UUID, courseID *uuid.UUID) (*model.Subscription, error) {
	var subscription model.Subscription
	query := db.
		Where("parent_id = ? AND student_id = ?", parentID, studentID).
		Order("current_period_end IS NULL ASC").
		Order("current_period_end DESC").
		Order("created_at DESC")
	if courseID == nil {
		query = query.Where("course_id IS NULL")
	} else {
		query = query.Where("course_id = ?", *courseID)
	}

	if err := query.First(&subscription).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &subscription, nil
}

func (ctrl *LMSController) ListMySubscriptions(c *gin.Context) {
	userID, role, ok := currentLMSUser(c)
	if !ok {
		return
	}

	db := lmsDB(c, ctrl.DB).WithContext(c)
	now := time.Now()
	if err := consolidateVisibleSubscriptionStacks(db, userID, now); err != nil {
		sendInternalError(c, err)
		return
	}
	var subscriptions []model.Subscription
	query := db.Order("current_period_end IS NULL ASC").
		Order("current_period_end DESC").
		Order("created_at DESC")
	if role == 10 {
		query = query.Where("parent_id = ?", userID)
	} else if role < 99 {
		query = query.Where("student_id = ?", userID)
	} else {
		query = query.Where("parent_id = ? OR student_id = ?", userID, userID)
	}
	if err := query.Find(&subscriptions).Error; err != nil {
		sendInternalError(c, err)
		return
	}

	visibleSubscriptions := make([]model.Subscription, 0, len(subscriptions))
	seenScopes := map[string]bool{}
	for _, subscription := range subscriptions {
		if err := applyPendingDowngradeIfDue(db, &subscription, now); err != nil {
			sendInternalError(c, err)
			return
		}
		scope := subscription.StudentID.String() + ":app"
		if subscription.CourseID != nil {
			scope = subscription.StudentID.String() + ":" + subscription.CourseID.String()
		}
		if seenScopes[scope] {
			continue
		}
		seenScopes[scope] = true
		visibleSubscriptions = append(visibleSubscriptions, subscription)
	}

	planIDs := make([]uuid.UUID, 0)
	seenPlanIDs := map[uuid.UUID]bool{}
	for _, subscription := range visibleSubscriptions {
		planID, err := uuid.Parse(subscription.ProviderPlanID)
		if err != nil || planID == uuid.Nil || seenPlanIDs[planID] {
		} else {
			seenPlanIDs[planID] = true
			planIDs = append(planIDs, planID)
		}
		pendingPlanID, err := uuid.Parse(subscription.PendingProviderPlanID)
		if err != nil || pendingPlanID == uuid.Nil || seenPlanIDs[pendingPlanID] {
			continue
		}
		seenPlanIDs[pendingPlanID] = true
		planIDs = append(planIDs, pendingPlanID)
	}

	plansByID := map[string]model.SubscriptionPlan{}
	if len(planIDs) > 0 {
		var plans []model.SubscriptionPlan
		if err := db.Preload("PricingCategory").Find(&plans, "id IN ?", planIDs).Error; err != nil {
			sendInternalError(c, err)
			return
		}
		for _, plan := range plans {
			plansByID[plan.ID.String()] = plan
		}
	}

	subscriptionIDs := make([]uuid.UUID, 0, len(visibleSubscriptions))
	for _, subscription := range visibleSubscriptions {
		subscriptionIDs = append(subscriptionIDs, subscription.ID)
	}
	pendingPaymentsBySubscriptionID := map[uuid.UUID]model.LMSPayment{}
	if len(subscriptionIDs) > 0 {
		var pendingPayments []model.LMSPayment
		if err := db.
			Where("subscription_id IN ? AND status = ?", subscriptionIDs, model.LMSPaymentPending).
			Order("created_at DESC").
			Find(&pendingPayments).Error; err != nil {
			sendInternalError(c, err)
			return
		}
		for _, payment := range pendingPayments {
			if payment.SubscriptionID == nil {
				continue
			}
			if _, exists := pendingPaymentsBySubscriptionID[*payment.SubscriptionID]; !exists {
				pendingPaymentsBySubscriptionID[*payment.SubscriptionID] = payment
			}
		}
	}

	items := make([]gin.H, 0, len(visibleSubscriptions))
	for _, subscription := range visibleSubscriptions {
		isActive := subscription.Status == model.SubscriptionStatusActive || subscription.Status == model.SubscriptionStatusTrialing
		if subscription.CurrentPeriodEnd != nil && subscription.CurrentPeriodEnd.Before(now) {
			isActive = false
		}

		var daysRemaining *int
		if subscription.CurrentPeriodEnd != nil {
			remaining := int(subscription.CurrentPeriodEnd.Sub(now).Hours() / 24)
			if remaining < 0 {
				remaining = 0
			}
			daysRemaining = &remaining
		}

		item := gin.H{
			"subscription":   subscription,
			"is_active":      isActive,
			"days_remaining": daysRemaining,
		}
		if pendingPayment, exists := pendingPaymentsBySubscriptionID[subscription.ID]; exists {
			item["pending_payment"] = pendingPayment
		}
		if plan, exists := plansByID[subscription.ProviderPlanID]; exists {
			item["plan"] = plan
		}
		if pendingPlan, exists := plansByID[subscription.PendingProviderPlanID]; exists {
			item["pending_plan"] = pendingPlan
		}
		items = append(items, item)
	}

	sendSuccess(c, gin.H{
		"subscriptions": items,
	}, "Subscriptions retrieved successfully")
}

func ConsolidateSubscriptionStack(db *gorm.DB, parentID uuid.UUID, studentID uuid.UUID, courseID *uuid.UUID, now time.Time) error {
	var subscriptions []model.Subscription
	query := db.
		Where("parent_id = ? AND student_id = ?", parentID, studentID).
		Where("status IN ?", []model.SubscriptionStatus{model.SubscriptionStatusActive, model.SubscriptionStatusTrialing}).
		Where("current_period_end IS NOT NULL AND current_period_end > ?", now).
		Order("current_period_end DESC").
		Order("created_at DESC")
	if courseID == nil {
		query = query.Where("course_id IS NULL")
	} else {
		query = query.Where("course_id = ?", *courseID)
	}
	if err := query.Find(&subscriptions).Error; err != nil {
		return err
	}
	if len(subscriptions) < 2 {
		return nil
	}

	primary := subscriptions[0]
	if primary.CurrentPeriodEnd == nil {
		return nil
	}
	periodEnd := *primary.CurrentPeriodEnd
	duplicateIDs := make([]uuid.UUID, 0)
	for _, duplicate := range subscriptions[1:] {
		if duplicate.ProviderPlanID != primary.ProviderPlanID || duplicate.CurrentPeriodEnd == nil {
			continue
		}
		periodEnd = addPlanInterval(periodEnd, duplicate.Interval)
		duplicateIDs = append(duplicateIDs, duplicate.ID)
	}
	if len(duplicateIDs) == 0 {
		return nil
	}

	return db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&primary).Update("current_period_end", &periodEnd).Error; err != nil {
			return err
		}
		return tx.Model(&model.Subscription{}).
			Where("id IN ?", duplicateIDs).
			Updates(map[string]interface{}{
				"status":      model.SubscriptionStatusCanceled,
				"canceled_at": &now,
			}).Error
	})
}

func extendSubscriptionPeriod(subscription model.Subscription, paidAt time.Time) (time.Time, time.Time) {
	periodStart := paidAt
	if subscription.CurrentPeriodStart != nil && subscription.CurrentPeriodEnd != nil && subscription.CurrentPeriodEnd.After(paidAt) {
		periodStart = *subscription.CurrentPeriodStart
	}

	baseEnd := paidAt
	if subscription.CurrentPeriodEnd != nil && subscription.CurrentPeriodEnd.After(baseEnd) {
		baseEnd = *subscription.CurrentPeriodEnd
	}

	periodEnd := baseEnd.AddDate(0, 1, 0)
	switch strings.ToLower(subscription.Interval) {
	case "year", "yearly", "annual":
		periodEnd = baseEnd.AddDate(1, 0, 0)
	case "week", "weekly":
		periodEnd = baseEnd.AddDate(0, 0, 7)
	case "day", "daily":
		periodEnd = baseEnd.AddDate(0, 0, 1)
	}

	return periodStart, periodEnd
}

func proratedSubscriptionCredit(subscription model.Subscription, at time.Time) float64 {
	if subscription.CurrentPeriodStart == nil || subscription.CurrentPeriodEnd == nil || !subscription.CurrentPeriodEnd.After(at) {
		return 0
	}
	totalSeconds := subscription.CurrentPeriodEnd.Sub(*subscription.CurrentPeriodStart).Seconds()
	if totalSeconds <= 0 || subscription.Amount <= 0 {
		return 0
	}
	remainingSeconds := subscription.CurrentPeriodEnd.Sub(at).Seconds()
	if remainingSeconds <= 0 {
		return 0
	}
	return subscription.Amount * (remainingSeconds / totalSeconds)
}

func ClearPendingSubscriptionChange() map[string]interface{} {
	return map[string]interface{}{
		"pending_change_type":      "",
		"pending_provider_plan_id": "",
		"pending_amount":           0,
		"pending_currency":         "",
		"pending_interval":         "",
		"pending_change_at":        nil,
	}
}
