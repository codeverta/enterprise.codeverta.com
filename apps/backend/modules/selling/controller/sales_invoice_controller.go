package controller

import (
	"errors"
	"fmt"
	"math"
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

type SalesInvoiceController struct{}

func NewSalesInvoiceController() *SalesInvoiceController { return &SalesInvoiceController{} }

type salesInvoiceReturnInput struct {
	Reason string `json:"reason"`
	Items  []struct {
		AgainstItemID string  `json:"against_item_id"`
		Quantity      float64 `json:"quantity"`
	} `json:"items"`
}

type refundInput struct {
	Reference string `json:"reference"`
}

func loadSalesInvoice(db *gorm.DB, tenant, id string) (sellingmodel.SalesInvoice, error) {
	var invoice sellingmodel.SalesInvoice
	err := db.Preload("Items").Where("tenant_id = ? AND (id = ? OR number = ?)", tenant, id, id).First(&invoice).Error
	if err != nil {
		return invoice, err
	}
	if len(invoice.Items) == 0 {
		var posInv sellingmodel.POSInvoice
		if db.Preload("Items").Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND invoice_number = ?", tenant, invoice.Number).First(&posInv).Error == nil && len(posInv.Items) > 0 {
			for _, itm := range posInv.Items {
				item := sellingmodel.SalesInvoiceItem{
					ID:             "sii-" + uuid.New().String()[:8],
					SalesInvoiceID: invoice.ID,
					ItemCode:       itm.ItemCode,
					ItemName:       itm.ItemName,
					Quantity:       itm.Quantity,
					Rate:           itm.Rate,
					Amount:         itm.Amount,
					UOM:            "Nos",
				}
				_ = db.Create(&item).Error
				invoice.Items = append(invoice.Items, item)
			}
		}
	}
	return invoice, nil
}

func calculateSalesInvoice(invoice *sellingmodel.SalesInvoice) {
	sign := 1.0
	if invoice.IsReturn {
		sign = -1
	}
	var net float64
	var totalQty float64
	for i := range invoice.Items {
		qty := math.Abs(invoice.Items[i].Quantity)
		invoice.Items[i].Quantity = sign * qty
		invoice.Items[i].Amount = sign * qty * math.Abs(invoice.Items[i].Rate)
		net += invoice.Items[i].Amount
		totalQty += qty
	}
	invoice.TotalQty = totalQty

	// Additional Discount
	absNet := math.Abs(net)
	discount := math.Abs(invoice.DiscountAmount)
	if invoice.AdditionalDiscountPercentage > 0 {
		discount = absNet * (invoice.AdditionalDiscountPercentage / 100)
		invoice.DiscountAmount = discount
	}
	absDiscountedNet := absNet - discount
	if absDiscountedNet < 0 {
		absDiscountedNet = 0
	}
	invoice.NetTotal = net

	// Tax calculation
	tax := sign * (absDiscountedNet * math.Abs(invoice.TaxRate) / 100)
	invoice.TaxAmount = tax
	invoice.TotalTaxesAndCharges = tax

	rawGrand := (sign * absDiscountedNet) + tax
	invoice.GrandTotal = rawGrand

	// Rounding
	if !invoice.UseCompanyRoundoffCostCenter {
		invoice.RoundedTotal = math.Round(rawGrand)
		invoice.RoundingAdjustment = invoice.RoundedTotal - rawGrand
	} else {
		invoice.RoundedTotal = rawGrand
		invoice.RoundingAdjustment = 0
	}

	if invoice.IsReturn {
		invoice.OutstandingAmount = 0
	} else if !invoice.IsPaid {
		outstanding := invoice.RoundedTotal - math.Abs(invoice.TotalAdvance)
		if outstanding < 0 {
			outstanding = 0
		}
		invoice.OutstandingAmount = outstanding
	}
}

