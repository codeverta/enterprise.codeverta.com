package controller

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"gin-template/model"
	stockmodel "gin-template/modules/stock/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type StockLedgerController struct{}

func NewStockLedgerController() *StockLedgerController {
	return &StockLedgerController{}
}

type StockLedgerRow struct {
	ID              string    `json:"id"`
	Date            time.Time `json:"date"`
	PostingDate     string    `json:"posting_date"`
	ItemCode        string    `json:"item_code"`
	ItemName        string    `json:"item_name"`
	StockUOM        string    `json:"stock_uom"`
	InQty           float64   `json:"in_qty"`
	OutQty          float64   `json:"out_qty"`
	BalanceQty      float64   `json:"balance_qty"`
	Warehouse       string    `json:"warehouse"`
	ItemGroup       string    `json:"item_group"`
	Brand           string    `json:"brand"`
	Description     string    `json:"description"`
	IncomingRate    float64   `json:"incoming_rate"`
	ValuationRate   float64   `json:"valuation_rate"`
	BalanceValue    float64   `json:"balance_value"`
	VoucherType     string    `json:"voucher_type"`
	VoucherNumber   string    `json:"voucher_number"`
	VoucherID       string    `json:"voucher_id"`
	VoucherDetailID string    `json:"voucher_detail_id"`
	BatchNo         string    `json:"batch_no"`
	SerialNo        string    `json:"serial_no"`
	Company         string    `json:"company"`
	Project         string    `json:"project"`
}

// syncMissingSLEs ensures any submitted StockEntry, PurchaseReceipt, or DeliveryNote has SLEs
func (ctrl *StockLedgerController) syncMissingSLEs(db *gorm.DB, tenant string) {
	// 1. Check submitted StockEntries
	var stockEntries []stockmodel.StockEntry
	_ = db.Preload("Items").Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND status = ?", tenant, "Submitted").Find(&stockEntries).Error
	for _, se := range stockEntries {
		for _, it := range se.Items {
			fromWh := it.SourceWarehouse
			if fromWh == "" {
				fromWh = se.FromWarehouse
			}
			toWh := it.TargetWarehouse
			if toWh == "" {
				toWh = se.ToWarehouse
			}

			if fromWh != "" {
				detailSrc := it.ID + "-src"
				var cnt int64
				db.Model(&stockmodel.StockLedgerEntry{}).Where("voucher_detail_id = ?", detailSrc).Count(&cnt)
				if cnt == 0 {
					_ = db.Create(&stockmodel.StockLedgerEntry{
						ID:              "sle-" + uuid.NewString()[:8],
						TenantID:        tenant,
						PostingDate:     se.PostingDate,
						VoucherType:     "Stock Entry",
						VoucherID:       se.ID,
						VoucherNumber:   se.StockEntryNumber,
						VoucherDetailID: detailSrc,
						ItemCode:        it.ItemCode,
						Warehouse:       fromWh,
						ActualQty:       -it.Qty,
						IncomingRate:    it.BasicRate,
						ValuationRate:   it.BasicRate,
						Company:         se.Company,
						BatchNo:         it.BatchNo,
						CreatedAt:       se.PostingDate,
					}).Error
				}
			}

			if toWh != "" {
				detailTgt := it.ID + "-tgt"
				var cnt int64
				db.Model(&stockmodel.StockLedgerEntry{}).Where("voucher_detail_id = ?", detailTgt).Count(&cnt)
				if cnt == 0 {
					_ = db.Create(&stockmodel.StockLedgerEntry{
						ID:              "sle-" + uuid.NewString()[:8],
						TenantID:        tenant,
						PostingDate:     se.PostingDate,
						VoucherType:     "Stock Entry",
						VoucherID:       se.ID,
						VoucherNumber:   se.StockEntryNumber,
						VoucherDetailID: detailTgt,
						ItemCode:        it.ItemCode,
						Warehouse:       toWh,
						ActualQty:       it.Qty,
						IncomingRate:    it.BasicRate,
						ValuationRate:   it.BasicRate,
						Company:         se.Company,
						BatchNo:         it.BatchNo,
						CreatedAt:       se.PostingDate,
					}).Error
				}
			}
		}
	}

	// 2. Check submitted Purchase Receipts
	var prs []stockmodel.PurchaseReceipt
	_ = db.Preload("Items").Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND status = ?", tenant, "Submitted").Find(&prs).Error
	for _, pr := range prs {
		for _, it := range pr.Items {
			wh := it.AcceptedWarehouse
			if wh == "" {
				wh = pr.SetWarehouse
			}
			if wh == "" {
				continue
			}
			var cnt int64
			db.Model(&stockmodel.StockLedgerEntry{}).Where("voucher_detail_id = ?", it.ID).Count(&cnt)
			if cnt == 0 {
				qty := it.AcceptedQuantity
				if qty <= 0 {
					continue
				}
				_ = db.Create(&stockmodel.StockLedgerEntry{
					ID:              "sle-" + uuid.NewString()[:8],
					TenantID:        tenant,
					PostingDate:     pr.PostingDate,
					VoucherType:     "Purchase Receipt",
					VoucherID:       pr.ID,
					VoucherNumber:   pr.Number,
					VoucherDetailID: it.ID,
					ItemCode:        it.ItemCode,
					Warehouse:       wh,
					ActualQty:       qty,
					IncomingRate:    it.Rate,
					ValuationRate:   it.Rate,
					Company:         pr.Company,
					BatchNo:         it.BatchNo,
					Project:         pr.Project,
					CreatedAt:       pr.PostingDate,
				}).Error
			}
		}
	}
}

