package controller

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	coremodel "gin-template/model"
	sellingmodel "gin-template/modules/selling/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type POSProfileController struct{}

func NewPOSProfileController() *POSProfileController {
	return &POSProfileController{}
}

func (c *POSProfileController) List(ctx *gin.Context) {
	db := posDB(ctx)
	tenant := tenantString(ctx)

	query := db.Preload("ApplicableForUsers").
		Preload("Payments").
		Preload("ItemGroups").
		Preload("CustomerGroups").
		Order("created_at desc")

	if tenant != "" {
		query = query.Where("tenant_id = ?", tenant)
	}

	if q := strings.TrimSpace(ctx.Query("q")); q != "" {
		like := "%" + q + "%"
		query = query.Where("name LIKE ? OR company LIKE ? OR warehouse LIKE ?", like, like, like)
	}

	if company := strings.TrimSpace(ctx.Query("company")); company != "" {
		query = query.Where("company = ?", company)
	}

	if disabled := ctx.Query("disabled"); disabled != "" {
		if disabled == "true" {
			query = query.Where("disabled = ?", true)
		} else if disabled == "false" {
			query = query.Where("disabled = ?", false)
		}
	}

	var profiles []sellingmodel.POSProfile
	if err := query.Find(&profiles).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil daftar POS Profile"})
		return
	}

	// If empty, auto-seed a default POS Profile
	if len(profiles) == 0 {
		defaultProfile := seedDefaultPOSProfile(db, tenant)
		if defaultProfile != nil {
			profiles = append(profiles, *defaultProfile)
		}
	}

	ctx.JSON(http.StatusOK, gin.H{"data": profiles})
}

func seedDefaultPOSProfile(db *gorm.DB, tenant string) *sellingmodel.POSProfile {
	now := time.Now()
	profile := sellingmodel.POSProfile{
		ID:                          "posp-" + uuid.New().String()[:8],
		TenantID:                    tenant,
		Name:                        "Usaha Jualan Lilin",
		Company:                     "UD MILLION CANDLES",
		Customer:                    "Walk-in Customer",
		Country:                     "Indonesia",
		Disabled:                    false,
		Warehouse:                   "Stores - MC",
		HideImages:                  false,
		HideUnavailableItems:        false,
		AutoAddItemToCart:           false,
		ValidateStockOnSave:         false,
		PrintReceiptOnOrderComplete: true,
		ActionOnNewInvoice:          "Always Ask",
		IgnorePricingRule:           false,
		AllowRateChange:             true,
		AllowDiscountChange:         true,
		SetGrandTotalToDefaultMop:   true,
		AllowPartialPayment:         false,
		SellingPriceList:            "Standard Selling",
		Currency:                    "IDR",
		WriteOffLimit:               1000,
		ApplyDiscountOn:             "Grand Total",
		CreatedAt:                   now,
		UpdatedAt:                   now,
		ApplicableForUsers: []sellingmodel.POSProfileUser{
			{
				ID:        "posu-" + uuid.New().String()[:8],
				User:      "Administrator",
				IsDefault: true,
				CreatedAt: now,
			},
		},
		Payments: []sellingmodel.POSProfilePaymentMethod{
			{
				ID:             "pospm-" + uuid.New().String()[:8],
				ModeOfPayment:  "Cash",
				IsDefault:      true,
				AllowInReturns: true,
				CreatedAt:      now,
			},
			{
				ID:             "pospm-" + uuid.New().String()[:8],
				ModeOfPayment:  "Bank Transfer",
				IsDefault:      false,
				AllowInReturns: true,
				CreatedAt:      now,
			},
		},
	}

	if err := db.Create(&profile).Error; err == nil {
		return &profile
	}
	return nil
}

func (c *POSProfileController) Get(ctx *gin.Context) {
	db := posDB(ctx)
	tenant := tenantString(ctx)
	id := ctx.Param("id")

	var profile sellingmodel.POSProfile
	query := db.Preload("ApplicableForUsers").
		Preload("Payments").
		Preload("ItemGroups").
		Preload("CustomerGroups").
		Where("id = ? OR name = ?", id, id)

	if tenant != "" {
		query = query.Where("tenant_id = ?", tenant)
	}

	if err := query.First(&profile).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "POS Profile tidak ditemukan"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil POS Profile"})
		return
	}

	ctx.JSON(http.StatusOK, profile)
}