func prepareSalesInvoice(invoice *sellingmodel.SalesInvoice, tenant, defaultCompany string) {
	now := time.Now()
	invoice.ID = "sinv-" + uuid.NewString()[:8]
	invoice.TenantID = tenant
	invoice.Status = sellingmodel.SalesInvoiceStatusDraft
	if invoice.PostingDate.IsZero() {
		invoice.PostingDate = now
	}
	if invoice.Currency == "" {
		invoice.Currency = "IDR"
	}
	if invoice.Company == "" {
		invoice.Company = defaultCompany
	}
	if invoice.DueDate == nil || invoice.DueDate.IsZero() {
		due := now.AddDate(0, 0, 7)
		invoice.DueDate = &due
	}
	if invoice.Number == "" {
		prefix := "ACC-SINV"
		if invoice.IsReturn {
			prefix = "ACC-SINV-RET"
		}
		invoice.Number = fmt.Sprintf("%s-%s-%s", prefix, now.Format("2006"), strings.ToUpper(uuid.NewString()[:8]))
	}
	invoice.CreatedAt, invoice.UpdatedAt = now, now
	for i := range invoice.Items {
		invoice.Items[i].ID = "sii-" + uuid.NewString()[:8]
		invoice.Items[i].SalesInvoiceID = invoice.ID
		if invoice.Items[i].UOM == "" {
			invoice.Items[i].UOM = "Nos"
		}
	}
	calculateSalesInvoice(invoice)
}

func (ctrl *SalesInvoiceController) Options(ctx *gin.Context) {
	db, tenant := posDB(ctx), tenantString(ctx)
	var companies []string
	db.Table("companies").Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant).Pluck("name", &companies)

	var warehouses []string
	db.Table("warehouses").Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant).Pluck("warehouse_name", &warehouses)

	var customers []string
	db.Table("selling_customers").Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant).Pluck("customer_name", &customers)
	if len(customers) == 0 {
		customers = []string{"PT Mitra Niaga Mandiri", "Walk-in Customer"}
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

	type SalesInvoiceItemOption struct {
		ItemCode    string  `json:"item_code"`
		ItemName    string  `json:"item_name"`
		UOM         string  `json:"uom"`
		Rate        float64 `json:"rate"`
		Barcode     string  `json:"barcode"`
		Description string  `json:"description"`
	}

	itemOptions := make([]SalesInvoiceItemOption, 0, len(items))
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
		if rate == 0 && itm.StandardRate > 0 {
			rate = itm.StandardRate
		}
		itemOptions = append(itemOptions, SalesInvoiceItemOption{
			ItemCode:    itm.ItemCode,
			ItemName:    itm.ItemName,
			UOM:         uom,
			Rate:        rate,
			Barcode:     barcode,
			Description: itm.Description,
		})
	}

	if len(itemOptions) == 0 {
		itemOptions = []SalesInvoiceItemOption{
			{ItemCode: "LIP-001", ItemName: "Lipstick Matte Red", UOM: "Nos", Rate: 100000, Barcode: "8991234001"},
			{ItemCode: "CAN-001", ItemName: "Aromatherapy Candle 200g", UOM: "Nos", Rate: 85000, Barcode: "8991234002"},
			{ItemCode: "SKN-001", ItemName: "Hydrating Facial Serum 30ml", UOM: "Bottle", Rate: 150000, Barcode: "8991234003"},
		}
	}

	ctx.JSON(http.StatusOK, gin.H{
		"naming_series": []string{
			"ACC-SINV-.YYYY.-",
			"ACC-SINV-RET-.YYYY.-",
		},
		"companies":       companies,
		"warehouses":      warehouses,
		"customers":       customers,
		"items":           itemOptions,
		"currencies":      []string{"IDR", "USD", "SGD", "EUR"},
		"tax_categories":  []string{"In State", "Out of State", "Export"},
		"taxes_templates": []string{"PPN 11%", "PPN 12%", "Exempt Tax"},
		"shipping_rules":  []string{"Standard Delivery", "Express Delivery", "Free Shipping"},
		"incoterms":       []string{"EXW", "FOB", "CIF", "DDP"},
		"apply_discount_on": []string{
			"Grand Total",
			"Net Total",
		},
		"cost_centers": []string{"Main - PZTS", "Sales - PZTS"},
		"projects":     []string{"Internal Project", "Customer Delivery"},
	})
}

