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

type SalesPartnerController struct{}

func NewSalesPartnerController() *SalesPartnerController {
	return &SalesPartnerController{}
}

func (c *SalesPartnerController) seedDefaultMasterData(ctx *gin.Context, db *gorm.DB, tenantID string) {
	if tenantID == "" {
		return
	}
	now := time.Now()

	// 1. Seed Partner Types
	var ptCount int64
	db.Model(&sellingmodel.SalesPartnerType{}).Where("tenant_id = ?", tenantID).Count(&ptCount)
	if ptCount == 0 {
		defaultTypes := []string{
			"Agent",
			"Channel Partner",
			"Dealer",
			"Distributor",
			"Implementation Partner",
			"Reseller",
			"Retailer",
		}
		for _, name := range defaultTypes {
			_ = db.Create(&sellingmodel.SalesPartnerType{
				ID:              uuid.NewString(),
				TenantID:        tenantID,
				PartnerTypeName: name,
				Description:     fmt.Sprintf("Tipe kemitraan penjualan %s", name),
				CreatedAt:       now,
				UpdatedAt:       now,
			}).Error
		}
	}

	// 2. Seed Item Groups
	var igCount int64
	db.Model(&sellingmodel.ItemGroup{}).Where("tenant_id = ?", tenantID).Count(&igCount)
	if igCount == 0 {
		defaultGroups := []struct {
			name    string
			isGroup bool
		}{
			{"All Item Groups", true},
			{"Products", false},
			{"Raw Material", false},
			{"Services", false},
			{"Consumable", false},
			{"Sub Assemblies", false},
		}
		for _, dg := range defaultGroups {
			parent := ""
			if !dg.isGroup {
				parent = "All Item Groups"
			}
			_ = db.Create(&sellingmodel.ItemGroup{
				ID:              uuid.NewString(),
				TenantID:        tenantID,
				ItemGroupName:   dg.name,
				ParentItemGroup: parent,
				IsGroup:         dg.isGroup,
				CreatedAt:       now,
				UpdatedAt:       now,
			}).Error
		}

		// Also check if buying_items has distinct item groups not yet in selling_item_groups
		var itemGroupsFromItems []string
		_ = db.Table("buying_items").
			Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND item_group != ''", tenantID).
			Distinct("item_group").
			Pluck("item_group", &itemGroupsFromItems).Error

		for _, ig := range itemGroupsFromItems {
			ig = strings.TrimSpace(ig)
			if ig == "" {
				continue
			}
			var exists int64
			db.Model(&sellingmodel.ItemGroup{}).Where("tenant_id = ? AND item_group_name = ?", tenantID, ig).Count(&exists)
			if exists == 0 {
				_ = db.Create(&sellingmodel.ItemGroup{
					ID:              uuid.NewString(),
					TenantID:        tenantID,
					ItemGroupName:   ig,
					ParentItemGroup: "All Item Groups",
					IsGroup:         false,
					CreatedAt:       now,
					UpdatedAt:       now,
				}).Error
			}
		}
	}

	// 3. Seed Fiscal Years
	var fyCount int64
	db.Model(&sellingmodel.FiscalYear{}).Where("tenant_id = ?", tenantID).Count(&fyCount)
	if fyCount == 0 {
		defaultYears := []string{"2024", "2025", "2026", "2027", "2028"}
		for _, yr := range defaultYears {
			_ = db.Create(&sellingmodel.FiscalYear{
				ID:        uuid.NewString(),
				TenantID:  tenantID,
				YearName:  yr,
				StartDate: fmt.Sprintf("%s-01-01", yr),
				EndDate:   fmt.Sprintf("%s-12-31", yr),
				Disabled:  false,
				CreatedAt: now,
				UpdatedAt: now,
			}).Error
		}
	}
}

/* =========================================================================
   PARTNER TYPES API
   ========================================================================= */
func (c *SalesPartnerController) ListPartnerTypes(ctx *gin.Context) {
	tenant := sellingTenant(ctx)
	db := model.GetDB(ctx).WithContext(ctx.Request.Context())
	c.seedDefaultMasterData(ctx, db, tenant)

	var rows []sellingmodel.SalesPartnerType
	if err := db.Where("tenant_id = ?", tenant).Order("partner_type_name asc").Find(&rows).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil Partner Types: " + err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": rows})
}

