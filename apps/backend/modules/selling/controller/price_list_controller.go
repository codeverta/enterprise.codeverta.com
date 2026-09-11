package controller

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"gin-template/model"
	sellingmodel "gin-template/modules/selling/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type PriceListController struct{}

func NewPriceListController() *PriceListController {
	return &PriceListController{}
}

func priceListDB(ctx *gin.Context) *gorm.DB {
	return model.GetDB(ctx).WithContext(ctx.Request.Context())
}

func priceListTenant(ctx *gin.Context) string {
	return strings.TrimSpace(ctx.GetString("tenant_id"))
}

func (ctrl *PriceListController) ListPriceLists(ctx *gin.Context) {
	db, tenant := priceListDB(ctx), priceListTenant(ctx)
	var count int64
	db.Model(&sellingmodel.PriceList{}).Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant).Count(&count)
	if count == 0 {
		_ = sellingmodel.SeedPriceLists(db, tenant)
	}

	var priceLists []sellingmodel.PriceList
	query := db.Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant)
	if search := strings.TrimSpace(ctx.Query("q")); search != "" {
		like := "%" + search + "%"
		query = query.Where("price_list_name LIKE ?", like)
	}
	if err := query.Order("price_list_name asc").Find(&priceLists).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil Price List"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": priceLists})
}

func (ctrl *PriceListController) Seed(ctx *gin.Context) {
	db, tenant := priceListDB(ctx), priceListTenant(ctx)
	if err := sellingmodel.SeedPriceLists(db, tenant); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal seeding Price List"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "Price List default berhasil di-seed"})
}

func (ctrl *PriceListController) GetPriceList(ctx *gin.Context) {
	db, tenant, id := priceListDB(ctx), priceListTenant(ctx), ctx.Param("id")
	var priceList sellingmodel.PriceList
	if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).First(&priceList).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "Price List tidak ditemukan"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil Price List"})
		return
	}
	ctx.JSON(http.StatusOK, priceList)
}

func (ctrl *PriceListController) CreatePriceList(ctx *gin.Context) {
	var input sellingmodel.PriceList
	if err := ctx.ShouldBindJSON(&input); err != nil || strings.TrimSpace(input.PriceListName) == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Price List Name wajib diisi"})
		return
	}
	db, tenant := priceListDB(ctx), priceListTenant(ctx)
	input.ID = "pl-" + uuid.NewString()[:8]
	input.TenantID = tenant
	if input.Currency == "" {
		input.Currency = "IDR"
	}
	if err := db.Create(&input).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat Price List"})
		return
	}
	ctx.JSON(http.StatusCreated, input)
}

func (ctrl *PriceListController) UpdatePriceList(ctx *gin.Context) {
	id := ctx.Param("id")
	var input sellingmodel.PriceList
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Data Price List tidak valid"})
		return
	}
	db, tenant := priceListDB(ctx), priceListTenant(ctx)
	var existing sellingmodel.PriceList
	if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).First(&existing).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Price List tidak ditemukan"})
		return
	}
	existing.PriceListName = strings.TrimSpace(input.PriceListName)
	existing.Currency = strings.TrimSpace(input.Currency)
	existing.Buying = input.Buying
	existing.Selling = input.Selling
	existing.Enabled = input.Enabled
	if err := db.Save(&existing).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui Price List"})
		return
	}
	ctx.JSON(http.StatusOK, existing)
}

func (ctrl *PriceListController) DeletePriceList(ctx *gin.Context) {
	db, tenant, id := priceListDB(ctx), priceListTenant(ctx), ctx.Param("id")
	if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).Delete(&sellingmodel.PriceList{}).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus Price List"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "Price List terhapus"})
}

func (ctrl *PriceListController) ListItemPrices(ctx *gin.Context) {
	db, tenant := priceListDB(ctx), priceListTenant(ctx)
	var itemPrices []sellingmodel.ItemPrice
	query := db.Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant)
	if priceList := strings.TrimSpace(ctx.Query("price_list")); priceList != "" {
		query = query.Where("price_list = ?", priceList)
	}
	if search := strings.TrimSpace(ctx.Query("q")); search != "" {
		like := "%" + search + "%"
		query = query.Where("item_code LIKE ? OR item_name LIKE ?", like, like)
	}
	if err := query.Order("created_at desc").Find(&itemPrices).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil Item Price"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": itemPrices})
}

func (ctrl *PriceListController) GetItemPrice(ctx *gin.Context) {
	db, tenant, id := priceListDB(ctx), priceListTenant(ctx), ctx.Param("id")
	var itemPrice sellingmodel.ItemPrice
	if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).First(&itemPrice).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "Item Price tidak ditemukan"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil Item Price"})
		return
	}
	ctx.JSON(http.StatusOK, itemPrice)
}

