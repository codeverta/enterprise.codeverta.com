package controller

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"gin-template/model"
	sellingmodel "gin-template/modules/selling/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type LoyaltyProgramController struct{}

func NewLoyaltyProgramController() *LoyaltyProgramController {
	return &LoyaltyProgramController{}
}

func loyaltyDB(ctx *gin.Context) *gorm.DB {
	return model.GetDB(ctx).WithContext(ctx.Request.Context())
}

func loyaltyTenant(ctx *gin.Context) string {
	tenantID, _ := ctx.Get("tenant_id")
	tenantStr, _ := tenantID.(string)
	return tenantStr
}

func (c *LoyaltyProgramController) List(ctx *gin.Context) {
	db := loyaltyDB(ctx)
	tenantStr := loyaltyTenant(ctx)

	query := db.Model(&sellingmodel.LoyaltyProgram{}).Preload("CollectionRules")
	if tenantStr != "" {
		query = query.Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenantStr)
	}

	if q := strings.TrimSpace(ctx.Query("q")); q != "" {
		like := "%" + q + "%"
		query = query.Where("loyalty_program_name LIKE ? OR customer_group LIKE ?", like, like)
	}
	if pType := strings.TrimSpace(ctx.Query("type")); pType != "" {
		query = query.Where("loyalty_program_type = ?", pType)
	}

	var programs []sellingmodel.LoyaltyProgram
	if err := query.Order("created_at desc").Find(&programs).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data loyalty program"})
		return
	}

	// Auto-seed default loyalty program if completely empty
	if len(programs) == 0 && ctx.Query("q") == "" && ctx.Query("type") == "" {
		now := time.Now()
		defaultProg := sellingmodel.LoyaltyProgram{
			ID:                 "lp-default-rewards",
			TenantID:           tenantStr,
			LoyaltyProgramName: "Standard Rewards Program",
			LoyaltyProgramType: "Single Tier Program",
			CustomerGroup:      "All Customer Groups",
			CustomerTerritory:  "All Territories",
			AutoOptIn:          true,
			ConversionFactor:   1,
			ExpiryDuration:     365,
			ExpenseAccount:     "5112 - Loyalty Program Expense",
			CreatedAt:          now,
			UpdatedAt:          now,
			CollectionRules: []sellingmodel.CollectionRule{
				{
					ID:               "cr-default-01",
					LoyaltyProgramID: "lp-default-rewards",
					TierName:         "Tier 1",
					MinSpent:         0,
					CollectionFactor: 10000,
				},
			},
		}
		if err := db.Create(&defaultProg).Error; err == nil {
			programs = append(programs, defaultProg)
		}
	}

	ctx.JSON(http.StatusOK, gin.H{"data": programs})
}

func (c *LoyaltyProgramController) Get(ctx *gin.Context) {
	db := loyaltyDB(ctx)
	tenantStr := loyaltyTenant(ctx)
	id := ctx.Param("id")

	var program sellingmodel.LoyaltyProgram
	query := db.Preload("CollectionRules").Where("id = ?", id)
	if tenantStr != "" {
		query = query.Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenantStr)
	}
	if err := query.First(&program).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Loyalty Program tidak ditemukan"})
		return
	}

	ctx.JSON(http.StatusOK, program)
}

func (c *LoyaltyProgramController) Create(ctx *gin.Context) {
	db := loyaltyDB(ctx)
	tenantStr := loyaltyTenant(ctx)

	var input sellingmodel.LoyaltyProgram
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if input.ID == "" {
		input.ID = "lp-" + uuid.New().String()[:8]
	}
	input.TenantID = tenantStr
	input.CreatedAt = time.Now()
	input.UpdatedAt = time.Now()

	for i := range input.CollectionRules {
		if input.CollectionRules[i].ID == "" {
			input.CollectionRules[i].ID = "cr-" + uuid.New().String()[:8]
		}
		input.CollectionRules[i].LoyaltyProgramID = input.ID
	}

	if err := db.Create(&input).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat Loyalty Program"})
		return
	}

	ctx.JSON(http.StatusCreated, input)
}

func (c *LoyaltyProgramController) Update(ctx *gin.Context) {
	db := loyaltyDB(ctx)
	tenantStr := loyaltyTenant(ctx)
	id := ctx.Param("id")

	var existing sellingmodel.LoyaltyProgram
	query := db.Where("id = ?", id)
	if tenantStr != "" {
		query = query.Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenantStr)
	}
	if err := query.First(&existing).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Loyalty Program tidak ditemukan"})
		return
	}

	var input sellingmodel.LoyaltyProgram
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	input.ID = id
	input.TenantID = existing.TenantID
	input.UpdatedAt = time.Now()

	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("loyalty_program_id = ?", id).Delete(&sellingmodel.CollectionRule{}).Error; err != nil {
			return err
		}
		for i := range input.CollectionRules {
			if input.CollectionRules[i].ID == "" {
				input.CollectionRules[i].ID = "cr-" + uuid.New().String()[:8]
			}
			input.CollectionRules[i].LoyaltyProgramID = id
		}
		return tx.Save(&input).Error
	})

	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengupdate Loyalty Program"})
		return
	}

	ctx.JSON(http.StatusOK, input)
}

