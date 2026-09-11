package controller

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	coremodel "gin-template/model"
	accountingmodel "gin-template/modules/accounting/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

var defaultVoucherTypes = []string{
	"Delivery Note",
	"Sales Invoice",
	"Purchase Invoice",
	"Journal Entry",
	"Payment Entry",
	"Purchase Receipt",
	"Stock Entry",
}

type GLEntryController struct{}

func NewGLEntryController() *GLEntryController {
	return &GLEntryController{}
}

func glEntryDB(ctx *gin.Context) *gorm.DB {
	return coremodel.GetDB(ctx).WithContext(ctx.Request.Context())
}

func glEntryTenant(ctx *gin.Context) string {
	t := strings.TrimSpace(ctx.GetString("tenant_id"))
	if t == "" {
		t = "tenant-1"
	}
	return t
}

func randomHex10() string {
	b := make([]byte, 5)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("%010d", time.Now().UnixNano()%10000000000)
	}
	return hex.EncodeToString(b)
}

func (ctrl *GLEntryController) ensureSeed(db *gorm.DB, tenantID string) {
	var count int64
	db.Model(&accountingmodel.GLEntry{}).Where("tenant_id = ?", tenantID).Count(&count)
	if count == 0 {
		_ = accountingmodel.SeedGLEntries(db, tenantID)
	}
}

// List returns GL entries matching filter criteria
func (ctrl *GLEntryController) List(ctx *gin.Context) {
	db := glEntryDB(ctx)
	tenantID := glEntryTenant(ctx)
	ctrl.ensureSeed(db, tenantID)

	query := db.Model(&accountingmodel.GLEntry{}).Where("tenant_id = ?", tenantID)

	if voucherType := strings.TrimSpace(ctx.Query("voucher_type")); voucherType != "" {
		query = query.Where("voucher_type = ?", voucherType)
	}
	if voucherNo := strings.TrimSpace(ctx.Query("voucher_no")); voucherNo != "" {
		query = query.Where("voucher_no LIKE ?", "%"+voucherNo+"%")
	}
	if account := strings.TrimSpace(ctx.Query("account")); account != "" {
		query = query.Where("account LIKE ?", "%"+account+"%")
	}
	if company := strings.TrimSpace(ctx.Query("company")); company != "" {
		query = query.Where("company = ?", company)
	}
	if costCenter := strings.TrimSpace(ctx.Query("cost_center")); costCenter != "" {
		query = query.Where("cost_center = ?", costCenter)
	}
	if fromDate := strings.TrimSpace(ctx.Query("from_date")); fromDate != "" {
		if t, err := time.Parse("2006-01-02", fromDate); err == nil {
			query = query.Where("posting_date >= ?", t)
		}
	}
	if toDate := strings.TrimSpace(ctx.Query("to_date")); toDate != "" {
		if t, err := time.Parse("2006-01-02", toDate); err == nil {
			// end of day
			tEnd := t.Add(24*time.Hour - time.Nanosecond)
			query = query.Where("posting_date <= ?", tEnd)
		}
	}
	if isCancelled := strings.TrimSpace(ctx.Query("is_cancelled")); isCancelled != "" {
		if isCancelled == "true" || isCancelled == "1" {
			query = query.Where("is_cancelled = ?", true)
		} else if isCancelled == "false" || isCancelled == "0" {
			query = query.Where("is_cancelled = ?", false)
		}
	}
	if search := strings.TrimSpace(ctx.Query("q")); search != "" {
		like := "%" + search + "%"
		query = query.Where("id LIKE ? OR voucher_no LIKE ? OR account LIKE ? OR against LIKE ? OR remarks LIKE ?", like, like, like, like, like)
	}

	// Calculate totals on the filtered query
	type AggregateTotals struct {
		TotalDebit  float64 `gorm:"column:total_debit"`
		TotalCredit float64 `gorm:"column:total_credit"`
	}
	var totals AggregateTotals
	_ = query.Session(&gorm.Session{}).
		Select("COALESCE(SUM(debit), 0) as total_debit, COALESCE(SUM(credit), 0) as total_credit").
		Scan(&totals).Error

	var totalCount int64
	_ = query.Session(&gorm.Session{}).Count(&totalCount).Error

	// Pagination
	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(ctx.DefaultQuery("limit", "100"))
	if limit < 1 || limit > 500 {
		limit = 100
	}
	offset := (page - 1) * limit

	var rows []accountingmodel.GLEntry
	if err := query.Order("posting_date desc, id desc").Offset(offset).Limit(limit).Find(&rows).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data GL Entry"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"data":         rows,
		"total":        totalCount,
		"page":         page,
		"limit":        limit,
		"total_debit":  totals.TotalDebit,
		"total_credit": totals.TotalCredit,
		"difference":   totals.TotalDebit - totals.TotalCredit,
	})
}

