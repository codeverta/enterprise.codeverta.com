package controller

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"gin-template/model"
	stockmodel "gin-template/modules/stock/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type SerialNoController struct{}

func NewSerialNoController() *SerialNoController {
	return &SerialNoController{}
}

func (ctrl *SerialNoController) List(ctx *gin.Context) {
	db, tenant := stockDB(ctx), stockTenant(ctx)

	var serialNos []stockmodel.SerialNo
	query := db.Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant)

	if search := strings.TrimSpace(ctx.Query("q")); search != "" {
		like := "%" + search + "%"
		query = query.Where(
			"serial_no LIKE ? OR item_code LIKE ? OR item_name LIKE ? OR warehouse LIKE ? OR company LIKE ? OR customer LIKE ? OR supplier LIKE ? OR batch_no LIKE ?",
			like, like, like, like, like, like, like, like,
		)
	}

	if itemCode := strings.TrimSpace(ctx.Query("item_code")); itemCode != "" {
		query = query.Where("item_code = ?", itemCode)
	}

	if warehouse := strings.TrimSpace(ctx.Query("warehouse")); warehouse != "" {
		query = query.Where("warehouse = ?", warehouse)
	}

	if status := strings.TrimSpace(ctx.Query("status")); status != "" && status != "All" {
		query = query.Where("status = ?", status)
	}

	if batchNo := strings.TrimSpace(ctx.Query("batch_no")); batchNo != "" {
		query = query.Where("batch_no = ?", batchNo)
	}

	if err := query.Order("created_at desc").Find(&serialNos).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil daftar Serial No"})
		return
	}

	// Calculate stats
	var totalCount, availableCount, deliveredCount, expiredCount, inactiveCount int64
	baseStatsQuery := db.Model(&stockmodel.SerialNo{}).Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant)
	if itemCode := strings.TrimSpace(ctx.Query("item_code")); itemCode != "" {
		baseStatsQuery = baseStatsQuery.Where("item_code = ?", itemCode)
	}
	baseStatsQuery.Count(&totalCount)

	db.Model(&stockmodel.SerialNo{}).Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND status = ?", tenant, stockmodel.SerialNoStatusAvailable).Count(&availableCount)
	db.Model(&stockmodel.SerialNo{}).Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND status = ?", tenant, stockmodel.SerialNoStatusDelivered).Count(&deliveredCount)
	db.Model(&stockmodel.SerialNo{}).Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND status = ?", tenant, stockmodel.SerialNoStatusExpired).Count(&expiredCount)
	db.Model(&stockmodel.SerialNo{}).Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND status = ?", tenant, stockmodel.SerialNoStatusInactive).Count(&inactiveCount)

	ctx.JSON(http.StatusOK, gin.H{
		"data": serialNos,
		"stats": gin.H{
			"total":     totalCount,
			"available": availableCount,
			"delivered": deliveredCount,
			"expired":   expiredCount,
			"inactive":  inactiveCount,
		},
	})
}

func (ctrl *SerialNoController) Get(ctx *gin.Context) {
	db, tenant, id := stockDB(ctx), stockTenant(ctx), ctx.Param("id")

	var row stockmodel.SerialNo
	if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND (id = ? OR serial_no = ?)", tenant, id, id).First(&row).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "Serial No tidak ditemukan"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data Serial No"})
		return
	}

	ctx.JSON(http.StatusOK, row)
}

type CreateSerialNoRequest struct {
	SerialNo             string     `json:"serial_no"`
	SerialNos            []string   `json:"serial_nos"` // for bulk input
	ItemCode             string     `json:"item_code" binding:"required"`
	ItemName             string     `json:"item_name"`
	Description          string     `json:"description"`
	Warehouse            string     `json:"warehouse"`
	Company              string     `json:"company"`
	Status               string     `json:"status"`
	BatchNo              string     `json:"batch_no"`
	PurchaseDocumentType string     `json:"purchase_document_type"`
	PurchaseDocumentNo   string     `json:"purchase_document_no"`
	PurchaseDate         *time.Time `json:"purchase_date"`
	PurchaseRate         float64    `json:"purchase_rate"`
	Supplier             string     `json:"supplier"`
	SupplierName         string     `json:"supplier_name"`
	DeliveryDocumentType string     `json:"delivery_document_type"`
	DeliveryDocumentNo   string     `json:"delivery_document_no"`
	DeliveryDate         *time.Time `json:"delivery_date"`
	Customer             string     `json:"customer"`
	CustomerName         string     `json:"customer_name"`
	WarrantyPeriod       int        `json:"warranty_period"`
	WarrantyExpiryDate   *time.Time `json:"warranty_expiry_date"`
	AMCExpiryDate        *time.Time `json:"amc_expiry_date"`
	MaintenanceStatus    string     `json:"maintenance_status"`
	Notes                string     `json:"notes"`
}

