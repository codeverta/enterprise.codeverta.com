package controller

import (
	"fmt"
	"math"
	"net/http"
	"strings"
	"time"

	"gin-template/model"
	sellingmodel "gin-template/modules/selling/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type QuotationController struct{}

func NewQuotationController() *QuotationController {
	return &QuotationController{}
}

func (c *QuotationController) generateQuotationNumber(db *gorm.DB, tenantID, series string) string {
	year := time.Now().Format("2006")
	prefix := "SAL-QTN-" + year + "-"
	if series != "" && strings.Contains(series, ".YYYY.") {
		prefix = strings.ReplaceAll(series, ".YYYY.", year)
	}

	var count int64
	db.Model(&sellingmodel.Quotation{}).Where("tenant_id = ? AND quotation_number LIKE ?", tenantID, prefix+"%").Count(&count)
	return fmt.Sprintf("%s%05d", prefix, count+1)
}

func (c *QuotationController) List(ctx *gin.Context) {
	tenant := sellingTenant(ctx)
	db := model.GetDB(ctx).WithContext(ctx.Request.Context())

	query := db.Model(&sellingmodel.Quotation{}).Where("tenant_id = ?", tenant).Preload("Items")
	if q := strings.TrimSpace(ctx.Query("q")); q != "" {
		like := "%" + q + "%"
		query = query.Where("quotation_number LIKE ? OR party_name LIKE ? OR customer_name LIKE ?", like, like, like)
	}

	var rows []sellingmodel.Quotation
	if err := query.Order("created_at desc").Find(&rows).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data Quotation: " + err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": rows})
}

func (c *QuotationController) Get(ctx *gin.Context) {
	tenant := sellingTenant(ctx)
	id := strings.TrimSpace(ctx.Param("id"))
	db := model.GetDB(ctx).WithContext(ctx.Request.Context())

	var row sellingmodel.Quotation
	if err := db.Where("tenant_id = ? AND (id = ? OR quotation_number = ?)", tenant, id, id).Preload("Items").First(&row).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Quotation tidak ditemukan"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": row})
}

type QuotationItemInput struct {
	ItemCode string  `json:"item_code"`
	ItemName string  `json:"item_name"`
	Quantity float64 `json:"qty"`
	Rate     float64 `json:"rate"`
	Amount   float64 `json:"amount"`
}

type QuotationInput struct {
	NamingSeries                 string               `json:"naming_series"`
	QuotationTo                  string               `json:"quotation_to"`
	PartyName                    string               `json:"party_name"`
	CustomerName                 string               `json:"customer_name"`
	TransactionDate              string               `json:"transaction_date"`
	ValidTill                    string               `json:"valid_till"`
	OrderType                    string               `json:"order_type"`
	Company                      string               `json:"company"`
	Currency                     string               `json:"currency"`
	SellingPriceList             string               `json:"selling_price_list"`
	ScanBarcode                  string               `json:"scan_barcode"`
	TaxCategory                  string               `json:"tax_category"`
	TaxesAndCharges              string               `json:"taxes_and_charges"`
	ShippingRule                 string               `json:"shipping_rule"`
	Incoterm                     string               `json:"incoterm"`
	BaseTotalTaxesAndCharges     float64              `json:"base_total_taxes_and_charges"`
	TotalTaxesAndCharges         float64              `json:"total_taxes_and_charges"`
	GrandTotal                   float64              `json:"grand_total"`
	RoundingAdjustment           float64              `json:"rounding_adjustment"`
	RoundedTotal                 float64              `json:"rounded_total"`
	DisableRoundedTotal          bool                 `json:"disable_rounded_total"`
	ApplyDiscountOn              string               `json:"apply_discount_on"`
	CouponCode                   string               `json:"coupon_code"`
	AdditionalDiscountPercentage float64              `json:"additional_discount_percentage"`
	DiscountAmount               float64              `json:"discount_amount"`
	SalesPartner                 string               `json:"sales_partner"`
	Status                       string               `json:"status"`
	Items                        []QuotationItemInput `json:"items"`
}

