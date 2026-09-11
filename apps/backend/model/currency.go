package model

import (
	"time"
)

type Currency struct {
	ID                           string    `gorm:"primaryKey;size:32" json:"id"`
	CurrencyName                 string    `gorm:"size:64;not null;index" json:"currency_name"`
	Enabled                      bool      `gorm:"default:true;index" json:"enabled"`
	Fraction                     string    `gorm:"size:64" json:"fraction"`
	FractionUnits                int       `gorm:"default:100" json:"fraction_units"`
	SmallestCurrencyFractionValue float64  `gorm:"type:decimal(18,4);default:0.01" json:"smallest_currency_fraction_value"`
	Symbol                       string    `gorm:"size:16;not null" json:"symbol"`
	SymbolOnRight                bool      `gorm:"default:false" json:"symbol_on_right"`
	NumberFormat                 string    `gorm:"size:64;default:'#,###.##'" json:"number_format"`
	CreatedAt                    time.Time `json:"created_at"`
	UpdatedAt                    time.Time `json:"updated_at"`
}

func (Currency) TableName() string {
	return "currencies"
}