func (c *LoyaltyProgramController) Delete(ctx *gin.Context) {
	db := loyaltyDB(ctx)
	tenantStr := loyaltyTenant(ctx)
	id := ctx.Param("id")

	query := db.Where("id = ?", id)
	if tenantStr != "" {
		query = query.Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenantStr)
	}

	if err := query.Delete(&sellingmodel.LoyaltyProgram{}).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus Loyalty Program"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "Loyalty Program berhasil dihapus"})
}

func (c *LoyaltyProgramController) EntriesList(ctx *gin.Context) {
	db := loyaltyDB(ctx)
	tenantStr := loyaltyTenant(ctx)

	query := db.Model(&sellingmodel.LoyaltyPointEntry{})
	if tenantStr != "" {
		query = query.Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenantStr)
	}

	if q := strings.TrimSpace(ctx.Query("q")); q != "" {
		like := "%" + q + "%"
		query = query.Where("customer LIKE ? OR loyalty_program LIKE ? OR sales_invoice LIKE ? OR id LIKE ?", like, like, like, like)
	}
	if program := strings.TrimSpace(ctx.Query("program")); program != "" {
		query = query.Where("loyalty_program = ?", program)
	}
	if customer := strings.TrimSpace(ctx.Query("customer")); customer != "" {
		query = query.Where("customer = ?", customer)
	}
	if entryType := strings.TrimSpace(ctx.Query("type")); entryType != "" {
		query = query.Where("type = ?", entryType)
	}

	var entries []sellingmodel.LoyaltyPointEntry
	if err := query.Order("posting_date desc, created_at desc").Find(&entries).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data point entries"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": entries})
}

func (c *LoyaltyProgramController) CreateEntry(ctx *gin.Context) {
	db := loyaltyDB(ctx)
	tenantStr := loyaltyTenant(ctx)

	var input sellingmodel.LoyaltyPointEntry
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	input.Customer = strings.TrimSpace(input.Customer)
	input.LoyaltyProgram = strings.TrimSpace(input.LoyaltyProgram)
	if input.Customer == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Customer wajib diisi"})
		return
	}
	if input.LoyaltyProgram == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Loyalty Program wajib diisi"})
		return
	}
	if input.LoyaltyPoints == 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Loyalty Points tidak boleh 0"})
		return
	}

	if input.PostingDate.IsZero() {
		input.PostingDate = time.Now()
	}
	if input.ID == "" {
		input.ID = fmt.Sprintf("LPE-%s-%s", input.PostingDate.Format("2006"), strings.ToUpper(uuid.New().String()[:8]))
	}
	input.TenantID = tenantStr
	if input.Type == "" {
		if input.LoyaltyPoints > 0 {
			input.Type = "Earned"
		} else {
			input.Type = "Redeemed"
		}
	}
	if input.ReferenceType == "" {
		input.ReferenceType = "Manual Entry"
	}
	input.CreatedAt = time.Now()

	// If ExpiryDate not set and type is Earned, check program expiry duration
	if input.Type == "Earned" && input.ExpiryDate == nil {
		var prog sellingmodel.LoyaltyProgram
		if err := db.Where("loyalty_program_name = ?", input.LoyaltyProgram).First(&prog).Error; err == nil && prog.ExpiryDuration > 0 {
			exp := input.PostingDate.AddDate(0, 0, prog.ExpiryDuration)
			input.ExpiryDate = &exp
		}
	}

	if err := db.Create(&input).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat Loyalty Point Entry"})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{"data": input})
}

func (c *LoyaltyProgramController) DeleteEntry(ctx *gin.Context) {
	db := loyaltyDB(ctx)
	tenantStr := loyaltyTenant(ctx)
	id := ctx.Param("id")

	query := db.Where("id = ?", id)
	if tenantStr != "" {
		query = query.Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenantStr)
	}

	if err := query.Delete(&sellingmodel.LoyaltyPointEntry{}).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus Loyalty Point Entry"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "Point entry berhasil dihapus"})
}

func (c *LoyaltyProgramController) Options(ctx *gin.Context) {
	ctx.JSON(http.StatusOK, gin.H{
		"customer_groups": []string{
			"All Customer Groups", "Commercial", "Individual", "Non Profit", "Retail",
		},
		"customer_territories": []string{
			"All Territories", "Indonesia", "Jakarta", "Surabaya", "Asia", "North America",
		},
		"expense_accounts": []string{
			"5112 - Loyalty Program Expense",
			"5111 - Marketing & Promotional Expense",
			"5110 - Sales Expenses",
		},
		"companies": []string{
			"",
		},
		"cost_centers": []string{
			"",
			"",
			"",
		},
		"projects": []string{
			"General Marketing 2026", "Customer Retention Q3",
		},
	})
}
