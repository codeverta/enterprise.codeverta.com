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

type TerritoryController struct{}

func NewTerritoryController() *TerritoryController {
	return &TerritoryController{}
}

func (c *TerritoryController) seedDefaultRoot(ctx *gin.Context, db *gorm.DB, tenantID string) {
	if tenantID == "" {
		return
	}
	var count int64
	db.Model(&sellingmodel.Territory{}).Where("tenant_id = ?", tenantID).Count(&count)
	if count == 0 {
		now := time.Now()
		root := sellingmodel.Territory{
			ID:               uuid.NewString(),
			TenantID:         tenantID,
			TerritoryName:    "All Territories",
			ParentTerritory:  "",
			IsGroup:          true,
			TerritoryManager: "",
			Disabled:         false,
			CreatedAt:        now,
			UpdatedAt:        now,
		}
		_ = db.Create(&root).Error

		// Seed sample child territories
		indo := sellingmodel.Territory{
			ID:               uuid.NewString(),
			TenantID:         tenantID,
			TerritoryName:    "Indonesia",
			ParentTerritory:  "All Territories",
			IsGroup:          false,
			TerritoryManager: "",
			Disabled:         false,
			CreatedAt:        now,
			UpdatedAt:        now,
		}
		_ = db.Create(&indo).Error
	}
}

func (c *TerritoryController) List(ctx *gin.Context) {
	tenant := sellingTenant(ctx)
	db := model.GetDB(ctx).WithContext(ctx.Request.Context())
	c.seedDefaultRoot(ctx, db, tenant)

	query := db.Model(&sellingmodel.Territory{}).Where("tenant_id = ?", tenant)

	if term := strings.TrimSpace(ctx.Query("q")); term != "" {
		like := "%" + term + "%"
		query = query.Where("territory_name LIKE ? OR parent_territory LIKE ? OR territory_manager LIKE ?", like, like, like)
	}

	if parent := strings.TrimSpace(ctx.Query("parent_territory")); parent != "" {
		query = query.Where("parent_territory = ?", parent)
	}

	if isGroup := strings.TrimSpace(ctx.Query("is_group")); isGroup != "" {
		if isGroup == "true" || isGroup == "1" {
			query = query.Where("is_group = ?", true)
		} else if isGroup == "false" || isGroup == "0" {
			query = query.Where("is_group = ?", false)
		}
	}

	var rows []sellingmodel.Territory
	if err := query.Preload("Targets").Order("parent_territory asc, territory_name asc").Find(&rows).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data territory: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": rows})
}

func (c *TerritoryController) Get(ctx *gin.Context) {
	tenant := sellingTenant(ctx)
	id := strings.TrimSpace(ctx.Param("id"))
	db := model.GetDB(ctx).WithContext(ctx.Request.Context())

	var row sellingmodel.Territory
	err := db.Where("tenant_id = ? AND (id = ? OR territory_name = ?)", tenant, id, id).
		Preload("Targets").
		First(&row).Error

	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Territory tidak ditemukan"})
		return
	}

	ctx.JSON(http.StatusOK, row)
}

func (c *TerritoryController) Options(ctx *gin.Context) {
	tenant := sellingTenant(ctx)
	db := model.GetDB(ctx).WithContext(ctx.Request.Context())
	c.seedDefaultRoot(ctx, db, tenant)

	var territories []sellingmodel.Territory
	_ = db.Where("tenant_id = ?", tenant).
		Order("parent_territory asc, territory_name asc").
		Find(&territories).Error

	var parentOptions []string
	for _, t := range territories {
		parentOptions = append(parentOptions, t.TerritoryName)
	}

	// Fetch distinct item groups from buying_items
	var dbItemGroups []string
	_ = db.Table("buying_items").
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND item_group != ''", tenant).
		Distinct("item_group").
		Pluck("item_group", &dbItemGroups).Error

	defaultGroups := []string{"All Item Groups", "Products", "Raw Material", "Services", "Consumable", "Sub Assemblies"}
	itemGroupMap := make(map[string]bool)
	for _, dg := range defaultGroups {
		itemGroupMap[dg] = true
	}
	for _, g := range dbItemGroups {
		if strings.TrimSpace(g) != "" {
			itemGroupMap[strings.TrimSpace(g)] = true
		}
	}
	var finalItemGroups []string
	for _, dg := range defaultGroups {
		if itemGroupMap[dg] {
			finalItemGroups = append(finalItemGroups, dg)
			delete(itemGroupMap, dg)
		}
	}
	for g := range itemGroupMap {
		finalItemGroups = append(finalItemGroups, g)
	}

	// Fetch managers/users
	var managers []string
	_ = db.Table("users").
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL)", tenant).
		Pluck("username", &managers).Error

	var distinctManagers []string
	_ = db.Model(&sellingmodel.Territory{}).
		Where("tenant_id = ? AND territory_manager != ''", tenant).
		Distinct("territory_manager").
		Pluck("territory_manager", &distinctManagers).Error

	mMap := make(map[string]bool)
	for _, m := range managers {
		if strings.TrimSpace(m) != "" {
			mMap[strings.TrimSpace(m)] = true
		}
	}
	for _, m := range distinctManagers {
		if strings.TrimSpace(m) != "" {
			mMap[strings.TrimSpace(m)] = true
		}
	}
	var finalManagers []string
	for m := range mMap {
		finalManagers = append(finalManagers, m)
	}

	ctx.JSON(http.StatusOK, gin.H{
		"parent_territories": parentOptions,
		"territories":        territories,
		"item_groups":        finalItemGroups,
		"fiscal_years":       []string{"2024", "2025", "2026", "2027", "2028"},
		"distributions":      []string{"Even", "Quarterly", "Seasonality", "H1 Heavy", "H2 Heavy"},
		"managers":           finalManagers,
	})
}

