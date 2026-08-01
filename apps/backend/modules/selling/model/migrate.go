package model

import (
	"fmt"

	"gorm.io/gorm"
)

func Migrate(db *gorm.DB) error {
	if err := db.AutoMigrate(
		&LoyaltyProgram{},
		&CollectionRule{},
		&LoyaltyPointEntry{},
	); err != nil {
		return fmt.Errorf("auto migrate Selling models: %w", err)
	}

	indexes := []struct {
		model         interface{}
		name, columns string
	}{
		{&LoyaltyProgram{}, "idx_selling_lp_tenant", "tenant_id"},
		{&LoyaltyPointEntry{}, "idx_selling_lpe_tenant_cust", "tenant_id, customer"},
	}

	for _, index := range indexes {
		if db.Migrator().HasIndex(index.model, index.name) {
			continue
		}
		statement := &gorm.Statement{DB: db}
		if err := statement.Parse(index.model); err != nil {
			return err
		}
		if err := db.Exec(fmt.Sprintf("CREATE INDEX %s ON %s (%s)", index.name, statement.Schema.Table, index.columns)).Error; err != nil {
			return fmt.Errorf("create Selling index %s: %w", index.name, err)
		}
	}

	return nil
}
