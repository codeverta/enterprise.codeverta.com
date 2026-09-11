package controller

import (
	"errors"
	"fmt"
	"math"
	"net/http"
	"strings"
	"time"

	buyingmodel "gin-template/modules/buying/model"
	sellingmodel "gin-template/modules/selling/model"
	stockmodel "gin-template/modules/stock/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type PurchaseReceiptController struct{}

func NewPurchaseReceiptController() *PurchaseReceiptController {
	return &PurchaseReceiptController{}
}

func calculatePurchaseReceiptTotals(pr *stockmodel.PurchaseReceipt) {
	var totalQty float64
	var subtotal float64

	for i := range pr.Items {
		pr.Items[i].Idx = i + 1
		pr.Items[i].Amount = pr.Items[i].AcceptedQuantity * pr.Items[i].Rate
		totalQty += pr.Items[i].AcceptedQuantity + pr.Items[i].RejectedQuantity
		subtotal += pr.Items[i].Amount
	}

	pr.TotalQty = totalQty
	pr.Total = subtotal

	var taxTotalAdded float64
	var taxTotalDeducted float64
	for i := range pr.Taxes {
		pr.Taxes[i].Idx = i + 1
		if pr.Taxes[i].TaxRate > 0 && pr.Taxes[i].Amount == 0 {
			pr.Taxes[i].Amount = (subtotal * pr.Taxes[i].TaxRate) / 100.0
		}
		pr.Taxes[i].NetAmount = subtotal
		pr.Taxes[i].Total = subtotal + pr.Taxes[i].Amount
		if strings.EqualFold(pr.Taxes[i].Type, "Deduction") {
			taxTotalDeducted += pr.Taxes[i].Amount
		} else {
			taxTotalAdded += pr.Taxes[i].Amount
		}
	}

	pr.BaseTaxesAndChargesAdded = taxTotalAdded
	pr.TaxesAndChargesAdded = taxTotalAdded
	pr.BaseTaxesAndChargesDeducted = taxTotalDeducted
	pr.TaxesAndChargesDeducted = taxTotalDeducted

	netTax := taxTotalAdded - taxTotalDeducted
	pr.BaseTotalTaxesAndCharges = netTax
	pr.TotalTaxesAndCharges = netTax

	grandTotal := subtotal + netTax
	if pr.AdditionalDiscountPercentage > 0 {
		pr.DiscountAmount = (grandTotal * pr.AdditionalDiscountPercentage) / 100.0
	}
	grandTotal -= pr.DiscountAmount
	if grandTotal < 0 {
		grandTotal = 0
	}

	pr.GrandTotal = grandTotal
	if pr.DisableRoundedTotal {
		pr.RoundingAdjustment = 0
		pr.RoundedTotal = grandTotal
	} else {
		rounded := math.Round(grandTotal)
		pr.RoundingAdjustment = rounded - grandTotal
		pr.RoundedTotal = rounded
	}
}

func (ctrl *PurchaseReceiptController) List(ctx *gin.Context) {
	db, tenant := stockDB(ctx), stockTenant(ctx)
	var receipts []stockmodel.PurchaseReceipt
	query := db.Preload("Items").Preload("Taxes").Preload("SuppliedItems").
		Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant)

	if status := strings.TrimSpace(ctx.Query("status")); status != "" {
		query = query.Where("status = ?", status)
	}
	if supplier := strings.TrimSpace(ctx.Query("supplier")); supplier != "" {
		query = query.Where("supplier = ?", supplier)
	}
	if company := strings.TrimSpace(ctx.Query("company")); company != "" {
		query = query.Where("company = ?", company)
	}
	if search := strings.TrimSpace(ctx.Query("q")); search != "" {
		like := "%" + search + "%"
		query = query.Where("number LIKE ? OR supplier LIKE ? OR supplier_delivery_note LIKE ? OR company LIKE ?", like, like, like, like)
	}

	if err := query.Order("created_at desc").Find(&receipts).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil daftar Purchase Receipt"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": receipts})
}

