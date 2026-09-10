package controller

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	crmmodel "gin-template/model/crm"
	coremodel "gin-template/model"
	buyingmodel "gin-template/modules/buying/model"
	stockmodel "gin-template/modules/stock/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type PickListController struct{}

func NewPickListController() *PickListController {
	return &PickListController{}
}

func calculatePickListTotals(pickList *stockmodel.PickList) {
	var totalQty float64
	var totalPickedQty float64
	for i := range pickList.Locations {
		pickList.Locations[i].Idx = i + 1
		if pickList.Locations[i].ConversionFactor <= 0 {
			pickList.Locations[i].ConversionFactor = 1
		}
		pickList.Locations[i].StockQty = pickList.Locations[i].Qty * pickList.Locations[i].ConversionFactor
		totalQty += pickList.Locations[i].Qty
		totalPickedQty += pickList.Locations[i].PickedQty
	}
	pickList.TotalQty = totalQty
	pickList.TotalPickedQty = totalPickedQty
}

func (ctrl *PickListController) List(ctx *gin.Context) {
	db, tenant := stockDB(ctx), stockTenant(ctx)
	var list []stockmodel.PickList
	query := db.Preload("Locations").Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant)

	if status := strings.TrimSpace(ctx.Query("status")); status != "" {
		query = query.Where("status = ?", status)
	}
	if purpose := strings.TrimSpace(ctx.Query("purpose")); purpose != "" {
		query = query.Where("purpose = ?", purpose)
	}
	if company := strings.TrimSpace(ctx.Query("company")); company != "" {
		query = query.Where("company = ? OR company_id = ?", company, company)
	}
	if search := strings.TrimSpace(ctx.Query("q")); search != "" {
		like := "%" + search + "%"
		query = query.Where("pick_list_number LIKE ? OR company LIKE ? OR purpose LIKE ? OR remarks LIKE ?", like, like, like, like)
	}

	if err := query.Order("created_at desc").Find(&list).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil daftar Pick List"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": list})
}

func (ctrl *PickListController) Get(ctx *gin.Context) {
	db, tenant, id := stockDB(ctx), stockTenant(ctx), ctx.Param("id")
	var item stockmodel.PickList
	if err := db.Preload("Locations").
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND (id = ? OR pick_list_number = ?)", tenant, id, id).
		First(&item).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "Pick List tidak ditemukan"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil detail Pick List"})
		return
	}
	ctx.JSON(http.StatusOK, item)
}

func (ctrl *PickListController) Create(ctx *gin.Context) {
	var input stockmodel.PickList
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Data Pick List tidak valid: " + err.Error()})
		return
	}

	db, tenant := stockDB(ctx), stockTenant(ctx)
	now := time.Now()

	// Sync Company and CompanyID
	if input.CompanyID != "" && input.Company == "" {
		var comp coremodel.Company
		if err := db.Where("id = ?", input.CompanyID).First(&comp).Error; err == nil {
			input.Company = comp.Name
		}
	} else if input.CompanyID == "" && input.Company != "" {
		var comp coremodel.Company
		if err := db.Where("name = ?", input.Company).First(&comp).Error; err == nil {
			input.CompanyID = comp.ID.String()
		}
	}

	input.ID = "pkl-" + uuid.NewString()[:8]
	input.TenantID = tenant
	if input.PickListNumber == "" {
		year := now.Format("2006")
		input.PickListNumber = fmt.Sprintf("STO-PICK-%s-%05d", year, now.UnixNano()%100000)
	}
	if input.NamingSeries == "" {
		input.NamingSeries = "STO-PICK-.YYYY.-"
	}
	if input.Status == "" {
		input.Status = stockmodel.PickListStatusDraft
	}
	if input.Purpose == "" {
		input.Purpose = string(stockmodel.PickListPurposeDelivery)
	}
	input.CreatedAt = now
	input.UpdatedAt = now

	for i := range input.Locations {
		input.Locations[i].ID = "pkli-" + uuid.NewString()[:8]
		input.Locations[i].PickListID = input.ID
		input.Locations[i].TenantID = tenant
		input.Locations[i].CreatedAt = now
		input.Locations[i].UpdatedAt = now
	}

	calculatePickListTotals(&input)

	if err := db.Create(&input).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat Pick List: " + err.Error()})
		return
	}
	ctx.JSON(http.StatusCreated, input)
}

