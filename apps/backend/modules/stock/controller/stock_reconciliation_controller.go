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

type StockReconciliationController struct{}

func NewStockReconciliationController() *StockReconciliationController {
	return &StockReconciliationController{}
}

func calculateStockReconciliationTotals(reco *stockmodel.StockReconciliation) {
	var totalQty float64
	var totalAmount float64
	for i := range reco.Items {
		reco.Items[i].Idx = i + 1
		reco.Items[i].Amount = reco.Items[i].Qty * reco.Items[i].ValuationRate
		totalQty += reco.Items[i].Qty
		totalAmount += reco.Items[i].Amount
	}
	reco.TotalQty = totalQty
	reco.TotalAmount = totalAmount
}

func (ctrl *StockReconciliationController) List(ctx *gin.Context) {
	db, tenant := stockDB(ctx), stockTenant(ctx)
	var reconciliations []stockmodel.StockReconciliation
	query := db.Preload("Items").Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant)

	if status := strings.TrimSpace(ctx.Query("status")); status != "" {
		query = query.Where("status = ?", status)
	}
	if purpose := strings.TrimSpace(ctx.Query("purpose")); purpose != "" {
		query = query.Where("purpose = ?", purpose)
	}
	if company := strings.TrimSpace(ctx.Query("company")); company != "" {
		query = query.Where("company = ?", company)
	}
	if search := strings.TrimSpace(ctx.Query("q")); search != "" {
		like := "%" + search + "%"
		query = query.Where("reconciliation_number LIKE ? OR company LIKE ? OR purpose LIKE ? OR remarks LIKE ?", like, like, like, like)
	}

	if err := query.Order("created_at desc").Find(&reconciliations).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil daftar Stock Reconciliation"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": reconciliations})
}

func (ctrl *StockReconciliationController) Get(ctx *gin.Context) {
	db, tenant, id := stockDB(ctx), stockTenant(ctx), ctx.Param("id")
	var reco stockmodel.StockReconciliation
	if err := db.Preload("Items").
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND (id = ? OR reconciliation_number = ?)", tenant, id, id).
		First(&reco).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "Stock Reconciliation tidak ditemukan"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil detail Stock Reconciliation"})
		return
	}
	ctx.JSON(http.StatusOK, reco)
}

func (ctrl *StockReconciliationController) Create(ctx *gin.Context) {
	var input stockmodel.StockReconciliation
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Data Stock Reconciliation tidak valid: " + err.Error()})
		return
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

	if input.Series == "" {
		input.Series = "MAT-RECO-.YYYY.-"
	}
	if input.Purpose == "" {
		input.Purpose = "Stock Reconciliation"
	}

	input.ID = "reco-" + uuid.NewString()[:8]
	input.TenantID = tenant
	input.Status = "Draft"
	if input.PostingDate.IsZero() {
		input.PostingDate = now
	}
	if input.PostingTime == "" {
		input.PostingTime = now.Format("15:04:05")
	}

	prefix := fmt.Sprintf("MAT-RECO-%d-", input.PostingDate.Year())
	var last stockmodel.StockReconciliation
	var seq int64 = 1
	if err := db.Where("tenant_id = ? AND reconciliation_number LIKE ?", tenant, prefix+"%").
		Order("reconciliation_number desc").First(&last).Error; err == nil {
		var existingSeq int64
		if _, scanErr := fmt.Sscanf(last.ReconciliationNumber, prefix+"%d", &existingSeq); scanErr == nil {
			seq = existingSeq + 1
		}
	}
	input.ReconciliationNumber = fmt.Sprintf("%s%05d", prefix, seq)
	input.CreatedAt = now
	input.UpdatedAt = now

	for i := range input.Items {
		input.Items[i].ID = "recoi-" + uuid.NewString()[:8]
		input.Items[i].StockReconciliationID = input.ID
		input.Items[i].TenantID = tenant
		if input.Items[i].Warehouse == "" && input.DefaultWarehouse != "" {
			input.Items[i].Warehouse = input.DefaultWarehouse
		}
		if input.Items[i].UOM == "" {
			input.Items[i].UOM = "Nos"
		}
		input.Items[i].CreatedAt = now
		input.Items[i].UpdatedAt = now
	}

	calculateStockReconciliationTotals(&input)

	err := db.Transaction(func(tx *gorm.DB) error {
		return tx.Create(&input).Error
	})

	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat Stock Reconciliation: " + err.Error()})
		return
	}

	db.Preload("Items").First(&input, "id = ?", input.ID)
	ctx.JSON(http.StatusCreated, input)
}

