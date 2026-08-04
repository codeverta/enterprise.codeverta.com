package controller

import (
	"errors"
	"net/http"
	"strings"

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

func (ctrl *PriceListController) CreateItemPrice(ctx *gin.Context) {
	var input sellingmodel.ItemPrice
	if err := ctx.ShouldBindJSON(&input); err != nil || strings.TrimSpace(input.ItemCode) == "" || strings.TrimSpace(input.PriceList) == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Item Code dan Price List wajib diisi"})
		return
	}
	db, tenant := priceListDB(ctx), priceListTenant(ctx)
	input.ID = "ip-" + uuid.NewString()[:8]
	input.TenantID = tenant
	if input.Currency == "" {
		input.Currency = "IDR"
	}
	input.IsActive = true
	if err := db.Create(&input).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat Item Price"})
		return
	}
	ctx.JSON(http.StatusCreated, input)
}

func (ctrl *PriceListController) UpdateItemPrice(ctx *gin.Context) {
	id := ctx.Param("id")
	var input sellingmodel.ItemPrice
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Data Item Price tidak valid"})
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
	existing.ValidFrom = input.ValidFrom
	existing.ValidUpto = input.ValidUpto
	existing.Note = strings.TrimSpace(input.Note)
	existing.IsActive = input.IsActive
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