func (ctrl *PickListController) Update(ctx *gin.Context) {
	id := ctx.Param("id")
	var input stockmodel.PickList
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Data Pick List tidak valid: " + err.Error()})
		return
	}

	db, tenant := stockDB(ctx), stockTenant(ctx)
	var existing stockmodel.PickList
	if err := db.Preload("Locations").
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).
		First(&existing).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Pick List tidak ditemukan"})
		return
	}
	if existing.Status != stockmodel.PickListStatusDraft {
		ctx.JSON(http.StatusConflict, gin.H{"error": "Hanya Pick List berstatus Draft yang dapat diedit"})
		return
	}

	// Sync Company and CompanyID
	if input.CompanyID != "" && input.Company == "" {
		var comp coremodel.Company
		if err := db.Where("id = ?", input.CompanyID).First(&comp).Error; err == nil {
			input.Company = comp.Name
		}
	} else if input.CompanyID == "" && input.Company != "" {
		var comp coremodel.Company
		if err := db.Where("name = ?", input.Company).First(&comp).Error; err == nil {
			input.CompanyID = comp.ID.String()
		}
	}

	existing.CompanyID = input.CompanyID
	existing.Company = input.Company
	existing.Purpose = input.Purpose
	existing.ParentWarehouse = input.ParentWarehouse
	existing.ConsiderRejectedWarehouses = input.ConsiderRejectedWarehouses
	existing.PickManually = input.PickManually
	existing.IgnorePricingRule = input.IgnorePricingRule
	existing.ScanBarcode = input.ScanBarcode
	existing.ScanMode = input.ScanMode
	existing.PromptQty = input.PromptQty
	existing.Remarks = input.Remarks
	existing.UpdatedAt = time.Now()

	for i := range input.Locations {
		if input.Locations[i].ID == "" {
			input.Locations[i].ID = "pkli-" + uuid.NewString()[:8]
		}
		input.Locations[i].PickListID = existing.ID
		input.Locations[i].TenantID = tenant
		input.Locations[i].CreatedAt = existing.CreatedAt
		input.Locations[i].UpdatedAt = existing.UpdatedAt
	}
	existing.Locations = input.Locations
	calculatePickListTotals(&existing)

	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("pick_list_id = ?", existing.ID).Delete(&stockmodel.PickListItem{}).Error; err != nil {
			return err
		}
		if len(existing.Locations) > 0 {
			if err := tx.Create(&existing.Locations).Error; err != nil {
				return err
			}
		}
		return tx.Save(&existing).Error
	})

	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui Pick List: " + err.Error()})
		return
	}

	db.Preload("Locations").First(&existing, "id = ?", existing.ID)
	ctx.JSON(http.StatusOK, existing)
}

func (ctrl *PickListController) Delete(ctx *gin.Context) {
	db, tenant, id := stockDB(ctx), stockTenant(ctx), ctx.Param("id")
	var existing stockmodel.PickList
	if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).First(&existing).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Pick List tidak ditemukan"})
		return
	}
	if existing.Status != stockmodel.PickListStatusDraft && existing.Status != stockmodel.PickListStatusCancelled {
		ctx.JSON(http.StatusConflict, gin.H{"error": "Hanya Pick List berstatus Draft atau Cancelled yang dapat dihapus"})
		return
	}

	_ = db.Where("pick_list_id = ?", existing.ID).Delete(&stockmodel.PickListItem{})
	if err := db.Delete(&existing).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus Pick List"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "Pick List berhasil dihapus"})
}

func (ctrl *PickListController) Submit(ctx *gin.Context) {
	db, tenant, id := stockDB(ctx), stockTenant(ctx), ctx.Param("id")
	var existing stockmodel.PickList
	if err := db.Preload("Locations").
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).
		First(&existing).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Pick List tidak ditemukan"})
		return
	}
	if existing.Status != stockmodel.PickListStatusDraft {
		ctx.JSON(http.StatusConflict, gin.H{"error": "Hanya Pick List berstatus Draft yang dapat disubmit"})
		return
	}

	// In ERPNext: If Scan Mode is false, picked qty is automatically fulfilled on submit
	if !existing.ScanMode {
		for i := range existing.Locations {
			if existing.Locations[i].PickedQty <= 0 {
				existing.Locations[i].PickedQty = existing.Locations[i].Qty
			}
		}
	}

	existing.Status = stockmodel.PickListStatusSubmitted
	existing.UpdatedAt = time.Now()
	calculatePickListTotals(&existing)

	err := db.Transaction(func(tx *gorm.DB) error {
		for _, loc := range existing.Locations {
			if err := tx.Model(&stockmodel.PickListItem{}).Where("id = ?", loc.ID).Update("picked_qty", loc.PickedQty).Error; err != nil {
				return err
			}
		}
		return tx.Save(&existing).Error
	})

	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal submit Pick List: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, existing)
}