func syncPOSInvoicesToSalesInvoices(db *gorm.DB, tenant string) {
	var posInvoices []sellingmodel.POSInvoice
	_ = db.Preload("Items").Where("tenant_id = ?", tenant).Find(&posInvoices).Error

	for _, posInv := range posInvoices {
		var existing sellingmodel.SalesInvoice
		err := db.Preload("Items").Where("tenant_id = ? AND number = ?", tenant, posInv.InvoiceNumber).First(&existing).Error
		if err != nil {
			now := posInv.CreatedAt
			if now.IsZero() {
				now = time.Now()
			}
			sinvID := "sinv-" + uuid.New().String()[:8]
			var items []sellingmodel.SalesInvoiceItem
			var totalQty float64
			for _, itm := range posInv.Items {
				totalQty += itm.Quantity
				items = append(items, sellingmodel.SalesInvoiceItem{
					ID:             "sii-" + uuid.New().String()[:8],
					SalesInvoiceID: sinvID,
					ItemCode:       itm.ItemCode,
					ItemName:       itm.ItemName,
					Quantity:       itm.Quantity,
					Rate:           itm.Rate,
					Amount:         itm.Amount,
					UOM:            "Nos",
				})
			}
			cust := posInv.Customer
			if cust == "" {
				cust = "Walk-in Customer"
			}
			var opening sellingmodel.POSOpeningEntry
			db.Select("company").Where("id = ?", posInv.OpeningEntryID).First(&opening)
			company := opening.Company
			if company == "" {
				company = coremodel.ResolveActiveCompanyName(db, nil)
			}
			sinv := sellingmodel.SalesInvoice{
				ID:                 sinvID,
				TenantID:           tenant,
				Number:             posInv.InvoiceNumber,
				NamingSeries:       "ACC-SINV-.YYYY.-",
				Status:             sellingmodel.SalesInvoiceStatusSubmitted,
				Customer:           cust,
				Company:            company,
				PostingDate:        now,
				PostingTime:        now.Format("15:04:05"),
				IsPOS:              true,
				IsPaid:             true,
				Currency:           "IDR",
				TotalQty:           totalQty,
				NetTotal:           posInv.NetTotal,
				GrandTotal:         posInv.GrandTotal,
				RoundedTotal:       math.Round(posInv.GrandTotal),
				RoundingAdjustment: math.Round(posInv.GrandTotal) - posInv.GrandTotal,
				TotalAdvance:       posInv.GrandTotal,
				OutstandingAmount:  0,
				Items:              items,
				CreatedAt:          now,
				UpdatedAt:          now,
			}
			_ = db.Create(&sinv).Error
			for i := range items {
				_ = db.Create(&items[i]).Error
			}
		} else if len(existing.Items) == 0 && len(posInv.Items) > 0 {
			for _, itm := range posInv.Items {
				item := sellingmodel.SalesInvoiceItem{
					ID:             "sii-" + uuid.New().String()[:8],
					SalesInvoiceID: existing.ID,
					ItemCode:       itm.ItemCode,
					ItemName:       itm.ItemName,
					Quantity:       itm.Quantity,
					Rate:           itm.Rate,
					Amount:         itm.Amount,
					UOM:            "Nos",
				}
				_ = db.Create(&item).Error
			}
		}
	}
}

func (ctrl *SalesInvoiceController) List(ctx *gin.Context) {
	db, tenant := posDB(ctx), tenantString(ctx)
	syncPOSInvoicesToSalesInvoices(db, tenant)

	var rows []sellingmodel.SalesInvoice
	query := db.Preload("Items").Where("tenant_id = ?", tenant)
	if value := strings.TrimSpace(ctx.Query("status")); value != "" {
		query = query.Where("status = ?", value)
	}
	if value := strings.TrimSpace(ctx.Query("q")); value != "" {
		like := "%" + value + "%"
		query = query.Where("number LIKE ? OR customer LIKE ?", like, like)
	}
	if err := query.Order("created_at DESC").Find(&rows).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil Sales Invoice"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": rows})
}

func (ctrl *SalesInvoiceController) Get(ctx *gin.Context) {
	invoice, err := loadSalesInvoice(posDB(ctx), tenantString(ctx), ctx.Param("id"))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "Sales Invoice tidak ditemukan"})
		} else {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil Sales Invoice"})
		}
		return
	}
	ctx.JSON(http.StatusOK, invoice)
}

