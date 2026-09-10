package controller

import (
	"errors"
	"net/http"
	"strings"
	"time"

	stockmodel "gin-template/modules/stock/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type BatchController struct{}

func NewBatchController() *BatchController {
	return &BatchController{}
}

func (ctrl *BatchController) List(ctx *gin.Context) {
	db, tenant := stockDB(ctx), stockTenant(ctx)

	var batches []stockmodel.Batch
	query := db.Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant)

	if search := strings.TrimSpace(ctx.Query("q")); search != "" {
		like := "%" + search + "%"
		query = query.Where("batch_id LIKE ? OR item_code LIKE ? OR item_name LIKE ? OR supplier LIKE ? OR reference_name LIKE ?", like, like, like, like, like)
	}

	if itemCode := strings.TrimSpace(ctx.Query("item_code")); itemCode != "" {
		query = query.Where("item_code = ?", itemCode)
	}

	now := time.Now()
	soon := now.AddDate(0, 0, 30)

	if status := strings.TrimSpace(ctx.Query("status")); status != "" && status != "All" {
		switch strings.ToLower(status) {
		case "active":
			query = query.Where("disabled = ? AND (expiry_date IS NULL OR expiry_date > ?)", false, now)
		case "expiring_soon":
			query = query.Where("disabled = ? AND expiry_date IS NOT NULL AND expiry_date > ? AND expiry_date <= ?", false, now, soon)
		case "expired":
			query = query.Where("disabled = ? AND expiry_date IS NOT NULL AND expiry_date <= ?", false, now)
		case "disabled":
			query = query.Where("disabled = ?", true)
		}
	}

	if err := query.Order("created_at desc").Find(&batches).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil daftar Batch"})
		return
	}

	// Calculate stats
	var totalCount, activeCount, expiringSoonCount, expiredCount int64
	baseStats := db.Model(&stockmodel.Batch{}).Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant)
	if itemCode := strings.TrimSpace(ctx.Query("item_code")); itemCode != "" {
		baseStats = baseStats.Where("item_code = ?", itemCode)
	}
	baseStats.Count(&totalCount)

	db.Model(&stockmodel.Batch{}).
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND disabled = ? AND (expiry_date IS NULL OR expiry_date > ?)", tenant, false, now).
		Count(&activeCount)

	db.Model(&stockmodel.Batch{}).
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND disabled = ? AND expiry_date IS NOT NULL AND expiry_date > ? AND expiry_date <= ?", tenant, false, now, soon).
		Count(&expiringSoonCount)

	db.Model(&stockmodel.Batch{}).
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND disabled = ? AND expiry_date IS NOT NULL AND expiry_date <= ?", tenant, false, now).
		Count(&expiredCount)

	ctx.JSON(http.StatusOK, gin.H{
		"data": batches,
		"stats": gin.H{
			"total":         totalCount,
			"active":        activeCount,
			"expiring_soon": expiringSoonCount,
			"expired":       expiredCount,
		},
	})
}

func (ctrl *BatchController) Get(ctx *gin.Context) {
	db, tenant, id := stockDB(ctx), stockTenant(ctx), ctx.Param("id")

	var row stockmodel.Batch
	if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND (id = ? OR batch_id = ?)", tenant, id, id).First(&row).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "Batch tidak ditemukan"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data Batch"})
		return
	}

	ctx.JSON(http.StatusOK, row)
}

type CreateBatchRequest struct {
	BatchID           string     `json:"batch_id" binding:"required"`
	ItemCode          string     `json:"item_code" binding:"required"`
	ItemName          string     `json:"item_name"`
	BatchQty          float64    `json:"batch_qty"`
	ManufacturingDate *time.Time `json:"manufacturing_date"`
	ExpiryDate        *time.Time `json:"expiry_date"`
	ShelfLifeInDays   int        `json:"shelf_life_in_days"`
	ReferenceDoctype  string     `json:"reference_doctype"`
	ReferenceName     string     `json:"reference_name"`
	Supplier          string     `json:"supplier"`
	Disabled          bool       `json:"disabled"`
	Description       string     `json:"description"`
}

