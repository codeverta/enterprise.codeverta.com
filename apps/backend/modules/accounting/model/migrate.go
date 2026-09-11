package model

import (
	"fmt"

	"gorm.io/gorm"
)

func Migrate(db *gorm.DB) error {
	if err := db.AutoMigrate(&Account{}); err != nil {
		return fmt.Errorf("auto migrate Accounting models: %w", err)
	}
	return nil
}