// Get returns single GL entry
func (ctrl *GLEntryController) Get(ctx *gin.Context) {
	id := strings.TrimSpace(ctx.Param("id"))
	if id == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "ID wajib diisi"})
		return
	}

	db := glEntryDB(ctx)
	tenantID := glEntryTenant(ctx)
	ctrl.ensureSeed(db, tenantID)

	var entry accountingmodel.GLEntry
	if err := db.Where("tenant_id = ? AND id = ?", tenantID, id).First(&entry).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "GL Entry tidak ditemukan"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil GL Entry"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": entry})
}

// Create handles creating a manual GL entry
func (ctrl *GLEntryController) Create(ctx *gin.Context) {
	db := glEntryDB(ctx)
	tenantID := glEntryTenant(ctx)

	var input accountingmodel.GLEntry
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Data input tidak valid: " + err.Error()})
		return
	}

	if strings.TrimSpace(input.Account) == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Account wajib diisi"})
		return
	}
	if strings.TrimSpace(input.VoucherType) == "" {
		input.VoucherType = "Journal Entry"
	}
	if strings.TrimSpace(input.VoucherNo) == "" {
		input.VoucherNo = "JV-" + time.Now().Format("2006-00001")
	}
	if input.PostingDate.IsZero() {
		input.PostingDate = time.Now()
	}
	if strings.TrimSpace(input.FiscalYear) == "" {
		input.FiscalYear = strconv.Itoa(input.PostingDate.Year())
	}
	if strings.TrimSpace(input.Company) == "" {
		userID, _ := ctx.Get("id")
		input.Company = coremodel.ResolveActiveCompanyName(db, userID)
	}
	if strings.TrimSpace(input.CostCenter) == "" {
		input.CostCenter = "Main - PZTS"
	}
	if strings.TrimSpace(input.AccountCurrency) == "" {
		input.AccountCurrency = "IDR"
	}
	if strings.TrimSpace(input.TransactionCurrency) == "" {
		input.TransactionCurrency = input.AccountCurrency
	}
	if input.TransactionExchangeRate <= 0 {
		input.TransactionExchangeRate = 1.0
	}
	if input.ReportingCurrencyExchangeRate <= 0 {
		input.ReportingCurrencyExchangeRate = 1.0
	}

	// Synchronize currency fields if not set
	if input.DebitInAccountCurrency == 0 && input.Debit > 0 {
		input.DebitInAccountCurrency = input.Debit
	}
	if input.Debit == 0 && input.DebitInAccountCurrency > 0 {
		input.Debit = input.DebitInAccountCurrency
	}
	if input.DebitInTransactionCurrency == 0 && input.Debit > 0 {
		input.DebitInTransactionCurrency = input.Debit * input.TransactionExchangeRate
	}
	if input.DebitInReportingCurrency == 0 && input.Debit > 0 {
		input.DebitInReportingCurrency = input.Debit * input.ReportingCurrencyExchangeRate
	}

	if input.CreditInAccountCurrency == 0 && input.Credit > 0 {
		input.CreditInAccountCurrency = input.Credit
	}
	if input.Credit == 0 && input.CreditInAccountCurrency > 0 {
		input.Credit = input.CreditInAccountCurrency
	}
	if input.CreditInTransactionCurrency == 0 && input.Credit > 0 {
		input.CreditInTransactionCurrency = input.Credit * input.TransactionExchangeRate
	}
	if input.CreditInReportingCurrency == 0 && input.Credit > 0 {
		input.CreditInReportingCurrency = input.Credit * input.ReportingCurrencyExchangeRate
	}

	if strings.TrimSpace(input.ID) == "" {
		input.ID = randomHex10()
	}
	input.TenantID = tenantID
	now := time.Now()
	input.CreatedAt = now
	input.UpdatedAt = now

	if err := db.Create(&input).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan GL Entry: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{
		"message": "GL Entry berhasil disimpan",
		"data":    input,
	})
}