func (ctrl *SalesInvoiceController) Create(ctx *gin.Context) {
	var input sellingmodel.SalesInvoice
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Data Sales Invoice tidak valid"})
		return
	}
	if input.IsReturn || input.ReturnAgainstID != "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Credit Note harus dibuat dari Sales Invoice asal"})
		return
	}
	db, tenant := posDB(ctx), tenantString(ctx)
	if input.DeliveryNoteID != "" {
		var delivery stockmodel.DeliveryNote
		if err := db.Preload("Items").Where("tenant_id = ? AND id = ? AND status = ? AND is_return = ?", tenant, input.DeliveryNoteID, stockmodel.DeliveryNoteStatusSubmitted, false).First(&delivery).Error; err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "Delivery Note harus Submitted sebelum dibuatkan Sales Invoice"})
			return
		}
		var count int64
		db.Model(&sellingmodel.SalesInvoice{}).Where("tenant_id = ? AND delivery_note_id = ? AND is_return = ? AND status <> ?", tenant, delivery.ID, false, sellingmodel.SalesInvoiceStatusCancelled).Count(&count)
		if count > 0 {
			ctx.JSON(http.StatusConflict, gin.H{"error": "Delivery Note ini sudah memiliki Sales Invoice"})
			return
		}
		input.Customer, input.Company, input.SalesOrderID = delivery.Customer, delivery.Company, delivery.SalesOrderID
		if input.TaxRate == 0 && delivery.Total != 0 {
			input.TaxRate = math.Abs(delivery.TotalTaxesAndCharges / delivery.Total * 100)
		}
		if len(input.Items) == 0 {
			for _, item := range delivery.Items {
				input.Items = append(input.Items, sellingmodel.SalesInvoiceItem{
					ItemCode: item.ItemCode, ItemName: item.ItemName, Quantity: item.Quantity,
					UOM: item.UOM, Rate: item.Rate,
				})
			}
		}
	}
	if strings.TrimSpace(input.Customer) == "" || len(input.Items) == 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Customer dan item wajib diisi"})
		return
	}
	userID, _ := ctx.Get("id")
	prepareSalesInvoice(&input, tenant, coremodel.ResolveActiveCompanyName(db, userID))
	if err := db.Create(&input).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat Sales Invoice"})
		return
	}
	ctx.JSON(http.StatusCreated, input)
}

