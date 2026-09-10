package model

import (
	"fmt"
	"time"

	printingmodel "gin-template/modules/printing/model"
	stockmodel "gin-template/modules/stock/model"

	"gorm.io/gorm"
)

const InstallationSeedVersion = 1

type InstallationSeedState struct {
	Key         string    `gorm:"primaryKey;size:64" json:"key"`
	Version     int       `gorm:"not null" json:"version"`
	CompletedAt time.Time `json:"completed_at"`
}

func (InstallationSeedState) TableName() string { return "installation_seed_states" }

// SeedInstallationData is the single first-run bootstrap pipeline. Every
// seeder is idempotent and the marker is only stored after the full pipeline
// succeeds, so an interrupted setup resumes safely on the next launch.
func SeedInstallationData(db *gorm.DB) error {
	var state InstallationSeedState
	err := db.Where("`key` = ?", "default").First(&state).Error
	if err == nil && state.Version >= InstallationSeedVersion {
		return nil
	}
	if err != nil && err != gorm.ErrRecordNotFound {
		return fmt.Errorf("read installation seed state: %w", err)
	}

	steps := []struct {
		name string
		run  func() error
	}{
		{"default roles", func() error { return SeedDefaultRoles(db) }},
		{"email templates", func() error { return SeedEmailTemplates(db) }},
		{"organization", func() error { return SeedOrganizationData(db, DefaultTenantID) }},
		{"pricing categories", func() error { return SeedPricingCategories(db) }},
		{"subscription plans", func() error { return SeedSubscriptionPlans(db) }},
		{"units of measure", func() error { return stockmodel.SeedUOMs(db, DefaultTenantIDString) }},
		{"warehouses", func() error { return stockmodel.SeedWarehouses(db, DefaultTenantIDString) }},
		{"stock entry types", func() error { return stockmodel.SeedStockEntryTypes(db, DefaultTenantIDString) }},
		{"print formats", func() error { return printingmodel.SeedPrintFormats(db, DefaultTenantIDString) }},
	}

	for _, step := range steps {
		if err := step.run(); err != nil {
			return fmt.Errorf("installation seeding failed at %s: %w", step.name, err)
		}
	}

	state = InstallationSeedState{Key: "default", Version: InstallationSeedVersion, CompletedAt: time.Now()}
	if err := db.Save(&state).Error; err != nil {
		return fmt.Errorf("save installation seed state: %w", err)
	}
	return nil
}