func (c *POSProfileController) Create(ctx *gin.Context) {
	var input sellingmodel.POSProfile
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	input.Name = strings.TrimSpace(input.Name)
	input.Company = strings.TrimSpace(input.Company)
	if input.Name == "" || input.Company == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Name dan Company wajib diisi"})
		return
	}

	tenant := tenantString(ctx)
	now := time.Now()
	input.ID = "POS-PROF-" + now.Format("20060102") + "-" + uuid.New().String()[:6]
	input.TenantID = tenant
	input.CreatedAt = now
	input.UpdatedAt = now

	for i := range input.ApplicableForUsers {
		input.ApplicableForUsers[i].ID = "posu-" + uuid.New().String()[:8]
		input.ApplicableForUsers[i].POSProfileID = input.ID
		input.ApplicableForUsers[i].CreatedAt = now
	}
	for i := range input.Payments {
		input.Payments[i].ID = "pospm-" + uuid.New().String()[:8]
		input.Payments[i].POSProfileID = input.ID
		input.Payments[i].CreatedAt = now
	}
	for i := range input.ItemGroups {
		input.ItemGroups[i].ID = "posig-" + uuid.New().String()[:8]
		input.ItemGroups[i].POSProfileID = input.ID
		input.ItemGroups[i].CreatedAt = now
	}
	for i := range input.CustomerGroups {
		input.CustomerGroups[i].ID = "poscg-" + uuid.New().String()[:8]
		input.CustomerGroups[i].POSProfileID = input.ID
		input.CustomerGroups[i].CreatedAt = now
	}

	db := posDB(ctx)
	// Check duplicate name
	var count int64
	checkQuery := db.Model(&sellingmodel.POSProfile{}).Where("name = ?", input.Name)
	if tenant != "" {
		checkQuery = checkQuery.Where("tenant_id = ?", tenant)
	}
	_ = checkQuery.Count(&count)
	if count > 0 {
		ctx.JSON(http.StatusConflict, gin.H{"error": fmt.Sprintf("POS Profile dengan nama '%s' sudah ada", input.Name)})
		return
	}

	if err := db.Create(&input).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat POS Profile: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, input)
}

