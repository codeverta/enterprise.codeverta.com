package crm

import (
	"testing"

	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestMigrateAndTenantScopedCreate(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := Migrate(db); err != nil {
		t.Fatal(err)
	}

	tenantID := uuid.New()
	lead := Lead{Name: "Prospek Baru"}
	if err := db.Set("tenant_id", tenantID.String()).Create(&lead).Error; err != nil {
		t.Fatal(err)
	}
	if lead.ID == uuid.Nil {
		t.Fatal("expected generated UUID")
	}
	if lead.TenantID != tenantID {
		t.Fatalf("expected tenant %s, got %s", tenantID, lead.TenantID)
	}
}

func TestCreateRejectsMissingTenant(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:crm_missing_tenant?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&Lead{}); err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&Lead{Name: "Unsafe"}).Error; err == nil {
		t.Fatal("expected missing tenant to be rejected")
	}
}

func TestTenantScopedUniqueIndexes(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:crm_unique?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := Migrate(db); err != nil {
		t.Fatal(err)
	}
	tenantA, tenantB := uuid.New(), uuid.New()
	first := Product{Name: "Paket", SKU: "SKU-1", Price: 10}
	if err := db.Set("tenant_id", tenantA.String()).Create(&first).Error; err != nil {
		t.Fatal(err)
	}
	duplicate := Product{Name: "Paket lain", SKU: "SKU-1", Price: 20}
	if err := db.Set("tenant_id", tenantA.String()).Create(&duplicate).Error; err == nil {
		t.Fatal("expected duplicate SKU in one tenant to fail")
	}
	otherTenant := Product{Name: "Paket tenant B", SKU: "SKU-1", Price: 30}
	if err := db.Set("tenant_id", tenantB.String()).Create(&otherTenant).Error; err != nil {
		t.Fatalf("same SKU in another tenant should be allowed: %v", err)
	}
}