func (ctrl *SerialNoController) Create(ctx *gin.Context) {
	db, tenant := stockDB(ctx), stockTenant(ctx)

	var req CreateSerialNoRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	itemCode := strings.TrimSpace(req.ItemCode)
	if itemCode == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Item Code wajib diisi"})
		return
	}

	// Auto-lookup item name if empty
	itemName := strings.TrimSpace(req.ItemName)
	if itemName == "" {
		var item struct {
			ItemName    string `gorm:"column:item_name"`
			Description string `gorm:"column:description"`
		}
		if err := db.Table("buying_items").Select("item_name, description").Where("item_code = ?", itemCode).Limit(1).Scan(&item).Error; err == nil && item.ItemName != "" {
			itemName = item.ItemName
			if req.Description == "" {
				req.Description = item.Description
			}
		}
	}

	status := stockmodel.SerialNoStatusAvailable
	if req.Status != "" {
		status = stockmodel.SerialNoStatus(req.Status)
	}

	// Collect serial numbers list (support multiple entered via textarea split by newlines/commas)
	var rawSerialNos []string
	if len(req.SerialNos) > 0 {
		rawSerialNos = append(rawSerialNos, req.SerialNos...)
	} else if strings.TrimSpace(req.SerialNo) != "" {
		parts := strings.FieldsFunc(req.SerialNo, func(r rune) bool {
			return r == '\n' || r == '\r' || r == ','
		})
		for _, p := range parts {
			trimmed := strings.TrimSpace(p)
			if trimmed != "" {
				rawSerialNos = append(rawSerialNos, trimmed)
			}
		}
	}

	if len(rawSerialNos) == 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Serial No wajib diisi"})
		return
	}

	var createdList []stockmodel.SerialNo
	err := db.Transaction(func(tx *gorm.DB) error {
		for _, sn := range rawSerialNos {
			// Check if duplicate exists for tenant
			var exists int64
			tx.Model(&stockmodel.SerialNo{}).
				Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND serial_no = ?", tenant, sn).
				Count(&exists)
			if exists > 0 {
				return errors.New("Serial No sudah terdaftar: " + sn)
			}

			record := stockmodel.SerialNo{
				ID:                   uuid.NewString(),
				TenantID:             tenant,
				SerialNo:             sn,
				ItemCode:             itemCode,
				ItemName:             itemName,
				Description:          req.Description,
				Warehouse:            req.Warehouse,
				Company:              req.Company,
				Status:               status,
				BatchNo:              req.BatchNo,
				PurchaseDocumentType: req.PurchaseDocumentType,
				PurchaseDocumentNo:   req.PurchaseDocumentNo,
				PurchaseDate:         req.PurchaseDate,
				PurchaseRate:         req.PurchaseRate,
				Supplier:             req.Supplier,
				SupplierName:         req.SupplierName,
				DeliveryDocumentType: req.DeliveryDocumentType,
				DeliveryDocumentNo:   req.DeliveryDocumentNo,
				DeliveryDate:         req.DeliveryDate,
				Customer:             req.Customer,
				CustomerName:         req.CustomerName,
				WarrantyPeriod:       req.WarrantyPeriod,
				WarrantyExpiryDate:   req.WarrantyExpiryDate,
				AMCExpiryDate:        req.AMCExpiryDate,
				MaintenanceStatus:    req.MaintenanceStatus,
				Notes:                req.Notes,
				CreatedAt:            time.Now(),
				UpdatedAt:            time.Now(),
			}

			if err := tx.Create(&record).Error; err != nil {
				return err
			}
			createdList = append(createdList, record)
		}
		return nil
	})

	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if len(createdList) == 1 {
		ctx.JSON(http.StatusCreated, createdList[0])
		return
	}
	ctx.JSON(http.StatusCreated, gin.H{
		"message": "Berhasil membuat serial numbers",
		"count":   len(createdList),
		"data":    createdList,
	})
}

