package controller

import (
	"context"
	"encoding/json"
	"fmt"
	"gin-template/common"
	"gin-template/model"
	"net/http"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupFreeTrialCheckoutTest(t *testing.T) (*gin.Engine, *gorm.DB, model.Tenant, model.SubscriptionPlan) {
	t.Helper()
	gin.SetMode(gin.TestMode)

	db, err := gorm.Open(
		sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))),
		&gorm.Config{},
	)
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(
		&model.Tenant{},
		&model.User{},
		&model.Profile{},
		&model.Wallet{},
		&model.PricingCategory{},
		&model.SubscriptionPlan{},
		&model.Membership{},
		&model.Subscription{},
		&model.LMSPayment{},
		&model.AuthHandoff{},
	); err != nil {
		t.Fatalf("migrate trial models: %v", err)
	}

	tenant := model.Tenant{
		ID:       uuid.New(),
		Name:     "Free Trial Tenant",
		Domain:   "trial.test",
		IsActive: true,
	}
	if err := db.Create(&tenant).Error; err != nil {
		t.Fatalf("create tenant: %v", err)
	}
	ctx := context.WithValue(context.Background(), common.CtxTenantKey, tenant)
	category := model.PricingCategory{
		Name:         "Keluarga",
		Slug:         "keluarga",
		CheckoutType: "parent_child",
		IsActive:     true,
	}
	if err := db.WithContext(ctx).Create(&category).Error; err != nil {
		t.Fatalf("create category: %v", err)
	}
	plan := model.SubscriptionPlan{
		Name:              "Family Monthly",
		Slug:              "family-monthly",
		Amount:            250000,
		Currency:          "IDR",
		DurationDays:      30,
		Interval:          "monthly",
		IsActive:          true,
		PricingCategoryID: &category.ID,
	}
	if err := db.WithContext(ctx).Create(&plan).Error; err != nil {
		t.Fatalf("create plan: %v", err)
	}

	lmsController := NewLMSController(db)
	authController := NewAuthController(db)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("db", db)
		c.Set(common.CtxTenantKey, tenant)
		c.Request = c.Request.WithContext(context.WithValue(c.Request.Context(), common.CtxTenantKey, tenant))
		c.Next()
	})
	router.POST("/checkout/guest", lmsController.GuestCheckout)
	router.POST("/auth/handoff/exchange", authController.ExchangeAuthHandoff)
	return router, db, tenant, plan
}

func TestEmailFreeTrialCreatesAccountsAndLogsInOnce(t *testing.T) {
	router, db, tenant, plan := setupFreeTrialCheckoutTest(t)
	body := fmt.Sprintf(`{
		"parent_name":"Merchant Trial",
		"parent_username":"merchanttrial",
		"parent_phone":"08123456789",
		"student_name":"Anak Trial",
		"student_nisn":"1234567890",
		"plan_id":"%s",
		"payment_method":"free_trial"
	}`, plan.ID)

	rec := performJSON(router, http.MethodPost, "/checkout/guest", body)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}

	var response struct {
		Data struct {
			AuthHandoff string `json:"auth_handoff"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode checkout response: %v", err)
	}
	if response.Data.AuthHandoff == "" {
		t.Fatal("expected a one-time auth handoff")
	}

	var users []model.User
	if err := db.Set("skip_tenant_scope", true).
		Where("tenant_id = ?", tenant.ID).
		Order("role").
		Find(&users).Error; err != nil {
		t.Fatalf("load trial users: %v", err)
	}
	if len(users) != 2 {
		t.Fatalf("expected parent and student accounts, got %d", len(users))
	}
	for _, user := range users {
		if user.Status != common.UserStatusEnabled {
			t.Fatalf("expected enabled trial account, got status %d", user.Status)
		}
		if !strings.HasSuffix(user.Email, "@trial.kitafuture.local") {
			t.Fatalf("expected an internal unique email, got %q", user.Email)
		}
	}

	var subscription model.Subscription
	if err := db.First(&subscription).Error; err != nil {
		t.Fatalf("load subscription: %v", err)
	}
	if subscription.Status != model.SubscriptionStatusTrialing || subscription.CurrentPeriodEnd == nil {
		t.Fatalf("expected active trial period, got status=%s end=%v", subscription.Status, subscription.CurrentPeriodEnd)
	}

	exchangeBody := fmt.Sprintf(`{"token":%q}`, response.Data.AuthHandoff)
	exchange := performJSON(router, http.MethodPost, "/auth/handoff/exchange", exchangeBody)
	if exchange.Code != http.StatusOK {
		t.Fatalf("expected handoff exchange 200, got %d body=%s", exchange.Code, exchange.Body.String())
	}
	var exchangeResponse map[string]interface{}
	if err := json.Unmarshal(exchange.Body.Bytes(), &exchangeResponse); err != nil {
		t.Fatalf("decode exchange response: %v", err)
	}
	data := exchangeResponse["data"].(map[string]interface{})
	if data["access_token"] == "" || data["refresh_token"] == "" {
		t.Fatal("expected JWT pair from handoff exchange")
	}
	user := data["user"].(map[string]interface{})
	if user["email"] != "" {
		t.Fatalf("internal trial email must not be exposed, got %v", user["email"])
	}

	replay := performJSON(router, http.MethodPost, "/auth/handoff/exchange", exchangeBody)
	if replay.Code != http.StatusUnauthorized {
		t.Fatalf("expected replay to be rejected with 401, got %d body=%s", replay.Code, replay.Body.String())
	}
}

func TestPaidGuestCheckoutStillRequiresParentEmail(t *testing.T) {
	router, _, _, plan := setupFreeTrialCheckoutTest(t)
	body := fmt.Sprintf(`{
		"parent_name":"Merchant",
		"parent_username":"merchantbayar",
		"parent_phone":"08123456789",
		"student_name":"Anak",
		"student_nisn":"1234567890",
		"plan_id":"%s",
		"payment_method":"QRIS"
	}`, plan.ID)

	rec := performJSON(router, http.MethodPost, "/checkout/guest", body)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected missing paid-checkout email to return 400, got %d body=%s", rec.Code, rec.Body.String())
	}
}
