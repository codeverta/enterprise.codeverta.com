package entitlement

import (
	"context"
	"testing"
	"time"

	"gin-template/internal/tenancy"

	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestFeaturesAndLimitsAreCentralizedByTenantPlan(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	service := New(db, time.Minute)
	if err := service.Migrate(); err != nil {
		t.Fatal(err)
	}
	plan := Plan{ID: uuid.New(), Slug: "starter", Name: "Starter", IsActive: true}
	limit := int64(5)
	if err := db.Create(&plan).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&[]Grant{
		{ID: uuid.New(), PlanID: plan.ID, Feature: "inventory", Enabled: true},
		{ID: uuid.New(), PlanID: plan.ID, Feature: "payroll", Enabled: false},
		{ID: uuid.New(), PlanID: plan.ID, Feature: "users", Enabled: true, Limit: &limit},
	}).Error; err != nil {
		t.Fatal(err)
	}
	tenantDB, _ := gorm.Open(sqlite.Open("file:"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{})
	ctx := tenancy.WithScope(context.Background(), tenancy.Context{ID: uuid.New(), Plan: "starter"}, tenantDB)
	hasInventory, err := service.Has(ctx, "inventory")
	if err != nil || !hasInventory {
		t.Fatalf("inventory grant: %v %v", hasInventory, err)
	}
	hasPayroll, err := service.Has(ctx, "payroll")
	if err != nil || hasPayroll {
		t.Fatalf("payroll grant: %v %v", hasPayroll, err)
	}
	gotLimit, bounded, err := service.Limit(ctx, "users")
	if err != nil || !bounded || gotLimit != 5 {
		t.Fatalf("user limit: %d %v %v", gotLimit, bounded, err)
	}
}
