package controller

import (
	"net/http"
	"strings"

	"gin-template/model"
	sellingmodel "gin-template/modules/selling/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type SubscriptionPlanController struct{}

func NewSubscriptionPlanController() *SubscriptionPlanController {
	return &SubscriptionPlanController{}
}

func (c *SubscriptionPlanController) List(ctx *gin.Context) {
	tenant := sellingTenant(ctx)
	db := model.GetDB(ctx).WithContext(ctx.Request.Context())

	query := db.Model(&sellingmodel.SubscriptionPlanMaster{}).Where("tenant_id = ?", tenant)
	if q := strings.TrimSpace(ctx.Query("q")); q != "" {
		like := "%" + q + "%"
		query = query.Where("plan_name LIKE ? OR item LIKE ? OR price_determination LIKE ? OR currency LIKE ?", like, like, like, like)
	}
	if status := strings.TrimSpace(ctx.Query("status")); status != "" && status != "All" {
		if status == "Active" {
			query = query.Where("disabled = ? OR status = ?", false, "Active")
		} else if status == "Disabled" {
			query = query.Where("disabled = ? OR status = ?", true, "Disabled")
		} else {
			query = query.Where("status = ?", status)
		}
	}

	var rows []sellingmodel.SubscriptionPlanMaster
	if err := query.Order("created_at desc").Find(&rows).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data Subscription Plan: " + err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": rows})
}

func (c *SubscriptionPlanController) Get(ctx *gin.Context) {
	tenant := sellingTenant(ctx)
	id := strings.TrimSpace(ctx.Param("id"))
	db := model.GetDB(ctx).WithContext(ctx.Request.Context())

	var row sellingmodel.SubscriptionPlanMaster
	if err := db.Where("tenant_id = ? AND (id = ? OR plan_name = ?)", tenant, id, id).First(&row).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Subscription Plan tidak ditemukan"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": row})
}

func (c *SubscriptionPlanController) Create(ctx *gin.Context) {
	tenant := sellingTenant(ctx)
	db := model.GetDB(ctx).WithContext(ctx.Request.Context())

	var input sellingmodel.SubscriptionPlanMaster
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Payload data tidak valid: " + err.Error()})
		return
	}

	input.PlanName = strings.TrimSpace(input.PlanName)
	if input.PlanName == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Plan Name wajib diisi"})
		return
	}

	if strings.TrimSpace(input.Currency) == "" {
		input.Currency = "IDR"
	}
	if strings.TrimSpace(input.PriceDetermination) == "" {
		input.PriceDetermination = "Fixed Rate"
	}
	if strings.TrimSpace(input.BillingInterval) == "" {
		input.BillingInterval = "Month"
	}
	if input.BillingIntervalCount <= 0 {
		input.BillingIntervalCount = 1
	}
	if input.Disabled {
		input.Status = "Disabled"
	} else if strings.TrimSpace(input.Status) == "" {
		input.Status = "Active"
	}

	input.ID = uuid.New().String()
	input.TenantID = tenant

	if err := db.Create(&input).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat Subscription Plan: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{"data": input, "message": "Subscription Plan berhasil dibuat"})
}

func (c *SubscriptionPlanController) Update(ctx *gin.Context) {
	tenant := sellingTenant(ctx)
	id := strings.TrimSpace(ctx.Param("id"))
	db := model.GetDB(ctx).WithContext(ctx.Request.Context())

	var existing sellingmodel.SubscriptionPlanMaster
	if err := db.Where("tenant_id = ? AND (id = ? OR plan_name = ?)", tenant, id, id).First(&existing).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Subscription Plan tidak ditemukan"})
		return
	}

	var input sellingmodel.SubscriptionPlanMaster
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Payload data tidak valid: " + err.Error()})
		return
	}

	input.PlanName = strings.TrimSpace(input.PlanName)
	if input.PlanName == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Plan Name wajib diisi"})
		return
	}

	existing.PlanName = input.PlanName
	if input.Currency != "" {
		existing.Currency = input.Currency
	}
	existing.Item = input.Item
	if input.PriceDetermination != "" {
		existing.PriceDetermination = input.PriceDetermination
	}
	existing.Cost = input.Cost
	existing.PriceList = input.PriceList
	if input.BillingInterval != "" {
		existing.BillingInterval = input.BillingInterval
	}
	if input.BillingIntervalCount > 0 {
		existing.BillingIntervalCount = input.BillingIntervalCount
	}
	existing.ProductPriceID = input.ProductPriceID
	existing.PaymentGateway = input.PaymentGateway
	existing.CostCenter = input.CostCenter
	existing.Disabled = input.Disabled
	if input.Disabled {
		existing.Status = "Disabled"
	} else if input.Status != "" {
		existing.Status = input.Status
	} else {
		existing.Status = "Active"
	}

	if err := db.Save(&existing).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui Subscription Plan: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": existing, "message": "Subscription Plan berhasil diperbarui"})
}

func (c *SubscriptionPlanController) Delete(ctx *gin.Context) {
	tenant := sellingTenant(ctx)
	id := strings.TrimSpace(ctx.Param("id"))
	db := model.GetDB(ctx).WithContext(ctx.Request.Context())

	var existing sellingmodel.SubscriptionPlanMaster
	if err := db.Where("tenant_id = ? AND (id = ? OR plan_name = ?)", tenant, id, id).First(&existing).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Subscription Plan tidak ditemukan"})
		return
	}

	if err := db.Delete(&existing).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus Subscription Plan: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "Subscription Plan berhasil dihapus"})
}
