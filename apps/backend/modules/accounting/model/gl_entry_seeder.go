package model

import (
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func SeedGLEntries(db *gorm.DB, tenantID string) error {
	if tenantID == "" {
		tenantID = "tenant-1"
	}
	var company struct {
		Name         string
		Abbreviation string
	}
	if err := db.Table("companies").Select("name", "abbreviation").Where("tenant_id = ? AND is_active = ? AND deleted_at IS NULL", tenantID, true).Order("name asc").Scan(&company).Error; err != nil {
		return err
	}
	if company.Name == "" {
		return nil
	}

	dateAug05 := time.Date(2026, 8, 5, 0, 0, 0, 0, time.UTC)
	dateAug10 := time.Date(2026, 8, 10, 0, 0, 0, 0, time.UTC)
	dateAug12 := time.Date(2026, 8, 12, 0, 0, 0, 0, time.UTC)

	entries := []GLEntry{
		{
			ID:                            "82808c1ee5",
			TenantID:                      tenantID,
			PostingDate:                   dateAug05,
			FiscalYear:                    "2026",
			Account:                       "4210.000 - HPP Pembelian - PZTS",
			AccountCurrency:               "IDR",
			Against:                       "1141.000 - Persediaan Barang - PZTS",
			VoucherType:                   "Delivery Note",
			VoucherNo:                     "MAT-DN-2026-00001",
			VoucherSubtype:                "Delivery Note",
			TransactionCurrency:           "IDR",
			TransactionExchangeRate:       1.0,
			ReportingCurrencyExchangeRate: 1.0,
			DebitInAccountCurrency:        0,
			Debit:                         0,
			DebitInTransactionCurrency:    0,
			DebitInReportingCurrency:      0,
			CreditInAccountCurrency:       10000,
			Credit:                        10000,
			CreditInTransactionCurrency:   10000,
			CreditInReportingCurrency:     10000,
			CostCenter:                    "Main - PZTS",
			Company:                       company.Name,
			IsOpening:                     false,
			IsAdvance:                     false,
			IsCancelled:                   true,
			Remarks:                       "On cancellation of MAT-DN-2026-00001",
			Comment:                       "At",
			CreatedAt:                     dateAug05,
			UpdatedAt:                     dateAug05,
		},
		{
			ID:                            "82808c1ee6",
			TenantID:                      tenantID,
			PostingDate:                   dateAug05,
			FiscalYear:                    "2026",
			Account:                       "1141.000 - Persediaan Barang - PZTS",
			AccountCurrency:               "IDR",
			Against:                       "4210.000 - HPP Pembelian - PZTS",
			VoucherType:                   "Delivery Note",
			VoucherNo:                     "MAT-DN-2026-00001",
			VoucherSubtype:                "Delivery Note",
			TransactionCurrency:           "IDR",
			TransactionExchangeRate:       1.0,
			ReportingCurrencyExchangeRate: 1.0,
			DebitInAccountCurrency:        10000,
			Debit:                         10000,
			DebitInTransactionCurrency:    10000,
			DebitInReportingCurrency:      10000,
			CreditInAccountCurrency:       0,
			Credit:                        0,
			CreditInTransactionCurrency:   0,
			CreditInReportingCurrency:     0,
			CostCenter:                    "Main - PZTS",
			Company:                       company.Name,
			IsOpening:                     false,
			IsAdvance:                     false,
			IsCancelled:                   true,
			Remarks:                       "On cancellation of MAT-DN-2026-00001",
			CreatedAt:                     dateAug05,
			UpdatedAt:                     dateAug05,
		},
		{
			ID:                            "7f1a9b2c3d",
			TenantID:                      tenantID,
			PostingDate:                   dateAug10,
			FiscalYear:                    "2026",
			Account:                       "1131.000 - Piutang Dagang - PZTS",
			AccountCurrency:               "IDR",
			Against:                       "4110.000 - Penjualan Produk - PZTS",
			VoucherType:                   "Sales Invoice",
			VoucherNo:                     "ACC-SINV-2026-00001",
			VoucherSubtype:                "Sales Invoice",
			TransactionCurrency:           "IDR",
			TransactionExchangeRate:       1.0,
			ReportingCurrencyExchangeRate: 1.0,
			DebitInAccountCurrency:        2500000,
			Debit:                         2500000,
			DebitInTransactionCurrency:    2500000,
			DebitInReportingCurrency:      2500000,
			CreditInAccountCurrency:       0,
			Credit:                        0,
			CreditInTransactionCurrency:   0,
			CreditInReportingCurrency:     0,
			CostCenter:                    "Main - PZTS",
			Company:                       company.Name,
			IsOpening:                     false,
			IsAdvance:                     false,
			IsCancelled:                   false,
			Remarks:                       "Sales to customer Zenit Customer Test",
			CreatedAt:                     dateAug10,
			UpdatedAt:                     dateAug10,
		},
		{
			ID:                            "7f1a9b2c3e",
			TenantID:                      tenantID,
			PostingDate:                   dateAug10,
			FiscalYear:                    "2026",
			Account:                       "4110.000 - Penjualan Produk - PZTS",
			AccountCurrency:               "IDR",
			Against:                       "1131.000 - Piutang Dagang - PZTS",
			VoucherType:                   "Sales Invoice",
			VoucherNo:                     "ACC-SINV-2026-00001",
			VoucherSubtype:                "Sales Invoice",
			TransactionCurrency:           "IDR",
			TransactionExchangeRate:       1.0,
			ReportingCurrencyExchangeRate: 1.0,
			DebitInAccountCurrency:        0,
			Debit:                         0,
			DebitInTransactionCurrency:    0,
			DebitInReportingCurrency:      0,
			CreditInAccountCurrency:       2500000,
			Credit:                        2500000,
			CreditInTransactionCurrency:   2500000,
			CreditInReportingCurrency:     2500000,
			CostCenter:                    "Main - PZTS",
			Company:                       company.Name,
			IsOpening:                     false,
			IsAdvance:                     false,
			IsCancelled:                   false,
			Remarks:                       "Sales to customer Zenit Customer Test",
			CreatedAt:                     dateAug10,
			UpdatedAt:                     dateAug10,
		},
		{
			ID:                            "6b2c4e8f1a",
			TenantID:                      tenantID,
			PostingDate:                   dateAug12,
			FiscalYear:                    "2026",
			Account:                       "1141.000 - Persediaan Barang - PZTS",
			AccountCurrency:               "IDR",
			Against:                       "2111.000 - Hutang Dagang - PZTS",
			VoucherType:                   "Purchase Invoice",
			VoucherNo:                     "ACC-PINV-2026-00001",
			VoucherSubtype:                "Purchase Invoice",
			TransactionCurrency:           "IDR",
			TransactionExchangeRate:       1.0,
			ReportingCurrencyExchangeRate: 1.0,
			DebitInAccountCurrency:        1500000,
			Debit:                         1500000,
			DebitInTransactionCurrency:    1500000,
			DebitInReportingCurrency:      1500000,
			CreditInAccountCurrency:       0,
			Credit:                        0,
			CreditInTransactionCurrency:   0,
			CreditInReportingCurrency:     0,
			CostCenter:                    "Main - PZTS",
			Company:                       company.Name,
			IsOpening:                     false,
			IsAdvance:                     false,
			IsCancelled:                   false,
			Remarks:                       "Purchase from Supplier Mitra Jaya",
			CreatedAt:                     dateAug12,
			UpdatedAt:                     dateAug12,
		},
		{
			ID:                            "6b2c4e8f1b",
			TenantID:                      tenantID,
			PostingDate:                   dateAug12,
			FiscalYear:                    "2026",
			Account:                       "2111.000 - Hutang Dagang - PZTS",
			AccountCurrency:               "IDR",
			Against:                       "1141.000 - Persediaan Barang - PZTS",
			VoucherType:                   "Purchase Invoice",
			VoucherNo:                     "ACC-PINV-2026-00001",
			VoucherSubtype:                "Purchase Invoice",
			TransactionCurrency:           "IDR",
			TransactionExchangeRate:       1.0,
			ReportingCurrencyExchangeRate: 1.0,
			DebitInAccountCurrency:        0,
			Debit:                         0,
			DebitInTransactionCurrency:    0,
			DebitInReportingCurrency:      0,
			CreditInAccountCurrency:       1500000,
			Credit:                        1500000,
			CreditInTransactionCurrency:   1500000,
			CreditInReportingCurrency:     1500000,
			CostCenter:                    "Main - PZTS",
			Company:                       company.Name,
			IsOpening:                     false,
			IsAdvance:                     false,
			IsCancelled:                   false,
			Remarks:                       "Purchase from Supplier Mitra Jaya",
			CreatedAt:                     dateAug12,
			UpdatedAt:                     dateAug12,
		},
	}
	suffix := company.Abbreviation
	if suffix == "" {
		suffix = company.Name
	}
	for index := range entries {
		entries[index].Account = strings.ReplaceAll(entries[index].Account, "PZTS", suffix)
		entries[index].Against = strings.ReplaceAll(entries[index].Against, "PZTS", suffix)
		entries[index].CostCenter = strings.ReplaceAll(entries[index].CostCenter, "PZTS", suffix)
		entries[index].Remarks = strings.ReplaceAll(entries[index].Remarks, "Zenit", company.Name)
	}

	return db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "id"}},
		DoNothing: true,
	}).Create(&entries).Error
}