func parseFlexibleDate(str string, isEnd bool) *time.Time {
	str = strings.TrimSpace(str)
	if str == "" {
		return nil
	}
	layouts := []string{
		"2006-01-02",
		"02-01-2006",
		"02/01/2006",
		"2006/01/02",
		time.RFC3339,
	}
	for _, l := range layouts {
		if t, err := time.Parse(l, str); err == nil {
			if isEnd {
				end := time.Date(t.Year(), t.Month(), t.Day(), 23, 59, 59, 999999999, t.Location())
				return &end
			}
			start := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
			return &start
		}
	}
	return nil
}

func (ctrl *StockLedgerController) List(ctx *gin.Context) {
	db, tenant := stockDB(ctx), stockTenant(ctx)

	// Sync submitted records to ensure SLEs exist
	ctrl.syncMissingSLEs(db, tenant)

	query := db.Table("stock_ledger_entries AS sle").
		Select(`
			sle.id,
			sle.posting_date,
			sle.voucher_type,
			sle.voucher_id,
			sle.voucher_number,
			sle.voucher_detail_id,
			sle.item_code,
			COALESCE(bi.item_name, sle.item_code) AS item_name,
			COALESCE(bi.stock_uom, 'Nos') AS stock_uom,
			COALESCE(bi.item_group, '') AS item_group,
			COALESCE(bi.brand, '') AS brand,
			COALESCE(bi.description, '') AS description,
			sle.warehouse,
			sle.actual_qty,
			sle.incoming_rate,
			sle.valuation_rate,
			COALESCE(sle.company, '') AS company,
			COALESCE(sle.batch_no, '') AS batch_no,
			COALESCE(sle.serial_no, '') AS serial_no,
			COALESCE(sle.project, '') AS project,
			sle.created_at
		`).
		Joins("LEFT JOIN buying_items AS bi ON bi.item_code = sle.item_code").
		Where("sle.tenant_id = ? OR sle.tenant_id = '' OR sle.tenant_id IS NULL", tenant)

	// Filters
	if company := strings.TrimSpace(ctx.Query("company")); company != "" && company != "All" {
		query = query.Where("sle.company = ? OR sle.company = '' OR sle.company IS NULL", company)
	}

	if fromDate := parseFlexibleDate(ctx.Query("from_date"), false); fromDate != nil {
		query = query.Where("sle.posting_date >= ?", *fromDate)
	}

	if toDate := parseFlexibleDate(ctx.Query("to_date"), true); toDate != nil {
		query = query.Where("sle.posting_date <= ?", *toDate)
	}

	if warehouse := strings.TrimSpace(ctx.Query("warehouse")); warehouse != "" && warehouse != "All" {
		query = query.Where("sle.warehouse = ?", warehouse)
	}

	if itemCode := strings.TrimSpace(ctx.Query("item_code")); itemCode != "" {
		query = query.Where("sle.item_code = ?", itemCode)
	}

	if itemGroup := strings.TrimSpace(ctx.Query("item_group")); itemGroup != "" && itemGroup != "All" {
		query = query.Where("bi.item_group = ?", itemGroup)
	}

	if batchNo := strings.TrimSpace(ctx.Query("batch_no")); batchNo != "" {
		query = query.Where("sle.batch_no = ?", batchNo)
	}

	if brand := strings.TrimSpace(ctx.Query("brand")); brand != "" && brand != "All" {
		query = query.Where("bi.brand = ?", brand)
	}

	if voucherNo := strings.TrimSpace(ctx.Query("voucher_no")); voucherNo != "" {
		query = query.Where("sle.voucher_number LIKE ?", "%"+voucherNo+"%")
	}

	if project := strings.TrimSpace(ctx.Query("project")); project != "" {
		query = query.Where("sle.project = ?", project)
	}

	if q := strings.TrimSpace(ctx.Query("q")); q != "" {
		like := "%" + q + "%"
		query = query.Where("sle.item_code LIKE ? OR bi.item_name LIKE ? OR sle.warehouse LIKE ? OR sle.voucher_number LIKE ? OR sle.batch_no LIKE ? OR sle.serial_no LIKE ?", like, like, like, like, like, like)
	}

	type rawResult struct {
		ID              string    `gorm:"column:id"`
		PostingDate     time.Time `gorm:"column:posting_date"`
		VoucherType     string    `gorm:"column:voucher_type"`
		VoucherID       string    `gorm:"column:voucher_id"`
		VoucherNumber   string    `gorm:"column:voucher_number"`
		VoucherDetailID string    `gorm:"column:voucher_detail_id"`
		ItemCode        string    `gorm:"column:item_code"`
		ItemName        string    `gorm:"column:item_name"`
		StockUOM        string    `gorm:"column:stock_uom"`
		ItemGroup       string    `gorm:"column:item_group"`
		Brand           string    `gorm:"column:brand"`
		Description     string    `gorm:"column:description"`
		Warehouse       string    `gorm:"column:warehouse"`
		ActualQty       float64   `gorm:"column:actual_qty"`
		IncomingRate    float64   `gorm:"column:incoming_rate"`
		ValuationRate   float64   `gorm:"column:valuation_rate"`
		Company         string    `gorm:"column:company"`
		BatchNo         string    `gorm:"column:batch_no"`
		SerialNo        string    `gorm:"column:serial_no"`
		Project         string    `gorm:"column:project"`
		CreatedAt       time.Time `gorm:"column:created_at"`
	}

	var rawEntries []rawResult
	if err := query.Order("sle.posting_date asc, sle.created_at asc, sle.id asc").Find(&rawEntries).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data Stock Ledger: " + err.Error()})
		return
	}

	// Calculate running balances per Item + Warehouse (or sequential)
	itemBalances := make(map[string]float64)
	var rows []StockLedgerRow
	var totalInQty, totalOutQty, netBalance float64

	for _, item := range rawEntries {
		key := fmt.Sprintf("%s|%s", item.ItemCode, item.Warehouse)
		currentBal := itemBalances[key]

		inQty := 0.0
		outQty := 0.0
		if item.ActualQty > 0 {
			inQty = item.ActualQty
			totalInQty += inQty
		} else if item.ActualQty < 0 {
			outQty = -item.ActualQty
			totalOutQty += outQty
		}

		currentBal += item.ActualQty
		itemBalances[key] = currentBal
		netBalance += item.ActualQty

		rate := item.IncomingRate
		if rate == 0 {
			rate = item.ValuationRate
		}
		valRate := item.ValuationRate
		if valRate == 0 {
			valRate = rate
		}
		balanceValue := currentBal * valRate

		rows = append(rows, StockLedgerRow{
			ID:              item.ID,
			Date:            item.PostingDate,
			PostingDate:     item.PostingDate.Format("02-01-2006 15:04"),
			ItemCode:        item.ItemCode,
			ItemName:        item.ItemName,
			StockUOM:        item.StockUOM,
			InQty:           inQty,
			OutQty:          outQty,
			BalanceQty:      currentBal,
			Warehouse:       item.Warehouse,
			ItemGroup:       item.ItemGroup,
			Brand:           item.Brand,
			Description:     item.Description,
			IncomingRate:    rate,
			ValuationRate:   valRate,
			BalanceValue:    balanceValue,
			VoucherType:     item.VoucherType,
			VoucherNumber:   item.VoucherNumber,
			VoucherID:       item.VoucherID,
			VoucherDetailID: item.VoucherDetailID,
			BatchNo:         item.BatchNo,
			SerialNo:        item.SerialNo,
			Company:         item.Company,
			Project:         item.Project,
		})
	}

	ctx.JSON(http.StatusOK, gin.H{
		"data": rows,
		"stats": gin.H{
			"total_entries": len(rows),
			"total_in_qty":  totalInQty,
			"total_out_qty": totalOutQty,
			"net_balance":   netBalance,
		},
	})
}