// Update handles editing a GL entry
func (ctrl *GLEntryController) Update(ctx *gin.Context) {
	id := strings.TrimSpace(ctx.Param("id"))
	if id == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "ID wajib diisi"})
		return
	}

	db := glEntryDB(ctx)
	tenantID := glEntryTenant(ctx)

	var existing accountingmodel.GLEntry
	if err := db.Where("tenant_id = ? AND id = ?", tenantID, id).First(&existing).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "GL Entry tidak ditemukan"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mencari GL Entry"})
		return
	}

	var input accountingmodel.GLEntry
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Data input tidak valid: " + err.Error()})
		return
	}

	if !input.PostingDate.IsZero() {
		existing.PostingDate = input.PostingDate
		existing.FiscalYear = strconv.Itoa(input.PostingDate.Year())
	}
	if input.FiscalYear != "" {
		existing.FiscalYear = input.FiscalYear
	}
	if input.Account != "" {
		existing.Account = input.Account
	}
	if input.AccountCurrency != "" {
		existing.AccountCurrency = input.AccountCurrency
	}
	existing.Against = input.Against
	if input.VoucherType != "" {
		existing.VoucherType = input.VoucherType
	}
	if input.VoucherNo != "" {
		existing.VoucherNo = input.VoucherNo
	}
	existing.VoucherSubtype = input.VoucherSubtype
	if input.TransactionCurrency != "" {
		existing.TransactionCurrency = input.TransactionCurrency
	}
	if input.TransactionExchangeRate > 0 {
		existing.TransactionExchangeRate = input.TransactionExchangeRate
	}
	if input.ReportingCurrencyExchangeRate > 0 {
		existing.ReportingCurrencyExchangeRate = input.ReportingCurrencyExchangeRate
	}

	existing.Debit = input.Debit
	existing.DebitInAccountCurrency = input.DebitInAccountCurrency
	existing.DebitInTransactionCurrency = input.DebitInTransactionCurrency
	existing.DebitInReportingCurrency = input.DebitInReportingCurrency

	existing.Credit = input.Credit
	existing.CreditInAccountCurrency = input.CreditInAccountCurrency
	existing.CreditInTransactionCurrency = input.CreditInTransactionCurrency
	existing.CreditInReportingCurrency = input.CreditInReportingCurrency

	if input.CostCenter != "" {
		existing.CostCenter = input.CostCenter
	}
	if input.Company != "" {
		existing.Company = input.Company
	}
	existing.IsOpening = input.IsOpening
	existing.IsAdvance = input.IsAdvance
	existing.IsCancelled = input.IsCancelled
	existing.Remarks = input.Remarks
	existing.Comment = input.Comment
	existing.UpdatedAt = time.Now()

	if err := db.Save(&existing).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengupdate GL Entry: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "GL Entry berhasil diperbarui",
		"data":    existing,
	})
}

// Delete handles deleting a GL entry
func (ctrl *GLEntryController) Delete(ctx *gin.Context) {
	id := strings.TrimSpace(ctx.Param("id"))
	if id == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "ID wajib diisi"})
		return
	}

	db := glEntryDB(ctx)
	tenantID := glEntryTenant(ctx)

	res := db.Where("tenant_id = ? AND id = ?", tenantID, id).Delete(&accountingmodel.GLEntry{})
	if res.Error != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus GL Entry"})
		return
	}
	if res.RowsAffected == 0 {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "GL Entry tidak ditemukan"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "GL Entry berhasil dihapus"})
}

// Options returns selectable accounts, companies, cost centers, and voucher types
func (ctrl *GLEntryController) Options(ctx *gin.Context) {
	db := glEntryDB(ctx)
	tenantID := glEntryTenant(ctx)

	// Fetch accounts from Chart of Accounts
	var accounts []accountingmodel.Account
	_ = db.Where("tenant_id = ? AND is_group = ?", tenantID, false).
		Order("account_number asc").Find(&accounts).Error

	accountOptions := make([]string, 0, len(accounts))
	for _, a := range accounts {
		accountOptions = append(accountOptions, fmt.Sprintf("%s - %s - PZTS", a.AccountNumber, a.AccountName))
	}

	if len(accountOptions) == 0 {
		accountOptions = []string{
			"1111.001 - Kas Kecil - PZTS",
			"1121.001 - Bank Mandiri - PZTS",
			"1131.000 - Piutang Dagang - PZTS",
			"1141.000 - Persediaan Barang - PZTS",
			"2111.000 - Hutang Dagang - PZTS",
			"4110.000 - Penjualan Produk - PZTS",
			"4210.000 - HPP Pembelian - PZTS",
			"5110.000 - Biaya Gaji - PZTS",
		}
	}

	companies := []string{
		"",
	}

	costCenters := []string{
		"Main - PZTS",
		"Sales - PZTS",
		"Operations - PZTS",
	}

	currencies := []string{
		"IDR",
		"USD",
		"SGD",
		"EUR",
	}

	ctx.JSON(http.StatusOK, gin.H{
		"accounts":      accountOptions,
		"companies":     companies,
		"cost_centers":  costCenters,
		"voucher_types": defaultVoucherTypes,
		"currencies":    currencies,
	})
}
