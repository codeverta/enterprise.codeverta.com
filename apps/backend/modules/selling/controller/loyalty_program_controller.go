package controller

import (
	"net/http"
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

func (c *LoyaltyProgramController) List(ctx *gin.Context) {
	db := model.DB
	tenantID, _ := ctx.Get("tenant_id")
	tenantStr, _ := tenantID.(string)

	query := db.Model(&sellingmodel.LoyaltyProgram{}).Preload("CollectionRules")
	if tenantStr != "" {
		query = query.Where("tenant_id = ?", tenantStr)
	}

	if q := ctx.Query("q"); q != "" {
		like := "%" + q + "%"
		query = query.Where("loyalty_program_name LIKE ? OR customer_group LIKE ?", like, like)
	}
	if pType := ctx.Query("type"); pType != "" {
		query = query.Where("loyalty_program_type = ?", pType)
	}

	var programs []sellingmodel.LoyaltyProgram
	if err := query.Order("created_at desc").Find(&programs).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data loyalty program"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": programs})
}

func (c *LoyaltyProgramController) Get(ctx *gin.Context) {
	db := model.DB
	id := ctx.Param("id")

	var program sellingmodel.LoyaltyProgram
	if err := db.Preload("CollectionRules").First(&program, "id = ?", id).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Loyalty Program tidak ditemukan"})
		return
	}

	ctx.JSON(http.StatusOK, program)
}

func (c *LoyaltyProgramController) Create(ctx *gin.Context) {
	db := model.DB
	tenantID, _ := ctx.Get("tenant_id")
	tenantStr, _ := tenantID.(string)

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
	db := model.DB
	id := ctx.Param("id")

	var existing sellingmodel.LoyaltyProgram
	if err := db.First(&existing, "id = ?", id).Error; err != nil {
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
	db := model.DB
	id := ctx.Param("id")

	if err := db.Where("id = ?", id).Delete(&sellingmodel.LoyaltyProgram{}).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus Loyalty Program"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "Loyalty Program berhasil dihapus"})
}

func (c *LoyaltyProgramController) EntriesList(ctx *gin.Context) {
	db := model.DB
	tenantID, _ := ctx.Get("tenant_id")
	tenantStr, _ := tenantID.(string)

	query := db.Model(&sellingmodel.LoyaltyPointEntry{})
	if tenantStr != "" {
		query = query.Where("tenant_id = ?", tenantStr)
	}

	var entries []sellingmodel.LoyaltyPointEntry
	if err := query.Order("posting_date desc").Find(&entries).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data point entries"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": entries})
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
			"PT ZENIT TECHNOLOGY SOLUTION",
		},
		"cost_centers": []string{
			"Main - PT ZENIT TECHNOLOGY SOLUTION",
			"Sales - PT ZENIT TECHNOLOGY SOLUTION",
			"Marketing - PT ZENIT TECHNOLOGY SOLUTION",
		},
		"projects": []string{
			"General Marketing 2026", "Customer Retention Q3",
		},
	})
}
