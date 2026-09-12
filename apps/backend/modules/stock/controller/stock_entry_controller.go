package controller

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	coremodel "gin-template/model"
	buyingmodel "gin-template/modules/buying/model"
	sellingmodel "gin-template/modules/selling/model"
	stockmodel "gin-template/modules/stock/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type StockEntryController struct{}

func NewStockEntryController() *StockEntryController {
	return &StockEntryController{}
}

func calculateStockEntryTotals(entry *stockmodel.StockEntry) {
	var totalQty float64
	var totalAmount float64
	for i := range entry.Items {
		entry.Items[i].Idx = i + 1
		if entry.Items[i].ConversionFactor <= 0 {
			entry.Items[i].ConversionFactor = 1
		}
		entry.Items[i].TransferQty = entry.Items[i].Qty * entry.Items[i].ConversionFactor
		entry.Items[i].Amount = entry.Items[i].Qty * entry.Items[i].BasicRate
		totalQty += entry.Items[i].Qty
		totalAmount += entry.Items[i].Amount
	}
	entry.TotalQty = totalQty
	entry.TotalAmount = totalAmount
}

func (ctrl *StockEntryController) List(ctx *gin.Context) {
	db, tenant := stockDB(ctx), stockTenant(ctx)
	var entries []stockmodel.StockEntry
	query := db.Preload("Items").Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant)

	if status := strings.TrimSpace(ctx.Query("status")); status != "" {
		query = query.Where("status = ?", status)
	}
	if entryType := strings.TrimSpace(ctx.Query("stock_entry_type")); entryType != "" {
		query = query.Where("stock_entry_type = ?", entryType)
	}
	if company := strings.TrimSpace(ctx.Query("company")); company != "" {
		query = query.Where("company = ?", company)
	}
	if search := strings.TrimSpace(ctx.Query("q")); search != "" {
		like := "%" + search + "%"
		query = query.Where("stock_entry_number LIKE ? OR company LIKE ? OR purpose LIKE ? OR remarks LIKE ?", like, like, like, like)
	}

	if err := query.Order("created_at desc").Find(&entries).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil daftar Stock Entry"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": entries})
}

func (ctrl *StockEntryController) Get(ctx *gin.Context) {
	db, tenant, id := stockDB(ctx), stockTenant(ctx), ctx.Param("id")
	var entry stockmodel.StockEntry
	if err := db.Preload("Items").
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND (id = ? OR stock_entry_number = ?)", tenant, id, id).
		First(&entry).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "Stock Entry tidak ditemukan"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil detail Stock Entry"})
		return
	}
	ctx.JSON(http.StatusOK, entry)
}

func (ctrl *StockEntryController) Create(ctx *gin.Context) {
	var input stockmodel.StockEntry
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error":   fmt.Sprintf("Data Stock Entry tidak valid: %v", err),
			"details": err.Error(),
		})
		return
	}

	if strings.TrimSpace(input.Company) == "" && strings.TrimSpace(input.CompanyID) == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Company wajib diisi"})
		return
	}
	if strings.TrimSpace(input.StockEntryType) == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Stock Entry Type wajib diisi"})
		return
	}
	if len(input.Items) == 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Stock Entry wajib memiliki minimal 1 item"})
		return
	}
	for i, it := range input.Items {
		if strings.TrimSpace(it.ItemCode) == "" {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Item Code pada baris %d wajib diisi", i+1)})
			return
		}
		if it.Qty <= 0 {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Quantity pada baris %d (%s) harus lebih besar dari 0", i+1, it.ItemCode)})
			return
		}
	}

	db, tenant := stockDB(ctx), stockTenant(ctx)
	now := time.Now()

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

	input.ID = "ste-" + uuid.NewString()[:8]
	input.TenantID = tenant
	if input.StockEntryNumber == "" {
		year := now.Format("2006")
		input.StockEntryNumber = fmt.Sprintf("MAT-STE-%s-%05d", year, now.UnixNano()%100000)
	}
	if input.Series == "" {
		input.Series = "MAT-STE-.YYYY.-"
	}
	if input.Status == "" {
		input.Status = "Draft"
	}
	if input.PostingDate.IsZero() {
		input.PostingDate = now
	}
	if input.PostingTime == "" {
		input.PostingTime = now.Format("15:04:05")
	}
	input.CreatedAt = now
	input.UpdatedAt = now

	for i := range input.Items {
		input.Items[i].ID = "stei-" + uuid.NewString()[:8]
		input.Items[i].StockEntryID = input.ID
		input.Items[i].TenantID = tenant
		if input.Items[i].SourceWarehouse == "" && input.FromWarehouse != "" {
			input.Items[i].SourceWarehouse = input.FromWarehouse
		}
		if input.Items[i].TargetWarehouse == "" && input.ToWarehouse != "" {
			input.Items[i].TargetWarehouse = input.ToWarehouse
		}
		input.Items[i].CreatedAt = now
		input.Items[i].UpdatedAt = now
	}

	calculateStockEntryTotals(&input)

	if err := db.Create(&input).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat Stock Entry: " + err.Error()})
		return
	}
	ctx.JSON(http.StatusCreated, input)
}

