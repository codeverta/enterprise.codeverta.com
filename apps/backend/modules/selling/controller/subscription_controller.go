package controller

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"gin-template/model"
	sellingmodel "gin-template/modules/selling/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type SubscriptionController struct{}

func NewSubscriptionController() *SubscriptionController {
	return &SubscriptionController{}
}

func (c *SubscriptionController) generateSubscriptionNumber(db *gorm.DB, tenantID string) string {
	year := time.Now().Format("2006")
	prefix := "SUB-" + year + "-"

	var count int64
	db.Model(&sellingmodel.Subscription{}).Where("tenant_id = ? AND subscription_number LIKE ?", tenantID, prefix+"%").Count(&count)
	return fmt.Sprintf("%s%05d", prefix, count+1)
}

func (c *SubscriptionController) List(ctx *gin.Context) {
	tenant := sellingTenant(ctx)
	db := model.GetDB(ctx).WithContext(ctx.Request.Context())

	query := db.Model(&sellingmodel.Subscription{}).Where("tenant_id = ?", tenant).Preload("Plans")
	if q := strings.TrimSpace(ctx.Query("q")); q != "" {
		like := "%" + q + "%"
		query = query.Where("subscription_number LIKE ? OR party LIKE ? OR company LIKE ?", like, like, like)
	}
	if status := strings.TrimSpace(ctx.Query("status")); status != "" && status != "All" {
		query = query.Where("status = ?", status)
	}
	if partyType := strings.TrimSpace(ctx.Query("party_type")); partyType != "" {
		query = query.Where("party_type = ?", partyType)
	}

	var rows []sellingmodel.Subscription
	if err := query.Order("created_at desc").Find(&rows).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data Subscription: " + err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": rows})
}

func (c *SubscriptionController) Get(ctx *gin.Context) {
	tenant := sellingTenant(ctx)
	id := strings.TrimSpace(ctx.Param("id"))
	db := model.GetDB(ctx).WithContext(ctx.Request.Context())

	var row sellingmodel.Subscription
	if err := db.Where("tenant_id = ? AND (id = ? OR subscription_number = ?)", tenant, id, id).Preload("Plans").First(&row).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Subscription tidak ditemukan"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": row})
}

func (c *SubscriptionController) Create(ctx *gin.Context) {
	tenant := sellingTenant(ctx)
	db := model.GetDB(ctx).WithContext(ctx.Request.Context())

	var input sellingmodel.Subscription
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Payload data tidak valid: " + err.Error()})
		return
	}

	if strings.TrimSpace(input.Party) == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Party wajib diisi"})
		return
	}
	if strings.TrimSpace(input.PartyType) == "" {
		input.PartyType = "Customer"
	}
	if strings.TrimSpace(input.Company) == "" {
		input.Company = "Codeverta"
	}
	if strings.TrimSpace(input.Status) == "" {
		input.Status = "Draft"
	}

	input.ID = uuid.New().String()
	input.TenantID = tenant
	if strings.TrimSpace(input.SubscriptionNumber) == "" {
		input.SubscriptionNumber = c.generateSubscriptionNumber(db, tenant)
	}

	for i := range input.Plans {
		input.Plans[i].ID = uuid.New().String()
		input.Plans[i].TenantID = tenant
		input.Plans[i].SubscriptionID = input.ID
		if input.Plans[i].Quantity <= 0 {
			input.Plans[i].Quantity = 1
		}
	}

	if err := db.Create(&input).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat Subscription: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{"data": input, "message": "Subscription berhasil dibuat"})
}

func (c *SubscriptionController) Update(ctx *gin.Context) {
	tenant := sellingTenant(ctx)
	id := strings.TrimSpace(ctx.Param("id"))
	db := model.GetDB(ctx).WithContext(ctx.Request.Context())

	var existing sellingmodel.Subscription
	if err := db.Where("tenant_id = ? AND (id = ? OR subscription_number = ?)", tenant, id, id).First(&existing).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Subscription tidak ditemukan"})
		return
	}

	var input sellingmodel.Subscription
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Payload data tidak valid: " + err.Error()})
		return
	}

	if strings.TrimSpace(input.Party) == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Party wajib diisi"})
		return
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		existing.PartyType = input.PartyType
		existing.Party = input.Party
		existing.Company = input.Company
		existing.StartDate = input.StartDate
		existing.EndDate = input.EndDate
		existing.TrialPeriodStart = input.TrialPeriodStart
		existing.TrialPeriodEnd = input.TrialPeriodEnd
		existing.FollowCalendarMonths = input.FollowCalendarMonths
		existing.GenerateNewInvoicesPastDueDate = input.GenerateNewInvoicesPastDueDate
		existing.SubmitInvoice = input.SubmitInvoice
		existing.DaysUntilDue = input.DaysUntilDue
		existing.GenerateInvoiceAt = input.GenerateInvoiceAt
		existing.CancelAtPeriodEnd = input.CancelAtPeriodEnd
		existing.ApplyAdditionalDiscount = input.ApplyAdditionalDiscount
		existing.AdditionalDiscountPercentage = input.AdditionalDiscountPercentage
		existing.AdditionalDiscountAmount = input.AdditionalDiscountAmount
		existing.CostCenter = input.CostCenter
		if input.Status != "" {
			existing.Status = input.Status
		}

		if err := tx.Save(&existing).Error; err != nil {
			return err
		}

		if err := tx.Where("subscription_id = ?", existing.ID).Delete(&sellingmodel.SubscriptionPlanItem{}).Error; err != nil {
			return err
		}

		for _, p := range input.Plans {
			planItem := sellingmodel.SubscriptionPlanItem{
				ID:             uuid.New().String(),
				TenantID:       tenant,
				SubscriptionID: existing.ID,
				Plan:           p.Plan,
				Quantity:       p.Quantity,
			}
			if planItem.Quantity <= 0 {
				planItem.Quantity = 1
			}
			if err := tx.Create(&planItem).Error; err != nil {
				return err
			}
		}
		return nil
	})

	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui Subscription: " + err.Error()})
		return
	}

	_ = db.Where("id = ?", existing.ID).Preload("Plans").First(&existing)
	ctx.JSON(http.StatusOK, gin.H{"data": existing, "message": "Subscription berhasil diperbarui"})
}

func (c *SubscriptionController) Delete(ctx *gin.Context) {
	tenant := sellingTenant(ctx)
	id := strings.TrimSpace(ctx.Param("id"))
	db := model.GetDB(ctx).WithContext(ctx.Request.Context())

	var existing sellingmodel.Subscription
	if err := db.Where("tenant_id = ? AND (id = ? OR subscription_number = ?)", tenant, id, id).First(&existing).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Subscription tidak ditemukan"})
		return
	}

	if err := db.Select("Plans").Delete(&existing).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus Subscription: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "Subscription berhasil dihapus"})
}
