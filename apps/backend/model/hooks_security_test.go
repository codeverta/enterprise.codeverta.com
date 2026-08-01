package model

import (
	"context"
	"gin-template/common"
	"testing"
	"time"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func modelTestDB(t *testing.T) (*gorm.DB, Tenant) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	tenant := Tenant{ID: uuid.New(), Name: "Tenant", Domain: "tenant.local", IsActive: true}
	return db, tenant
}

func modelTenantContext(tenant Tenant) context.Context {
	return context.WithValue(context.Background(), common.CtxTenantKey, tenant)
}

func TestTenantScopedBeforeCreateHooks(t *testing.T) {
	db, tenant := modelTestDB(t)
	ctxDB := db.WithContext(modelTenantContext(tenant))

	cases := []struct {
		name     string
		run      func(*gorm.DB) (*uuid.UUID, error)
		noTenant func(*gorm.DB) error
	}{
		{
			name: "audit log",
			run: func(tx *gorm.DB) (*uuid.UUID, error) {
				item := &AuditLog{}
				err := item.BeforeCreate(tx)
				return item.TenantID, err
			},
			noTenant: func(tx *gorm.DB) error { return (&AuditLog{}).BeforeCreate(tx) },
		},
		{
			name: "impersonation session",
			run: func(tx *gorm.DB) (*uuid.UUID, error) {
				item := &ImpersonationSession{}
				err := item.BeforeCreate(tx)
				return item.TenantID, err
			},
			noTenant: func(tx *gorm.DB) error { return (&ImpersonationSession{}).BeforeCreate(tx) },
		},
		{
			name: "balance log",
			run: func(tx *gorm.DB) (*uuid.UUID, error) {
				item := &BalanceLog{}
				err := item.BeforeCreate(tx)
				return item.TenantID, err
			},
			noTenant: func(tx *gorm.DB) error { return (&BalanceLog{}).BeforeCreate(tx) },
		},
		{
			name: "event",
			run: func(tx *gorm.DB) (*uuid.UUID, error) {
				item := &Event{}
				err := item.BeforeCreate(tx)
				return item.TenantID, err
			},
			noTenant: func(tx *gorm.DB) error { return (&Event{}).BeforeCreate(tx) },
		},

		{
			name: "system setting",
			run: func(tx *gorm.DB) (*uuid.UUID, error) {
				item := &SystemSetting{}
				return item.TenantID, item.BeforeCreate(tx)
			},
			noTenant: func(tx *gorm.DB) error { return (&SystemSetting{}).BeforeCreate(tx) },
		},
		{
			name: "promo code",
			run: func(tx *gorm.DB) (*uuid.UUID, error) {
				item := &PromoCode{}
				return item.TenantID, item.BeforeCreate(tx)
			},
			noTenant: func(tx *gorm.DB) error { return (&PromoCode{}).BeforeCreate(tx) },
		},
		{
			name: "user",
			run: func(tx *gorm.DB) (*uuid.UUID, error) {
				item := &User{}
				err := item.BeforeCreate(tx)
				return item.TenantID, err
			},
			noTenant: func(tx *gorm.DB) error { return (&User{}).BeforeCreate(tx) },
		},
		{
			name: "ticket category",
			run: func(tx *gorm.DB) (*uuid.UUID, error) {
				item := &TicketCategory{}
				err := item.BeforeCreate(tx)
				return item.TenantID, err
			},
			noTenant: func(tx *gorm.DB) error { return (&TicketCategory{}).BeforeCreate(tx) },
		},
		{
			name: "ticket price",
			run: func(tx *gorm.DB) (*uuid.UUID, error) {
				item := &TicketPrice{}
				err := item.BeforeCreate(tx)
				return item.TenantID, err
			},
			noTenant: func(tx *gorm.DB) error { return (&TicketPrice{}).BeforeCreate(tx) },
		},
		{
			name: "ticket reservation",
			run: func(tx *gorm.DB) (*uuid.UUID, error) {
				item := &TicketReservation{}
				err := item.BeforeCreate(tx)
				return item.TenantID, err
			},
			noTenant: func(tx *gorm.DB) error { return (&TicketReservation{}).BeforeCreate(tx) },
		},
		{
			name: "training event",
			run: func(tx *gorm.DB) (*uuid.UUID, error) {
				item := &TrainingEvent{}
				err := item.BeforeCreate(tx)
				return item.TenantID, err
			},
			noTenant: func(tx *gorm.DB) error { return (&TrainingEvent{}).BeforeCreate(tx) },
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			tenantID, err := tc.run(ctxDB)
			if err != nil {
				t.Fatalf("expected tenant hook to pass: %v", err)
			}
			if tenantID == nil || *tenantID != tenant.ID {
				t.Fatalf("expected tenant id %s, got %v", tenant.ID, tenantID)
			}

			if err := tc.noTenant(db); err == nil {
				t.Fatal("expected missing tenant to fail")
			}
		})
	}
}

