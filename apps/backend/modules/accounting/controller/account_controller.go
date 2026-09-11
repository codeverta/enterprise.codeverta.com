package controller

import (
	"errors"
	"net/http"
	"strings"

	coremodel "gin-template/model"
	accountingmodel "gin-template/modules/accounting/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var accountTypes = []string{
	"Accumulated Depreciation", "Asset Received But Not Billed", "Bank", "Cash", "Chargeable",
	"Capital Work in Progress", "Cost of Goods Sold", "Current Asset", "Current Liability", "Depreciation",
	"Direct Expense", "Direct Income", "Equity", "Expense Account", "Expenses Included In Asset Valuation",
	"Expenses Included In Valuation", "Fixed Asset", "Income Account", "Indirect Expense", "Indirect Income",
	"Liability", "Payable", "Receivable", "Round Off", "Round Off for Opening", "Stock", "Stock Adjustment",
	"Stock Received But Not Billed", "Service Received But Not Billed", "Tax", "Temporary",
}

type AccountController struct{}

func NewAccountController() *AccountController { return &AccountController{} }

func accountDB(ctx *gin.Context) *gorm.DB {
	return coremodel.GetDB(ctx).WithContext(ctx.Request.Context())
}

func accountTenant(ctx *gin.Context) string { return strings.TrimSpace(ctx.GetString("tenant_id")) }

func (ctrl *AccountController) Options(ctx *gin.Context) {
	var categories []string
	_ = accountDB(ctx).Model(&accountingmodel.Account{}).
		Where("tenant_id = ? AND account_category <> ''", accountTenant(ctx)).
		Distinct().Order("account_category").Pluck("account_category", &categories).Error
	ctx.JSON(http.StatusOK, gin.H{"account_types": accountTypes, "account_categories": categories})
}

func (ctrl *AccountController) List(ctx *gin.Context) {
	companyID := strings.TrimSpace(ctx.Query("company_id"))
	if companyID == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Company wajib dipilih"})
		return
	}
	var rows []accountingmodel.Account
	query := accountDB(ctx).Where("tenant_id = ? AND company_id = ?", accountTenant(ctx), companyID)
	if search := strings.TrimSpace(ctx.Query("q")); search != "" {
		like := "%" + search + "%"
		query = query.Where("account_name LIKE ? OR account_number LIKE ? OR account_type LIKE ?", like, like, like)
	}
	if err := query.Order("account_number asc").Find(&rows).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil Chart of Accounts"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": rows})
}

func normalizeAccount(input *accountingmodel.Account) {
	input.AccountName = strings.TrimSpace(input.AccountName)
	input.AccountNumber = strings.TrimSpace(input.AccountNumber)
	input.AccountType = strings.TrimSpace(input.AccountType)
	input.AccountCategory = strings.TrimSpace(input.AccountCategory)
	input.AccountCurrency = strings.ToUpper(strings.TrimSpace(input.AccountCurrency))
	if input.ParentAccountID != nil {
		trimmed := strings.TrimSpace(*input.ParentAccountID)
		if trimmed == "" {
			input.ParentAccountID = nil
		} else {
			input.ParentAccountID = &trimmed
		}
	}
}

func validAccountType(value string) bool {
	if value == "" {
		return true
	}
	for _, candidate := range accountTypes {
		if value == candidate {
			return true
		}
	}
	return false
}

func validateCompanyAndParent(ctx *gin.Context, input *accountingmodel.Account, currentID string) string {
	db, tenant := accountDB(ctx), accountTenant(ctx)
	var company coremodel.Company
	if err := db.Where("id = ?", input.CompanyID).First(&company).Error; err != nil || company.TenantID.String() != tenant {
		return "Company tidak ditemukan"
	}
	if input.AccountCurrency == "" {
		input.AccountCurrency = company.Currency
		if input.AccountCurrency == "" {
			input.AccountCurrency = "IDR"
		}
	}
	if input.ParentAccountID == nil {
		return ""
	}
	if *input.ParentAccountID == currentID {
		return "Account tidak dapat menjadi parent dirinya sendiri"
	}
	var parent accountingmodel.Account
	if err := db.Where("tenant_id = ? AND company_id = ? AND id = ?", tenant, input.CompanyID, *input.ParentAccountID).First(&parent).Error; err != nil {
		return "Parent Account tidak ditemukan"
	}
	if !parent.IsGroup {
		return "Parent Account harus berupa Group"
	}
	for parent.ParentAccountID != nil {
		if *parent.ParentAccountID == currentID {
			return "Parent Account menghasilkan siklus hierarki"
		}
		if err := db.Where("tenant_id = ? AND company_id = ? AND id = ?", tenant, input.CompanyID, *parent.ParentAccountID).First(&parent).Error; err != nil {
			break
		}
	}
	return ""
}