func (ctrl *StockEntryController) Update(ctx *gin.Context) {
	id := ctx.Param("id")
	var input stockmodel.StockEntry
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error":   fmt.Sprintf("Data Stock Entry tidak valid: %v", err),
			"details": err.Error(),
		})
		return
	}

	if strings.TrimSpace(input.Company) == "" && strings.TrimSpace(input.CompanyID) == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Company wajib diisi"})
		return
	}
	if strings.TrimSpace(input.StockEntryType) == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Stock Entry Type wajib diisi"})
		return
	}
	if len(input.Items) == 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Stock Entry wajib memiliki minimal 1 item"})
		return
	}
	for i, it := range input.Items {
		if strings.TrimSpace(it.ItemCode) == "" {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Item Code pada baris %d wajib diisi", i+1)})
			return
		}
		if it.Qty <= 0 {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Quantity pada baris %d (%s) harus lebih besar dari 0", i+1, it.ItemCode)})
			return
		}
	}

	db, tenant := stockDB(ctx), stockTenant(ctx)
	var existing stockmodel.StockEntry
	if err := db.Preload("Items").
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).
		First(&existing).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Stock Entry tidak ditemukan"})
		return
	}
	if existing.Status != "Draft" {
		ctx.JSON(http.StatusConflict, gin.H{"error": "Hanya Stock Entry berstatus Draft yang dapat diedit"})
		return
	}

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

	existing.StockEntryType = input.StockEntryType
	existing.Purpose = input.Purpose
	existing.CompanyID = input.CompanyID
	existing.Company = input.Company
	existing.Series = input.Series
	existing.PostingDate = input.PostingDate
	existing.PostingTime = input.PostingTime
	existing.SetPostingTime = input.SetPostingTime
	existing.InspectionRequired = input.InspectionRequired
	existing.AddToTransit = input.AddToTransit
	existing.ApplyPutawayRule = input.ApplyPutawayRule
	existing.WorkOrder = input.WorkOrder
	existing.FromBOM = input.FromBOM
	existing.BOMNo = input.BOMNo
	existing.FromWarehouse = input.FromWarehouse
	existing.ToWarehouse = input.ToWarehouse
	existing.ScanBarcode = input.ScanBarcode
	existing.Remarks = input.Remarks
	existing.UpdatedAt = time.Now()

	for i := range input.Items {
		if input.Items[i].ID == "" {
			input.Items[i].ID = "stei-" + uuid.NewString()[:8]
		}
		input.Items[i].StockEntryID = existing.ID
		input.Items[i].TenantID = tenant
		if input.Items[i].SourceWarehouse == "" && existing.FromWarehouse != "" {
			input.Items[i].SourceWarehouse = existing.FromWarehouse
		}
		if input.Items[i].TargetWarehouse == "" && existing.ToWarehouse != "" {
			input.Items[i].TargetWarehouse = existing.ToWarehouse
		}
		input.Items[i].CreatedAt = existing.CreatedAt
		input.Items[i].UpdatedAt = existing.UpdatedAt
	}
	existing.Items = input.Items
	calculateStockEntryTotals(&existing)

	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("stock_entry_id = ?", existing.ID).Delete(&stockmodel.StockEntryItem{}).Error; err != nil {
			return err
		}
		if len(existing.Items) > 0 {
			if err := tx.Create(&existing.Items).Error; err != nil {
				return err
			}
		}
		return tx.Save(&existing).Error
	})

	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui Stock Entry: " + err.Error()})
		return
	}

	db.Preload("Items").First(&existing, "id = ?", existing.ID)
	ctx.JSON(http.StatusOK, existing)
}

