package model

import (
	"fmt"

	"gorm.io/gorm"
)

func Migrate(db *gorm.DB) error {
	if err := db.AutoMigrate(&PrintFormat{}); err != nil {
		return fmt.Errorf("auto migrate Printing models: %w", err)
	}
	return nil
}
