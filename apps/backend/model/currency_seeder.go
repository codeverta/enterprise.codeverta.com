package model

import (
	"log"

	"gorm.io/gorm"
)

var DefaultCurrencies = []Currency{
	{
		ID:                            "IDR",
		CurrencyName:                  "IDR",
		Enabled:                       true,
		Fraction:                      "Sen",
		FractionUnits:                 100,
		SmallestCurrencyFractionValue: 100.0,
		Symbol:                        "Rp",
		SymbolOnRight:                 false,
		NumberFormat:                  "#.###,##",
	},
	{
		ID:                            "USD",
		CurrencyName:                  "USD",
		Enabled:                       true,
		Fraction:                      "Cent",
		FractionUnits:                 100,
		SmallestCurrencyFractionValue: 0.01,
		Symbol:                        "$",
		SymbolOnRight:                 false,
		NumberFormat:                  "#,###.##",
	},
	{
		ID:                            "EUR",
		CurrencyName:                  "EUR",
		Enabled:                       true,
		Fraction:                      "Cent",
		FractionUnits:                 100,
		SmallestCurrencyFractionValue: 0.01,
		Symbol:                        "€",
		SymbolOnRight:                 false,
		NumberFormat:                  "#.###,##",
	},
	{
		ID:                            "SGD",
		CurrencyName:                  "SGD",
		Enabled:                       true,
		Fraction:                      "Cent",
		FractionUnits:                 100,
		SmallestCurrencyFractionValue: 0.01,
		Symbol:                        "S$",
		SymbolOnRight:                 false,
		NumberFormat:                  "#,###.##",
	},
	{
		ID:                            "JPY",
		CurrencyName:                  "JPY",
		Enabled:                       true,
		Fraction:                      "Sen",
		FractionUnits:                 100,
		SmallestCurrencyFractionValue: 1.0,
		Symbol:                        "¥",
		SymbolOnRight:                 false,
		NumberFormat:                  "#,###",
	},
	{
		ID:                            "GBP",
		CurrencyName:                  "GBP",
		Enabled:                       true,
		Fraction:                      "Penny",
		FractionUnits:                 100,
		SmallestCurrencyFractionValue: 0.01,
		Symbol:                        "£",
		SymbolOnRight:                 false,
		NumberFormat:                  "#,###.##",
	},
	{
		ID:                            "CNY",
		CurrencyName:                  "CNY",
		Enabled:                       true,
		Fraction:                      "Fen",
		FractionUnits:                 100,
		SmallestCurrencyFractionValue: 0.01,
		Symbol:                        "¥",
		SymbolOnRight:                 false,
		NumberFormat:                  "#,###.##",
	},
	{
		ID:                            "AUD",
		CurrencyName:                  "AUD",
		Enabled:                       true,
		Fraction:                      "Cent",
		FractionUnits:                 100,
		SmallestCurrencyFractionValue: 0.05,
		Symbol:                        "A$",
		SymbolOnRight:                 false,
		NumberFormat:                  "#,###.##",
	},
	{
		ID:                            "MYR",
		CurrencyName:                  "MYR",
		Enabled:                       true,
		Fraction:                      "Sen",
		FractionUnits:                 100,
		SmallestCurrencyFractionValue: 0.05,
		Symbol:                        "RM",
		SymbolOnRight:                 false,
		NumberFormat:                  "#,###.##",
	},
}

// SeedCurrencies populates default currencies idempotently.
func SeedCurrencies(db *gorm.DB) error {
	for _, cur := range DefaultCurrencies {
		var existing Currency
		err := db.Session(&gorm.Session{NewDB: true}).Set("skip_tenant_scope", true).Where("id = ?", cur.ID).First(&existing).Error
		if err == gorm.ErrRecordNotFound {
			if err := db.Session(&gorm.Session{NewDB: true}).Set("skip_tenant_scope", true).Create(&cur).Error; err != nil {
				log.Printf("[CurrencySeeder] Failed to seed %s: %v\n", cur.ID, err)
				return err
			}
		} else if err != nil {
			return err
		}
	}
	return nil
}
