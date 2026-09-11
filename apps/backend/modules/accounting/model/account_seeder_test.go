package model

import (
	"testing"

	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestSeedDefaultAccountsForCompanyIsCompleteIdempotentAndIsolated(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Account{}))

	first := CompanySeedInput{ID: "company-1", TenantID: "tenant-1", Name: "PT ZENIT TECHNOLOGY SOLUTION", Abbreviation: "PZTS", Currency: "IDR"}
	require.NoError(t, SeedDefaultAccountsForCompany(db, first))
	require.NoError(t, SeedDefaultAccountsForCompany(db, first))

	var firstCount int64
	require.NoError(t, db.Model(&Account{}).Where("tenant_id = ? AND company_id = ?", first.TenantID, first.ID).Count(&firstCount).Error)
	require.EqualValues(t, DefaultAccountTemplateCount(), firstCount)
	require.Equal(t, 210, DefaultAccountTemplateCount())

	var bank, bankRupiah Account
	require.NoError(t, db.Where("company_id = ? AND account_number = ?", first.ID, "1120.000").First(&bank).Error)
	require.NoError(t, db.Where("company_id = ? AND account_number = ?", first.ID, "1121.000").First(&bankRupiah).Error)
	require.True(t, bank.IsGroup)
	require.NotNil(t, bankRupiah.ParentAccountID)
	require.Equal(t, bank.ID, *bankRupiah.ParentAccountID)

	var companyBank Account
	require.NoError(t, db.Where("company_id = ? AND account_number = ?", first.ID, "1121.001").First(&companyBank).Error)
	require.Contains(t, companyBank.AccountName, first.Name)
	require.Equal(t, "Bank", companyBank.AccountType)

	second := CompanySeedInput{ID: "company-2", TenantID: "tenant-1", Name: "PT COMPANY DUA", Abbreviation: "PCD", Currency: "USD"}
	require.NoError(t, SeedDefaultAccountsForCompany(db, second))
	var secondCount int64
	require.NoError(t, db.Model(&Account{}).Where("company_id = ?", second.ID).Count(&secondCount).Error)
	require.Equal(t, firstCount, secondCount)

	var secondBank Account
	require.NoError(t, db.Where("company_id = ? AND account_number = ?", second.ID, "1121.001").First(&secondBank).Error)
	require.Equal(t, "USD", secondBank.AccountCurrency)
	require.Contains(t, secondBank.AccountName, second.Name)
}
