package controller

import (
	"errors"
	"fmt"
	"math"
	"net/http"
	"strings"
	"time"

	crmmodel "gin-template/model/crm"
	stockmodel "gin-template/modules/stock/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type DeliveryNoteController struct{}

type deliveryReturnInput struct {
	Reason string `json:"reason"`
	Items  []struct {
		AgainstItemID string  `json:"against_item_id"`
		Quantity      float64 `json:"quantity"`
	} `json:"items"`
}

func NewDeliveryNoteController() *DeliveryNoteController {
	return &DeliveryNoteController{}
}

func (ctrl *DeliveryNoteController) List(ctx *gin.Context) {
	db, tenant := stockDB(ctx), stockTenant(ctx)
	var notes []stockmodel.DeliveryNote
	query := db.Preload("Items").Preload("Taxes").
		Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant)

	if status := strings.TrimSpace(ctx.Query("status")); status != "" {
		query = query.Where("status = ?", status)
	}
	if search := strings.TrimSpace(ctx.Query("q")); search != "" {
		like := "%" + search + "%"
		query = query.Where("number LIKE ? OR customer LIKE ? OR company LIKE ?", like, like, like)
	}

	if err := query.Order("created_at desc").Find(&notes).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil daftar Delivery Note"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": notes})
}

func (ctrl *DeliveryNoteController) Get(ctx *gin.Context) {
	db, tenant, id := stockDB(ctx), stockTenant(ctx), ctx.Param("id")
	var note stockmodel.DeliveryNote
	if err := db.Preload("Items").Preload("Taxes").
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND (id = ? OR number = ?)", tenant, id, id).
		First(&note).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "Delivery Note tidak ditemukan"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil detail Delivery Note"})
		return
	}
	ctx.JSON(http.StatusOK, note)
}

func calculateDeliveryNoteTotals(note *stockmodel.DeliveryNote) {
	var totalQty float64
	var subtotal float64

	for i := range note.Items {
		note.Items[i].Idx = i + 1
		if note.Items[i].Quantity <= 0 {
			note.Items[i].Quantity = 1
		}
		note.Items[i].Amount = note.Items[i].Quantity * note.Items[i].Rate
		totalQty += note.Items[i].Quantity
		subtotal += note.Items[i].Amount
	}

	note.TotalQty = totalQty
	note.Total = subtotal

	var taxTotal float64
	for i := range note.Taxes {
		note.Taxes[i].Idx = i + 1
		if note.Taxes[i].Rate > 0 && note.Taxes[i].TaxAmount == 0 {
			note.Taxes[i].TaxAmount = (subtotal * note.Taxes[i].Rate) / 100.0
		}
		note.Taxes[i].NetAmount = subtotal
		note.Taxes[i].Total = subtotal + note.Taxes[i].TaxAmount
		taxTotal += note.Taxes[i].TaxAmount
	}

	note.BaseTotalTaxesAndCharges = taxTotal
	note.TotalTaxesAndCharges = taxTotal

	grandTotal := subtotal + taxTotal
	if note.AdditionalDiscountPercentage > 0 {
		note.AdditionalDiscountAmount = (grandTotal * note.AdditionalDiscountPercentage) / 100.0
	}
	grandTotal -= note.AdditionalDiscountAmount
	if grandTotal < 0 {
		grandTotal = 0
	}

	note.GrandTotal = grandTotal
	rounded := math.Round(grandTotal)
	note.RoundingAdjustment = rounded - grandTotal
	note.RoundedTotal = rounded
}