func (ctrl *StockEntryController) Submit(ctx *gin.Context) {
	db, tenant, id := stockDB(ctx), stockTenant(ctx), ctx.Param("id")
	var entry stockmodel.StockEntry
	if err := db.Preload("Items").
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).
		First(&entry).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Stock Entry tidak ditemukan"})
		return
	}
	if entry.Status == "Submitted" {
		ctx.JSON(http.StatusOK, entry)
		return
	}
	if entry.Status != "Draft" || len(entry.Items) == 0 {
		ctx.JSON(http.StatusConflict, gin.H{"error": "Stock Entry tidak dapat disubmit. Pastikan berstatus Draft dan memiliki minimal satu item."})
		return
	}

	for _, item := range entry.Items {
		switch entry.StockEntryType {
		case "Material Issue":
			wh := item.SourceWarehouse
			if wh == "" {
				wh = entry.FromWarehouse
			}
			if wh == "" {
				ctx.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Source Warehouse wajib diisi untuk item %s", item.ItemCode)})
				return
			}
		case "Material Receipt":
			wh := item.TargetWarehouse
			if wh == "" {
				wh = entry.ToWarehouse
			}
			if wh == "" {
				ctx.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Target Warehouse wajib diisi untuk item %s", item.ItemCode)})
				return
			}
		case "Material Transfer", "Manufacture", "Repack":
			fromWh := item.SourceWarehouse
			if fromWh == "" {
				fromWh = entry.FromWarehouse
			}
			toWh := item.TargetWarehouse
			if toWh == "" {
				toWh = entry.ToWarehouse
			}
			if fromWh == "" || toWh == "" {
				ctx.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Source Warehouse dan Target Warehouse wajib diisi untuk item %s", item.ItemCode)})
				return
			}
		}
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		entry.Status = "Submitted"
		entry.UpdatedAt = now
		if err := tx.Save(&entry).Error; err != nil {
			return err
		}

		voucherType := "Stock Entry"
		for _, item := range entry.Items {
			fromWh := item.SourceWarehouse
			if fromWh == "" {
				fromWh = entry.FromWarehouse
			}
			toWh := item.TargetWarehouse
			if toWh == "" {
				toWh = entry.ToWarehouse
			}

			if fromWh != "" && (entry.StockEntryType == "Material Issue" || entry.StockEntryType == "Material Transfer" || entry.StockEntryType == "Manufacture" || entry.StockEntryType == "Repack") {
				sle := stockmodel.StockLedgerEntry{
					ID:              "sle-" + uuid.NewString()[:8],
					TenantID:        tenant,
					PostingDate:     entry.PostingDate,
					VoucherType:     voucherType,
					VoucherID:       entry.ID,
					VoucherNumber:   entry.StockEntryNumber,
					VoucherDetailID: item.ID + "-src",
					ItemCode:        item.ItemCode,
					Warehouse:       fromWh,
					ActualQty:       -item.Qty,
					CreatedAt:       now,
				}
				if err := tx.Create(&sle).Error; err != nil {
					return err
				}
			}

			if toWh != "" && (entry.StockEntryType == "Material Receipt" || entry.StockEntryType == "Material Transfer" || entry.StockEntryType == "Manufacture" || entry.StockEntryType == "Repack") {
				sle := stockmodel.StockLedgerEntry{
					ID:              "sle-" + uuid.NewString()[:8],
					TenantID:        tenant,
					PostingDate:     entry.PostingDate,
					VoucherType:     voucherType,
					VoucherID:       entry.ID,
					VoucherNumber:   entry.StockEntryNumber,
					VoucherDetailID: item.ID + "-tgt",
					ItemCode:        item.ItemCode,
					Warehouse:       toWh,
					ActualQty:       item.Qty,
					CreatedAt:       now,
				}
				if err := tx.Create(&sle).Error; err != nil {
					return err
				}
			}
		}
		return nil
	})

	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal submit Stock Entry: " + err.Error()})
		return
	}

	db.Preload("Items").First(&entry, "id = ?", entry.ID)
	ctx.JSON(http.StatusOK, entry)
}