func (ctrl *SalesInvoiceController) Update(ctx *gin.Context) {
	db, tenant := posDB(ctx), tenantString(ctx)
	existing, err := loadSalesInvoice(db, tenant, ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Sales Invoice tidak ditemukan"})
		return
	}
	if existing.Status != sellingmodel.SalesInvoiceStatusDraft {
		ctx.JSON(http.StatusConflict, gin.H{"error": "Hanya Sales Invoice Draft yang dapat diubah"})
		return
	}
	if existing.IsReturn {
		ctx.JSON(http.StatusConflict, gin.H{"error": "Item Credit Note ditetapkan saat return dibuat; hapus draft dan buat ulang untuk mengubahnya"})
		return
	}
	var input sellingmodel.SalesInvoice
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Data Sales Invoice tidak valid"})
		return
	}
	existing.Customer = input.Customer
	existing.Company = input.Company
	existing.NamingSeries = input.NamingSeries
	existing.PostingDate = input.PostingDate
	existing.PostingTime = input.PostingTime
	existing.SetPostingTime = input.SetPostingTime
	existing.DueDate = input.DueDate
	existing.IsPOS = input.IsPOS
	existing.IsDebitNote = input.IsDebitNote
	existing.ApplyTDS = input.ApplyTDS
	existing.CostCenter = input.CostCenter
	existing.Project = input.Project
	existing.ScanBarcode = input.ScanBarcode
	existing.UpdateStock = input.UpdateStock
	existing.Currency = input.Currency
	existing.TaxCategory = input.TaxCategory
	existing.TaxesAndCharges = input.TaxesAndCharges
	existing.ShippingRule = input.ShippingRule
	existing.Incoterm = input.Incoterm
	existing.TaxRate = input.TaxRate
	existing.UseCompanyRoundoffCostCenter = input.UseCompanyRoundoffCostCenter
	existing.TotalAdvance = input.TotalAdvance
	existing.ApplyDiscountOn = input.ApplyDiscountOn
	existing.CouponCode = input.CouponCode
	existing.AdditionalDiscountPercentage = input.AdditionalDiscountPercentage
	existing.DiscountAmount = input.DiscountAmount
	existing.IsCashOrNonTradeDiscount = input.IsCashOrNonTradeDiscount
	existing.AllocateAdvancesAutomatically = input.AllocateAdvancesAutomatically
	existing.RedeemLoyaltyPoints = input.RedeemLoyaltyPoints
	existing.LoyaltyProgram = input.LoyaltyProgram
	existing.CustomerAddress = input.CustomerAddress
	existing.ContactPerson = input.ContactPerson
	existing.Territory = input.Territory
	existing.ShippingAddressName = input.ShippingAddressName
	existing.DispatchAddressName = input.DispatchAddressName
	existing.CompanyAddress = input.CompanyAddress
	existing.PaymentTermsTemplate = input.PaymentTermsTemplate
	existing.TCName = input.TCName
	existing.TermsAndConditions = input.TermsAndConditions
	existing.PONo = input.PONo
	existing.PODate = input.PODate
	existing.DebitTo = input.DebitTo
	existing.SalesPartner = input.SalesPartner
	existing.AmountEligibleForCommission = input.AmountEligibleForCommission
	existing.CommissionRate = input.CommissionRate
	existing.TotalCommission = input.TotalCommission
	existing.LetterHead = input.LetterHead
	existing.GroupSameItems = input.GroupSameItems
	existing.SelectPrintHeading = input.SelectPrintHeading
	existing.Language = input.Language
	existing.Subscription = input.Subscription
	existing.FromDate = input.FromDate
	existing.ToDate = input.ToDate
	existing.UTMSource = input.UTMSource
	existing.UTMMedium = input.UTMMedium
	existing.UTMCampaign = input.UTMCampaign
	existing.UTMContent = input.UTMContent
	existing.Items = input.Items
	existing.UpdatedAt = time.Now()
	calculateSalesInvoice(&existing)
	err = db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("sales_invoice_id = ?", existing.ID).Delete(&sellingmodel.SalesInvoiceItem{}).Error; err != nil {
			return err
		}
		for i := range existing.Items {
			existing.Items[i].ID = "sii-" + uuid.NewString()[:8]
			existing.Items[i].SalesInvoiceID = existing.ID
			if err := tx.Create(&existing.Items[i]).Error; err != nil {
				return err
			}
		}
		return tx.Omit("Items").Save(&existing).Error
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui Sales Invoice"})
		return
	}
	ctx.JSON(http.StatusOK, existing)
}

func (ctrl *SalesInvoiceController) CreateReturn(ctx *gin.Context) {
	var input salesInvoiceReturnInput
	if err := ctx.ShouldBindJSON(&input); err != nil || len(input.Items) == 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Pilih minimal satu item untuk Credit Note"})
		return
	}
	db, tenant := posDB(ctx), tenantString(ctx)
	source, err := loadSalesInvoice(db, tenant, ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Sales Invoice asal tidak ditemukan"})
		return
	}
	if source.IsReturn || source.Status != sellingmodel.SalesInvoiceStatusSubmitted {
		ctx.JSON(http.StatusConflict, gin.H{"error": "Credit Note hanya dapat dibuat dari Sales Invoice Submitted"})
		return
	}
	var prior []sellingmodel.SalesInvoice
	if err := db.Preload("Items").Where("tenant_id = ? AND return_against_id = ? AND status <> ?", tenant, source.ID, sellingmodel.SalesInvoiceStatusCancelled).Find(&prior).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memeriksa histori Credit Note"})
		return
	}
	returnedQty := map[string]float64{}
	for _, credit := range prior {
		for _, item := range credit.Items {
			returnedQty[item.AgainstItemID] += math.Abs(item.Quantity)
		}
	}
	sourceItems := map[string]sellingmodel.SalesInvoiceItem{}
	for _, item := range source.Items {
		sourceItems[item.ID] = item
	}
	result := sellingmodel.SalesInvoice{
		TenantID: tenant, Customer: source.Customer, Company: source.Company, PostingDate: time.Now(),
		SalesOrderID: source.SalesOrderID, DeliveryNoteID: source.DeliveryNoteID,
		IsReturn: true, ReturnAgainstID: source.ID, ReturnReason: strings.TrimSpace(input.Reason),
		Currency: source.Currency, TaxRate: source.TaxRate, IsPaid: false,
	}
	if source.IsPaid {
		result.RefundStatus = "Pending Refund"
	} else {
		result.RefundStatus = "Credit Available"
	}
	for _, requested := range input.Items {
		sourceItem, exists := sourceItems[requested.AgainstItemID]
		remaining := math.Abs(sourceItem.Quantity) - returnedQty[requested.AgainstItemID]
		if !exists || requested.Quantity <= 0 || requested.Quantity > remaining+0.000001 {
			ctx.JSON(http.StatusConflict, gin.H{"error": "Kuantitas Credit Note melebihi sisa invoice"})
			return
		}
		returnedQty[requested.AgainstItemID] += requested.Quantity
		result.Items = append(result.Items, sellingmodel.SalesInvoiceItem{
			AgainstItemID: sourceItem.ID, ItemCode: sourceItem.ItemCode, ItemName: sourceItem.ItemName,
			Quantity: requested.Quantity, UOM: sourceItem.UOM, Rate: sourceItem.Rate,
		})
	}
	userID, _ := ctx.Get("id")
	prepareSalesInvoice(&result, tenant, coremodel.ResolveActiveCompanyName(db, userID))
	if err := db.Create(&result).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat Credit Note"})
		return
	}
	ctx.JSON(http.StatusCreated, result)
}

