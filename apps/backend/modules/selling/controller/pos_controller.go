package controller

import (
	"fmt"
	"math"
	"net/http"
	"sort"
	"strings"
	"time"

	"gin-template/model"
	buyingmodel "gin-template/modules/buying/model"
	sellingmodel "gin-template/modules/selling/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type POSController struct{}

func NewPOSController() *POSController { return &POSController{} }

func tenantString(ctx *gin.Context) string {
	tenantID, _ := ctx.Get("tenant_id")
	tenant, _ := tenantID.(string)
	return tenant
}

func posDB(ctx *gin.Context) *gorm.DB {
	return model.GetDB(ctx).WithContext(ctx.Request.Context())
}

type posItemResponse struct {
	ID          uuid.UUID `json:"id"`
	ItemCode    string    `json:"item_code"`
	ItemName    string    `json:"item_name"`
	ItemGroup   string    `json:"item_group"`
	Rate        float64   `json:"rate"`
	Stock       float64   `json:"stock"`
	Unit        string    `json:"unit"`
	IsStockItem bool      `json:"is_stock_item"`
	Barcodes    []string  `json:"barcodes"`
}

// Items exposes the active Item master as the canonical POS catalog.
func (c *POSController) Items(ctx *gin.Context) {
	db := model.GetDB(ctx).WithContext(ctx.Request.Context()).
		Preload("Barcodes", func(query *gorm.DB) *gorm.DB { return query.Order("idx ASC") }).
		Where("disabled = ?", false)
	if query := strings.TrimSpace(ctx.Query("q")); query != "" {
		like := "%" + query + "%"
		db = db.Where("item_code LIKE ? OR item_name LIKE ? OR item_group LIKE ?", like, like, like)
	}
	var items []buyingmodel.Item
	if err := db.Order("item_group ASC, item_name ASC").Limit(500).Find(&items).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil item POS"})
		return
	}

	result := make([]posItemResponse, 0, len(items))
	for _, item := range items {
		barcodes := make([]string, 0, len(item.Barcodes))
		for _, barcode := range item.Barcodes {
			if value := strings.TrimSpace(barcode.Barcode); value != "" {
				barcodes = append(barcodes, value)
			}
		}
		result = append(result, posItemResponse{
			ID: item.ID, ItemCode: item.ItemCode, ItemName: item.ItemName,
			ItemGroup: item.ItemGroup, Rate: item.StandardRate, Stock: item.OpeningStock,
			Unit: item.StockUOM, IsStockItem: item.IsStockItem, Barcodes: barcodes,
		})
	}
	ctx.JSON(http.StatusOK, gin.H{"data": result})
}

func (c *POSController) OpeningEntries(ctx *gin.Context) {
	query := posDB(ctx).Preload("BalanceDetails").Order("period_start_date desc")
	if tenant := tenantString(ctx); tenant != "" {
		query = query.Where("tenant_id = ?", tenant)
	}
	if status := strings.TrimSpace(ctx.Query("status")); status != "" {
		query = query.Where("status = ?", status)
	}
	if company := strings.TrimSpace(ctx.Query("company")); company != "" {
		query = query.Where("company = ?", company)
	}
	if posProfile := strings.TrimSpace(ctx.Query("pos_profile")); posProfile != "" {
		query = query.Where("pos_profile = ?", posProfile)
	}
	var entries []sellingmodel.POSOpeningEntry
	if err := query.Find(&entries).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil POS Opening Entry"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": entries})
}

func (c *POSController) GetOpeningEntry(ctx *gin.Context) {
	id := ctx.Param("id")
	query := posDB(ctx).Preload("BalanceDetails").Where("id = ?", id)
	if tenant := tenantString(ctx); tenant != "" {
		query = query.Where("tenant_id = ?", tenant)
	}
	var entry sellingmodel.POSOpeningEntry
	if err := query.First(&entry).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "POS Opening Entry tidak ditemukan"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil POS Opening Entry"})
		return
	}
	ctx.JSON(http.StatusOK, entry)
}

func (c *POSController) CurrentOpening(ctx *gin.Context) {
	var entry sellingmodel.POSOpeningEntry
	query := posDB(ctx).Preload("BalanceDetails").Where("status = ?", sellingmodel.POSOpeningStatusOpen)
	if tenant := tenantString(ctx); tenant != "" {
		query = query.Where("tenant_id = ?", tenant)
	}
	if profile := strings.TrimSpace(ctx.Query("pos_profile")); profile != "" {
		query = query.Where("pos_profile = ?", profile)
	}
	if err := query.Order("period_start_date desc").First(&entry).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			ctx.JSON(http.StatusOK, gin.H{"data": nil})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil opening aktif"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{
		"data":        entry,
		"is_outdated": time.Since(entry.PeriodStartDate) > 12*time.Hour,
	})
}

