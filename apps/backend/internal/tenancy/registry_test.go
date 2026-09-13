package tenancy

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func registryDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	return db
}

func TestRegistryResolvesOnlyVerifiedExactHostname(t *testing.T) {
	db := registryDB(t)
	registry := NewRegistry(db, time.Minute)
	if err := registry.Migrate(); err != nil {
		t.Fatal(err)
	}
	now := time.Now()
	alpha := Record{ID: uuid.New(), Name: "Alpha", Slug: "alpha", PrimaryDomain: "alpha.erp.example.com", Status: StatusActive, Plan: "pro"}
	beta := Record{ID: uuid.New(), Name: "Beta", Slug: "beta", PrimaryDomain: "beta.erp.example.com", Status: StatusActive, Plan: "starter"}
	if err := db.Create(&alpha).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&beta).Error; err != nil {
		t.Fatal(err)
	}
	domains := []Domain{
		{ID: uuid.New(), TenantID: alpha.ID, Domain: "alpha.erp.example.com", IsPrimary: true, VerifiedAt: &now},
		{ID: uuid.New(), TenantID: beta.ID, Domain: "beta.erp.example.com", IsPrimary: true},
	}
	if err := db.Create(&domains).Error; err != nil {
		t.Fatal(err)
	}

	got, err := registry.ResolveByHost(context.Background(), "ALPHA.erp.example.com:443")
	if err != nil || got.ID != alpha.ID {
		t.Fatalf("resolved %#v, err %v", got, err)
	}
	if _, err := registry.ResolveByHost(context.Background(), "beta.erp.example.com"); !errors.Is(err, ErrTenantNotFound) {
		t.Fatalf("unverified domain should not resolve: %v", err)
	}
	if _, err := registry.ResolveByHost(context.Background(), "alpha.erp.example.com@attacker.test"); !errors.Is(err, ErrTenantNotFound) {
		t.Fatalf("spoofed host should be rejected: %v", err)
	}
}

func TestCustomDomainMustBeVerified(t *testing.T) {
	db := registryDB(t)
	registry := NewRegistry(db, time.Minute)
	if err := registry.Migrate(); err != nil {
		t.Fatal(err)
	}
	tenant := Record{ID: uuid.New(), Name: "Alpha", Slug: "alpha", PrimaryDomain: "alpha.erp.example.com", Status: StatusActive, Plan: "pro"}
	if err := db.Create(&tenant).Error; err != nil {
		t.Fatal(err)
	}
	token, err := registry.BeginDomainVerification(context.Background(), tenant.ID, "erp.ptalpha.com")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := registry.ResolveByHost(context.Background(), "erp.ptalpha.com"); !errors.Is(err, ErrTenantNotFound) {
		t.Fatalf("unverified custom domain resolved: %v", err)
	}
	if err := registry.ConfirmDomainVerification(context.Background(), "erp.ptalpha.com", "wrong"); !errors.Is(err, ErrDomainUnverified) {
		t.Fatalf("wrong proof accepted: %v", err)
	}
	if err := registry.ConfirmDomainVerification(context.Background(), "erp.ptalpha.com", token); err != nil {
		t.Fatal(err)
	}
	resolved, err := registry.ResolveByHost(context.Background(), "erp.ptalpha.com")
	if err != nil || resolved.ID != tenant.ID {
		t.Fatalf("verified domain did not resolve: %#v %v", resolved, err)
	}
}

func TestBeginDomainVerificationReusesPendingPrimaryDomain(t *testing.T) {
	db := registryDB(t)
	registry := NewRegistry(db, time.Minute)
	if err := registry.Migrate(); err != nil {
		t.Fatal(err)
	}
	tenant := Record{ID: uuid.New(), Name: "Alpha", Slug: "alpha", PrimaryDomain: "erp.ptalpha.com", Status: StatusActive, Plan: "pro"}
	if err := db.Create(&tenant).Error; err != nil {
		t.Fatal(err)
	}
	pending := Domain{ID: uuid.New(), TenantID: tenant.ID, Domain: tenant.PrimaryDomain, IsPrimary: true}
	if err := db.Create(&pending).Error; err != nil {
		t.Fatal(err)
	}
	token, err := registry.BeginDomainVerification(context.Background(), tenant.ID, tenant.PrimaryDomain)
	if err != nil || token == "" {
		t.Fatalf("expected a verification token for pending primary domain: %q, %v", token, err)
	}
	var count int64
	if err := db.Model(&Domain{}).Where("domain = ?", tenant.PrimaryDomain).Count(&count).Error; err != nil || count != 1 {
		t.Fatalf("pending domain was duplicated: count=%d err=%v", count, err)
	}
}