func (ctrl *SerialNoController) Update(ctx *gin.Context) {
	db, tenant, id := stockDB(ctx), stockTenant(ctx), ctx.Param("id")

	var existing stockmodel.SerialNo
	if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).First(&existing).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "Serial No tidak ditemukan"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mencari data"})
		return
	}

	var req stockmodel.SerialNo
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.SerialNo != "" && req.SerialNo != existing.SerialNo {
		var exists int64
		db.Model(&stockmodel.SerialNo{}).
			Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND serial_no = ? AND id != ?", tenant, req.SerialNo, id).
			Count(&exists)
		if exists > 0 {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "Serial No sudah dipakai oleh record lain"})
			return
		}
		existing.SerialNo = req.SerialNo
	}

	if req.ItemCode != "" {
		existing.ItemCode = req.ItemCode
	}
	if req.ItemName != "" {
		existing.ItemName = req.ItemName
	}
	existing.Description = req.Description
	existing.Warehouse = req.Warehouse
	existing.Company = req.Company
	if req.Status != "" {
		existing.Status = req.Status
	}
	existing.BatchNo = req.BatchNo

	existing.PurchaseDocumentType = req.PurchaseDocumentType
	existing.PurchaseDocumentNo = req.PurchaseDocumentNo
	existing.PurchaseDate = req.PurchaseDate
	existing.PurchaseRate = req.PurchaseRate
	existing.Supplier = req.Supplier
	existing.SupplierName = req.SupplierName

	existing.DeliveryDocumentType = req.DeliveryDocumentType
	existing.DeliveryDocumentNo = req.DeliveryDocumentNo
	existing.DeliveryDate = req.DeliveryDate
	existing.Customer = req.Customer
	existing.CustomerName = req.CustomerName

	existing.WarrantyPeriod = req.WarrantyPeriod
	existing.WarrantyExpiryDate = req.WarrantyExpiryDate
	existing.AMCExpiryDate = req.AMCExpiryDate
	existing.MaintenanceStatus = req.MaintenanceStatus
	existing.Notes = req.Notes
	existing.UpdatedAt = time.Now()

	if err := db.Save(&existing).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui Serial No: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, existing)
}

func (ctrl *SerialNoController) Delete(ctx *gin.Context) {
	db, tenant, id := stockDB(ctx), stockTenant(ctx), ctx.Param("id")

	res := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).Delete(&stockmodel.SerialNo{})
	if res.Error != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus Serial No"})
		return
	}
	if res.RowsAffected == 0 {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Serial No tidak ditemukan"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "Serial No berhasil dihapus"})
}

func (ctrl *SerialNoController) Options(ctx *gin.Context) {
	db, tenant := stockDB(ctx), stockTenant(ctx)

	type ItemOpt struct {
		ItemCode    string `json:"item_code"`
		ItemName    string `json:"item_name"`
		StockUOM    string `json:"stock_uom"`
		HasSerialNo bool   `json:"has_serial_no"`
		HasBatchNo  bool   `json:"has_batch_no"`
	}
	var items []ItemOpt
	_ = db.Table("buying_items").
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND disabled = ?", tenant, false).
		Order("item_name asc").
		Limit(100).
		Scan(&items).Error

	type WhOpt struct {
		ID            string `json:"id"`
		WarehouseName string `json:"warehouse_name"`
		Company       string `json:"company"`
		IsGroup       bool   `json:"is_group"`
	}
	var warehouses []WhOpt
	_ = db.Model(&stockmodel.Warehouse{}).
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND disabled = ?", tenant, false).
		Order("warehouse_name asc").
		Scan(&warehouses).Error

	type CompOpt struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}
	var companies []CompOpt
	_ = db.Model(&model.Company{}).
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND is_active = ?", tenant, true).
		Order("name asc").
		Scan(&companies).Error

	type BatchOpt struct {
		BatchID  string  `json:"batch_id"`
		ItemCode string  `json:"item_code"`
		BatchQty float64 `json:"batch_qty"`
	}
	var batches []BatchOpt
	_ = db.Model(&stockmodel.Batch{}).
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND disabled = ?", tenant, false).
		Order("batch_id asc").
		Limit(100).
		Scan(&batches).Error

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

	type CustomerOpt struct {
		ID           string `json:"id"`
		CustomerName string `json:"customer_name"`
	}
	var customers []CustomerOpt
	_ = db.Table("selling_customers").
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND disabled = ?", tenant, false).
		Order("customer_name asc").
		Limit(100).
		Scan(&customers).Error

	ctx.JSON(http.StatusOK, gin.H{
		"items":      items,
		"warehouses": warehouses,
		"companies":  companies,
		"batches":    batches,
		"suppliers":  suppliers,
		"customers":  customers,
	})
}