func (ctrl *PurchaseReceiptController) Get(ctx *gin.Context) {
	db, tenant, id := stockDB(ctx), stockTenant(ctx), ctx.Param("id")
	var pr stockmodel.PurchaseReceipt
	if err := db.Preload("Items").Preload("Taxes").Preload("SuppliedItems").
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND (id = ? OR number = ?)", tenant, id, id).
		First(&pr).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "Purchase Receipt tidak ditemukan"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil detail Purchase Receipt"})
		return
	}
	ctx.JSON(http.StatusOK, pr)
}

func (ctrl *PurchaseReceiptController) Create(ctx *gin.Context) {
	var input stockmodel.PurchaseReceipt
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Data Purchase Receipt tidak valid"})
		return
	}

	db, tenant := stockDB(ctx), stockTenant(ctx)
	now := time.Now()

	input.ID = "pr-" + uuid.NewString()[:8]
	input.TenantID = tenant
	year := now.Format("2006")
	if input.Number == "" {
		if input.IsReturn {
			input.Number = fmt.Sprintf("MAT-PR-RET-%s-%05d", year, now.UnixNano()%100000)
		} else {
			input.Number = fmt.Sprintf("MAT-PRE-%s-%05d", year, now.UnixNano()%100000)
		}
	}
	if input.NamingSeries == "" {
		if input.IsReturn {
			input.NamingSeries = "MAT-PR-RET-.YYYY.-"
		} else {
			input.NamingSeries = "MAT-PRE-.YYYY.-"
		}
	}
	if input.Status == "" {
		input.Status = stockmodel.PurchaseReceiptStatusDraft
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
		input.Items[i].ID = "pri-" + uuid.NewString()[:8]
		input.Items[i].PurchaseReceiptID = input.ID
		if input.Items[i].AcceptedWarehouse == "" && input.SetWarehouse != "" {
			input.Items[i].AcceptedWarehouse = input.SetWarehouse
		}
		if input.Items[i].RejectedWarehouse == "" && input.RejectedWarehouse != "" {
			input.Items[i].RejectedWarehouse = input.RejectedWarehouse
		}
	}

	for i := range input.Taxes {
		input.Taxes[i].ID = "prt-" + uuid.NewString()[:8]
		input.Taxes[i].PurchaseReceiptID = input.ID
	}

	for i := range input.SuppliedItems {
		input.SuppliedItems[i].ID = "prsi-" + uuid.NewString()[:8]
		input.SuppliedItems[i].PurchaseReceiptID = input.ID
	}

	calculatePurchaseReceiptTotals(&input)

	if err := db.Create(&input).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat Purchase Receipt: " + err.Error()})
		return
	}
	ctx.JSON(http.StatusCreated, input)
}