func (ctrl *DeliveryNoteController) Create(ctx *gin.Context) {
	var input stockmodel.DeliveryNote
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Data Delivery Note tidak valid"})
		return
	}

	db, tenant := stockDB(ctx), stockTenant(ctx)
	if input.IsReturn || input.ReturnAgainstID != "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Delivery Note Return harus dibuat dari dokumen Delivery Note asal"})
		return
	}
	if input.ReplacementForID != "" {
		var returned stockmodel.DeliveryNote
		if err := db.Where("tenant_id = ? AND id = ? AND is_return = ? AND status = ?", tenant, input.ReplacementForID, true, stockmodel.DeliveryNoteStatusSubmitted).First(&returned).Error; err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "Delivery Note Return asal untuk barang pengganti tidak valid"})
			return
		}
		if input.Customer == "" {
			input.Customer = returned.Customer
		}
		if input.SalesOrderID == "" {
			input.SalesOrderID = returned.SalesOrderID
		}
	}
	if input.SalesOrderID != "" {
		var salesOrder crmmodel.SalesOrder
		if err := db.Where("tenant_id = ? AND id = ?", tenant, input.SalesOrderID).First(&salesOrder).Error; err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "Sales Order reference tidak valid"})
			return
		}
		if input.Customer == "" {
			input.Customer = salesOrder.Customer
		}
	}
	now := time.Now()

	input.ID = "dn-" + uuid.NewString()[:8]
	input.TenantID = tenant
	if input.NamingSeries == "" {
		input.NamingSeries = "MAT-DN-.YYYY.-"
	}
	if input.IsReturn {
		input.Number = fmt.Sprintf("MAT-DN-RET-%s-%s", now.Format("2006"), strings.ToUpper(uuid.NewString()[:8]))
	} else {
		input.Number = fmt.Sprintf("MAT-DN-%s-%s", now.Format("2006"), strings.ToUpper(uuid.NewString()[:8]))
	}
	if input.Status == "" {
		input.Status = stockmodel.DeliveryNoteStatusDraft
	}
	if input.PostingDate.IsZero() {
		input.PostingDate = now
	}
	if input.PostingTime == "" {
		input.PostingTime = now.Format("15:04:05")
	}
	input.CreatedAt = now
	input.UpdatedAt = now

	calculateDeliveryNoteTotals(&input)

	for i := range input.Items {
		input.Items[i].ID = "dni-" + uuid.NewString()[:8]
		input.Items[i].DeliveryNoteID = input.ID
	}
	for i := range input.Taxes {
		input.Taxes[i].ID = "dnt-" + uuid.NewString()[:8]
		input.Taxes[i].DeliveryNoteID = input.ID
	}

	if err := db.Create(&input).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat Delivery Note"})
		return
	}
	ctx.JSON(http.StatusCreated, input)
}

func (ctrl *DeliveryNoteController) CreateReturn(ctx *gin.Context) {
	var input deliveryReturnInput
	if err := ctx.ShouldBindJSON(&input); err != nil || len(input.Items) == 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Pilih minimal satu item yang dikembalikan"})
		return
	}
	db, tenant, sourceID := stockDB(ctx), stockTenant(ctx), ctx.Param("id")
	var source stockmodel.DeliveryNote
	if err := db.Preload("Items").Preload("Taxes").Where("tenant_id = ? AND id = ?", tenant, sourceID).First(&source).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Delivery Note asal tidak ditemukan"})
		return
	}
	if source.IsReturn || source.Status != stockmodel.DeliveryNoteStatusSubmitted {
		ctx.JSON(http.StatusConflict, gin.H{"error": "Return hanya dapat dibuat dari Delivery Note yang sudah Submitted"})
		return
	}

	var priorReturns []stockmodel.DeliveryNote
	if err := db.Preload("Items").Where("tenant_id = ? AND return_against_id = ? AND status <> ?", tenant, source.ID, stockmodel.DeliveryNoteStatusCancelled).Find(&priorReturns).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memeriksa histori return"})
		return
	}
	returnedQty := map[string]float64{}
	for _, returned := range priorReturns {
		for _, item := range returned.Items {
			returnedQty[item.AgainstItemID] += item.Quantity
		}
	}
	sourceItems := map[string]stockmodel.DeliveryNoteItem{}
	for _, item := range source.Items {
		sourceItems[item.ID] = item
	}

	now := time.Now()
	result := stockmodel.DeliveryNote{
		ID: "dn-" + uuid.NewString()[:8], TenantID: tenant,
		Number:       fmt.Sprintf("MAT-DN-RET-%s-%s", now.Format("2006"), strings.ToUpper(uuid.NewString()[:8])),
		NamingSeries: "MAT-DN-RET-.YYYY.-", Status: stockmodel.DeliveryNoteStatusDraft,
		Customer: source.Customer, PostingDate: now, PostingTime: now.Format("15:04:05"), Company: source.Company,
		IsReturn: true, ReturnAgainstID: source.ID, ReturnReason: strings.TrimSpace(input.Reason),
		SalesOrderID: source.SalesOrderID, SetWarehouse: source.SetWarehouse,
		TaxCategory: source.TaxCategory, TaxesAndCharges: source.TaxesAndCharges,
		ShippingRule: source.ShippingRule, Incoterm: source.Incoterm,
		ApplyDiscountOn: source.ApplyDiscountOn, CreatedAt: now, UpdatedAt: now,
	}
	for _, requested := range input.Items {
		sourceItem, exists := sourceItems[requested.AgainstItemID]
		remaining := sourceItem.Quantity - returnedQty[requested.AgainstItemID]
		if !exists || requested.Quantity <= 0 || requested.Quantity > remaining+0.000001 {
			ctx.JSON(http.StatusConflict, gin.H{"error": "Kuantitas return melebihi sisa yang dapat dikembalikan"})
			return
		}
		returnedQty[requested.AgainstItemID] += requested.Quantity
		result.Items = append(result.Items, stockmodel.DeliveryNoteItem{
			ID: "dni-" + uuid.NewString()[:8], DeliveryNoteID: result.ID, AgainstItemID: sourceItem.ID,
			ItemCode: sourceItem.ItemCode, ItemName: sourceItem.ItemName, Quantity: requested.Quantity,
			UOM: sourceItem.UOM, Rate: sourceItem.Rate, Warehouse: sourceItem.Warehouse,
		})
	}
	for _, tax := range source.Taxes {
		result.Taxes = append(result.Taxes, stockmodel.DeliveryNoteTax{
			ID: "dnt-" + uuid.NewString()[:8], DeliveryNoteID: result.ID,
			ChargeType: tax.ChargeType, AccountHead: tax.AccountHead, Rate: tax.Rate,
		})
	}
	calculateDeliveryNoteTotals(&result)
	if err := db.Create(&result).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat Delivery Note Return"})
		return
	}
	ctx.JSON(http.StatusCreated, result)
}