func (c *POSController) CreateOpening(ctx *gin.Context) {
	var input sellingmodel.POSOpeningEntry
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	input.Company = strings.TrimSpace(input.Company)
	input.POSProfile = strings.TrimSpace(input.POSProfile)
	input.User = strings.TrimSpace(input.User)
	if input.Company == "" || input.POSProfile == "" || input.User == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Company, POS Profile, dan Cashier wajib diisi"})
		return
	}

	tenant := tenantString(ctx)
	now := time.Now()
	if input.PeriodStartDate.IsZero() {
		input.PeriodStartDate = now
	}
	if input.PostingDate.IsZero() {
		input.PostingDate = now
	}
	input.ID = "POS-OPEN-" + now.Format("20060102") + "-" + uuid.New().String()[:6]
	input.TenantID = tenant
	input.Status = sellingmodel.POSOpeningStatusOpen
	input.CreatedAt = now
	input.UpdatedAt = now
	input.OpeningBalanceTotal = 0
	for i := range input.BalanceDetails {
		input.BalanceDetails[i].ID = "posb-" + uuid.New().String()[:8]
		input.BalanceDetails[i].OpeningEntryID = input.ID
		input.OpeningBalanceTotal += input.BalanceDetails[i].OpeningAmount
	}

	err := posDB(ctx).Transaction(func(tx *gorm.DB) error {
		var count int64
		query := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Model(&sellingmodel.POSOpeningEntry{}).
			Where("status = ? AND pos_profile = ?", sellingmodel.POSOpeningStatusOpen, input.POSProfile)
		if tenant != "" {
			query = query.Where("tenant_id = ?", tenant)
		}
		if err := query.Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			return fmt.Errorf("OPENING_EXISTS")
		}
		return tx.Create(&input).Error
	})
	if err != nil {
		if err.Error() == "OPENING_EXISTS" {
			ctx.JSON(http.StatusConflict, gin.H{"error": "Masih ada POS Opening Entry aktif. Tutup shift lama sebelum membuat opening baru."})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat POS Opening Entry"})
		return
	}
	ctx.JSON(http.StatusCreated, input)
}

type closingInput struct {
	ClosingAmounts map[string]float64 `json:"closing_amounts"`
}

func (c *POSController) CloseOpening(ctx *gin.Context) {
	var input closingInput
	_ = ctx.ShouldBindJSON(&input)
	closing, err := closePOSOpening(posDB(ctx), tenantString(ctx), ctx.Param("id"), input.ClosingAmounts)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "POS Opening Entry aktif tidak ditemukan"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusCreated, closing)
}