func (ctrl *PurchaseReceiptController) Update(ctx *gin.Context) {
	id := ctx.Param("id")
	var input stockmodel.PurchaseReceipt
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Data Purchase Receipt tidak valid"})
		return
	}

	db, tenant := stockDB(ctx), stockTenant(ctx)
	var existing stockmodel.PurchaseReceipt
	if err := db.Preload("Items").Preload("Taxes").Preload("SuppliedItems").
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).
		First(&existing).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Purchase Receipt tidak ditemukan"})
		return
	}
	if existing.Status != stockmodel.PurchaseReceiptStatusDraft {
		ctx.JSON(http.StatusConflict, gin.H{"error": "Hanya Purchase Receipt Draft yang dapat diedit"})
		return
	}

	existing.Supplier = input.Supplier
	existing.SupplierDeliveryNote = input.SupplierDeliveryNote
	existing.PostingDate = input.PostingDate
	existing.PostingTime = input.PostingTime
	existing.SetPostingTime = input.SetPostingTime
	existing.Company = input.Company
	existing.ApplyPutawayRule = input.ApplyPutawayRule
	existing.IsReturn = input.IsReturn
	existing.ReturnAgainstID = input.ReturnAgainstID
	existing.CostCenter = input.CostCenter
	existing.Project = input.Project
	existing.Currency = input.Currency
	existing.BuyingPriceList = input.BuyingPriceList
	existing.IgnorePricingRule = input.IgnorePricingRule
	existing.ScanBarcode = input.ScanBarcode
	existing.SetWarehouse = input.SetWarehouse
	existing.RejectedWarehouse = input.RejectedWarehouse
	existing.IsSubcontracted = input.IsSubcontracted
	existing.TaxCategory = input.TaxCategory
	existing.TaxesAndCharges = input.TaxesAndCharges
	existing.ShippingRule = input.ShippingRule
	existing.Incoterm = input.Incoterm
	existing.ApplyDiscountOn = input.ApplyDiscountOn
	existing.AdditionalDiscountPercentage = input.AdditionalDiscountPercentage
	existing.DiscountAmount = input.DiscountAmount
	existing.DisableRoundedTotal = input.DisableRoundedTotal
	existing.Remarks = input.Remarks
	existing.UpdatedAt = time.Now()

	for i := range input.Items {
		if input.Items[i].ID == "" {
			input.Items[i].ID = "pri-" + uuid.NewString()[:8]
		}
		input.Items[i].PurchaseReceiptID = existing.ID
		if input.Items[i].AcceptedWarehouse == "" && existing.SetWarehouse != "" {
			input.Items[i].AcceptedWarehouse = existing.SetWarehouse
		}
		if input.Items[i].RejectedWarehouse == "" && existing.RejectedWarehouse != "" {
			input.Items[i].RejectedWarehouse = existing.RejectedWarehouse
		}
	}
	existing.Items = input.Items

	for i := range input.Taxes {
		if input.Taxes[i].ID == "" {
			input.Taxes[i].ID = "prt-" + uuid.NewString()[:8]
		}
		input.Taxes[i].PurchaseReceiptID = existing.ID
	}
	existing.Taxes = input.Taxes

	for i := range input.SuppliedItems {
		if input.SuppliedItems[i].ID == "" {
			input.SuppliedItems[i].ID = "prsi-" + uuid.NewString()[:8]
		}
		input.SuppliedItems[i].PurchaseReceiptID = existing.ID
	}
	existing.SuppliedItems = input.SuppliedItems

	calculatePurchaseReceiptTotals(&existing)

	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("purchase_receipt_id = ?", existing.ID).Delete(&stockmodel.PurchaseReceiptItem{}).Error; err != nil {
			return err
		}
		if err := tx.Where("purchase_receipt_id = ?", existing.ID).Delete(&stockmodel.PurchaseReceiptTax{}).Error; err != nil {
			return err
		}
		if err := tx.Where("purchase_receipt_id = ?", existing.ID).Delete(&stockmodel.PurchaseReceiptSuppliedItem{}).Error; err != nil {
			return err
		}

		if len(existing.Items) > 0 {
			if err := tx.Create(&existing.Items).Error; err != nil {
				return err
			}
		}
		if len(existing.Taxes) > 0 {
			if err := tx.Create(&existing.Taxes).Error; err != nil {
				return err
			}
		}
		if len(existing.SuppliedItems) > 0 {
			if err := tx.Create(&existing.SuppliedItems).Error; err != nil {
				return err
			}
		}
		return tx.Save(&existing).Error
	})

	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui Purchase Receipt: " + err.Error()})
		return
	}

	db.Preload("Items").Preload("Taxes").Preload("SuppliedItems").First(&existing, "id = ?", existing.ID)
	ctx.JSON(http.StatusOK, existing)
}