func (c *QuotationController) Create(ctx *gin.Context) {
	tenant := sellingTenant(ctx)
	var input QuotationInput
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Format payload tidak valid: " + err.Error()})
		return
	}

	db := model.GetDB(ctx).WithContext(ctx.Request.Context())
	now := time.Now()
	qid := uuid.NewString()

	series := input.NamingSeries
	if series == "" {
		series = "SAL-QTN-.YYYY.-"
	}
	quoteNum := c.generateQuotationNumber(db, tenant, series)

	// Calculate totals if needed
	var totalQty float64
	var netTotal float64
	var items []sellingmodel.QuotationItem
	for _, it := range input.Items {
		amt := it.Amount
		if amt == 0 && it.Quantity > 0 && it.Rate > 0 {
			amt = it.Quantity * it.Rate
		}
		totalQty += it.Quantity
		netTotal += amt

		items = append(items, sellingmodel.QuotationItem{
			ID:          uuid.NewString(),
			TenantID:    tenant,
			QuotationID: qid,
			ItemCode:    it.ItemCode,
			ItemName:    it.ItemName,
			Quantity:    it.Quantity,
			Rate:        it.Rate,
			Amount:      amt,
			CreatedAt:   now,
			UpdatedAt:   now,
		})
	}

	grand := input.GrandTotal
	if grand == 0 {
		grand = netTotal + input.TotalTaxesAndCharges - input.DiscountAmount
		if grand < 0 {
			grand = 0
		}
	}
	rounded := math.Round(grand)
	adjustment := rounded - grand

	status := input.Status
	if status == "" {
		status = "Draft"
	}

	transDate := input.TransactionDate
	if transDate == "" {
		transDate = time.Now().Format("2006-01-02")
	}

	quotation := sellingmodel.Quotation{
		ID:                           qid,
		TenantID:                     tenant,
		NamingSeries:                 series,
		QuotationNumber:              quoteNum,
		QuotationTo:                  input.QuotationTo,
		PartyName:                    input.PartyName,
		CustomerName:                 input.CustomerName,
		TransactionDate:              transDate,
		ValidTill:                    input.ValidTill,
		OrderType:                    input.OrderType,
		Company:                      input.Company,
		Currency:                     input.Currency,
		SellingPriceList:             input.SellingPriceList,
		ScanBarcode:                  input.ScanBarcode,
		TotalQty:                     totalQty,
		Total:                        netTotal,
		TaxCategory:                  input.TaxCategory,
		TaxesAndCharges:              input.TaxesAndCharges,
		ShippingRule:                 input.ShippingRule,
		Incoterm:                     input.Incoterm,
		BaseTotalTaxesAndCharges:     input.BaseTotalTaxesAndCharges,
		TotalTaxesAndCharges:         input.TotalTaxesAndCharges,
		GrandTotal:                   grand,
		RoundingAdjustment:           adjustment,
		RoundedTotal:                 rounded,
		DisableRoundedTotal:          input.DisableRoundedTotal,
		ApplyDiscountOn:              input.ApplyDiscountOn,
		CouponCode:                   input.CouponCode,
		AdditionalDiscountPercentage: input.AdditionalDiscountPercentage,
		DiscountAmount:               input.DiscountAmount,
		SalesPartner:                 input.SalesPartner,
		Status:                       status,
		Items:                        items,
		CreatedAt:                    now,
		UpdatedAt:                    now,
	}

	if err := db.Create(&quotation).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan Quotation: " + err.Error()})
		return
	}
	ctx.JSON(http.StatusCreated, gin.H{"data": quotation})
}

func (c *QuotationController) Update(ctx *gin.Context) {
	tenant := sellingTenant(ctx)
	id := strings.TrimSpace(ctx.Param("id"))
	var input QuotationInput
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Format payload tidak valid: " + err.Error()})
		return
	}

	db := model.GetDB(ctx).WithContext(ctx.Request.Context())
	var row sellingmodel.Quotation
	if err := db.Where("tenant_id = ? AND id = ?", tenant, id).First(&row).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Quotation tidak ditemukan"})
		return
	}

	now := time.Now()

	// Update items: delete existing and recreate
	_ = db.Where("tenant_id = ? AND quotation_id = ?", tenant, id).Delete(&sellingmodel.QuotationItem{}).Error

	var totalQty float64
	var netTotal float64
	var items []sellingmodel.QuotationItem
	for _, it := range input.Items {
		amt := it.Amount
		if amt == 0 && it.Quantity > 0 && it.Rate > 0 {
			amt = it.Quantity * it.Rate
		}
		totalQty += it.Quantity
		netTotal += amt

		item := sellingmodel.QuotationItem{
			ID:          uuid.NewString(),
			TenantID:    tenant,
			QuotationID: id,
			ItemCode:    it.ItemCode,
			ItemName:    it.ItemName,
			Quantity:    it.Quantity,
			Rate:        it.Rate,
			Amount:      amt,
			CreatedAt:   now,
			UpdatedAt:   now,
		}
		_ = db.Create(&item).Error
		items = append(items, item)
	}

	grand := input.GrandTotal
	if grand == 0 {
		grand = netTotal + input.TotalTaxesAndCharges - input.DiscountAmount
		if grand < 0 {
			grand = 0
		}
	}
	rounded := math.Round(grand)
	adjustment := rounded - grand

	row.QuotationTo = input.QuotationTo
	row.PartyName = input.PartyName
	row.CustomerName = input.CustomerName
	row.TransactionDate = input.TransactionDate
	row.ValidTill = input.ValidTill
	row.OrderType = input.OrderType
	row.Company = input.Company
	row.Currency = input.Currency
	row.SellingPriceList = input.SellingPriceList
	row.ScanBarcode = input.ScanBarcode
	row.TotalQty = totalQty
	row.Total = netTotal
	row.TaxCategory = input.TaxCategory
	row.TaxesAndCharges = input.TaxesAndCharges
	row.ShippingRule = input.ShippingRule
	row.Incoterm = input.Incoterm
	row.BaseTotalTaxesAndCharges = input.BaseTotalTaxesAndCharges
	row.TotalTaxesAndCharges = input.TotalTaxesAndCharges
	row.GrandTotal = grand
	row.RoundingAdjustment = adjustment
	row.RoundedTotal = rounded
	row.DisableRoundedTotal = input.DisableRoundedTotal
	row.ApplyDiscountOn = input.ApplyDiscountOn
	row.CouponCode = input.CouponCode
	row.AdditionalDiscountPercentage = input.AdditionalDiscountPercentage
	row.DiscountAmount = input.DiscountAmount
	row.SalesPartner = input.SalesPartner
	if input.Status != "" {
		row.Status = input.Status
	}
	row.UpdatedAt = now

	if err := db.Save(&row).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui Quotation: " + err.Error()})
		return
	}
	row.Items = items
	ctx.JSON(http.StatusOK, gin.H{"data": row})
}

func (c *QuotationController) Delete(ctx *gin.Context) {
	tenant := sellingTenant(ctx)
	id := strings.TrimSpace(ctx.Param("id"))
	db := model.GetDB(ctx).WithContext(ctx.Request.Context())

	_ = db.Where("tenant_id = ? AND quotation_id = ?", tenant, id).Delete(&sellingmodel.QuotationItem{}).Error
	if err := db.Where("tenant_id = ? AND id = ?", tenant, id).Delete(&sellingmodel.Quotation{}).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus Quotation: " + err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "Quotation berhasil dihapus"})
}