func (c *SalesPartnerController) CreatePartnerType(ctx *gin.Context) {
	tenant := sellingTenant(ctx)
	db := model.GetDB(ctx).WithContext(ctx.Request.Context())

	var input sellingmodel.SalesPartnerType
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Payload tidak valid: " + err.Error()})
		return
	}
	input.PartnerTypeName = strings.TrimSpace(input.PartnerTypeName)
	if input.PartnerTypeName == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Nama Partner Type wajib diisi"})
		return
	}

	var count int64
	db.Model(&sellingmodel.SalesPartnerType{}).Where("tenant_id = ? AND partner_type_name = ?", tenant, input.PartnerTypeName).Count(&count)
	if count > 0 {
		ctx.JSON(http.StatusConflict, gin.H{"error": fmt.Sprintf("Partner Type '%s' sudah ada", input.PartnerTypeName)})
		return
	}

	now := time.Now()
	input.ID = uuid.NewString()
	input.TenantID = tenant
	input.CreatedAt = now
	input.UpdatedAt = now

	if err := db.Create(&input).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan Partner Type: " + err.Error()})
		return
	}
	ctx.JSON(http.StatusCreated, input)
}

/* =========================================================================
   ITEM GROUPS API
   ========================================================================= */
func (c *SalesPartnerController) ListItemGroups(ctx *gin.Context) {
	tenant := sellingTenant(ctx)
	db := model.GetDB(ctx).WithContext(ctx.Request.Context())
	c.seedDefaultMasterData(ctx, db, tenant)

	var rows []sellingmodel.ItemGroup
	if err := db.Where("tenant_id = ?", tenant).Order("parent_item_group asc, item_group_name asc").Find(&rows).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil Item Groups: " + err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": rows})
}

func (c *SalesPartnerController) CreateItemGroup(ctx *gin.Context) {
	tenant := sellingTenant(ctx)
	db := model.GetDB(ctx).WithContext(ctx.Request.Context())

	var input sellingmodel.ItemGroup
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Payload tidak valid: " + err.Error()})
		return
	}
	input.ItemGroupName = strings.TrimSpace(input.ItemGroupName)
	if input.ItemGroupName == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Nama Item Group wajib diisi"})
		return
	}

	var count int64
	db.Model(&sellingmodel.ItemGroup{}).Where("tenant_id = ? AND item_group_name = ?", tenant, input.ItemGroupName).Count(&count)
	if count > 0 {
		ctx.JSON(http.StatusConflict, gin.H{"error": fmt.Sprintf("Item Group '%s' sudah ada", input.ItemGroupName)})
		return
	}

	now := time.Now()
	input.ID = uuid.NewString()
	input.TenantID = tenant
	input.CreatedAt = now
	input.UpdatedAt = now

	if err := db.Create(&input).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan Item Group: " + err.Error()})
		return
	}
	ctx.JSON(http.StatusCreated, input)
}

/* =========================================================================
   FISCAL YEARS API
   ========================================================================= */
func (c *SalesPartnerController) ListFiscalYears(ctx *gin.Context) {
	tenant := sellingTenant(ctx)
	db := model.GetDB(ctx).WithContext(ctx.Request.Context())
	c.seedDefaultMasterData(ctx, db, tenant)

	var rows []sellingmodel.FiscalYear
	if err := db.Where("tenant_id = ?", tenant).Order("year_name desc").Find(&rows).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil Fiscal Years: " + err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": rows})
}

func (c *SalesPartnerController) CreateFiscalYear(ctx *gin.Context) {
	tenant := sellingTenant(ctx)
	db := model.GetDB(ctx).WithContext(ctx.Request.Context())

	var input sellingmodel.FiscalYear
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Payload tidak valid: " + err.Error()})
		return
	}
	input.YearName = strings.TrimSpace(input.YearName)
	if input.YearName == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Nama Fiscal Year wajib diisi"})
		return
	}

	var count int64
	db.Model(&sellingmodel.FiscalYear{}).Where("tenant_id = ? AND year_name = ?", tenant, input.YearName).Count(&count)
	if count > 0 {
		ctx.JSON(http.StatusConflict, gin.H{"error": fmt.Sprintf("Fiscal Year '%s' sudah ada", input.YearName)})
		return
	}

	now := time.Now()
	input.ID = uuid.NewString()
	input.TenantID = tenant
	input.CreatedAt = now
	input.UpdatedAt = now

	if err := db.Create(&input).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan Fiscal Year: " + err.Error()})
		return
	}
	ctx.JSON(http.StatusCreated, input)
}