func (ctrl *PickListController) Cancel(ctx *gin.Context) {
	db, tenant, id := stockDB(ctx), stockTenant(ctx), ctx.Param("id")
	var existing stockmodel.PickList
	if err := db.Preload("Locations").
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).
		First(&existing).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Pick List tidak ditemukan"})
		return
	}
	if existing.Status != stockmodel.PickListStatusSubmitted {
		ctx.JSON(http.StatusConflict, gin.H{"error": "Hanya Pick List berstatus Submitted yang dapat dibatalkan"})
		return
	}

	existing.Status = stockmodel.PickListStatusCancelled
	existing.UpdatedAt = time.Now()

	if err := db.Save(&existing).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membatalkan Pick List: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, existing)
}

func (ctrl *PickListController) Options(ctx *gin.Context) {
	db, tenant := stockDB(ctx), stockTenant(ctx)

	// Companies from database
	var dbCompanies []coremodel.Company
	_ = db.Order("name asc").Find(&dbCompanies)

	type CompanyOptionItem struct {
		ID           string `json:"id"`
		Name         string `json:"name"`
		Abbreviation string `json:"abbreviation"`
	}
	companyNames := make([]string, 0, len(dbCompanies))
	companyOptions := make([]CompanyOptionItem, 0, len(dbCompanies))
	for _, c := range dbCompanies {
		companyNames = append(companyNames, c.Name)
		companyOptions = append(companyOptions, CompanyOptionItem{
			ID:           c.ID.String(),
			Name:         c.Name,
			Abbreviation: c.Abbreviation,
		})
	}
	if len(companyNames) == 0 {
		companyNames = []string{
			"PT ZENIT TECHNOLOGY SOLUTION",
			"PT Codeverta Utama (PZTS)",
			"PT Codeverta Mandiri (MC)",
		}
		companyOptions = []CompanyOptionItem{
			{ID: "cmp-pzts", Name: "PT ZENIT TECHNOLOGY SOLUTION", Abbreviation: "PZTS"},
			{ID: "cmp-utama", Name: "PT Codeverta Utama (PZTS)", Abbreviation: "PZTS"},
			{ID: "cmp-mandiri", Name: "PT Codeverta Mandiri (MC)", Abbreviation: "MC"},
		}
	}

	// Warehouses
	var warehouses []stockmodel.Warehouse
	_ = db.Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant).Order("warehouse_name asc").Find(&warehouses)
	warehouseNames := make([]string, 0, len(warehouses))
	for _, w := range warehouses {
		warehouseNames = append(warehouseNames, w.WarehouseName)
	}
	if len(warehouseNames) == 0 {
		warehouseNames = []string{
			"Stores - PT ZENIT",
			"Finished Goods - PT ZENIT",
			"Work In Progress - PT ZENIT",
			"Goods In Transit - PT ZENIT",
		}
	}

	// Items
	var items []buyingmodel.Item
	_ = db.Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant).Find(&items)
	type ItemOption struct {
		ItemCode string  `json:"item_code"`
		ItemName string  `json:"item_name"`
		UOM      string  `json:"uom"`
		Barcode  string  `json:"barcode"`
	}
	var itemOptions []ItemOption
	for _, itm := range items {
		uom := "Nos"
		if len(itm.UOMs) > 0 {
			uom = itm.UOMs[0].UOM
		}
		barcode := ""
		if len(itm.Barcodes) > 0 {
			barcode = itm.Barcodes[0].Barcode
		}
		itemOptions = append(itemOptions, ItemOption{
			ItemCode: itm.ItemCode,
			ItemName: itm.ItemName,
			UOM:      uom,
			Barcode:  barcode,
		})
	}
	if len(itemOptions) == 0 {
		itemOptions = []ItemOption{
			{ItemCode: "RAW-MTL-001", ItemName: "Raw Material Steel Plate", UOM: "Nos", Barcode: "8991234001"},
			{ItemCode: "RAW-MTL-002", ItemName: "Copper Wiring 50m", UOM: "Roll", Barcode: "8991234002"},
			{ItemCode: "FG-PRD-001", ItemName: "Assembled Industrial Motor 5HP", UOM: "Nos", Barcode: "8991234003"},
			{ItemCode: "SP-CMP-001", ItemName: "Bearing 6204", UOM: "Nos", Barcode: "8991234004"},
		}
	}

	ctx.JSON(http.StatusOK, gin.H{
		"naming_series": []string{"STO-PICK-.YYYY.-"},
		"purposes": []string{
			string(stockmodel.PickListPurposeDelivery),
			string(stockmodel.PickListPurposeTransferForMfg),
			string(stockmodel.PickListPurposeMaterialTransfer),
		},
		"companies":       companyNames,
		"company_options": companyOptions,
		"warehouses":      warehouseNames,
		"items":           itemOptions,
	})
}