type TerritoryTreeNode struct {
	ID               string              `json:"id"`
	TerritoryName    string              `json:"territory_name"`
	ParentTerritory  string              `json:"parent_territory"`
	IsGroup          bool                `json:"is_group"`
	TerritoryManager string              `json:"territory_manager"`
	Disabled         bool                `json:"disabled"`
	TargetCount      int                 `json:"target_count"`
	Children         []TerritoryTreeNode `json:"children"`
}

func (c *TerritoryController) Tree(ctx *gin.Context) {
	tenant := sellingTenant(ctx)
	db := model.GetDB(ctx).WithContext(ctx.Request.Context())
	c.seedDefaultRoot(ctx, db, tenant)

	var rows []sellingmodel.Territory
	if err := db.Where("tenant_id = ?", tenant).Preload("Targets").Order("territory_name asc").Find(&rows).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data tree: " + err.Error()})
		return
	}

	// Build parent to children map
	childrenMap := make(map[string][]sellingmodel.Territory)
	for _, r := range rows {
		childrenMap[r.ParentTerritory] = append(childrenMap[r.ParentTerritory], r)
	}

	var buildTree func(parentName string) []TerritoryTreeNode
	buildTree = func(parentName string) []TerritoryTreeNode {
		children := childrenMap[parentName]
		var nodes []TerritoryTreeNode
		for _, child := range children {
			node := TerritoryTreeNode{
				ID:               child.ID,
				TerritoryName:    child.TerritoryName,
				ParentTerritory:  child.ParentTerritory,
				IsGroup:          child.IsGroup,
				TerritoryManager: child.TerritoryManager,
				Disabled:         child.Disabled,
				TargetCount:      len(child.Targets),
				Children:         buildTree(child.TerritoryName),
			}
			nodes = append(nodes, node)
		}
		return nodes
	}

	// Root nodes have empty parent or "All Territories" if All Territories has no parent
	tree := buildTree("")
	if len(tree) == 0 {
		// Fallback if All Territories is stored with itself or not empty
		tree = buildTree("All Territories")
	}

	ctx.JSON(http.StatusOK, gin.H{"data": tree})
}

func (c *TerritoryController) Create(ctx *gin.Context) {
	tenant := sellingTenant(ctx)
	db := model.GetDB(ctx).WithContext(ctx.Request.Context())

	var input sellingmodel.Territory
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Payload tidak valid: " + err.Error()})
		return
	}

	input.TerritoryName = strings.TrimSpace(input.TerritoryName)
	input.ParentTerritory = strings.TrimSpace(input.ParentTerritory)
	input.TerritoryManager = strings.TrimSpace(input.TerritoryManager)

	if input.TerritoryName == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Territory Name wajib diisi"})
		return
	}

	if input.TerritoryName == input.ParentTerritory {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Parent Territory tidak boleh sama dengan Territory Name"})
		return
	}

	var existingCount int64
	db.Model(&sellingmodel.Territory{}).Where("tenant_id = ? AND territory_name = ?", tenant, input.TerritoryName).Count(&existingCount)
	if existingCount > 0 {
		ctx.JSON(http.StatusConflict, gin.H{"error": fmt.Sprintf("Territory '%s' sudah terdaftar", input.TerritoryName)})
		return
	}

	now := time.Now()
	input.ID = uuid.NewString()
	input.TenantID = tenant
	input.CreatedAt = now
	input.UpdatedAt = now

	for i := range input.Targets {
		input.Targets[i].ID = uuid.NewString()
		input.Targets[i].TerritoryID = input.ID
		input.Targets[i].TenantID = tenant
		input.Targets[i].CreatedAt = now
		input.Targets[i].UpdatedAt = now
	}

	if err := db.Create(&input).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan Territory: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, input)
}