func createSalesLedger(tx *gorm.DB, invoice *sellingmodel.SalesInvoice, entryType, account string, debit, credit float64) error {
	return tx.Create(&sellingmodel.SalesLedgerEntry{
		ID: "sle-" + uuid.NewString()[:8], TenantID: invoice.TenantID, PostingDate: invoice.PostingDate,
		VoucherID: invoice.ID, VoucherNumber: invoice.Number, EntryType: entryType,
		Account: account, Debit: debit, Credit: credit, CreatedAt: time.Now(),
	}).Error
}

func awardSalesInvoiceLoyalty(tx *gorm.DB, invoice *sellingmodel.SalesInvoice, referenceType string) error {
	if invoice.IsReturn {
		return nil
	}
	_, err := AwardLoyaltyPoints(tx, LoyaltyAwardInput{
		TenantID:       invoice.TenantID,
		Customer:       invoice.Customer,
		Company:        invoice.Company,
		Reference:      invoice.Number,
		ReferenceType:  referenceType,
		PurchaseAmount: math.Abs(invoice.GrandTotal),
		PostingDate:    invoice.PostingDate,
		Program:        invoice.LoyaltyProgram,
	})
	return err
}

func (ctrl *SalesInvoiceController) Submit(ctx *gin.Context) {
	db, tenant := posDB(ctx), tenantString(ctx)
	invoice, err := loadSalesInvoice(db, tenant, ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Sales Invoice tidak ditemukan"})
		return
	}
	if invoice.Status == sellingmodel.SalesInvoiceStatusSubmitted {
		if err := awardSalesInvoiceLoyalty(db, &invoice, "Sales Invoice"); err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mencatat loyalty points"})
			return
		}
		ctx.JSON(http.StatusOK, invoice)
		return
	}
	if invoice.Status != sellingmodel.SalesInvoiceStatusDraft || len(invoice.Items) == 0 {
		ctx.JSON(http.StatusConflict, gin.H{"error": "Sales Invoice tidak dapat disubmit"})
		return
	}
	err = db.Transaction(func(tx *gorm.DB) error {
		invoice.Status, invoice.UpdatedAt = sellingmodel.SalesInvoiceStatusSubmitted, time.Now()
		if err := tx.Omit("Items").Save(&invoice).Error; err != nil {
			return err
		}
		amount := math.Abs(invoice.GrandTotal)
		netAmount := math.Abs(invoice.NetTotal)
		taxAmount := math.Abs(invoice.TaxAmount)
		if invoice.IsReturn {
			if err := createSalesLedger(tx, &invoice, "Credit Note", "Sales Returns", netAmount, 0); err != nil {
				return err
			}
			if taxAmount > 0 {
				if err := createSalesLedger(tx, &invoice, "Credit Note", "Output Tax Payable", taxAmount, 0); err != nil {
					return err
				}
			}
			if err := createSalesLedger(tx, &invoice, "Credit Note", "Accounts Receivable / Customer Credit", 0, amount); err != nil {
				return err
			}
			if invoice.RefundStatus == "Credit Available" && invoice.ReturnAgainstID != "" {
				return tx.Model(&sellingmodel.SalesInvoice{}).Where("tenant_id = ? AND id = ?", tenant, invoice.ReturnAgainstID).
					Update("outstanding_amount", gorm.Expr("CASE WHEN outstanding_amount > ? THEN outstanding_amount - ? ELSE 0 END", amount, amount)).Error
			}
			return nil
		}
		if err := createSalesLedger(tx, &invoice, "Sales Invoice", "Accounts Receivable", amount, 0); err != nil {
			return err
		}
		if err := createSalesLedger(tx, &invoice, "Sales Invoice", "Sales Revenue", 0, netAmount); err != nil {
			return err
		}
		if taxAmount > 0 {
			if err := createSalesLedger(tx, &invoice, "Sales Invoice", "Output Tax Payable", 0, taxAmount); err != nil {
				return err
			}
		}
		return awardSalesInvoiceLoyalty(tx, &invoice, "Sales Invoice")
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal submit Sales Invoice"})
		return
	}
	ctx.JSON(http.StatusOK, invoice)
}

