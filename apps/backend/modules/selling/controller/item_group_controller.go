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

type ItemGroupController struct{}

func NewItemGroupController() *ItemGroupController {
	return &ItemGroupController{}
}

func (c *ItemGroupController) seedDefaultTree(ctx *gin.Context, db *gorm.DB, tenantID string) {
	if tenantID == "" {
		return
	}
	var count int64
	db.Model(&sellingmodel.ItemGroup{}).Where("tenant_id = ?", tenantID).Count(&count)
	if count == 0 {
		now := time.Now()
		// 1. Root group: All Item Groups
		root := sellingmodel.ItemGroup{
			ID:              uuid.NewString(),
			TenantID:        tenantID,
			ItemGroupName:   "All Item Groups",
			ParentItemGroup: "",
			IsGroup:         true,
			CreatedAt:       now,
			UpdatedAt:       now,
		}
		_ = db.Create(&root).Error

		// 2. Default standard groups under All Item Groups
		defaults := []string{
			"Consumable",
			"Products",
			"Raw Material",
			"Services",
			"Sub Assemblies",
		}
		for _, name := range defaults {
			_ = db.Create(&sellingmodel.ItemGroup{
				ID:              uuid.NewString(),
				TenantID:        tenantID,
				ItemGroupName:   name,
				ParentItemGroup: "All Item Groups",
				IsGroup:         false,
				CreatedAt:       now,
				UpdatedAt:       now,
			}).Error
		}
	}
}

type ItemGroupTreeNode struct {
	ID              string              `json:"id"`
	ItemGroupName   string              `json:"item_group_name"`
	ParentItemGroup string              `json:"parent_item_group"`
	IsGroup         bool                `json:"is_group"`
	Children        []ItemGroupTreeNode `json:"children"`
}

func (c *ItemGroupController) Tree(ctx *gin.Context) {
	tenant := sellingTenant(ctx)
	db := model.GetDB(ctx).WithContext(ctx.Request.Context())
	c.seedDefaultTree(ctx, db, tenant)

	var rows []sellingmodel.ItemGroup
	if err := db.Where("tenant_id = ?", tenant).Order("item_group_name asc").Find(&rows).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data tree: " + err.Error()})
		return
	}

	childrenMap := make(map[string][]sellingmodel.ItemGroup)
	for _, r := range rows {
		childrenMap[r.ParentItemGroup] = append(childrenMap[r.ParentItemGroup], r)
	}

	var buildTree func(parentName string) []ItemGroupTreeNode
	buildTree = func(parentName string) []ItemGroupTreeNode {
		children := childrenMap[parentName]
		var nodes []ItemGroupTreeNode
		for _, child := range children {
			node := ItemGroupTreeNode{
				ID:              child.ID,
				ItemGroupName:   child.ItemGroupName,
				ParentItemGroup: child.ParentItemGroup,
				IsGroup:         child.IsGroup,
				Children:        buildTree(child.ItemGroupName),
			}
			nodes = append(nodes, node)
		}
		return nodes
	}

	tree := buildTree("")
	if len(tree) == 0 {
		tree = buildTree("All Item Groups")
	}

	ctx.JSON(http.StatusOK, gin.H{"data": tree})
}

func (c *ItemGroupController) List(ctx *gin.Context) {
	tenant := sellingTenant(ctx)
	db := model.GetDB(ctx).WithContext(ctx.Request.Context())
	c.seedDefaultTree(ctx, db, tenant)

	query := db.Model(&sellingmodel.ItemGroup{}).Where("tenant_id = ?", tenant)

	if term := strings.TrimSpace(ctx.Query("q")); term != "" {
		like := "%" + term + "%"
		query = query.Where("item_group_name LIKE ? OR parent_item_group LIKE ?", like, like)
	}

	if parent := strings.TrimSpace(ctx.Query("parent_item_group")); parent != "" {
		query = query.Where("parent_item_group = ?", parent)
	}

	if isGroup := strings.TrimSpace(ctx.Query("is_group")); isGroup != "" {
		if isGroup == "true" || isGroup == "1" {
			query = query.Where("is_group = ?", true)
		} else if isGroup == "false" || isGroup == "0" {
			query = query.Where("is_group = ?", false)
		}
	}

	var rows []sellingmodel.ItemGroup
	if err := query.Order("parent_item_group asc, item_group_name asc").Find(&rows).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data Item Group: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": rows})
}

func (c *ItemGroupController) Get(ctx *gin.Context) {
	tenant := sellingTenant(ctx)
	id := strings.TrimSpace(ctx.Param("id"))
	db := model.GetDB(ctx).WithContext(ctx.Request.Context())

	var row sellingmodel.ItemGroup
	err := db.Where("tenant_id = ? AND (id = ? OR item_group_name = ?)", tenant, id, id).First(&row).Error
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Item Group tidak ditemukan"})
		return
	}

	ctx.JSON(http.StatusOK, row)
}