func TestSimpleBeforeCreateHooksAndResponses(t *testing.T) {
	db, _ := modelTestDB(t)

	credential := &WebAuthnCredential{}
	if err := credential.BeforeCreate(db); err != nil {
		t.Fatalf("webauthn hook failed: %v", err)
	}
	if credential.ID == uuid.Nil {
		t.Fatal("webauthn hook did not set ID")
	}

	paymentMethod := &PaymentMethod{}
	if err := paymentMethod.BeforeCreate(db); err != nil {
		t.Fatalf("payment method hook failed: %v", err)
	}
	if paymentMethod.ID == uuid.Nil {
		t.Fatal("payment method hook did not set ID")
	}

	user := &User{
		ID:          uuid.New(),
		Email:       "runner@example.com",
		DisplayName: "Runner",
		WebAuthnCreds: []webauthn.Credential{{
			ID: []byte("credential"),
			Authenticator: webauthn.Authenticator{
				AAGUID:       []byte("aaguid"),
				SignCount:    7,
				CloneWarning: false,
			},
			Flags: webauthn.CredentialFlags{
				UserPresent:    true,
				UserVerified:   true,
				BackupEligible: true,
				BackupState:    true,
			},
			Transport: []protocol.AuthenticatorTransport{protocol.USB},
		}},
	}
	if string(user.WebAuthnID()) != user.ID.String() {
		t.Fatal("unexpected WebAuthnID")
	}
	if user.WebAuthnName() != user.Email || user.WebAuthnDisplayName() != user.DisplayName || user.WebAuthnIcon() != "" {
		t.Fatal("unexpected WebAuthn user metadata")
	}
	if len(user.WebAuthnCredentials()) != 1 {
		t.Fatal("expected stored webauthn credentials")
	}

	setting := SystemSetting{
		AppName:               "Trail",
		BannerText:            "Open",
		IsDevMode:             true,
		IsRegistrationOpen:    true,
		IsMaintenanceMode:     false,
		EventStartTime:        time.Date(2026, 5, 26, 7, 0, 0, 0, time.UTC),
		EmailQuota:            100,
		EmailUsed:             10,
		ParticipantQuota:      200,
		ParticipantUsed:       20,
		DiscordPaymentWebhook: "payment",
	}
	publicResp := setting.ToResponse(false)
	if _, ok := publicResp["email_quota"]; ok {
		t.Fatal("public response should hide admin quota")
	}
	adminResp := setting.ToResponse(true)
	if adminResp["email_quota"] != 100 || adminResp["participant_used"] != 20 {
		t.Fatalf("admin response missing quota: %#v", adminResp)
	}
}

func TestEncryptDecryptAndBlindIndex(t *testing.T) {
	t.Setenv("DB_ENCRYPTION_KEY", "12345678901234567890123456789012")
	t.Setenv("DB_HMAC_KEY", "hmac-key")

	encrypted, err := Encrypt("sensitive")
	if err != nil {
		t.Fatalf("encrypt failed: %v", err)
	}
	if encrypted == "sensitive" {
		t.Fatal("ciphertext should differ from plaintext")
	}

	decrypted, err := Decrypt(encrypted)
	if err != nil {
		t.Fatalf("decrypt failed: %v", err)
	}
	if decrypted != "sensitive" {
		t.Fatalf("decrypt=%q", decrypted)
	}

	if _, err := Decrypt("bad-base64"); err == nil {
		t.Fatal("expected invalid ciphertext error")
	}

	if a, b := generateBlindIndex("same"), generateBlindIndex("same"); a == "" || a != b {
		t.Fatalf("blind index should be deterministic, got %q %q", a, b)
	}
}

func TestUserGuardClauses(t *testing.T) {
	if _, err := GetUserById(uuid.Nil, false); err == nil {
		t.Fatal("nil user id should fail")
	}
	if err := DeleteUserById(nil, uuid.Nil); err == nil {
		t.Fatal("nil delete id should fail")
	}
	if err := (&User{}).Delete(); err == nil {
		t.Fatal("nil model delete id should fail")
	}
	if err := (&User{}).FillUserById(); err == nil {
		t.Fatal("empty FillUserById should fail")
	}
	if err := (&User{}).FillUserByEmail(); err == nil {
		t.Fatal("empty FillUserByEmail should fail")
	}
	if err := (&User{}).FillUserByUsername(); err == nil {
		t.Fatal("empty FillUserByUsername should fail")
	}
	if user := ValidateUserToken(""); user != nil {
		t.Fatal("empty token should not resolve user")
	}
	if err := ResetUserPasswordByEmail("", "secret"); err == nil {
		t.Fatal("empty reset email should fail")
	}
}