func (ctrl *StockReconciliationController) Update(ctx *gin.Context) {
	db, tenant, id := stockDB(ctx), stockTenant(ctx), ctx.Param("id")
	var existing stockmodel.StockReconciliation
	if err := db.Preload("Items").
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).
		First(&existing).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Stock Reconciliation tidak ditemukan"})
		return
	}

	if existing.Status != "Draft" {
		ctx.JSON(http.StatusConflict, gin.H{"error": "Hanya Stock Reconciliation berstatus Draft yang dapat diubah"})
		return
	}

	var input stockmodel.StockReconciliation
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Data Stock Reconciliation tidak valid: " + err.Error()})
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

	existing.Purpose = input.Purpose
	existing.CompanyID = input.CompanyID
	existing.Company = input.Company
	existing.Series = input.Series
	existing.PostingDate = input.PostingDate
	existing.PostingTime = input.PostingTime
	existing.SetPostingTime = input.SetPostingTime
	existing.DefaultWarehouse = input.DefaultWarehouse
	existing.ScanBarcode = input.ScanBarcode
	existing.ScanMode = input.ScanMode
	existing.ExpenseAccount = input.ExpenseAccount
	existing.CostCenter = input.CostCenter
	existing.Remarks = input.Remarks
	existing.UpdatedAt = time.Now()

	for i := range input.Items {
		if input.Items[i].ID == "" {
			input.Items[i].ID = "recoi-" + uuid.NewString()[:8]
		}
		input.Items[i].StockReconciliationID = existing.ID
		input.Items[i].TenantID = tenant
		if input.Items[i].Warehouse == "" && existing.DefaultWarehouse != "" {
			input.Items[i].Warehouse = existing.DefaultWarehouse
		}
		if input.Items[i].UOM == "" {
			input.Items[i].UOM = "Nos"
		}
		input.Items[i].CreatedAt = existing.CreatedAt
		input.Items[i].UpdatedAt = existing.UpdatedAt
	}
	existing.Items = input.Items
	calculateStockReconciliationTotals(&existing)

	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("stock_reconciliation_id = ?", existing.ID).Delete(&stockmodel.StockReconciliationItem{}).Error; err != nil {
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
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui Stock Reconciliation: " + err.Error()})
		return
	}

	db.Preload("Items").First(&existing, "id = ?", existing.ID)
	ctx.JSON(http.StatusOK, existing)
}

func (ctrl *StockReconciliationController) Submit(ctx *gin.Context) {
	db, tenant, id := stockDB(ctx), stockTenant(ctx), ctx.Param("id")
	var reco stockmodel.StockReconciliation
	if err := db.Preload("Items").
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).
		First(&reco).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Stock Reconciliation tidak ditemukan"})
		return
	}

	if reco.Status != "Draft" {
		ctx.JSON(http.StatusConflict, gin.H{"error": "Hanya Stock Reconciliation Draft yang dapat di-submit"})
		return
	}

	if len(reco.Items) == 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Wajib memiliki minimal satu item untuk di-reconcile"})
		return
	}

	for _, item := range reco.Items {
		wh := item.Warehouse
		if wh == "" {
			wh = reco.DefaultWarehouse
		}
		if wh == "" {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Warehouse wajib diisi untuk item %s", item.ItemCode)})
			return
		}
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		reco.Status = "Submitted"
		reco.UpdatedAt = now
		if err := tx.Save(&reco).Error; err != nil {
			return err
		}

		voucherType := "Stock Reconciliation"
		for _, item := range reco.Items {
			wh := item.Warehouse
			if wh == "" {
				wh = reco.DefaultWarehouse
			}

			// Compute current balance in that warehouse up to this point
			type balanceRes struct {
				CurrentQty float64
			}
			var res balanceRes
			_ = tx.Model(&stockmodel.StockLedgerEntry{}).
				Select("COALESCE(SUM(actual_qty), 0) as current_qty").
				Where("tenant_id = ? AND item_code = ? AND warehouse = ?", tenant, item.ItemCode, wh).
				Scan(&res).Error

			diffQty := item.Qty - res.CurrentQty
			if diffQty != 0 {
				sle := stockmodel.StockLedgerEntry{
					ID:              "sle-" + uuid.NewString()[:8],
					TenantID:        tenant,
					PostingDate:     reco.PostingDate,
					VoucherType:     voucherType,
					VoucherID:       reco.ID,
					VoucherNumber:   reco.ReconciliationNumber,
					VoucherDetailID: item.ID + "-reco",
					ItemCode:        item.ItemCode,
					Warehouse:       wh,
					ActualQty:       diffQty,
					ValuationRate:   item.ValuationRate,
					StockValue:      item.Qty * item.ValuationRate,
					Company:         reco.Company,
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
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal submit Stock Reconciliation: " + err.Error()})
		return
	}

	db.Preload("Items").First(&reco, "id = ?", reco.ID)
	ctx.JSON(http.StatusOK, reco)
}

func (ctrl *StockReconciliationController) Cancel(ctx *gin.Context) {
	db, tenant, id := stockDB(ctx), stockTenant(ctx), ctx.Param("id")
	var reco stockmodel.StockReconciliation
	if err := db.Preload("Items").
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).
		First(&reco).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Stock Reconciliation tidak ditemukan"})
		return
	}

	if reco.Status != "Submitted" {
		ctx.JSON(http.StatusConflict, gin.H{"error": "Hanya Stock Reconciliation Submitted yang dapat dibatalkan"})
		return
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		reco.Status = "Cancelled"
		reco.UpdatedAt = now
		if err := tx.Save(&reco).Error; err != nil {
			return err
		}

		// Find SLEs created by this Stock Reconciliation and reverse them
		var sles []stockmodel.StockLedgerEntry
		if err := tx.Where("tenant_id = ? AND voucher_id = ? AND voucher_type = ?", tenant, reco.ID, "Stock Reconciliation").
			Find(&sles).Error; err != nil {
			return err
		}

		for _, sle := range sles {
			rev := stockmodel.StockLedgerEntry{
				ID:              "sle-" + uuid.NewString()[:8],
				TenantID:        tenant,
				PostingDate:     now,
				VoucherType:     "Stock Reconciliation Cancel",
				VoucherID:       reco.ID,
				VoucherNumber:   reco.ReconciliationNumber,
				VoucherDetailID: sle.ID + "-rev",
				ItemCode:        sle.ItemCode,
				Warehouse:       sle.Warehouse,
				ActualQty:       -sle.ActualQty,
				ValuationRate:   sle.ValuationRate,
				Company:         sle.Company,
				CreatedAt:       now,
			}
			if err := tx.Create(&rev).Error; err != nil {
				return err
			}
		}
		return nil
	})

	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membatalkan Stock Reconciliation: " + err.Error()})
		return
	}

	db.Preload("Items").First(&reco, "id = ?", reco.ID)
	ctx.JSON(http.StatusOK, reco)
}