/* =========================================================================
   SALES PARTNERS CRUD API
   ========================================================================= */
func (c *SalesPartnerController) List(ctx *gin.Context) {
	tenant := sellingTenant(ctx)
	db := model.GetDB(ctx).WithContext(ctx.Request.Context())
	c.seedDefaultMasterData(ctx, db, tenant)

	query := db.Model(&sellingmodel.SalesPartner{}).Where("tenant_id = ?", tenant)

	if term := strings.TrimSpace(ctx.Query("q")); term != "" {
		like := "%" + term + "%"
		query = query.Where("partner_name LIKE ? OR partner_type LIKE ? OR territory LIKE ? OR referral_code LIKE ?", like, like, like, like)
	}

	if pType := strings.TrimSpace(ctx.Query("partner_type")); pType != "" {
		query = query.Where("partner_type = ?", pType)
	}

	if territory := strings.TrimSpace(ctx.Query("territory")); territory != "" {
		query = query.Where("territory = ?", territory)
	}

	var rows []sellingmodel.SalesPartner
	if err := query.Preload("Targets").Order("partner_name asc").Find(&rows).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data Sales Partner: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": rows})
}

func (c *SalesPartnerController) Get(ctx *gin.Context) {
	tenant := sellingTenant(ctx)
	id := strings.TrimSpace(ctx.Param("id"))
	db := model.GetDB(ctx).WithContext(ctx.Request.Context())

	var row sellingmodel.SalesPartner
	err := db.Where("tenant_id = ? AND (id = ? OR partner_name = ?)", tenant, id, id).
		Preload("Targets").
		First(&row).Error

	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Sales Partner tidak ditemukan"})
		return
	}

	ctx.JSON(http.StatusOK, row)
}

func (c *SalesPartnerController) Create(ctx *gin.Context) {
	tenant := sellingTenant(ctx)
	db := model.GetDB(ctx).WithContext(ctx.Request.Context())

	var input sellingmodel.SalesPartner
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Payload tidak valid: " + err.Error()})
		return
	}

	input.PartnerName = strings.TrimSpace(input.PartnerName)
	input.PartnerType = strings.TrimSpace(input.PartnerType)
	input.Territory = strings.TrimSpace(input.Territory)
	input.ReferralCode = strings.TrimSpace(input.ReferralCode)

	if input.PartnerName == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Sales Partner Name wajib diisi"})
		return
	}
	if input.PartnerType == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Partner Type wajib diisi"})
		return
	}

	var count int64
	db.Model(&sellingmodel.SalesPartner{}).Where("tenant_id = ? AND partner_name = ?", tenant, input.PartnerName).Count(&count)
	if count > 0 {
		ctx.JSON(http.StatusConflict, gin.H{"error": fmt.Sprintf("Sales Partner '%s' sudah terdaftar", input.PartnerName)})
		return
	}

	now := time.Now()
	input.ID = uuid.NewString()
	input.TenantID = tenant
	input.CreatedAt = now
	input.UpdatedAt = now

	for i := range input.Targets {
		input.Targets[i].ID = uuid.NewString()
		input.Targets[i].SalesPartnerID = input.ID
		input.Targets[i].TenantID = tenant
		input.Targets[i].CreatedAt = now
		input.Targets[i].UpdatedAt = now
	}

	if err := db.Create(&input).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan Sales Partner: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, input)
}