func (c *ItemGroupController) Create(ctx *gin.Context) {
	tenant := sellingTenant(ctx)
	db := model.GetDB(ctx).WithContext(ctx.Request.Context())

	var input sellingmodel.ItemGroup
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Payload tidak valid: " + err.Error()})
		return
	}

	input.ItemGroupName = strings.TrimSpace(input.ItemGroupName)
	input.ParentItemGroup = strings.TrimSpace(input.ParentItemGroup)

	if input.ItemGroupName == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Item Group Name wajib diisi"})
		return
	}

	if input.ParentItemGroup != "" {
		if input.ItemGroupName == input.ParentItemGroup {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "Parent Item Group tidak boleh sama dengan Item Group Name"})
			return
		}

		// Validate parent must be is_group = true
		var parent sellingmodel.ItemGroup
		if err := db.Where("tenant_id = ? AND item_group_name = ?", tenant, input.ParentItemGroup).First(&parent).Error; err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Parent Item Group '%s' tidak ditemukan", input.ParentItemGroup)})
			return
		}
		if !parent.IsGroup {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Parent '%s' bukan bertipe Group. Further sub-groups can only be created under records marked as 'Group'", input.ParentItemGroup)})
			return
		}
	}

	var count int64
	db.Model(&sellingmodel.ItemGroup{}).Where("tenant_id = ? AND item_group_name = ?", tenant, input.ItemGroupName).Count(&count)
	if count > 0 {
		ctx.JSON(http.StatusConflict, gin.H{"error": fmt.Sprintf("Item Group '%s' sudah terdaftar", input.ItemGroupName)})
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

func (c *ItemGroupController) Update(ctx *gin.Context) {
	tenant := sellingTenant(ctx)
	id := strings.TrimSpace(ctx.Param("id"))
	db := model.GetDB(ctx).WithContext(ctx.Request.Context())

	var existing sellingmodel.ItemGroup
	if err := db.Where("tenant_id = ? AND id = ?", tenant, id).First(&existing).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Item Group tidak ditemukan"})
		return
	}

	var input sellingmodel.ItemGroup
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Payload tidak valid: " + err.Error()})
		return
	}

	input.ItemGroupName = strings.TrimSpace(input.ItemGroupName)
	input.ParentItemGroup = strings.TrimSpace(input.ParentItemGroup)

	if input.ItemGroupName == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Item Group Name wajib diisi"})
		return
	}

	if input.ParentItemGroup != "" {
		if input.ItemGroupName == input.ParentItemGroup {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "Parent Item Group tidak boleh sama dengan Item Group Name"})
			return
		}

		var parent sellingmodel.ItemGroup
		if err := db.Where("tenant_id = ? AND item_group_name = ?", tenant, input.ParentItemGroup).First(&parent).Error; err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Parent Item Group '%s' tidak ditemukan", input.ParentItemGroup)})
			return
		}
		if !parent.IsGroup {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Parent '%s' bukan bertipe Group. Further sub-groups can only be created under records marked as 'Group'", input.ParentItemGroup)})
			return
		}
	}

	// Check if name taken by another record
	var conflictCount int64
	db.Model(&sellingmodel.ItemGroup{}).
		Where("tenant_id = ? AND item_group_name = ? AND id <> ?", tenant, input.ItemGroupName, id).
		Count(&conflictCount)
	if conflictCount > 0 {
		ctx.JSON(http.StatusConflict, gin.H{"error": fmt.Sprintf("Nama Item Group '%s' sudah digunakan", input.ItemGroupName)})
		return
	}

	now := time.Now()
	err := db.Transaction(func(tx *gorm.DB) error {
		// If name changed, update children pointing to the old name
		if existing.ItemGroupName != input.ItemGroupName {
			if err := tx.Model(&sellingmodel.ItemGroup{}).
				Where("tenant_id = ? AND parent_item_group = ?", tenant, existing.ItemGroupName).
				Update("parent_item_group", input.ItemGroupName).Error; err != nil {
				return err
			}
		}

		existing.ItemGroupName = input.ItemGroupName
		existing.ParentItemGroup = input.ParentItemGroup
		existing.IsGroup = input.IsGroup
		existing.UpdatedAt = now

		return tx.Save(&existing).Error
	})

	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui Item Group: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, existing)
}

func (c *ItemGroupController) Delete(ctx *gin.Context) {
	tenant := sellingTenant(ctx)
	id := strings.TrimSpace(ctx.Param("id"))
	db := model.GetDB(ctx).WithContext(ctx.Request.Context())

	var existing sellingmodel.ItemGroup
	if err := db.Where("tenant_id = ? AND id = ?", tenant, id).First(&existing).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Item Group tidak ditemukan"})
		return
	}

	// Check if has children
	var childCount int64
	db.Model(&sellingmodel.ItemGroup{}).
		Where("tenant_id = ? AND parent_item_group = ?", tenant, existing.ItemGroupName).
		Count(&childCount)
	if childCount > 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Tidak dapat menghapus Item Group '%s' karena masih memiliki %d sub-group (child)", existing.ItemGroupName, childCount)})
		return
	}

	if err := db.Delete(&existing).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus Item Group: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Item Group '%s' berhasil dihapus", existing.ItemGroupName),
		"id":      id,
	})
}