func (ctrl *StockReconciliationController) Delete(ctx *gin.Context) {
	db, tenant, id := stockDB(ctx), stockTenant(ctx), ctx.Param("id")
	var reco stockmodel.StockReconciliation
	if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).First(&reco).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Stock Reconciliation tidak ditemukan"})
		return
	}
	if reco.Status != "Draft" {
		ctx.JSON(http.StatusConflict, gin.H{"error": "Hanya Stock Reconciliation Draft yang dapat dihapus"})
		return
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("stock_reconciliation_id = ?", reco.ID).Delete(&stockmodel.StockReconciliationItem{}).Error; err != nil {
			return err
		}
		return tx.Delete(&reco).Error
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus Stock Reconciliation: " + err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "Stock Reconciliation berhasil dihapus"})
}

type StockReconciliationItemOption struct {
	ItemCode      string  `json:"item_code"`
	ItemName      string  `json:"item_name"`
	UOM           string  `json:"stock_uom"`
	ValuationRate float64 `json:"valuation_rate"`
	Barcode       string  `json:"barcode"`
	Description   string  `json:"description"`
}

func (ctrl *StockReconciliationController) Options(ctx *gin.Context) {
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

	itemOptions := make([]StockReconciliationItemOption, 0, len(items))
	for _, itm := range items {
		barcode := ""
		if len(itm.Barcodes) > 0 {
			barcode = itm.Barcodes[0].Barcode
		}
		uom := "Nos"
		if len(itm.UOMs) > 0 && itm.UOMs[0].UOM != "" {
			uom = itm.UOMs[0].UOM
		} else if itm.StockUOM != "" {
			uom = itm.StockUOM
		}
		rate := priceMap[itm.ItemCode]
		if rate == 0 && itm.ValuationRate > 0 {
			rate = itm.ValuationRate
		}
		itemOptions = append(itemOptions, StockReconciliationItemOption{
			ItemCode:      itm.ItemCode,
			ItemName:      itm.ItemName,
			UOM:           uom,
			ValuationRate: rate,
			Barcode:       barcode,
			Description:   itm.Description,
		})
	}

	var dbCompanies []coremodel.Company
	_ = db.Order("name asc").Find(&dbCompanies)

	companyNames := make([]string, 0, len(dbCompanies))
	for _, c := range dbCompanies {
		companyNames = append(companyNames, c.Name)
	}

	// Difference accounts / Expense accounts
	expenseAccounts := []string{
		"5111 - Stock Adjustment - Expense",
		"5112 - Cost of Goods Sold",
		"5110 - Miscellaneous Expenses",
		"5113 - Inventory Write-off",
	}

	// Cost centers
	costCenters := []string{
		"Main - MC",
		"Main - PZTS",
		"Operations",
		"Warehouse & Logistics",
		"Sales & Marketing",
	}

	ctx.JSON(http.StatusOK, gin.H{
		"naming_series": []string{
			"MAT-RECO-.YYYY.-",
		},
		"purposes": []string{
			"Stock Reconciliation",
			"Opening Stock",
		},
		"companies":        companyNames,
		"warehouses":       warehouseNames,
		"items":            itemOptions,
		"expense_accounts": expenseAccounts,
		"cost_centers":     costCenters,
	})
}
