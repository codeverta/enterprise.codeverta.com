package controller

import (
	"net/http"
	"strings"

	coremodel "gin-template/model"
	accountingmodel "gin-template/modules/accounting/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type BankingController struct{}

func NewBankingController() *BankingController { return &BankingController{} }

func bankingTenant(ctx *gin.Context) string { return strings.TrimSpace(ctx.GetString("tenant_id")) }

func (c *BankingController) Banks(ctx *gin.Context) {
	var rows []accountingmodel.Bank
	query := coremodel.GetDB(ctx).Where("tenant_id = ?", bankingTenant(ctx))
	if q := strings.TrimSpace(ctx.Query("q")); q != "" {
		like := "%" + q + "%"
		query = query.Where("bank_name LIKE ? OR swift_number LIKE ?", like, like)
	}
	if err := query.Order("bank_name asc").Find(&rows).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil Bank"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": rows})
}

func (c *BankingController) Bank(ctx *gin.Context) {
	var row accountingmodel.Bank
	if err := coremodel.GetDB(ctx).Where("tenant_id = ? AND id = ?", bankingTenant(ctx), ctx.Param("id")).First(&row).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Bank tidak ditemukan"})
		return
	}
	ctx.JSON(http.StatusOK, row)
}

func (c *BankingController) CreateBank(ctx *gin.Context) {
	var input accountingmodel.Bank
	if err := ctx.ShouldBindJSON(&input); err != nil || strings.TrimSpace(input.BankName) == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Bank Name wajib diisi"})
		return
	}
	input.ID, input.TenantID = "bank-"+uuid.NewString()[:12], bankingTenant(ctx)
	input.BankName, input.SWIFTNumber, input.Website = strings.TrimSpace(input.BankName), strings.TrimSpace(input.SWIFTNumber), strings.TrimSpace(input.Website)
	if err := coremodel.GetDB(ctx).Create(&input).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat Bank"})
		return
	}
	ctx.JSON(http.StatusCreated, input)
}

func (c *BankingController) UpdateBank(ctx *gin.Context) {
	db, tenant := coremodel.GetDB(ctx), bankingTenant(ctx)
	var row accountingmodel.Bank
	if err := db.Where("tenant_id = ? AND id = ?", tenant, ctx.Param("id")).First(&row).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Bank tidak ditemukan"})
		return
	}
	var input accountingmodel.Bank
	if err := ctx.ShouldBindJSON(&input); err != nil || strings.TrimSpace(input.BankName) == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Bank Name wajib diisi"})
		return
	}
	input.ID, input.TenantID = row.ID, row.TenantID
	input.BankName, input.SWIFTNumber, input.Website = strings.TrimSpace(input.BankName), strings.TrimSpace(input.SWIFTNumber), strings.TrimSpace(input.Website)
	if err := db.Save(&input).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui Bank"})
		return
	}
	ctx.JSON(http.StatusOK, input)
}

func (c *BankingController) DeleteBank(ctx *gin.Context) {
	db := coremodel.GetDB(ctx)
	var row accountingmodel.Bank
	if err := db.Where("tenant_id = ? AND id = ?", bankingTenant(ctx), ctx.Param("id")).First(&row).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Bank tidak ditemukan"})
		return
	}
	if err := db.Delete(&row).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus Bank"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "Bank terhapus"})
}

func (c *BankingController) BankAccountOptions(ctx *gin.Context) {
	db := coremodel.GetDB(ctx)
	var banks []accountingmodel.Bank
	var types []accountingmodel.BankAccountType
	db.Where("tenant_id = ?", bankingTenant(ctx)).Order("bank_name").Find(&banks)
	db.Where("tenant_id = ? AND disabled = ?", bankingTenant(ctx), false).Order("name").Find(&types)
	ctx.JSON(http.StatusOK, gin.H{"banks": banks, "account_types": types})
}

func (c *BankingController) BankAccounts(ctx *gin.Context) {
	var rows []accountingmodel.BankAccount
	query := coremodel.GetDB(ctx).Where("tenant_id = ?", bankingTenant(ctx))
	if q := strings.TrimSpace(ctx.Query("q")); q != "" {
		query = query.Where("account_name LIKE ? OR bank_account_no LIKE ?", "%"+q+"%", "%"+q+"%")
	}
	if err := query.Order("account_name asc").Find(&rows).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil Bank Account"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": rows})
}

func (c *BankingController) BankAccount(ctx *gin.Context) {
	var row accountingmodel.BankAccount
	if err := coremodel.GetDB(ctx).Where("tenant_id = ? AND id = ?", bankingTenant(ctx), ctx.Param("id")).First(&row).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Bank Account tidak ditemukan"})
		return
	}
	ctx.JSON(http.StatusOK, row)
}

func (c *BankingController) CreateBankAccount(ctx *gin.Context) { c.saveBankAccount(ctx, "") }

func (c *BankingController) UpdateBankAccount(ctx *gin.Context) {
	c.saveBankAccount(ctx, ctx.Param("id"))
}

func (c *BankingController) saveBankAccount(ctx *gin.Context, id string) {
	db, tenant := coremodel.GetDB(ctx), bankingTenant(ctx)
	var input accountingmodel.BankAccount
	if err := ctx.ShouldBindJSON(&input); err != nil || strings.TrimSpace(input.AccountName) == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Account Name wajib diisi"})
		return
	}
	if id == "" {
		input.ID = "bank-account-" + uuid.NewString()[:12]
		input.TenantID = tenant
	} else {
		var existing accountingmodel.BankAccount
		if err := db.Where("tenant_id = ? AND id = ?", tenant, id).First(&existing).Error; err != nil {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "Bank Account tidak ditemukan"})
			return
		}
		input.ID, input.TenantID, input.CreatedAt = existing.ID, existing.TenantID, existing.CreatedAt
	}
	input.AccountName = strings.TrimSpace(input.AccountName)
	if err := db.Save(&input).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan Bank Account"})
		return
	}
	status := http.StatusOK
	if id == "" {
		status = http.StatusCreated
	}
	ctx.JSON(status, input)
}

func (c *BankingController) DeleteBankAccount(ctx *gin.Context) {
	db := coremodel.GetDB(ctx)
	var row accountingmodel.BankAccount
	if err := db.Where("tenant_id = ? AND id = ?", bankingTenant(ctx), ctx.Param("id")).First(&row).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Bank Account tidak ditemukan"})
		return
	}
	db.Delete(&row)
	ctx.JSON(http.StatusOK, gin.H{"message": "Bank Account terhapus"})
}

func (c *BankingController) BankAccountTypes(ctx *gin.Context) {
	var rows []accountingmodel.BankAccountType
	if err := coremodel.GetDB(ctx).Where("tenant_id = ?", bankingTenant(ctx)).Order("name").Find(&rows).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil Bank Account Type"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": rows})
}

func (c *BankingController) CreateBankAccountType(ctx *gin.Context) {
	var input accountingmodel.BankAccountType
	if err := ctx.ShouldBindJSON(&input); err != nil || strings.TrimSpace(input.Name) == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Account Type wajib diisi"})
		return
	}
	input.ID, input.TenantID, input.Name = "bank-account-type-"+uuid.NewString()[:12], bankingTenant(ctx), strings.TrimSpace(input.Name)
	if err := coremodel.GetDB(ctx).Create(&input).Error; err != nil {
		ctx.JSON(http.StatusConflict, gin.H{"error": "Bank Account Type sudah ada"})
		return
	}
	ctx.JSON(http.StatusCreated, input)
}