func (ctrl *StockEntryController) Cancel(ctx *gin.Context) {
	db, tenant, id := stockDB(ctx), stockTenant(ctx), ctx.Param("id")
	var entry stockmodel.StockEntry
	if err := db.Preload("Items").
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).
		First(&entry).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Stock Entry tidak ditemukan"})
		return
	}
	if entry.Status != "Submitted" {
		ctx.JSON(http.StatusConflict, gin.H{"error": "Hanya Stock Entry Submitted yang dapat dibatalkan"})
		return
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		entry.Status = "Cancelled"
		entry.UpdatedAt = now
		if err := tx.Save(&entry).Error; err != nil {
			return err
		}

		for _, item := range entry.Items {
			fromWh := item.SourceWarehouse
			if fromWh == "" {
				fromWh = entry.FromWarehouse
			}
			toWh := item.TargetWarehouse
			if toWh == "" {
				toWh = entry.ToWarehouse
			}

			if fromWh != "" && (entry.StockEntryType == "Material Issue" || entry.StockEntryType == "Material Transfer" || entry.StockEntryType == "Manufacture" || entry.StockEntryType == "Repack") {
				sle := stockmodel.StockLedgerEntry{
					ID:              "sle-" + uuid.NewString()[:8],
					TenantID:        tenant,
					PostingDate:     now,
					VoucherType:     "Stock Entry Cancel",
					VoucherID:       entry.ID,
					VoucherNumber:   entry.StockEntryNumber,
					VoucherDetailID: item.ID + "-src-rev",
					ItemCode:        item.ItemCode,
					Warehouse:       fromWh,
					ActualQty:       item.Qty,
					CreatedAt:       now,
				}
				if err := tx.Create(&sle).Error; err != nil {
					return err
				}
			}

			if toWh != "" && (entry.StockEntryType == "Material Receipt" || entry.StockEntryType == "Material Transfer" || entry.StockEntryType == "Manufacture" || entry.StockEntryType == "Repack") {
				sle := stockmodel.StockLedgerEntry{
					ID:              "sle-" + uuid.NewString()[:8],
					TenantID:        tenant,
					PostingDate:     now,
					VoucherType:     "Stock Entry Cancel",
					VoucherID:       entry.ID,
					VoucherNumber:   entry.StockEntryNumber,
					VoucherDetailID: item.ID + "-tgt-rev",
					ItemCode:        item.ItemCode,
					Warehouse:       toWh,
					ActualQty:       -item.Qty,
					CreatedAt:       now,
				}
				if err := tx.Create(&sle).Error; err != nil {
					return err
				}
			}
		}
		return nil
	})

	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membatalkan Stock Entry: " + err.Error()})
		return
	}

	db.Preload("Items").First(&entry, "id = ?", entry.ID)
	ctx.JSON(http.StatusOK, entry)
}

func (ctrl *StockEntryController) Delete(ctx *gin.Context) {
	db, tenant, id := stockDB(ctx), stockTenant(ctx), ctx.Param("id")
	var entry stockmodel.StockEntry
	if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).First(&entry).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Stock Entry tidak ditemukan"})
		return
	}
	if entry.Status != "Draft" {
		ctx.JSON(http.StatusConflict, gin.H{"error": "Hanya Stock Entry Draft yang dapat dihapus"})
		return
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("stock_entry_id = ?", entry.ID).Delete(&stockmodel.StockEntryItem{}).Error; err != nil {
			return err
		}
		return tx.Delete(&entry).Error
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus Stock Entry: " + err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "Stock Entry berhasil dihapus"})
}

