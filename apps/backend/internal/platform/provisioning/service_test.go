package provisioning

import (
	"context"
	"encoding/base64"
	"errors"
	"testing"
	"time"

	"gin-template/internal/tenancy"

	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type provisionerStub struct{ err error }

func (p provisionerStub) Create(context.Context, tenancy.Record, string) error { return p.err }

func provisioningDependencies(t *testing.T, provisionErr error) (*Service, *tenancy.Registry, *tenancy.DatabaseManager) {
	t.Helper()
	platform, err := gorm.Open(sqlite.Open("file:"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	registry := tenancy.NewRegistry(platform, time.Minute)
	if err := registry.Migrate(); err != nil {
		t.Fatal(err)
	}
	key := base64.StdEncoding.EncodeToString([]byte("0123456789abcdef0123456789abcdef"))
	cipher, err := tenancy.NewCredentialCipher(key)
	if err != nil {
		t.Fatal(err)
	}
	manager := tenancy.NewDatabaseManagerWithOpener(cipher, tenancy.PoolConfig{}, func(record tenancy.Record, _ string) (*gorm.DB, error) {
		return gorm.Open(sqlite.Open("file:"+record.ID.String()+"?mode=memory&cache=shared"), &gorm.Config{})
	})
	service := NewService(registry, manager, cipher, provisionerStub{err: provisionErr},
		func(_ context.Context, db *gorm.DB) error { return db.Exec("CREATE TABLE migrated (id integer)").Error },
		func(_ context.Context, db *gorm.DB, _ tenancy.Record, request Request) error {
			return db.Exec("CREATE TABLE bootstrap (email text); INSERT INTO bootstrap(email) VALUES (?)", request.AdminEmail).Error
		},
		"mysql", 3306, "erp.example.com",
	)
	return service, registry, manager
}

func TestProvisioningActivatesOnlyAfterDatabaseMigrationAndBootstrap(t *testing.T) {
	service, registry, manager := provisioningDependencies(t, nil)
	t.Cleanup(manager.Close)
	record, err := service.Create(context.Background(), Request{Name: "PT Alpha", Slug: "alpha", Domain: "alpha.erp.example.com", AdminEmail: "admin@alpha.test"})
	if err != nil {
		t.Fatal(err)
	}
	if record.Status != tenancy.StatusActive {
		t.Fatalf("status=%s", record.Status)
	}
	stored, err := registry.FindBySlug(context.Background(), "alpha")
	if err != nil || stored.Status != tenancy.StatusActive || stored.DatabasePasswordEncrypted == "" {
		t.Fatalf("stored tenant invalid: %#v %v", stored, err)
	}
	if len(stored.Domains) != 1 || stored.Domains[0].VerifiedAt == nil {
		t.Fatalf("platform subdomain was not verified: %#v", stored.Domains)
	}
}

func TestProvisioningFailureIsRecorded(t *testing.T) {
	service, registry, manager := provisioningDependencies(t, errors.New("database unavailable"))
	t.Cleanup(manager.Close)
	_, err := service.Create(context.Background(), Request{Name: "PT Beta", Slug: "beta", Domain: "beta.erp.example.com", AdminEmail: "admin@beta.test"})
	if err == nil {
		t.Fatal("expected provisioning failure")
	}
	stored, findErr := registry.FindBySlug(context.Background(), "beta")
	if findErr != nil || stored.Status != tenancy.StatusFailed || stored.ProvisioningError == "" {
		t.Fatalf("failure state not persisted: %#v %v", stored, findErr)
	}
}