func (ctrl *StockLedgerController) Options(ctx *gin.Context) {
	db, tenant := stockDB(ctx), stockTenant(ctx)

	// Companies
	var companies []string
	_ = db.Model(&model.Company{}).
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND is_active = ?", tenant, true).
		Pluck("name", &companies).Error

	// Warehouses
	var warehouses []string
	_ = db.Model(&stockmodel.Warehouse{}).
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND disabled = ?", tenant, false).
		Order("warehouse_name asc").
		Pluck("warehouse_name", &warehouses).Error

	// Items
	type itemInfo struct {
		ItemCode  string `json:"item_code"`
		ItemName  string `json:"item_name"`
		StockUOM  string `json:"stock_uom"`
		ItemGroup string `json:"item_group"`
		Brand     string `json:"brand"`
	}
	var items []itemInfo
	_ = db.Table("buying_items").
		Select("item_code, item_name, stock_uom, item_group, brand").
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND disabled = ?", tenant, false).
		Order("item_name asc").
		Limit(200).
		Scan(&items).Error

	// Distinct Item Groups
	var itemGroups []string
	_ = db.Table("buying_items").
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND item_group != ''", tenant).
		Distinct("item_group").
		Pluck("item_group", &itemGroups).Error

	// Distinct Brands
	var brands []string
	_ = db.Table("buying_items").
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND brand != ''", tenant).
		Distinct("brand").
		Pluck("brand", &brands).Error

	// Distinct Batches
	var batches []string
	_ = db.Model(&stockmodel.Batch{}).
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND disabled = ?", tenant, false).
		Order("batch_id asc").
		Pluck("batch_id", &batches).Error

	ctx.JSON(http.StatusOK, gin.H{
		"companies":   companies,
		"warehouses":  warehouses,
		"items":       items,
		"item_groups": itemGroups,
		"brands":      brands,
		"batches":     batches,
	})
}
