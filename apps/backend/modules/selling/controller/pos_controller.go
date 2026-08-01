package controller

import (
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	"gin-template/model"
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

func (c *POSController) OpeningEntries(ctx *gin.Context) {
	query := model.DB.Preload("BalanceDetails").Order("period_start_date desc")
	if tenant := tenantString(ctx); tenant != "" {
		query = query.Where("tenant_id = ?", tenant)
	}
	var entries []sellingmodel.POSOpeningEntry
	if err := query.Find(&entries).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil POS Opening Entry"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": entries})
}

func (c *POSController) CurrentOpening(ctx *gin.Context) {
	var entry sellingmodel.POSOpeningEntry
	query := model.DB.Preload("BalanceDetails").Where("status = ?", sellingmodel.POSOpeningStatusOpen)
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

	err := model.DB.Transaction(func(tx *gorm.DB) error {
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
	closing, err := closePOSOpening(model.DB, tenantString(ctx), ctx.Param("id"), input.ClosingAmounts)
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
		var netTotal, grandTotal float64
		for _, invoice := range invoices {
			salesByMode[invoice.ModeOfPayment] += invoice.PaidAmount
			netTotal += invoice.NetTotal
			grandTotal += invoice.GrandTotal
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
			ID:       "POS-CLOSE-" + now.Format("20060102") + "-" + uuid.New().String()[:6],
			TenantID: tenant, OpeningEntryID: opening.ID, PeriodEndDate: now, PostingDate: now,
			Company: opening.Company, User: opening.User, NetTotal: netTotal, GrandTotal: grandTotal, CreatedAt: now,
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
	query := model.DB.Preload("Reconciliations").Order("period_end_date desc")
	if tenant := tenantString(ctx); tenant != "" {
		query = query.Where("tenant_id = ?", tenant)
	}
	var entries []sellingmodel.POSClosingEntry
	if err := query.Find(&entries).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil POS Closing Entry"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": entries})
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
	query := model.DB.Where("id = ? AND status = ?", input.OpeningEntryID, sellingmodel.POSOpeningStatusOpen)
	if tenant != "" {
		query = query.Where("tenant_id = ?", tenant)
	}
	if err := query.First(&opening).Error; err != nil {
		ctx.JSON(http.StatusConflict, gin.H{"error": "POS shift belum dibuka atau sudah ditutup"})
		return
	}

	now := time.Now()
	input.ID = "posi-" + uuid.New().String()[:8]
	input.InvoiceNumber = "POS-INV-" + now.Format("20060102-150405")
	input.TenantID = tenant
	input.Status = "Paid"
	input.CreatedAt = now
	input.NetTotal = 0
	for i := range input.Items {
		input.Items[i].ID = "posii-" + uuid.New().String()[:8]
		input.Items[i].InvoiceID = input.ID
		input.Items[i].Amount = input.Items[i].Quantity * input.Items[i].Rate
		input.NetTotal += input.Items[i].Amount
	}
	input.GrandTotal = input.NetTotal + input.TaxTotal
	if input.PaidAmount == 0 {
		input.PaidAmount = input.GrandTotal
	}
	if err := model.DB.Create(&input).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan transaksi POS"})
		return
	}
	ctx.JSON(http.StatusCreated, input)
}

func (c *POSController) Invoices(ctx *gin.Context) {
	query := model.DB.Preload("Items").Order("created_at desc").Limit(100)
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
