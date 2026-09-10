package controller

import (
	"errors"
	"net/http"
	"strings"

	stockmodel "gin-template/modules/stock/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type WarehouseController struct{}

func NewWarehouseController() *WarehouseController {
	return &WarehouseController{}
}

func (ctrl *WarehouseController) List(ctx *gin.Context) {
	db, tenant := stockDB(ctx), stockTenant(ctx)

	// Auto-seed if 0 warehouses exist
	var count int64
	db.Model(&stockmodel.Warehouse{}).Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant).Count(&count)
	if count == 0 {
		_ = stockmodel.SeedWarehouses(db, tenant)
	}

	var warehouses []stockmodel.Warehouse
	query := db.Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant)

	if company := strings.TrimSpace(ctx.Query("company")); company != "" && company != "ALL" {
		query = query.Where("LOWER(company) = LOWER(?)", company)
	}

	if search := strings.TrimSpace(ctx.Query("q")); search != "" {
		like := "%" + search + "%"
		query = query.Where("warehouse_name LIKE ? OR city LIKE ? OR warehouse_type LIKE ?", like, like, like)
	}

	if isGroupStr := strings.TrimSpace(ctx.Query("is_group")); isGroupStr != "" {
		if isGroupStr == "true" || isGroupStr == "1" {
			query = query.Where("is_group = ?", true)
		} else if isGroupStr == "false" || isGroupStr == "0" {
			query = query.Where("is_group = ?", false)
		}
	}

	if err := query.Order("is_group desc, warehouse_name asc").Find(&warehouses).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil daftar gudang"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": warehouses})
}

type WarehouseTreeNode struct {
	stockmodel.Warehouse
	Children []WarehouseTreeNode `json:"children"`
}

func (ctrl *WarehouseController) Tree(ctx *gin.Context) {
	db, tenant := stockDB(ctx), stockTenant(ctx)

	var count int64
	db.Model(&stockmodel.Warehouse{}).Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant).Count(&count)
	if count == 0 {
		_ = stockmodel.SeedWarehouses(db, tenant)
	}

	var warehouses []stockmodel.Warehouse
	query := db.Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant)

	if company := strings.TrimSpace(ctx.Query("company")); company != "" && company != "ALL" {
		query = query.Where("LOWER(company) = LOWER(?)", company)
	}

	if err := query.Order("warehouse_name asc").Find(&warehouses).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data struktur gudang"})
		return
	}

	// Build map of parent -> children
	childrenMap := make(map[string][]stockmodel.Warehouse)
	var roots []stockmodel.Warehouse

	for _, wh := range warehouses {
		parent := strings.TrimSpace(wh.ParentWarehouse)
		if parent == "" {
			roots = append(roots, wh)
		} else {
			childrenMap[parent] = append(childrenMap[parent], wh)
		}
	}

	// If a warehouse has a parent that is not in the list (orphan), treat as root
	knownNames := make(map[string]bool)
	for _, wh := range warehouses {
		knownNames[wh.WarehouseName] = true
	}
	for parent, chList := range childrenMap {
		if !knownNames[parent] {
			roots = append(roots, chList...)
			delete(childrenMap, parent)
		}
	}

	var buildTree func(wh stockmodel.Warehouse) WarehouseTreeNode
	buildTree = func(wh stockmodel.Warehouse) WarehouseTreeNode {
		node := WarehouseTreeNode{
			Warehouse: wh,
			Children:  []WarehouseTreeNode{},
		}
		for _, child := range childrenMap[wh.WarehouseName] {
			node.Children = append(node.Children, buildTree(child))
		}
		return node
	}

	tree := make([]WarehouseTreeNode, 0, len(roots))
	for _, r := range roots {
		tree = append(tree, buildTree(r))
	}

	ctx.JSON(http.StatusOK, gin.H{"data": tree})
}

func (ctrl *WarehouseController) Get(ctx *gin.Context) {
	db, tenant, id := stockDB(ctx), stockTenant(ctx), ctx.Param("id")
	var wh stockmodel.Warehouse
	if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).First(&wh).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "Gudang tidak ditemukan"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data gudang"})
		return
	}
	ctx.JSON(http.StatusOK, wh)
}