type GetItemLocationsRequest struct {
	Items                     []stockmodel.PickListItem `json:"items"`
	ParentWarehouse           string                    `json:"parent_warehouse"`
	ConsiderRejectedWarehouse bool                      `json:"consider_rejected_warehouses"`
}

func (ctrl *PickListController) GetItemLocations(ctx *gin.Context) {
	var req GetItemLocationsRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Permintaan tidak valid"})
		return
	}

	db, tenant := stockDB(ctx), stockTenant(ctx)

	// Available warehouses
	var warehouses []stockmodel.Warehouse
	q := db.Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant)
	if req.ParentWarehouse != "" {
		q = q.Where("parent_warehouse = ? OR warehouse_name = ?", req.ParentWarehouse, req.ParentWarehouse)
	}
	if !req.ConsiderRejectedWarehouse {
		q = q.Where("LOWER(warehouse_type) NOT LIKE ? AND LOWER(warehouse_name) NOT LIKE ?", "%reject%", "%reject%")
	}
	_ = q.Find(&warehouses)

	defaultWarehouse := "Stores - PT ZENIT"
	if len(warehouses) > 0 {
		defaultWarehouse = warehouses[0].WarehouseName
	}

	allocatedLocations := make([]stockmodel.PickListItem, len(req.Items))
	for i, item := range req.Items {
		allocated := item
		if allocated.Warehouse == "" {
			allocated.Warehouse = defaultWarehouse
		}
		if allocated.ConversionFactor <= 0 {
			allocated.ConversionFactor = 1
		}
		allocated.StockQty = allocated.Qty * allocated.ConversionFactor

		// Check if item has active batches
		var batches []stockmodel.Batch
		_ = db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND item_code = ? AND (disabled = ? OR disabled IS NULL)", tenant, item.ItemCode, false).
			Order("expiry_date asc, created_at asc").
			Find(&batches)
		if len(batches) > 0 && allocated.BatchNo == "" {
			allocated.BatchNo = batches[0].BatchID
		}

		// Check if item has serial numbers
		var serials []stockmodel.SerialNo
		_ = db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND item_code = ? AND status = ?", tenant, item.ItemCode, "Active").
			Limit(int(allocated.Qty)).
			Find(&serials)
		if len(serials) > 0 && allocated.SerialNo == "" {
			var snList []string
			for _, s := range serials {
				snList = append(snList, s.SerialNo)
			}
			allocated.SerialNo = strings.Join(snList, ", ")
		}

		allocated.Idx = i + 1
		allocatedLocations[i] = allocated
	}

	ctx.JSON(http.StatusOK, gin.H{"data": allocatedLocations})
}

type PendingReference struct {
	DocumentType string                  `json:"document_type"`
	DocumentNo   string                  `json:"document_no"`
	Customer     string                  `json:"customer,omitempty"`
	Date         string                  `json:"date"`
	Status       string                  `json:"status"`
	Items        []stockmodel.PickListItem `json:"items"`
}

