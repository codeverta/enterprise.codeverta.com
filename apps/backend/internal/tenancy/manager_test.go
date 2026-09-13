package tenancy

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type isolatedItem struct {
	ID   uint `gorm:"primaryKey"`
	Name string
}

func encryptedRecord(t *testing.T, cipher *CredentialCipher, slug string) Record {
	t.Helper()
	password, err := cipher.Encrypt("secret-" + slug)
	if err != nil {
		t.Fatal(err)
	}
	return Record{ID: uuid.New(), Slug: slug, DatabaseDriver: "mysql", DatabasePasswordEncrypted: password}
}

func TestDatabaseManagerCreatesOnePoolUnderConcurrency(t *testing.T) {
	cipher := testCipher(t)
	tenant := encryptedRecord(t, cipher, "alpha")
	var opens atomic.Int32
	opener := func(record Record, password string) (*gorm.DB, error) {
		opens.Add(1)
		return gorm.Open(sqlite.Open("file:"+record.ID.String()+"?mode=memory&cache=shared"), &gorm.Config{})
	}
	manager := NewDatabaseManagerWithOpener(cipher, PoolConfig{}, opener)
	t.Cleanup(manager.Close)

	var wg sync.WaitGroup
	for i := 0; i < 30; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if _, err := manager.GetDB(context.Background(), tenant); err != nil {
				t.Errorf("GetDB: %v", err)
			}
		}()
	}
	wg.Wait()
	if got := opens.Load(); got != 1 {
		t.Fatalf("opened %d pools, want 1", got)
	}
}

func TestTenantDatabasesArePhysicallyIsolated(t *testing.T) {
	cipher := testCipher(t)
	manager := NewDatabaseManagerWithOpener(cipher, PoolConfig{}, func(record Record, _ string) (*gorm.DB, error) {
		return gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", record.ID)), &gorm.Config{})
	})
	t.Cleanup(manager.Close)
	alpha := encryptedRecord(t, cipher, "alpha")
	beta := encryptedRecord(t, cipher, "beta")

	alphaDB, err := manager.GetDB(context.Background(), alpha)
	if err != nil {
		t.Fatal(err)
	}
	betaDB, err := manager.GetDB(context.Background(), beta)
	if err != nil {
		t.Fatal(err)
	}
	for _, db := range []*gorm.DB{alphaDB, betaDB} {
		if err := db.AutoMigrate(&isolatedItem{}); err != nil {
			t.Fatal(err)
		}
	}
	if err := alphaDB.Create(&isolatedItem{Name: "Alpha product"}).Error; err != nil {
		t.Fatal(err)
	}
	if err := betaDB.Create(&isolatedItem{Name: "Beta product"}).Error; err != nil {
		t.Fatal(err)
	}
	var alphaItem, betaItem isolatedItem
	if err := alphaDB.First(&alphaItem).Error; err != nil {
		t.Fatal(err)
	}
	if err := betaDB.First(&betaItem).Error; err != nil {
		t.Fatal(err)
	}
	if alphaItem.Name != "Alpha product" || betaItem.Name != "Beta product" {
		t.Fatalf("cross-tenant leak: alpha=%q beta=%q", alphaItem.Name, betaItem.Name)
	}
}