func (ctrl *WarehouseController) Create(ctx *gin.Context) {
	var input stockmodel.Warehouse
	if err := ctx.ShouldBindJSON(&input); err != nil || strings.TrimSpace(input.WarehouseName) == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Nama Gudang wajib diisi"})
		return
	}

	db, tenant := stockDB(ctx), stockTenant(ctx)
	input.WarehouseName = strings.TrimSpace(input.WarehouseName)
	input.ParentWarehouse = strings.TrimSpace(input.ParentWarehouse)
	input.Company = strings.TrimSpace(input.Company)
	if input.Company == "" {
		input.Company = "PT ZENIT TECHNOLOGY SOLUTION"
	}

	// Check duplicate warehouse name in same tenant & company
	var existing stockmodel.Warehouse
	if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND LOWER(warehouse_name) = LOWER(?) AND LOWER(company) = LOWER(?)", tenant, input.WarehouseName, input.Company).First(&existing).Error; err == nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Nama gudang sudah digunakan pada perusahaan ini"})
		return
	}

	// Validate parent warehouse if specified
	if input.ParentWarehouse != "" {
		var parentWH stockmodel.Warehouse
		if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND (warehouse_name = ? OR id = ?)", tenant, input.ParentWarehouse, input.ParentWarehouse).First(&parentWH).Error; err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "Parent Warehouse tidak ditemukan"})
			return
		}
		if !parentWH.IsGroup {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "Child nodes can be only created under 'Group' type nodes"})
			return
		}
		input.ParentWarehouse = parentWH.WarehouseName
	}

	input.ID = "wh-" + uuid.NewString()[:8]
	input.TenantID = tenant
	if input.WarehouseType == "" {
		if input.IsGroup {
			input.WarehouseType = "Group"
		} else {
			input.WarehouseType = "Stores"
		}
	}

	if err := db.Create(&input).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat gudang"})
		return
	}

	ctx.JSON(http.StatusCreated, input)
}

func (ctrl *WarehouseController) Update(ctx *gin.Context) {
	id := ctx.Param("id")
	var input stockmodel.Warehouse
	if err := ctx.ShouldBindJSON(&input); err != nil || strings.TrimSpace(input.WarehouseName) == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Data gudang tidak valid"})
		return
	}

	db, tenant := stockDB(ctx), stockTenant(ctx)
	var existing stockmodel.Warehouse
	if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).First(&existing).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Gudang tidak ditemukan"})
		return
	}

	newParent := strings.TrimSpace(input.ParentWarehouse)
	if newParent == existing.WarehouseName || newParent == existing.ID {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Parent Warehouse tidak boleh sama dengan gudang itu sendiri"})
		return
	}

	// If changing is_group from true to false, check if has children
	if existing.IsGroup && !input.IsGroup {
		var childCount int64
		db.Model(&stockmodel.Warehouse{}).Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND parent_warehouse = ?", tenant, existing.WarehouseName).Count(&childCount)
		if childCount > 0 {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "Gudang ini memiliki sub-gudang (child nodes), tidak dapat diubah menjadi bukan grup"})
			return
		}
	}

	// Validate parent warehouse if specified
	if newParent != "" {
		var parentWH stockmodel.Warehouse
		if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND (warehouse_name = ? OR id = ?)", tenant, newParent, newParent).First(&parentWH).Error; err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "Parent Warehouse tidak ditemukan"})
			return
		}
		if !parentWH.IsGroup {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "Child nodes can be only created under 'Group' type nodes"})
			return
		}
		newParent = parentWH.WarehouseName
	}

	// If warehouse name changed, update children's parent_warehouse
	newName := strings.TrimSpace(input.WarehouseName)
	if newName != existing.WarehouseName {
		_ = db.Model(&stockmodel.Warehouse{}).Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND parent_warehouse = ?", tenant, existing.WarehouseName).Update("parent_warehouse", newName).Error
	}

	existing.WarehouseName = newName
	existing.IsGroup = input.IsGroup
	existing.ParentWarehouse = newParent
	if input.Company != "" {
		existing.Company = strings.TrimSpace(input.Company)
	}
	existing.WarehouseType = strings.TrimSpace(input.WarehouseType)
	existing.Account = strings.TrimSpace(input.Account)
	existing.AddressLine1 = strings.TrimSpace(input.AddressLine1)
	existing.City = strings.TrimSpace(input.City)
	existing.PhoneNo = strings.TrimSpace(input.PhoneNo)
	existing.Disabled = input.Disabled

	if err := db.Save(&existing).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui gudang"})
		return
	}

	ctx.JSON(http.StatusOK, existing)
}

func (ctrl *WarehouseController) Delete(ctx *gin.Context) {
	db, tenant, id := stockDB(ctx), stockTenant(ctx), ctx.Param("id")

	var existing stockmodel.Warehouse
	if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).First(&existing).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Gudang tidak ditemukan"})
		return
	}

	// Check if any child exists
	var childCount int64
	db.Model(&stockmodel.Warehouse{}).Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND parent_warehouse = ?", tenant, existing.WarehouseName).Count(&childCount)
	if childCount > 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Gudang grup ini memiliki sub-gudang, hapus atau pindahkan sub-gudang terlebih dahulu"})
		return
	}

	if err := db.Delete(&existing).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus gudang"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "Gudang berhasil dihapus"})
}

func (ctrl *WarehouseController) Seed(ctx *gin.Context) {
	db, tenant := stockDB(ctx), stockTenant(ctx)
	if err := stockmodel.SeedWarehouses(db, tenant); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal seeding gudang"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "Struktur gudang default berhasil di-seed"})
}