func (ctrl *DeliveryNoteController) Update(ctx *gin.Context) {
	id := ctx.Param("id")
	var input stockmodel.DeliveryNote
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Data Delivery Note tidak valid"})
		return
	}

	db, tenant := stockDB(ctx), stockTenant(ctx)
	var existing stockmodel.DeliveryNote
	if err := db.Preload("Items").Preload("Taxes").
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).
		First(&existing).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Delivery Note tidak ditemukan"})
		return
	}
	if existing.Status != stockmodel.DeliveryNoteStatusDraft {
		ctx.JSON(http.StatusConflict, gin.H{"error": "Hanya Delivery Note Draft yang dapat diubah"})
		return
	}
	if existing.IsReturn {
		ctx.JSON(http.StatusConflict, gin.H{"error": "Item Delivery Note Return ditetapkan saat dokumen return dibuat; hapus draft dan buat ulang untuk mengubahnya"})
		return
	}

	existing.NamingSeries = input.NamingSeries
	existing.Customer = input.Customer
	existing.PostingDate = input.PostingDate
	existing.PostingTime = input.PostingTime
	existing.SetPostingTime = input.SetPostingTime
	existing.Company = input.Company
	existing.SalesOrderID = input.SalesOrderID
	existing.SetWarehouse = input.SetWarehouse
	existing.TaxCategory = input.TaxCategory
	existing.TaxesAndCharges = input.TaxesAndCharges
	existing.ShippingRule = input.ShippingRule
	existing.Incoterm = input.Incoterm
	existing.ApplyDiscountOn = input.ApplyDiscountOn
	existing.AdditionalDiscountPercentage = input.AdditionalDiscountPercentage
	existing.AdditionalDiscountAmount = input.AdditionalDiscountAmount
	existing.Items = input.Items
	existing.Taxes = input.Taxes
	existing.UpdatedAt = time.Now()

	calculateDeliveryNoteTotals(&existing)

	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("delivery_note_id = ?", existing.ID).Delete(&stockmodel.DeliveryNoteItem{}).Error; err != nil {
			return err
		}
		if err := tx.Where("delivery_note_id = ?", existing.ID).Delete(&stockmodel.DeliveryNoteTax{}).Error; err != nil {
			return err
		}

		for i := range existing.Items {
			existing.Items[i].ID = "dni-" + uuid.NewString()[:8]
			existing.Items[i].DeliveryNoteID = existing.ID
			if err := tx.Create(&existing.Items[i]).Error; err != nil {
				return err
			}
		}
		for i := range existing.Taxes {
			existing.Taxes[i].ID = "dnt-" + uuid.NewString()[:8]
			existing.Taxes[i].DeliveryNoteID = existing.ID
			if err := tx.Create(&existing.Taxes[i]).Error; err != nil {
				return err
			}
		}

		return tx.Save(&existing).Error
	})

	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui Delivery Note"})
		return
	}

	db.Preload("Items").Preload("Taxes").First(&existing, "id = ?", existing.ID)
	ctx.JSON(http.StatusOK, existing)
}

