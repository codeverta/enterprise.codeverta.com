package controller

import (
	"testing"
	"time"

	sellingmodel "gin-template/modules/selling/model"

	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestAwardLoyaltyPointsMatchesProgramTierAndIsIdempotent(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(
		&sellingmodel.Customer{}, &sellingmodel.LoyaltyProgram{},
		&sellingmodel.CollectionRule{}, &sellingmodel.LoyaltyPointEntry{},
	); err != nil {
		t.Fatal(err)
	}

	tenant := "tenant-loyalty-test"
	postingDate := time.Date(2026, 9, 12, 10, 0, 0, 0, time.UTC)
	fromDate := postingDate.AddDate(0, 0, -1)
	toDate := postingDate.AddDate(0, 0, 1)
	customer := sellingmodel.Customer{
		ID: "cust-loyalty", TenantID: tenant, CustomerName: "PT Loyal",
		CustomerGroup: "Retail", Territory: "Indonesia",
	}
	program := sellingmodel.LoyaltyProgram{
		ID: "lp-loyalty", TenantID: tenant, LoyaltyProgramName: "Retail Rewards",
		LoyaltyProgramType: "Multiple Tier Program", FromDate: &fromDate, ToDate: &toDate,
		CustomerGroup: "Retail", CustomerTerritory: "Indonesia", AutoOptIn: true,
		ExpiryDuration: 30,
		CollectionRules: []sellingmodel.CollectionRule{
			{ID: "rule-basic", TierName: "Basic", MinSpent: 0, CollectionFactor: 100},
			{ID: "rule-gold", TierName: "Gold", MinSpent: 1000, CollectionFactor: 50},
		},
	}
	if err := db.Create(&customer).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&program).Error; err != nil {
		t.Fatal(err)
	}

	input := LoyaltyAwardInput{
		TenantID: tenant, Customer: customer.CustomerName, Company: "",
		Reference: "ACC-SINV-2026-0001", ReferenceType: "POS Invoice",
		PurchaseAmount: 1250, PostingDate: postingDate,
	}
	entry, err := AwardLoyaltyPoints(db, input)
	if err != nil {
		t.Fatal(err)
	}
	if entry == nil || entry.LoyaltyPoints != 25 || entry.ReferenceType != "POS Invoice" {
		t.Fatalf("unexpected loyalty entry: %+v", entry)
	}
	if entry.ExpiryDate == nil || !entry.ExpiryDate.Equal(postingDate.AddDate(0, 0, 30)) {
		t.Fatalf("unexpected expiry date: %+v", entry.ExpiryDate)
	}

	if _, err := AwardLoyaltyPoints(db, input); err != nil {
		t.Fatal(err)
	}
	var count int64
	if err := db.Model(&sellingmodel.LoyaltyPointEntry{}).Count(&count).Error; err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("expected one idempotent entry, got %d", count)
	}
}

func TestAwardLoyaltyPointsSkipsCustomerOutsideProgramScope(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(
		&sellingmodel.Customer{}, &sellingmodel.LoyaltyProgram{},
		&sellingmodel.CollectionRule{}, &sellingmodel.LoyaltyPointEntry{},
	); err != nil {
		t.Fatal(err)
	}
	tenant := "tenant-scope-test"
	db.Create(&sellingmodel.Customer{ID: "cust-scope", TenantID: tenant, CustomerName: "PT Wholesale", CustomerGroup: "Commercial", Territory: "Indonesia"})
	db.Create(&sellingmodel.LoyaltyProgram{
		ID: "lp-retail", TenantID: tenant, LoyaltyProgramName: "Retail Only", CustomerGroup: "Retail",
		CustomerTerritory: "All Territories", AutoOptIn: true,
		CollectionRules: []sellingmodel.CollectionRule{{ID: "rule-retail", TierName: "Default", CollectionFactor: 100}},
	})

	entry, err := AwardLoyaltyPoints(db, LoyaltyAwardInput{
		TenantID: tenant, Customer: "PT Wholesale", Reference: "SO-001",
		ReferenceType: "Sales Order", PurchaseAmount: 1000, PostingDate: time.Now(),
	})
	if err != nil {
		t.Fatal(err)
	}
	if entry != nil {
		t.Fatalf("expected no entry for mismatched customer group, got %+v", entry)
	}
}