func (c *POSProfileController) Update(ctx *gin.Context) {
	id := ctx.Param("id")
	db := posDB(ctx)
	tenant := tenantString(ctx)

	var existing sellingmodel.POSProfile
	query := db.Where("id = ? OR name = ?", id, id)
	if tenant != "" {
		query = query.Where("tenant_id = ?", tenant)
	}
	if err := query.First(&existing).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "POS Profile tidak ditemukan"})
		return
	}

	var input sellingmodel.POSProfile
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	now := time.Now()
	err := db.Transaction(func(tx *gorm.DB) error {
		// Remove existing child rows
		if err := tx.Where("pos_profile_id = ?", existing.ID).Delete(&sellingmodel.POSProfileUser{}).Error; err != nil {
			return err
		}
		if err := tx.Where("pos_profile_id = ?", existing.ID).Delete(&sellingmodel.POSProfilePaymentMethod{}).Error; err != nil {
			return err
		}
		if err := tx.Where("pos_profile_id = ?", existing.ID).Delete(&sellingmodel.POSProfileItemGroup{}).Error; err != nil {
			return err
		}
		if err := tx.Where("pos_profile_id = ?", existing.ID).Delete(&sellingmodel.POSProfileCustomerGroup{}).Error; err != nil {
			return err
		}

		existing.Name = input.Name
		existing.Company = input.Company
		existing.Customer = input.Customer
		existing.Country = input.Country
		existing.Disabled = input.Disabled
		existing.Warehouse = input.Warehouse
		existing.CompanyAddress = input.CompanyAddress
		existing.HideImages = input.HideImages
		existing.HideUnavailableItems = input.HideUnavailableItems
		existing.AutoAddItemToCart = input.AutoAddItemToCart
		existing.ValidateStockOnSave = input.ValidateStockOnSave
		existing.PrintReceiptOnOrderComplete = input.PrintReceiptOnOrderComplete
		existing.ActionOnNewInvoice = input.ActionOnNewInvoice
		existing.IgnorePricingRule = input.IgnorePricingRule
		existing.AllowRateChange = input.AllowRateChange
		existing.AllowDiscountChange = input.AllowDiscountChange
		existing.SetGrandTotalToDefaultMop = input.SetGrandTotalToDefaultMop
		existing.AllowPartialPayment = input.AllowPartialPayment
		existing.PrintFormat = input.PrintFormat
		existing.LetterHead = input.LetterHead
		existing.TermsAndConditions = input.TermsAndConditions
		existing.PrintHeading = input.PrintHeading
		existing.SellingPriceList = input.SellingPriceList
		existing.Currency = input.Currency
		existing.WriteOffAccount = input.WriteOffAccount
		existing.WriteOffCostCenter = input.WriteOffCostCenter
		existing.WriteOffLimit = input.WriteOffLimit
		existing.AccountForChangeAmount = input.AccountForChangeAmount
		existing.DisableRoundedTotal = input.DisableRoundedTotal
		existing.IncomeAccount = input.IncomeAccount
		existing.ExpenseAccount = input.ExpenseAccount
		existing.TaxesAndCharges = input.TaxesAndCharges
		existing.TaxCategory = input.TaxCategory
		existing.ApplyDiscountOn = input.ApplyDiscountOn
		existing.CostCenter = input.CostCenter
		existing.Project = input.Project
		existing.UTMSource = input.UTMSource
		existing.UTMCampaign = input.UTMCampaign
		existing.UTMMedium = input.UTMMedium
		existing.UpdatedAt = now

		if err := tx.Save(&existing).Error; err != nil {
			return err
		}

		for _, u := range input.ApplicableForUsers {
			u.ID = "posu-" + uuid.New().String()[:8]
			u.POSProfileID = existing.ID
			u.CreatedAt = now
			if err := tx.Create(&u).Error; err != nil {
				return err
			}
		}
		for _, p := range input.Payments {
			p.ID = "pospm-" + uuid.New().String()[:8]
			p.POSProfileID = existing.ID
			p.CreatedAt = now
			if err := tx.Create(&p).Error; err != nil {
				return err
			}
		}
		for _, ig := range input.ItemGroups {
			ig.ID = "posig-" + uuid.New().String()[:8]
			ig.POSProfileID = existing.ID
			ig.CreatedAt = now
			if err := tx.Create(&ig).Error; err != nil {
				return err
			}
		}
		for _, cg := range input.CustomerGroups {
			cg.ID = "poscg-" + uuid.New().String()[:8]
			cg.POSProfileID = existing.ID
			cg.CreatedAt = now
			if err := tx.Create(&cg).Error; err != nil {
				return err
			}
		}
		return nil
	})

	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui POS Profile: " + err.Error()})
		return
	}

	// Reload updated profile
	var reloaded sellingmodel.POSProfile
	_ = db.Preload("ApplicableForUsers").
		Preload("Payments").
		Preload("ItemGroups").
		Preload("CustomerGroups").
		Where("id = ?", existing.ID).First(&reloaded)

	ctx.JSON(http.StatusOK, reloaded)
}

func (c *POSProfileController) Delete(ctx *gin.Context) {
	id := ctx.Param("id")
	db := posDB(ctx)
	tenant := tenantString(ctx)

	var existing sellingmodel.POSProfile
	query := db.Where("id = ? OR name = ?", id, id)
	if tenant != "" {
		query = query.Where("tenant_id = ?", tenant)
	}
	if err := query.First(&existing).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "POS Profile tidak ditemukan"})
		return
	}

	if err := db.Delete(&existing).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus POS Profile"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "POS Profile berhasil dihapus"})
}

func (c *POSProfileController) Options(ctx *gin.Context) {
	db := posDB(ctx)
	tenant := tenantString(ctx)

	// Companies
	var companies []coremodel.Company
	_ = db.Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant).Find(&companies)
	compNames := make([]string, 0, len(companies))
	for _, comp := range companies {
		if comp.Name != "" {
			compNames = append(compNames, comp.Name)
		}
	}
	if len(compNames) == 0 {
		compNames = []string{"UD MILLION CANDLES", "PT ZENIT TECHNOLOGY SOLUTION"}
	}

	// Users / Cashiers
	var users []coremodel.User
	_ = db.Limit(50).Find(&users)
	userNames := make([]string, 0, len(users))
	for _, u := range users {
		name := u.DisplayName
		if name == "" {
			name = u.Username
		}
		if name != "" {
			userNames = append(userNames, name)
		}
	}
	if len(userNames) == 0 {
		userNames = []string{"Administrator", "Cashier 1"}
	}

	ctx.JSON(http.StatusOK, gin.H{
		"companies": compNames,
		"users":     userNames,
		"modes_of_payment": []string{
			"Cash",
			"Bank Transfer",
			"QRIS",
			"Credit Card",
		},
		"action_on_new_invoices": []string{
			"Always Ask",
			"Save Changes and Load New Invoice",
			"Discard Changes and Load New Invoice",
		},
	})
}