func (ctrl *SalesInvoiceController) MarkPaid(ctx *gin.Context) {
	db, tenant := posDB(ctx), tenantString(ctx)
	invoice, err := loadSalesInvoice(db, tenant, ctx.Param("id"))
	if err != nil || invoice.IsReturn || invoice.Status != sellingmodel.SalesInvoiceStatusSubmitted {
		ctx.JSON(http.StatusConflict, gin.H{"error": "Sales Invoice belum dapat ditandai lunas"})
		return
	}
	if err := db.Model(&invoice).Updates(map[string]interface{}{"is_paid": true, "outstanding_amount": 0}).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mencatat pembayaran"})
		return
	}
	invoice.IsPaid, invoice.OutstandingAmount = true, 0
	ctx.JSON(http.StatusOK, invoice)
}

func (ctrl *SalesInvoiceController) Refund(ctx *gin.Context) {
	var input refundInput
	_ = ctx.ShouldBindJSON(&input)
	db, tenant := posDB(ctx), tenantString(ctx)
	invoice, err := loadSalesInvoice(db, tenant, ctx.Param("id"))
	if err != nil || !invoice.IsReturn || invoice.Status != sellingmodel.SalesInvoiceStatusSubmitted || invoice.RefundStatus != "Pending Refund" {
		ctx.JSON(http.StatusConflict, gin.H{"error": "Dokumen ini bukan Credit Note Submitted"})
		return
	}
	if invoice.RefundStatus == "Refunded" {
		ctx.JSON(http.StatusOK, invoice)
		return
	}
	now, amount := time.Now(), math.Abs(invoice.GrandTotal)
	err = db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&invoice).Updates(map[string]interface{}{
			"refund_status": "Refunded", "refund_reference": strings.TrimSpace(input.Reference), "refunded_at": &now,
		}).Error; err != nil {
			return err
		}
		if err := createSalesLedger(tx, &invoice, "Refund", "Customer Credit / Refund Payable", amount, 0); err != nil {
			return err
		}
		return createSalesLedger(tx, &invoice, "Refund", "Cash / Bank", 0, amount)
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mencatat refund"})
		return
	}
	invoice.RefundStatus, invoice.RefundReference, invoice.RefundedAt = "Refunded", strings.TrimSpace(input.Reference), &now
	ctx.JSON(http.StatusOK, invoice)
}

func (ctrl *SalesInvoiceController) Delete(ctx *gin.Context) {
	db, tenant := posDB(ctx), tenantString(ctx)
	result := db.Where("tenant_id = ? AND id = ? AND status = ?", tenant, ctx.Param("id"), sellingmodel.SalesInvoiceStatusDraft).Delete(&sellingmodel.SalesInvoice{})
	if result.Error != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus Sales Invoice"})
		return
	}
	if result.RowsAffected == 0 {
		ctx.JSON(http.StatusConflict, gin.H{"error": "Hanya Sales Invoice Draft yang dapat dihapus"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "Sales Invoice terhapus"})
}
