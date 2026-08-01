package model

import (
	"context"
	"gin-template/common"
	"testing"

	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestRepairLegacyStudentPricingData(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&Tenant{}, &PricingCategory{}, &SubscriptionPlan{}); err != nil {
		t.Fatalf("migrate pricing models: %v", err)
	}

	tenant := Tenant{ID: uuid.New(), Name: "Pricing Tenant", Domain: "pricing.test", IsActive: true}
	if err := db.Create(&tenant).Error; err != nil {
		t.Fatalf("create tenant: %v", err)
	}
	ctx := context.WithValue(context.Background(), common.CtxTenantKey, tenant)

	legacyParent := PricingCategory{
		Name:         "Parent System",
		Slug:         "parent-system",
		CheckoutType: "parent",
		IsActive:     true,
	}
	legacySD := PricingCategory{
		Name:         "SD",
		Slug:         "sd",
		CheckoutType: "parent_child",
		IsActive:     true,
	}
	if err := db.WithContext(ctx).Create(&legacyParent).Error; err != nil {
		t.Fatalf("create parent category: %v", err)
	}
	if err := db.WithContext(ctx).Create(&legacySD).Error; err != nil {
		t.Fatalf("create legacy SD category: %v", err)
	}

	earlyPlan := SubscriptionPlan{
		Name:              "Early Years",
		Slug:              "early-years",
		Amount:            149000,
		DurationDays:      30,
		Interval:          "monthly",
		IsActive:          true,
		PricingCategoryID: &legacyParent.ID,
	}
	if err := db.WithContext(ctx).Create(&earlyPlan).Error; err != nil {
		t.Fatalf("create legacy early plan: %v", err)
	}

	if err := SeedPricingCategories(db); err != nil {
		t.Fatalf("repair student category checkout types: %v", err)
	}
	if err := repairLegacyEarlyYearsPlanCategories(db); err != nil {
		t.Fatalf("repair Early Years plan category: %v", err)
	}

	var repairedSD PricingCategory
	if err := db.First(&repairedSD, "id = ?", legacySD.ID).Error; err != nil {
		t.Fatalf("reload SD category: %v", err)
	}
	if repairedSD.CheckoutType != "student" {
		t.Fatalf("expected SD checkout_type student, got %q", repairedSD.CheckoutType)
	}

	var repairedPlan SubscriptionPlan
	if err := db.Preload("PricingCategory").First(&repairedPlan, "id = ?", earlyPlan.ID).Error; err != nil {
		t.Fatalf("reload Early Years plan: %v", err)
	}
	if repairedPlan.PricingCategory == nil || repairedPlan.PricingCategory.CheckoutType != "student" {
		t.Fatalf("expected Early Years student category, got %+v", repairedPlan.PricingCategory)
	}
	if repairedPlan.PricingCategory.Slug != "early-years" {
		t.Fatalf("expected dedicated early-years category, got %q", repairedPlan.PricingCategory.Slug)
	}

	var repairedParent PricingCategory
	if err := db.First(&repairedParent, "id = ?", legacyParent.ID).Error; err != nil {
		t.Fatalf("reload parent category: %v", err)
	}
	if repairedParent.CheckoutType != "parent" {
		t.Fatalf("parent category must remain parent, got %q", repairedParent.CheckoutType)
	}
}