func (ctrl *BatchController) Create(ctx *gin.Context) {
	db, tenant := stockDB(ctx), stockTenant(ctx)

	var req CreateBatchRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	batchID := strings.TrimSpace(req.BatchID)
	if batchID == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Batch ID wajib diisi"})
		return
	}

	itemCode := strings.TrimSpace(req.ItemCode)
	if itemCode == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Item Code wajib diisi"})
		return
	}

	// Check duplication
	var count int64
	db.Model(&stockmodel.Batch{}).
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND batch_id = ?", tenant, batchID).
		Count(&count)
	if count > 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Batch ID sudah ada"})
		return
	}

	// Auto-lookup item name if empty
	itemName := strings.TrimSpace(req.ItemName)
	if itemName == "" {
		var item struct {
			ItemName        string `gorm:"column:item_name"`
			ShelfLifeInDays int    `gorm:"column:shelf_life_in_days"`
		}
		if err := db.Table("buying_items").Select("item_name, shelf_life_in_days").Where("item_code = ?", itemCode).Limit(1).Scan(&item).Error; err == nil && item.ItemName != "" {
			itemName = item.ItemName
			if req.ShelfLifeInDays == 0 && item.ShelfLifeInDays > 0 {
				req.ShelfLifeInDays = item.ShelfLifeInDays
			}
		}
	}

	// Calculate expiry date if not provided but mfg date and shelf life are present
	expiryDate := req.ExpiryDate
	if expiryDate == nil && req.ManufacturingDate != nil && req.ShelfLifeInDays > 0 {
		calc := req.ManufacturingDate.AddDate(0, 0, req.ShelfLifeInDays)
		expiryDate = &calc
	}

	batch := stockmodel.Batch{
		ID:                uuid.NewString(),
		TenantID:          tenant,
		BatchID:           batchID,
		ItemCode:          itemCode,
		ItemName:          itemName,
		BatchQty:          req.BatchQty,
		ManufacturingDate: req.ManufacturingDate,
		ExpiryDate:        expiryDate,
		ShelfLifeInDays:   req.ShelfLifeInDays,
		ReferenceDoctype:  req.ReferenceDoctype,
		ReferenceName:     req.ReferenceName,
		Supplier:          req.Supplier,
		Disabled:          req.Disabled,
		Description:       req.Description,
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}

	if err := db.Create(&batch).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan Batch: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, batch)
}

func (ctrl *BatchController) Update(ctx *gin.Context) {
	db, tenant, id := stockDB(ctx), stockTenant(ctx), ctx.Param("id")

	var existing stockmodel.Batch
	if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).First(&existing).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "Batch tidak ditemukan"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mencari data"})
		return
	}

	var req stockmodel.Batch
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.BatchID != "" && req.BatchID != existing.BatchID {
		var exists int64
		db.Model(&stockmodel.Batch{}).
			Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND batch_id = ? AND id != ?", tenant, req.BatchID, id).
			Count(&exists)
		if exists > 0 {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "Batch ID sudah dipakai oleh record lain"})
			return
		}
		existing.BatchID = req.BatchID
	}

	if req.ItemCode != "" {
		existing.ItemCode = req.ItemCode
	}
	if req.ItemName != "" {
		existing.ItemName = req.ItemName
	}
	existing.BatchQty = req.BatchQty
	existing.ManufacturingDate = req.ManufacturingDate
	existing.ExpiryDate = req.ExpiryDate
	existing.ShelfLifeInDays = req.ShelfLifeInDays
	existing.ReferenceDoctype = req.ReferenceDoctype
	existing.ReferenceName = req.ReferenceName
	existing.Supplier = req.Supplier
	existing.Disabled = req.Disabled
	existing.Description = req.Description
	existing.UpdatedAt = time.Now()

	if err := db.Save(&existing).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui Batch: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, existing)
}

func (ctrl *BatchController) Delete(ctx *gin.Context) {
	db, tenant, id := stockDB(ctx), stockTenant(ctx), ctx.Param("id")

	res := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).Delete(&stockmodel.Batch{})
	if res.Error != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus Batch"})
		return
	}
	if res.RowsAffected == 0 {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Batch tidak ditemukan"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "Batch berhasil dihapus"})
}

func (ctrl *BatchController) Options(ctx *gin.Context) {
	db, tenant := stockDB(ctx), stockTenant(ctx)

	type ItemOpt struct {
		ItemCode        string `json:"item_code"`
		ItemName        string `json:"item_name"`
		StockUOM        string `json:"stock_uom"`
		HasBatchNo      bool   `json:"has_batch_no"`
		ShelfLifeInDays int    `json:"shelf_life_in_days"`
	}
	var items []ItemOpt
	_ = db.Table("buying_items").
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND disabled = ?", tenant, false).
		Order("item_name asc").
		Limit(100).
		Scan(&items).Error

	type SupplierOpt struct {
		ID           string `json:"id"`
		SupplierName string `json:"supplier_name"`
	}
	var suppliers []SupplierOpt
	_ = db.Table("buying_suppliers").
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND disabled = ?", tenant, false).
		Order("supplier_name asc").
		Limit(100).
		Scan(&suppliers).Error

	ctx.JSON(http.StatusOK, gin.H{
		"items":     items,
		"suppliers": suppliers,
	})
}