func (c *TerritoryController) Update(ctx *gin.Context) {
	tenant := sellingTenant(ctx)
	id := strings.TrimSpace(ctx.Param("id"))
	db := model.GetDB(ctx).WithContext(ctx.Request.Context())

	var existing sellingmodel.Territory
	if err := db.Where("tenant_id = ? AND id = ?", tenant, id).First(&existing).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Territory tidak ditemukan"})
		return
	}

	var input sellingmodel.Territory
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Payload tidak valid: " + err.Error()})
		return
	}

	input.TerritoryName = strings.TrimSpace(input.TerritoryName)
	input.ParentTerritory = strings.TrimSpace(input.ParentTerritory)
	input.TerritoryManager = strings.TrimSpace(input.TerritoryManager)

	if input.TerritoryName == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Territory Name wajib diisi"})
		return
	}

	if input.TerritoryName == input.ParentTerritory {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Parent Territory tidak boleh sama dengan Territory Name"})
		return
	}

	// Check if name is taken by another record
	var conflictCount int64
	db.Model(&sellingmodel.Territory{}).
		Where("tenant_id = ? AND territory_name = ? AND id <> ?", tenant, input.TerritoryName, id).
		Count(&conflictCount)
	if conflictCount > 0 {
		ctx.JSON(http.StatusConflict, gin.H{"error": fmt.Sprintf("Territory '%s' sudah digunakan oleh record lain", input.TerritoryName)})
		return
	}

	now := time.Now()
	err := db.Transaction(func(tx *gorm.DB) error {
		// If territory name changed, update any child territories referencing the old name
		if existing.TerritoryName != input.TerritoryName {
			if err := tx.Model(&sellingmodel.Territory{}).
				Where("tenant_id = ? AND parent_territory = ?", tenant, existing.TerritoryName).
				Update("parent_territory", input.TerritoryName).Error; err != nil {
				return err
			}
		}

		// Delete old targets
		if err := tx.Where("territory_id = ?", id).Delete(&sellingmodel.TerritoryTarget{}).Error; err != nil {
			return err
		}

		// Save updated territory fields
		existing.TerritoryName = input.TerritoryName
		existing.ParentTerritory = input.ParentTerritory
		existing.IsGroup = input.IsGroup
		existing.TerritoryManager = input.TerritoryManager
		existing.Disabled = input.Disabled
		existing.UpdatedAt = now

		if err := tx.Save(&existing).Error; err != nil {
			return err
		}

		// Insert new targets
		for i := range input.Targets {
			t := input.Targets[i]
			t.ID = uuid.NewString()
			t.TerritoryID = id
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
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui Territory: " + err.Error()})
		return
	}

	// Reload updated row
	_ = db.Where("tenant_id = ? AND id = ?", tenant, id).Preload("Targets").First(&existing)
	ctx.JSON(http.StatusOK, existing)
}

func (c *TerritoryController) Delete(ctx *gin.Context) {
	tenant := sellingTenant(ctx)
	id := strings.TrimSpace(ctx.Param("id"))
	db := model.GetDB(ctx).WithContext(ctx.Request.Context())

	var existing sellingmodel.Territory
	if err := db.Where("tenant_id = ? AND id = ?", tenant, id).First(&existing).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Territory tidak ditemukan"})
		return
	}

	// Check if this territory has children
	var childCount int64
	db.Model(&sellingmodel.Territory{}).
		Where("tenant_id = ? AND parent_territory = ?", tenant, existing.TerritoryName).
		Count(&childCount)
	if childCount > 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Tidak dapat menghapus territory '%s' karena masih memiliki %d sub-territory (child)", existing.TerritoryName, childCount)})
		return
	}

	// Delete targets and territory
	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("territory_id = ?", id).Delete(&sellingmodel.TerritoryTarget{}).Error; err != nil {
			return err
		}
		return tx.Delete(&existing).Error
	})

	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus Territory: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Territory '%s' berhasil dihapus", existing.TerritoryName),
		"id":      id,
	})
}