type ItemPriceRequest struct {
	ItemCode      string      `json:"item_code"`
	ItemName      string      `json:"item_name"`
	PriceList     string      `json:"price_list"`
	PriceListRate float64     `json:"price_list_rate"`
	Currency      string      `json:"currency"`
	UOM           string      `json:"uom"`
	PackingUnit   float64     `json:"packing_unit"`
	BatchNo       string      `json:"batch_no"`
	Buying        bool        `json:"buying"`
	Selling       bool        `json:"selling"`
	LeadTimeDays  int         `json:"lead_time_days"`
	ValidFrom     interface{} `json:"valid_from"`
	ValidUpto     interface{} `json:"valid_upto"`
	Note          string      `json:"note"`
	Reference     string      `json:"reference"`
	IsActive      *bool       `json:"is_active"`
}

func parseFlexibleDate(val interface{}) *time.Time {
	if val == nil {
		return nil
	}
	s, ok := val.(string)
	if !ok {
		return nil
	}
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	formats := []string{
		"2006-01-02",
		time.RFC3339,
		"2006-01-02T15:04:05Z07:00",
		"2006-01-02T15:04:05",
		"2006-01-02 15:04:05",
	}
	for _, layout := range formats {
		if t, err := time.Parse(layout, s); err == nil {
			return &t
		}
	}
	return nil
}

func (ctrl *PriceListController) CreateItemPrice(ctx *gin.Context) {
	var input ItemPriceRequest
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Data Item Price tidak valid: " + err.Error()})
		return
	}
	if strings.TrimSpace(input.ItemCode) == "" || strings.TrimSpace(input.PriceList) == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Item Code dan Price List wajib diisi"})
		return
	}
	db, tenant := priceListDB(ctx), priceListTenant(ctx)
	itemPrice := sellingmodel.ItemPrice{
		ID:            "ip-" + uuid.NewString()[:8],
		TenantID:      tenant,
		ItemCode:      strings.TrimSpace(input.ItemCode),
		ItemName:      strings.TrimSpace(input.ItemName),
		PriceList:     strings.TrimSpace(input.PriceList),
		PriceListRate: input.PriceListRate,
		Currency:      strings.TrimSpace(input.Currency),
		UOM:           strings.TrimSpace(input.UOM),
		PackingUnit:   input.PackingUnit,
		BatchNo:       strings.TrimSpace(input.BatchNo),
		Buying:        input.Buying,
		Selling:       input.Selling,
		LeadTimeDays:  input.LeadTimeDays,
		ValidFrom:     parseFlexibleDate(input.ValidFrom),
		ValidUpto:     parseFlexibleDate(input.ValidUpto),
		Note:          strings.TrimSpace(input.Note),
		Reference:     strings.TrimSpace(input.Reference),
		IsActive:      true,
	}
	if itemPrice.Currency == "" {
		itemPrice.Currency = "IDR"
	}
	if itemPrice.PackingUnit <= 0 {
		itemPrice.PackingUnit = 1
	}
	if input.IsActive != nil {
		itemPrice.IsActive = *input.IsActive
	}
	if err := db.Create(&itemPrice).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat Item Price"})
		return
	}
	ctx.JSON(http.StatusCreated, itemPrice)
}

func (ctrl *PriceListController) UpdateItemPrice(ctx *gin.Context) {
	id := ctx.Param("id")
	var input ItemPriceRequest
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Data Item Price tidak valid: " + err.Error()})
		return
	}
	if strings.TrimSpace(input.ItemCode) == "" || strings.TrimSpace(input.PriceList) == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Item Code dan Price List wajib diisi"})
		return
	}
	db, tenant := priceListDB(ctx), priceListTenant(ctx)
	var existing sellingmodel.ItemPrice
	if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).First(&existing).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Item Price tidak ditemukan"})
		return
	}
	existing.ItemCode = strings.TrimSpace(input.ItemCode)
	existing.ItemName = strings.TrimSpace(input.ItemName)
	existing.PriceList = strings.TrimSpace(input.PriceList)
	existing.PriceListRate = input.PriceListRate
	existing.Currency = strings.TrimSpace(input.Currency)
	existing.UOM = strings.TrimSpace(input.UOM)
	if input.PackingUnit > 0 {
		existing.PackingUnit = input.PackingUnit
	}
	existing.BatchNo = strings.TrimSpace(input.BatchNo)
	existing.Buying = input.Buying
	existing.Selling = input.Selling
	existing.LeadTimeDays = input.LeadTimeDays
	existing.ValidFrom = parseFlexibleDate(input.ValidFrom)
	existing.ValidUpto = parseFlexibleDate(input.ValidUpto)
	existing.Note = strings.TrimSpace(input.Note)
	existing.Reference = strings.TrimSpace(input.Reference)
	if input.IsActive != nil {
		existing.IsActive = *input.IsActive
	}
	if err := db.Save(&existing).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui Item Price"})
		return
	}
	ctx.JSON(http.StatusOK, existing)
}

func (ctrl *PriceListController) DeleteItemPrice(ctx *gin.Context) {
	db, tenant, id := priceListDB(ctx), priceListTenant(ctx), ctx.Param("id")
	if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).Delete(&sellingmodel.ItemPrice{}).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus Item Price"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "Item Price terhapus"})
}