func (ctrl *DeliveryNoteController) Submit(ctx *gin.Context) {
	db, tenant, id := stockDB(ctx), stockTenant(ctx), ctx.Param("id")
	var note stockmodel.DeliveryNote
	if err := db.Preload("Items").Preload("Taxes").Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).First(&note).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Delivery Note tidak ditemukan"})
		return
	}
	if note.Status == stockmodel.DeliveryNoteStatusSubmitted {
		ctx.JSON(http.StatusOK, note)
		return
	}
	if note.Status != stockmodel.DeliveryNoteStatusDraft || len(note.Items) == 0 {
		ctx.JSON(http.StatusConflict, gin.H{"error": "Delivery Note tidak dapat disubmit"})
		return
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		note.Status = stockmodel.DeliveryNoteStatusSubmitted
		note.UpdatedAt = now
		if err := tx.Save(&note).Error; err != nil {
			return err
		}
		sign := -1.0
		voucherType := "Delivery Note"
		if note.IsReturn {
			sign = 1
			voucherType = "Delivery Note Return"
		}
		for _, item := range note.Items {
			warehouse := strings.TrimSpace(item.Warehouse)
			if warehouse == "" {
				warehouse = note.SetWarehouse
			}
			entry := stockmodel.StockLedgerEntry{
				ID: "sle-" + uuid.NewString()[:8], TenantID: tenant, PostingDate: note.PostingDate,
				VoucherType: voucherType, VoucherID: note.ID, VoucherNumber: note.Number,
				VoucherDetailID: item.ID, ItemCode: item.ItemCode, Warehouse: warehouse,
				ActualQty: sign * item.Quantity, CreatedAt: now,
			}
			if err := tx.Create(&entry).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal submit Delivery Note"})
		return
	}
	ctx.JSON(http.StatusOK, note)
}

func (ctrl *DeliveryNoteController) Delete(ctx *gin.Context) {
	db, tenant, id := stockDB(ctx), stockTenant(ctx), ctx.Param("id")
	result := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ? AND status = ?", tenant, id, stockmodel.DeliveryNoteStatusDraft).Delete(&stockmodel.DeliveryNote{})
	if result.Error != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus Delivery Note"})
		return
	}
	if result.RowsAffected == 0 {
		ctx.JSON(http.StatusConflict, gin.H{"error": "Hanya Delivery Note Draft yang dapat dihapus"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "Delivery Note terhapus"})
}

func (ctrl *DeliveryNoteController) StockBalances(ctx *gin.Context) {
	tenant := stockTenant(ctx)
	type balance struct {
		ItemCode  string  `json:"item_code"`
		Warehouse string  `json:"warehouse"`
		Qty       float64 `json:"qty"`
	}
	var rows []balance
	query := stockDB(ctx).Model(&stockmodel.StockLedgerEntry{}).
		Select("item_code, warehouse, SUM(actual_qty) AS qty").Where("tenant_id = ?", tenant)
	if itemCode := strings.TrimSpace(ctx.Query("item_code")); itemCode != "" {
		query = query.Where("item_code = ?", itemCode)
	}
	if err := query.Group("item_code, warehouse").Order("item_code, warehouse").Scan(&rows).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil saldo stok"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": rows})
}

func (ctrl *DeliveryNoteController) Options(ctx *gin.Context) {
	ctx.JSON(http.StatusOK, gin.H{
		"naming_series":   []string{"MAT-DN-.YYYY.-", "MAT-DN-RET-.YYYY.-"},
		"companies":       []string{"PT ZENIT TECHNOLOGY SOLUTION", "PT Codeverta Enterprise"},
		"warehouses":      []string{"Stores - PT ZENIT", "Finished Goods - PT ZENIT", "Work In Progress - PT ZENIT"},
		"tax_categories":  []string{"In State", "Out of State", "Export"},
		"taxes_templates": []string{"PPN 11%", "PPN 12%", "Exempt Tax"},
		"shipping_rules":  []string{"Standard Delivery", "Express Delivery", "Free Shipping"},
		"incoterms":       []string{"EXW", "FOB", "CIF", "DDP", "CFR"},
	})
}