func (c *SalesPartnerController) Update(ctx *gin.Context) {
	tenant := sellingTenant(ctx)
	id := strings.TrimSpace(ctx.Param("id"))
	db := model.GetDB(ctx).WithContext(ctx.Request.Context())

	var existing sellingmodel.SalesPartner
	if err := db.Where("tenant_id = ? AND id = ?", tenant, id).First(&existing).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Sales Partner tidak ditemukan"})
		return
	}

	var input sellingmodel.SalesPartner
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Payload tidak valid: " + err.Error()})
		return
	}

	input.PartnerName = strings.TrimSpace(input.PartnerName)
	input.PartnerType = strings.TrimSpace(input.PartnerType)
	input.Territory = strings.TrimSpace(input.Territory)
	input.ReferralCode = strings.TrimSpace(input.ReferralCode)

	if input.PartnerName == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Sales Partner Name wajib diisi"})
		return
	}
	if input.PartnerType == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Partner Type wajib diisi"})
		return
	}

	var count int64
	db.Model(&sellingmodel.SalesPartner{}).
		Where("tenant_id = ? AND partner_name = ? AND id <> ?", tenant, input.PartnerName, id).
		Count(&count)
	if count > 0 {
		ctx.JSON(http.StatusConflict, gin.H{"error": fmt.Sprintf("Nama Sales Partner '%s' sudah digunakan", input.PartnerName)})
		return
	}

	now := time.Now()
	err := db.Transaction(func(tx *gorm.DB) error {
		// Delete old targets
		if err := tx.Where("sales_partner_id = ?", id).Delete(&sellingmodel.SalesPartnerTarget{}).Error; err != nil {
			return err
		}

		existing.PartnerName = input.PartnerName
		existing.PartnerType = input.PartnerType
		existing.Territory = input.Territory
		existing.CommissionRate = input.CommissionRate
		existing.ShowInWebsite = input.ShowInWebsite
		existing.ReferralCode = input.ReferralCode
		existing.Disabled = input.Disabled
		existing.UpdatedAt = now

		if err := tx.Save(&existing).Error; err != nil {
			return err
		}

		for i := range input.Targets {
			t := input.Targets[i]
			t.ID = uuid.NewString()
			t.SalesPartnerID = id
			t.TenantID = tenant
			t.CreatedAt = now
			t.UpdatedAt = now
			if err := tx.Create(&t).Error; err != nil {
				return err
			}
		}

		return nil
	})

	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui Sales Partner: " + err.Error()})
		return
	}

	_ = db.Where("tenant_id = ? AND id = ?", tenant, id).Preload("Targets").First(&existing)
	ctx.JSON(http.StatusOK, existing)
}

func (c *SalesPartnerController) Delete(ctx *gin.Context) {
	tenant := sellingTenant(ctx)
	id := strings.TrimSpace(ctx.Param("id"))
	db := model.GetDB(ctx).WithContext(ctx.Request.Context())

	var existing sellingmodel.SalesPartner
	if err := db.Where("tenant_id = ? AND id = ?", tenant, id).First(&existing).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Sales Partner tidak ditemukan"})
		return
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("sales_partner_id = ?", id).Delete(&sellingmodel.SalesPartnerTarget{}).Error; err != nil {
			return err
		}
		return tx.Delete(&existing).Error
	})

	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus Sales Partner: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Sales Partner '%s' berhasil dihapus", existing.PartnerName),
		"id":      id,
	})
}

func (c *SalesPartnerController) Options(ctx *gin.Context) {
	tenant := sellingTenant(ctx)
	db := model.GetDB(ctx).WithContext(ctx.Request.Context())
	c.seedDefaultMasterData(ctx, db, tenant)

	var partnerTypes []sellingmodel.SalesPartnerType
	_ = db.Where("tenant_id = ?", tenant).Order("partner_type_name asc").Find(&partnerTypes).Error

	var itemGroups []sellingmodel.ItemGroup
	_ = db.Where("tenant_id = ?", tenant).Order("item_group_name asc").Find(&itemGroups).Error

	var fiscalYears []sellingmodel.FiscalYear
	_ = db.Where("tenant_id = ?", tenant).Order("year_name desc").Find(&fiscalYears).Error

	var territories []string
	_ = db.Model(&sellingmodel.Territory{}).
		Where("tenant_id = ?", tenant).
		Order("territory_name asc").
		Pluck("territory_name", &territories).Error

	if len(territories) == 0 {
		territories = []string{"All Territories", "Indonesia"}
	}

	ctx.JSON(http.StatusOK, gin.H{
		"partner_types": partnerTypes,
		"item_groups":   itemGroups,
		"fiscal_years":  fiscalYears,
		"territories":   territories,
		"distributions": []string{"Even", "Quarterly", "Seasonality", "H1 Heavy", "H2 Heavy"},
	})
}