func (ctrl *PickListController) GetPendingReferences(ctx *gin.Context) {
	purpose := strings.TrimSpace(ctx.Query("purpose"))
	db, tenant := stockDB(ctx), stockTenant(ctx)

	var results []PendingReference

	if purpose == string(stockmodel.PickListPurposeDelivery) {
		// Fetch Sales Orders
		var orders []crmmodel.SalesOrder
		_ = db.Preload("Items").Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant).
			Order("created_at desc").
			Limit(10).
			Find(&orders)

		for _, so := range orders {
			items := make([]stockmodel.PickListItem, 0, len(so.Items))
			for _, item := range so.Items {
				items = append(items, stockmodel.PickListItem{
					ItemCode:       item.ItemCode,
					ItemName:       item.ItemName,
					Warehouse:      "Finished Goods - PT ZENIT",
					Qty:            float64(item.Quantity),
					StockQty:       float64(item.Quantity),
					UOM:            "Nos",
					SalesOrder:     so.OrderNumber,
					SalesOrderItem: item.ID.String(),
				})
			}
			if len(items) == 0 {
				items = []stockmodel.PickListItem{
					{
						ItemCode:       "FG-PRD-001",
						ItemName:       "Assembled Industrial Motor 5HP",
						Warehouse:      "Finished Goods - PT ZENIT",
						Qty:            5,
						StockQty:       5,
						UOM:            "Nos",
						SalesOrder:     so.OrderNumber,
						SalesOrderItem: so.OrderNumber + "-01",
					},
				}
			}
			results = append(results, PendingReference{
				DocumentType: "Sales Order",
				DocumentNo:   so.OrderNumber,
				Customer:     so.Customer,
				Date:         so.CreatedAt.Format("2006-01-02"),
				Status:       so.Status,
				Items:        items,
			})
		}

		if len(results) == 0 {
			results = []PendingReference{
				{
					DocumentType: "Sales Order",
					DocumentNo:   "SO-2026-0001",
					Customer:     "PT Mitra Logistik Pratama",
					Date:         time.Now().Format("2006-01-02"),
					Status:       "To Deliver",
					Items: []stockmodel.PickListItem{
						{
							ItemCode:       "FG-PRD-001",
							ItemName:       "Assembled Industrial Motor 5HP",
							Warehouse:      "Finished Goods - PT ZENIT",
							Qty:            3,
							StockQty:       3,
							UOM:            "Nos",
							SalesOrder:     "SO-2026-0001",
							SalesOrderItem: "SO-2026-0001-1",
						},
						{
							ItemCode:       "SP-CMP-001",
							ItemName:       "Bearing 6204",
							Warehouse:      "Stores - PT ZENIT",
							Qty:            10,
							StockQty:       10,
							UOM:            "Nos",
							SalesOrder:     "SO-2026-0001",
							SalesOrderItem: "SO-2026-0001-2",
						},
					},
				},
				{
					DocumentType: "Sales Order",
					DocumentNo:   "SO-2026-0002",
					Customer:     "CV Makmur Sejahtera Abadi",
					Date:         time.Now().AddDate(0, 0, -1).Format("2006-01-02"),
					Status:       "To Deliver",
					Items: []stockmodel.PickListItem{
						{
							ItemCode:       "RAW-MTL-002",
							ItemName:       "Copper Wiring 50m",
							Warehouse:      "Stores - PT ZENIT",
							Qty:            4,
							StockQty:       4,
							UOM:            "Roll",
							SalesOrder:     "SO-2026-0002",
							SalesOrderItem: "SO-2026-0002-1",
						},
					},
				},
			}
		}
	} else if purpose == string(stockmodel.PickListPurposeTransferForMfg) {
		results = []PendingReference{
			{
				DocumentType: "Work Order",
				DocumentNo:   "MFG-WO-2026-00001",
				Date:         time.Now().Format("2006-01-02"),
				Status:       "In Progress",
				Items: []stockmodel.PickListItem{
					{
						ItemCode:   "RAW-MTL-001",
						ItemName:   "Raw Material Steel Plate",
						Warehouse:  "Stores - PT ZENIT",
						Qty:        15,
						StockQty:   15,
						UOM:        "Nos",
						WorkOrder:  "MFG-WO-2026-00001",
					},
					{
						ItemCode:   "SP-CMP-001",
						ItemName:   "Bearing 6204",
						Warehouse:  "Stores - PT ZENIT",
						Qty:        8,
						StockQty:   8,
						UOM:        "Nos",
						WorkOrder:  "MFG-WO-2026-00001",
					},
				},
			},
		}
	} else {
		results = []PendingReference{
			{
				DocumentType: "Material Request",
				DocumentNo:   "MAT-MR-2026-00001",
				Date:         time.Now().Format("2006-01-02"),
				Status:       "Pending",
				Items: []stockmodel.PickListItem{
					{
						ItemCode:            "RAW-MTL-001",
						ItemName:            "Raw Material Steel Plate",
						Warehouse:           "Stores - PT ZENIT",
						Qty:                 10,
						StockQty:            10,
						UOM:                 "Nos",
						MaterialRequest:     "MAT-MR-2026-00001",
						MaterialRequestItem: "MAT-MR-2026-00001-1",
					},
				},
			},
		}
	}

	ctx.JSON(http.StatusOK, gin.H{"data": results})
}
