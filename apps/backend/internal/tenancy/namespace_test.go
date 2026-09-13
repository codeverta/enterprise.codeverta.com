package tenancy

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func scopedTestContext(t *testing.T, id uuid.UUID) context.Context {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+id.String()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	return WithScope(context.Background(), Context{ID: id, Slug: "test"}, db)
}

func TestTenantNamespacesCannotCollide(t *testing.T) {
	alphaID, betaID := uuid.New(), uuid.New()
	alpha := scopedTestContext(t, alphaID)
	beta := scopedTestContext(t, betaID)
	alphaKey, _ := CacheKey(alpha, "product", "123")
	betaKey, _ := CacheKey(beta, "product", "123")
	if alphaKey == betaKey || !strings.Contains(alphaKey, alphaID.String()) || !strings.Contains(betaKey, betaID.String()) {
		t.Fatalf("cache keys are not tenant isolated: %q %q", alphaKey, betaKey)
	}
	object, err := ObjectKey(alpha, "products", "photo.jpg")
	if err != nil || object != "tenants/"+alphaID.String()+"/products/photo.jpg" {
		t.Fatalf("unexpected object key %q: %v", object, err)
	}
	if _, err := ObjectKey(alpha, "products", "../beta/secret.pdf"); err == nil {
		t.Fatal("path traversal should be rejected")
	}
}

func TestJobEnvelopeRequiresTenant(t *testing.T) {
	if _, err := NewJob(context.Background(), "report", map[string]string{}); err == nil {
		t.Fatal("job without tenant should fail")
	}
	ctx := scopedTestContext(t, uuid.New())
	job, err := NewJob(ctx, "generate_invoice_pdf", map[string]string{"invoice_id": "1"})
	if err != nil || job.TenantID == "" {
		t.Fatalf("invalid tenant job: %#v %v", job, err)
	}
}

func TestJobRunnerUsesEnvelopeTenantDatabase(t *testing.T) {
	cipher := testCipher(t)
	alpha := encryptedRecord(t, cipher, "alpha")
	beta := encryptedRecord(t, cipher, "beta")
	alpha.Status, beta.Status = StatusActive, StatusActive
	resolver := resolverStub{records: map[string]Record{"alpha.test": alpha, "beta.test": beta}}
	manager := NewDatabaseManagerWithOpener(cipher, PoolConfig{}, func(record Record, _ string) (*gorm.DB, error) {
		return gorm.Open(sqlite.Open("file:"+record.ID.String()+"?mode=memory&cache=shared"), &gorm.Config{})
	})
	t.Cleanup(manager.Close)
	for _, record := range []Record{alpha, beta} {
		db, err := manager.GetDB(context.Background(), record)
		if err != nil {
			t.Fatal(err)
		}
		if err := db.AutoMigrate(&isolatedItem{}); err != nil {
			t.Fatal(err)
		}
		if err := db.Create(&isolatedItem{Name: record.Slug}).Error; err != nil {
			t.Fatal(err)
		}
	}
	seen := ""
	runner := JobRunner{Resolver: resolver, Databases: manager, Handlers: map[string]JobHandler{
		"read": func(ctx context.Context, _ json.RawMessage) error {
			db, err := DBFromContext(ctx)
			if err != nil {
				return err
			}
			var item isolatedItem
			if err := db.First(&item).Error; err != nil {
				return err
			}
			seen = item.Name
			return nil
		},
	}}
	if err := runner.Handle(context.Background(), JobEnvelope{TenantID: alpha.ID.String(), Type: "read", Payload: []byte(`{}`)}); err != nil {
		t.Fatal(err)
	}
	if seen != "alpha" {
		t.Fatalf("tenant A job read %q", seen)
	}
}