func closePOSOpening(db *gorm.DB, tenant, openingID string, closingAmounts map[string]float64) (*sellingmodel.POSClosingEntry, error) {
	var closing sellingmodel.POSClosingEntry
	err := db.Transaction(func(tx *gorm.DB) error {
		var opening sellingmodel.POSOpeningEntry
		query := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Preload("BalanceDetails").
			Where("id = ? AND status = ?", openingID, sellingmodel.POSOpeningStatusOpen)
		if tenant != "" {
			query = query.Where("tenant_id = ?", tenant)
		}
		if err := query.First(&opening).Error; err != nil {
			return err
		}

		var invoices []sellingmodel.POSInvoice
		if err := tx.Where("opening_entry_id = ? AND status = ?", opening.ID, "Paid").Find(&invoices).Error; err != nil {
			return err
		}
		openingByMode := map[string]float64{}
		for _, row := range opening.BalanceDetails {
			openingByMode[row.ModeOfPayment] += row.OpeningAmount
		}
		salesByMode := map[string]float64{}
		var netTotal, grandTotal, totalQty, totalTaxes float64
		for _, invoice := range invoices {
			salesByMode[invoice.ModeOfPayment] += invoice.PaidAmount
			netTotal += invoice.NetTotal
			totalTaxes += invoice.TaxTotal
			grandTotal += invoice.GrandTotal
			for _, it := range invoice.Items {
				totalQty += it.Quantity
			}
		}
		modes := map[string]bool{}
		for mode := range openingByMode {
			modes[mode] = true
		}
		for mode := range salesByMode {
			modes[mode] = true
		}
		keys := make([]string, 0, len(modes))
		for mode := range modes {
			keys = append(keys, mode)
		}
		sort.Strings(keys)

		now := time.Now()
		closing = sellingmodel.POSClosingEntry{
			ID:                   "POS-CLOSE-" + now.Format("20060102") + "-" + uuid.New().String()[:6],
			TenantID:             tenant,
			OpeningEntryID:       opening.ID,
			PeriodStartDate:      &opening.PeriodStartDate,
			PeriodEndDate:        now,
			PostingDate:          now,
			PostingTime:          now.Format("15:04:05"),
			Company:              opening.Company,
			POSProfile:           opening.POSProfile,
			User:                 opening.User,
			TotalQuantity:        totalQty,
			NetTotal:             netTotal,
			TotalTaxesAndCharges: totalTaxes,
			GrandTotal:           grandTotal,
			Status:               "Submitted",
			CreatedAt:            now,
		}
		for _, mode := range keys {
			expected := openingByMode[mode] + salesByMode[mode]
			actual, supplied := closingAmounts[mode]
			if !supplied {
				actual = expected
			}
			closing.Reconciliations = append(closing.Reconciliations, sellingmodel.POSPaymentReconciliation{
				ID: "posr-" + uuid.New().String()[:8], ClosingEntryID: closing.ID, ModeOfPayment: mode,
				OpeningAmount: openingByMode[mode], ExpectedAmount: expected, ClosingAmount: actual, Difference: actual - expected,
			})
		}
		if err := tx.Create(&closing).Error; err != nil {
			return err
		}
		opening.Status = sellingmodel.POSOpeningStatusClosed
		opening.ClosedAt = &now
		opening.UpdatedAt = now
		return tx.Save(&opening).Error
	})
	return &closing, err
}

func (c *POSController) ClosingEntries(ctx *gin.Context) {
	query := posDB(ctx).Preload("Reconciliations").Order("period_end_date desc")
	if tenant := tenantString(ctx); tenant != "" {
		query = query.Where("tenant_id = ?", tenant)
	}
	if company := strings.TrimSpace(ctx.Query("company")); company != "" {
		query = query.Where("company = ?", company)
	}
	if posProfile := strings.TrimSpace(ctx.Query("pos_profile")); posProfile != "" {
		query = query.Where("pos_profile = ?", posProfile)
	}
	var entries []sellingmodel.POSClosingEntry
	if err := query.Find(&entries).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil POS Closing Entry"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": entries})
}

func (c *POSController) GetClosingEntry(ctx *gin.Context) {
	id := ctx.Param("id")
	query := posDB(ctx).Preload("Reconciliations").Where("id = ?", id)
	if tenant := tenantString(ctx); tenant != "" {
		query = query.Where("tenant_id = ?", tenant)
	}
	var entry sellingmodel.POSClosingEntry
	if err := query.First(&entry).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "POS Closing Entry tidak ditemukan"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil POS Closing Entry"})
		return
	}
	ctx.JSON(http.StatusOK, entry)
}