func (ctrl *PurchaseReceiptController) Submit(ctx *gin.Context) {
	db, tenant, id := stockDB(ctx), stockTenant(ctx), ctx.Param("id")
	var pr stockmodel.PurchaseReceipt
	if err := db.Preload("Items").Preload("Taxes").Preload("SuppliedItems").
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).
		First(&pr).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Purchase Receipt tidak ditemukan"})
		return
	}
	if pr.Status == stockmodel.PurchaseReceiptStatusSubmitted {
		ctx.JSON(http.StatusOK, pr)
		return
	}
	if pr.Status != stockmodel.PurchaseReceiptStatusDraft || len(pr.Items) == 0 {
		ctx.JSON(http.StatusConflict, gin.H{"error": "Purchase Receipt tidak dapat disubmit. Pastikan berstatus Draft dan memiliki minimal satu item."})
		return
	}

	for _, item := range pr.Items {
		wh := item.AcceptedWarehouse
		if wh == "" {
			wh = pr.SetWarehouse
		}
		if wh == "" && item.AcceptedQuantity > 0 {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Accepted Warehouse wajib diisi untuk item %s", item.ItemCode)})
			return
		}
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		pr.Status = stockmodel.PurchaseReceiptStatusSubmitted
		pr.UpdatedAt = now
		if err := tx.Save(&pr).Error; err != nil {
			return err
		}

		voucherType := "Purchase Receipt"
		sign := 1.0 // Normal Receipt: +Stock
		if pr.IsReturn {
			voucherType = "Purchase Receipt Return"
			sign = -1.0 // Return: -Stock
		}

		for _, item := range pr.Items {
			wh := item.AcceptedWarehouse
			if wh == "" {
				wh = pr.SetWarehouse
			}

			if wh != "" && item.AcceptedQuantity > 0 {
				sle := stockmodel.StockLedgerEntry{
					ID:              "sle-" + uuid.NewString()[:8],
					TenantID:        tenant,
					PostingDate:     pr.PostingDate,
					VoucherType:     voucherType,
					VoucherID:       pr.ID,
					VoucherNumber:   pr.Number,
					VoucherDetailID: item.ID + "-acc",
					ItemCode:        item.ItemCode,
					Warehouse:       wh,
					ActualQty:       sign * item.AcceptedQuantity,
					CreatedAt:       now,
				}
				if err := tx.Create(&sle).Error; err != nil {
					return err
				}
			}

			// Rejected Warehouse
			rejWh := item.RejectedWarehouse
			if rejWh == "" {
				rejWh = pr.RejectedWarehouse
			}
			if rejWh != "" && item.RejectedQuantity > 0 {
				sle := stockmodel.StockLedgerEntry{
					ID:              "sle-" + uuid.NewString()[:8],
					TenantID:        tenant,
					PostingDate:     pr.PostingDate,
					VoucherType:     voucherType,
					VoucherID:       pr.ID,
					VoucherNumber:   pr.Number,
					VoucherDetailID: item.ID + "-rej",
					ItemCode:        item.ItemCode,
					Warehouse:       rejWh,
					ActualQty:       sign * item.RejectedQuantity,
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
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal submit Purchase Receipt: " + err.Error()})
		return
	}

	db.Preload("Items").Preload("Taxes").Preload("SuppliedItems").First(&pr, "id = ?", pr.ID)
	ctx.JSON(http.StatusOK, pr)
}

func (ctrl *PurchaseReceiptController) Cancel(ctx *gin.Context) {
	db, tenant, id := stockDB(ctx), stockTenant(ctx), ctx.Param("id")
	var pr stockmodel.PurchaseReceipt
	if err := db.Preload("Items").Preload("Taxes").Preload("SuppliedItems").
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).
		First(&pr).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Purchase Receipt tidak ditemukan"})
		return
	}
	if pr.Status != stockmodel.PurchaseReceiptStatusSubmitted {
		ctx.JSON(http.StatusConflict, gin.H{"error": "Hanya Purchase Receipt Submitted yang dapat dibatalkan"})
		return
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		pr.Status = stockmodel.PurchaseReceiptStatusCancelled
		pr.UpdatedAt = now
		if err := tx.Save(&pr).Error; err != nil {
			return err
		}

		revSign := -1.0
		if pr.IsReturn {
			revSign = 1.0
		}

		for _, item := range pr.Items {
			wh := item.AcceptedWarehouse
			if wh == "" {
				wh = pr.SetWarehouse
			}

			if wh != "" && item.AcceptedQuantity > 0 {
				sle := stockmodel.StockLedgerEntry{
					ID:              "sle-" + uuid.NewString()[:8],
					TenantID:        tenant,
					PostingDate:     now,
					VoucherType:     "Purchase Receipt Cancel",
					VoucherID:       pr.ID,
					VoucherNumber:   pr.Number,
					VoucherDetailID: item.ID + "-acc-rev",
					ItemCode:        item.ItemCode,
					Warehouse:       wh,
					ActualQty:       revSign * item.AcceptedQuantity,
					CreatedAt:       now,
				}
				if err := tx.Create(&sle).Error; err != nil {
					return err
				}
			}

			rejWh := item.RejectedWarehouse
			if rejWh == "" {
				rejWh = pr.RejectedWarehouse
			}
			if rejWh != "" && item.RejectedQuantity > 0 {
				sle := stockmodel.StockLedgerEntry{
					ID:              "sle-" + uuid.NewString()[:8],
					TenantID:        tenant,
					PostingDate:     now,
					VoucherType:     "Purchase Receipt Cancel",
					VoucherID:       pr.ID,
					VoucherNumber:   pr.Number,
					VoucherDetailID: item.ID + "-rej-rev",
					ItemCode:        item.ItemCode,
					Warehouse:       rejWh,
					ActualQty:       revSign * item.RejectedQuantity,
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
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membatalkan Purchase Receipt: " + err.Error()})
		return
	}

	db.Preload("Items").Preload("Taxes").Preload("SuppliedItems").First(&pr, "id = ?", pr.ID)
	ctx.JSON(http.StatusOK, pr)
}

func (ctrl *PurchaseReceiptController) Delete(ctx *gin.Context) {
	db, tenant, id := stockDB(ctx), stockTenant(ctx), ctx.Param("id")
	var pr stockmodel.PurchaseReceipt
	if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).First(&pr).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Purchase Receipt tidak ditemukan"})
		return
	}
	if pr.Status != stockmodel.PurchaseReceiptStatusDraft {
		ctx.JSON(http.StatusConflict, gin.H{"error": "Hanya Purchase Receipt Draft yang dapat dihapus"})
		return
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		_ = tx.Where("purchase_receipt_id = ?", pr.ID).Delete(&stockmodel.PurchaseReceiptItem{}).Error
		_ = tx.Where("purchase_receipt_id = ?", pr.ID).Delete(&stockmodel.PurchaseReceiptTax{}).Error
		_ = tx.Where("purchase_receipt_id = ?", pr.ID).Delete(&stockmodel.PurchaseReceiptSuppliedItem{}).Error
		return tx.Delete(&pr).Error
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus Purchase Receipt: " + err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "Purchase Receipt berhasil dihapus"})
}

func (ctrl *PurchaseReceiptController) Options(ctx *gin.Context) {
	db, tenant := stockDB(ctx), stockTenant(ctx)

	// Fetch leaf warehouses
	var warehouses []stockmodel.Warehouse
	_ = db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND is_group = ?", tenant, false).
		Order("warehouse_name asc").
		Find(&warehouses).Error

	warehouseNames := make([]string, 0, len(warehouses))
	for _, w := range warehouses {
		warehouseNames = append(warehouseNames, w.WarehouseName)
	}

	// Fetch suppliers
	var suppliers []buyingmodel.Supplier
	_ = db.Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant).
		Order("supplier_name asc").
		Find(&suppliers).Error

	supplierNames := make([]string, 0, len(suppliers))
	for _, s := range suppliers {
		supplierNames = append(supplierNames, s.SupplierName)
	}
	if len(supplierNames) == 0 {
		supplierNames = []string{
			"PT Mitra Logam Abadi",
			"PT Elektronika Komponen Indonesia",
			"CV Aneka Sparepart Makmur",
			"PT Global Baja Presisi",
		}
	}

	// Fetch items
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

	ctx.JSON(http.StatusOK, gin.H{
		"naming_series": []string{
			"MAT-PRE-.YYYY.-",
			"MAT-PR-RET-.YYYY.-",
		},
		"companies": []string{
			"",
			"PT Codeverta Enterprise",
		},
		"suppliers":        supplierNames,
		"warehouses":       warehouseNames,
		"currencies":       []string{"IDR", "USD", "SGD", "EUR"},
		"price_lists":      []string{"Standard Buying", "Local Supplier Rate"},
		"tax_categories":   []string{"In State", "Out of State", "Import"},
		"taxes_templates":  []string{"PPN 11%", "PPN 12%", "Exempt Tax"},
		"shipping_rules":   []string{"Standard Delivery", "Express Delivery", "Vendor Trucking"},
		"incoterms":        []string{"EXW", "FOB", "CIF", "DDP", "CFR"},
		"items":            itemOptions,
	})
}