type StockEntryItemOption struct {
	ItemCode    string  `json:"item_code"`
	ItemName    string  `json:"item_name"`
	UOM         string  `json:"uom"`
	BasicRate   float64 `json:"basic_rate"`
	Barcode     string  `json:"barcode"`
	Description string  `json:"description"`
}

func (ctrl *StockEntryController) Options(ctx *gin.Context) {
	db, tenant := stockDB(ctx), stockTenant(ctx)

	var warehouses []stockmodel.Warehouse
	_ = db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND is_group = ?", tenant, false).
		Order("warehouse_name asc").
		Find(&warehouses).Error

	warehouseNames := make([]string, 0, len(warehouses))
	for _, w := range warehouses {
		warehouseNames = append(warehouseNames, w.WarehouseName)
	}

	var items []buyingmodel.Item
	_ = db.Preload("Barcodes").Preload("UOMs").
		Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant).
		Order("item_code asc").
		Find(&items).Error

	var itemPrices []sellingmodel.ItemPrice
	_ = db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND is_active = ?", tenant, true).
		Find(&itemPrices).Error

	priceMap := make(map[string]float64)
	for _, ip := range itemPrices {
		if ip.PriceListRate > 0 && priceMap[ip.ItemCode] == 0 {
			priceMap[ip.ItemCode] = ip.PriceListRate
		}
	}

	itemOptions := make([]StockEntryItemOption, 0, len(items))
	for _, itm := range items {
		barcode := ""
		if len(itm.Barcodes) > 0 {
			barcode = itm.Barcodes[0].Barcode
		}
		uom := "Nos"
		if len(itm.UOMs) > 0 && itm.UOMs[0].UOM != "" {
			uom = itm.UOMs[0].UOM
		}
		rate := priceMap[itm.ItemCode]
		itemOptions = append(itemOptions, StockEntryItemOption{
			ItemCode:    itm.ItemCode,
			ItemName:    itm.ItemName,
			UOM:         uom,
			BasicRate:   rate,
			Barcode:     barcode,
			Description: itm.Description,
		})
	}

	if len(itemOptions) == 0 {
		itemOptions = []StockEntryItemOption{
			{ItemCode: "RAW-MTL-001", ItemName: "Raw Material Steel Plate", UOM: "Nos", BasicRate: 150000, Barcode: "8991234001"},
			{ItemCode: "RAW-MTL-002", ItemName: "Copper Wiring 50m", UOM: "Roll", BasicRate: 320000, Barcode: "8991234002"},
			{ItemCode: "FG-PRD-001", ItemName: "Assembled Industrial Motor 5HP", UOM: "Nos", BasicRate: 4500000, Barcode: "8991234003"},
			{ItemCode: "SP-CMP-001", ItemName: "Bearing 6204", UOM: "Nos", BasicRate: 45000, Barcode: "8991234004"},
		}
	}

	if len(warehouseNames) == 0 {
		warehouseNames = []string{
			"",
			"",
			"",
			"",
		}
	}

	var entryTypes []stockmodel.StockEntryType
	db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND (disabled = ? OR disabled IS NULL)", tenant, false).
		Order("name asc").
		Find(&entryTypes)

	typeNames := make([]string, 0, len(entryTypes))
	for _, et := range entryTypes {
		typeNames = append(typeNames, et.Name)
	}
	if len(typeNames) == 0 {
		typeNames = []string{
			"Material Issue",
			"Material Receipt",
			"Material Transfer",
			"Manufacture",
			"Repack",
			"Disassemble",
			"Send to Subcontractor",
			"Material Transfer for Manufacture",
			"Material Consumption for Manufacture",
		}
	}

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

	ctx.JSON(http.StatusOK, gin.H{
		"stock_entry_types": typeNames,
		"naming_series": []string{
			"MAT-STE-.YYYY.-",
		},
		"companies":       companyNames,
		"company_options": companyOptions,
		"warehouses":      warehouseNames,
		"items":           itemOptions,
	})
}