func validateAccount(input accountingmodel.Account) string {
	if input.AccountName == "" {
		return "New Account Name wajib diisi"
	}
	if input.AccountNumber == "" {
		return "Account Number wajib diisi"
	}
	if strings.TrimSpace(input.CompanyID) == "" {
		return "Company wajib dipilih"
	}
	if !validAccountType(input.AccountType) {
		return "Account Type tidak valid"
	}
	return ""
}

func writeAccountError(ctx *gin.Context, err error, fallback string) {
	lower := strings.ToLower(err.Error())
	if strings.Contains(lower, "unique") || strings.Contains(lower, "duplicate") {
		ctx.JSON(http.StatusConflict, gin.H{"error": "Account Number sudah digunakan pada company ini"})
		return
	}
	ctx.JSON(http.StatusInternalServerError, gin.H{"error": fallback})
}

func (ctrl *AccountController) Create(ctx *gin.Context) {
	var input accountingmodel.Account
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Data Account tidak valid"})
		return
	}
	normalizeAccount(&input)
	if message := validateAccount(input); message != "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": message})
		return
	}
	input.ID = "acc-" + uuid.NewString()[:12]
	input.TenantID = accountTenant(ctx)
	input.Balance = 0
	if message := validateCompanyAndParent(ctx, &input, input.ID); message != "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": message})
		return
	}
	if err := accountDB(ctx).Create(&input).Error; err != nil {
		writeAccountError(ctx, err, "Gagal membuat Account")
		return
	}
	ctx.JSON(http.StatusCreated, input)
}

func (ctrl *AccountController) Update(ctx *gin.Context) {
	db, tenant := accountDB(ctx), accountTenant(ctx)
	var existing accountingmodel.Account
	if err := db.Where("tenant_id = ? AND id = ?", tenant, ctx.Param("id")).First(&existing).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Account tidak ditemukan"})
		return
	}
	var input accountingmodel.Account
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Data Account tidak valid"})
		return
	}
	normalizeAccount(&input)
	if message := validateAccount(input); message != "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": message})
		return
	}
	if message := validateCompanyAndParent(ctx, &input, existing.ID); message != "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": message})
		return
	}
	if existing.IsGroup && !input.IsGroup {
		var children int64
		if err := db.Model(&accountingmodel.Account{}).Where("tenant_id = ? AND parent_account_id = ?", tenant, existing.ID).Count(&children).Error; err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memvalidasi child Account"})
			return
		}
		if children > 0 {
			ctx.JSON(http.StatusConflict, gin.H{"error": "Group yang masih memiliki child tidak dapat diubah menjadi non-Group"})
			return
		}
	}
	input.ID, input.TenantID, input.Balance = existing.ID, existing.TenantID, existing.Balance
	input.CreatedAt = existing.CreatedAt
	if err := db.Save(&input).Error; err != nil {
		writeAccountError(ctx, err, "Gagal memperbarui Account")
		return
	}
	ctx.JSON(http.StatusOK, input)
}

func (ctrl *AccountController) Delete(ctx *gin.Context) {
	db, tenant := accountDB(ctx), accountTenant(ctx)
	var row accountingmodel.Account
	if err := db.Where("tenant_id = ? AND id = ?", tenant, ctx.Param("id")).First(&row).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "Account tidak ditemukan"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil Account"})
		return
	}
	var children int64
	if err := db.Model(&accountingmodel.Account{}).Where("tenant_id = ? AND parent_account_id = ?", tenant, row.ID).Count(&children).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memvalidasi child Account"})
		return
	}
	if children > 0 || row.Balance != 0 {
		ctx.JSON(http.StatusConflict, gin.H{"error": "Account dengan child atau saldo tidak dapat dihapus"})
		return
	}
	if err := db.Delete(&row).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus Account"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "Account terhapus"})
}