func (c *POSController) CreateInvoice(ctx *gin.Context) {
	var input sellingmodel.POSInvoice
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if len(input.Items) == 0 || input.OpeningEntryID == "" || input.ModeOfPayment == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Opening Entry, item, dan metode pembayaran wajib diisi"})
		return
	}
	tenant := tenantString(ctx)
	var opening sellingmodel.POSOpeningEntry
	query := posDB(ctx).Where("id = ? AND status = ?", input.OpeningEntryID, sellingmodel.POSOpeningStatusOpen)
	if tenant != "" {
		query = query.Where("tenant_id = ?", tenant)
	}
	if err := query.First(&opening).Error; err != nil {
		ctx.JSON(http.StatusConflict, gin.H{"error": "POS shift belum dibuka atau sudah ditutup"})
		return
	}
	itemCodes := make([]string, 0, len(input.Items))
	for index := range input.Items {
		input.Items[index].ItemCode = strings.TrimSpace(input.Items[index].ItemCode)
		if input.Items[index].ItemCode == "" || input.Items[index].Quantity <= 0 || input.Items[index].Rate < 0 {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "Kode item dan quantity POS harus valid"})
			return
		}
		itemCodes = append(itemCodes, input.Items[index].ItemCode)
	}
	var masterItems []buyingmodel.Item
	itemQuery := model.GetDB(ctx).WithContext(ctx.Request.Context()).
		Where("disabled = ? AND item_code IN ?", false, itemCodes)
	if err := itemQuery.Find(&masterItems).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memvalidasi item POS"})
		return
	}
	itemsByCode := make(map[string]buyingmodel.Item, len(masterItems))
	for _, item := range masterItems {
		itemsByCode[item.ItemCode] = item
	}
	if len(itemsByCode) != len(itemCodes) {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Satu atau lebih item POS tidak aktif atau tidak ditemukan"})
		return
	}

	now := time.Now()
	input.ID = "posi-" + uuid.New().String()[:8]

	var sinvCount int64
	posDB(ctx).Model(&sellingmodel.SalesInvoice{}).Where("tenant_id = ? AND number LIKE ?", tenant, "ACC-SINV-"+now.Format("2006")+"-%").Count(&sinvCount)
	invoiceNumber := fmt.Sprintf("ACC-SINV-%s-%05d", now.Format("2006"), sinvCount+1)

	input.InvoiceNumber = invoiceNumber
	input.TenantID = tenant
	input.Status = "Paid"
	input.CreatedAt = now
	input.NetTotal = 0
	var totalQty float64
	var salesInvoiceItems []sellingmodel.SalesInvoiceItem
	salesInvoiceID := "sinv-" + uuid.New().String()[:8]

	for i := range input.Items {
		masterItem, exists := itemsByCode[input.Items[i].ItemCode]
		if !exists {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "Item POS tidak ditemukan: " + input.Items[i].ItemCode})
			return
		}
		input.Items[i].ID = "posii-" + uuid.New().String()[:8]
		input.Items[i].InvoiceID = input.ID
		input.Items[i].ItemName = masterItem.ItemName
		// POS may override the catalog rate for a negotiated or promotional price.
		// Keep the master rate as a fallback for clients that omit the rate.
		if input.Items[i].Rate == 0 {
			input.Items[i].Rate = masterItem.StandardRate
		}
		input.Items[i].Amount = input.Items[i].Quantity * input.Items[i].Rate
		input.NetTotal += input.Items[i].Amount
		totalQty += input.Items[i].Quantity

		salesInvoiceItems = append(salesInvoiceItems, sellingmodel.SalesInvoiceItem{
			ID:             "sii-" + uuid.New().String()[:8],
			SalesInvoiceID: salesInvoiceID,
			ItemCode:       input.Items[i].ItemCode,
			ItemName:       input.Items[i].ItemName,
			Quantity:       input.Items[i].Quantity,
			Rate:           input.Items[i].Rate,
			Amount:         input.Items[i].Amount,
			UOM:            "Nos",
		})
	}
	input.GrandTotal = input.NetTotal + input.TaxTotal
	input.PaidAmount = input.GrandTotal
	if err := posDB(ctx).Create(&input).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan transaksi POS"})
		return
	}

	company := opening.Company
	if company == "" {
		company = "PT ZENIT TECHNOLOGY SOLUTION"
	}
	customerName := input.Customer
	if customerName == "" {
		customerName = "Walk-in Customer"
	}

	salesInvoice := sellingmodel.SalesInvoice{
		ID:                 salesInvoiceID,
		TenantID:           tenant,
		Number:             invoiceNumber,
		NamingSeries:       "ACC-SINV-.YYYY.-",
		Status:             sellingmodel.SalesInvoiceStatusSubmitted,
		Customer:           customerName,
		Company:            company,
		PostingDate:        now,
		PostingTime:        now.Format("15:04:05"),
		IsPOS:              true,
		IsPaid:             true,
		Currency:           "IDR",
		TotalQty:           totalQty,
		NetTotal:           input.NetTotal,
		GrandTotal:         input.GrandTotal,
		RoundedTotal:       math.Round(input.GrandTotal),
		RoundingAdjustment: math.Round(input.GrandTotal) - input.GrandTotal,
		TotalAdvance:       input.GrandTotal,
		OutstandingAmount:  0,
		Items:              salesInvoiceItems,
		CreatedAt:          now,
		UpdatedAt:          now,
	}
	_ = posDB(ctx).Create(&salesInvoice).Error

	ctx.JSON(http.StatusCreated, input)
}

func (c *POSController) Invoices(ctx *gin.Context) {
	query := posDB(ctx).Preload("Items").Order("created_at desc").Limit(100)
	if tenant := tenantString(ctx); tenant != "" {
		query = query.Where("tenant_id = ?", tenant)
	}
	if opening := ctx.Query("opening_entry_id"); opening != "" {
		query = query.Where("opening_entry_id = ?", opening)
	}
	var invoices []sellingmodel.POSInvoice
	if err := query.Find(&invoices).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil transaksi POS"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": invoices})
}
