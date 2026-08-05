package controller

import (
	"errors"
	"fmt"
	"math"
	"net/http"
	"strings"
	"time"

	stockmodel "gin-template/modules/stock/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type DeliveryNoteController struct{}

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
	now := time.Now()

	input.ID = "dn-" + uuid.NewString()[:8]
	input.TenantID = tenant
	if input.NamingSeries == "" {
		input.NamingSeries = "MAT-DN-.YYYY.-"
	}
	if input.IsReturn {
		input.Number = fmt.Sprintf("MAT-DN-RET-%s-%05d", now.Format("2006"), now.Unix()%100000)
	} else {
		input.Number = fmt.Sprintf("MAT-DN-%s-%05d", now.Format("2006"), now.Unix()%100000)
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

	existing.NamingSeries = input.NamingSeries
	existing.Customer = input.Customer
	existing.PostingDate = input.PostingDate
	existing.PostingTime = input.PostingTime
	existing.SetPostingTime = input.SetPostingTime
	existing.Company = input.Company
	existing.IsReturn = input.IsReturn
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
	if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).First(&note).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Delivery Note tidak ditemukan"})
		return
	}

	note.Status = stockmodel.DeliveryNoteStatusSubmitted
	note.UpdatedAt = time.Now()
	if err := db.Save(&note).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal submit Delivery Note"})
		return
	}
	ctx.JSON(http.StatusOK, note)
}

func (ctrl *DeliveryNoteController) Delete(ctx *gin.Context) {
	db, tenant, id := stockDB(ctx), stockTenant(ctx), ctx.Param("id")
	if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).Delete(&stockmodel.DeliveryNote{}).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus Delivery Note"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "Delivery Note terhapus"})
}

func (ctrl *DeliveryNoteController) Options(ctx *gin.Context) {
	ctx.JSON(http.StatusOK, gin.H{
		"naming_series": []string{"MAT-DN-.YYYY.-", "MAT-DN-RET-.YYYY.-"},
		"companies":     []string{"PT ZENIT TECHNOLOGY SOLUTION", "PT Codeverta Enterprise"},
		"warehouses":    []string{"Stores - PT ZENIT", "Finished Goods - PT ZENIT", "Work In Progress - PT ZENIT"},
		"tax_categories": []string{"In State", "Out of State", "Export"},
		"taxes_templates": []string{"PPN 11%", "PPN 12%", "Exempt Tax"},
		"shipping_rules": []string{"Standard Delivery", "Express Delivery", "Free Shipping"},
		"incoterms":     []string{"EXW", "FOB", "CIF", "DDP", "CFR"},
	})
}
