package controller

import (
	"net/http"
	"strings"
	"time"

	"gin-template/model"
	sellingmodel "gin-template/modules/selling/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type TaxCategoryController struct{}

func NewTaxCategoryController() *TaxCategoryController {
	return &TaxCategoryController{}
}

func (c *TaxCategoryController) seedDefaults(ctx *gin.Context, db *gorm.DB, tenantID string) {
	if tenantID == "" {
		return
	}
	var count int64
	db.Model(&sellingmodel.TaxCategory{}).Where("tenant_id = ?", tenantID).Count(&count)
	if count == 0 {
		now := time.Now()
		defaults := []string{"In State", "Out of State", "Export"}
		for _, title := range defaults {
			_ = db.Create(&sellingmodel.TaxCategory{
				ID:        uuid.NewString(),
				TenantID:  tenantID,
				Title:     title,
				Disabled:  false,
				CreatedAt: now,
				UpdatedAt: now,
			}).Error
		}
	}
}

func (c *TaxCategoryController) List(ctx *gin.Context) {
	tenant := sellingTenant(ctx)
	db := model.GetDB(ctx).WithContext(ctx.Request.Context())
	c.seedDefaults(ctx, db, tenant)

	query := db.Model(&sellingmodel.TaxCategory{}).Where("tenant_id = ?", tenant)
	if q := strings.TrimSpace(ctx.Query("q")); q != "" {
		query = query.Where("title LIKE ?", "%"+q+"%")
	}

	var rows []sellingmodel.TaxCategory
	if err := query.Order("title asc").Find(&rows).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data Tax Category: " + err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": rows})
}

func (c *TaxCategoryController) Get(ctx *gin.Context) {
	tenant := sellingTenant(ctx)
	id := strings.TrimSpace(ctx.Param("id"))
	db := model.GetDB(ctx).WithContext(ctx.Request.Context())

	var row sellingmodel.TaxCategory
	if err := db.Where("tenant_id = ? AND id = ?", tenant, id).First(&row).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Tax Category tidak ditemukan"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": row})
}

type TaxCategoryInput struct {
	Title    string `json:"title" binding:"required"`
	Disabled bool   `json:"disabled"`
}

func (c *TaxCategoryController) Create(ctx *gin.Context) {
	tenant := sellingTenant(ctx)
	var input TaxCategoryInput
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Field 'title' wajib diisi"})
		return
	}
	title := strings.TrimSpace(input.Title)
	if title == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Field 'title' tidak boleh kosong"})
		return
	}

	db := model.GetDB(ctx).WithContext(ctx.Request.Context())
	var existing sellingmodel.TaxCategory
	if err := db.Where("tenant_id = ? AND LOWER(title) = LOWER(?)", tenant, title).First(&existing).Error; err == nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Tax Category dengan judul tersebut sudah ada"})
		return
	}

	now := time.Now()
	row := sellingmodel.TaxCategory{
		ID:        uuid.NewString(),
		TenantID:  tenant,
		Title:     title,
		Disabled:  input.Disabled,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := db.Create(&row).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan Tax Category: " + err.Error()})
		return
	}
	ctx.JSON(http.StatusCreated, gin.H{"data": row})
}

func (c *TaxCategoryController) Update(ctx *gin.Context) {
	tenant := sellingTenant(ctx)
	id := strings.TrimSpace(ctx.Param("id"))
	var input TaxCategoryInput
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Field 'title' wajib diisi"})
		return
	}
	title := strings.TrimSpace(input.Title)
	if title == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Field 'title' tidak boleh kosong"})
		return
	}

	db := model.GetDB(ctx).WithContext(ctx.Request.Context())
	var row sellingmodel.TaxCategory
	if err := db.Where("tenant_id = ? AND id = ?", tenant, id).First(&row).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Tax Category tidak ditemukan"})
		return
	}

	var duplicate sellingmodel.TaxCategory
	if err := db.Where("tenant_id = ? AND LOWER(title) = LOWER(?) AND id <> ?", tenant, title, id).First(&duplicate).Error; err == nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Tax Category dengan judul tersebut sudah ada"})
		return
	}

	row.Title = title
	row.Disabled = input.Disabled
	row.UpdatedAt = time.Now()

	if err := db.Save(&row).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui Tax Category: " + err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": row})
}

func (c *TaxCategoryController) Delete(ctx *gin.Context) {
	tenant := sellingTenant(ctx)
	id := strings.TrimSpace(ctx.Param("id"))
	db := model.GetDB(ctx).WithContext(ctx.Request.Context())

	if err := db.Where("tenant_id = ? AND id = ?", tenant, id).Delete(&sellingmodel.TaxCategory{}).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus Tax Category: " + err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "Tax Category berhasil dihapus"})
}
