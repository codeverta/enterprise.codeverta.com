package controller

import (
	"gin-template/model"
	sellingmodel "gin-template/modules/selling/model"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"log"
	"net/http"
	"strings"
	"time"
)

type CustomerController struct{}

func NewCustomerController() *CustomerController { return &CustomerController{} }
func (c *CustomerController) List(ctx *gin.Context) {
	tenant := strings.TrimSpace(ctx.GetString("tenant_id"))
	db := model.GetDB(ctx).WithContext(ctx.Request.Context())
	q := db.Model(&sellingmodel.Customer{}).Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant)
	if term := strings.TrimSpace(ctx.Query("q")); term != "" {
		like := "%" + term + "%"
		q = q.Where("customer_name LIKE ? OR email LIKE ? OR phone LIKE ? OR customer_group LIKE ? OR territory LIKE ?", like, like, like, like, like)
	}
	var rows []sellingmodel.Customer
	if err := q.Order("customer_name asc").Find(&rows).Error; err != nil {
		log.Printf("selling customers list query failed: %v", err)
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data customer", "detail": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": rows})
}
func (c *CustomerController) Get(ctx *gin.Context) {
	var row sellingmodel.Customer
	tenant := strings.TrimSpace(ctx.GetString("tenant_id"))
	if err := model.GetDB(ctx).WithContext(ctx.Request.Context()).Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, ctx.Param("id")).First(&row).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Customer tidak ditemukan"})
		return
	}
	ctx.JSON(http.StatusOK, row)
}
func (c *CustomerController) Create(ctx *gin.Context) {
	var in sellingmodel.Customer
	if err := ctx.ShouldBindJSON(&in); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	in.ID = uuid.New().String()
	in.TenantID = ctx.GetString("tenant_id")
	in.CreatedAt = time.Now()
	in.UpdatedAt = time.Now()
	if in.CustomerType == "" {
		in.CustomerType = "Company"
	}
	if in.DefaultCurrency == "" {
		in.DefaultCurrency = "IDR"
	}
	if in.DefaultPriceList == "" {
		in.DefaultPriceList = "Standard Selling"
	}
	db := model.GetDB(ctx).WithContext(ctx.Request.Context())
	if in.IsDefaultForPOS {
		_ = db.Model(&sellingmodel.Customer{}).
			Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", in.TenantID).
			Update("is_default_for_pos", false).Error
	}
	if err := db.Create(&in).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat customer"})
		return
	}
	ctx.JSON(http.StatusCreated, in)
}
func (c *CustomerController) Update(ctx *gin.Context) {
	var row sellingmodel.Customer
	tenant := strings.TrimSpace(ctx.GetString("tenant_id"))
	db := model.GetDB(ctx).WithContext(ctx.Request.Context())
	if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, ctx.Param("id")).First(&row).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Customer tidak ditemukan"})
		return
	}
	var in sellingmodel.Customer
	if err := ctx.ShouldBindJSON(&in); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	in.ID = row.ID
	in.TenantID = row.TenantID
	in.CreatedAt = row.CreatedAt
	in.UpdatedAt = time.Now()
	if in.IsDefaultForPOS {
		_ = db.Model(&sellingmodel.Customer{}).
			Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id != ?", tenant, row.ID).
			Update("is_default_for_pos", false).Error
	}
	if err := db.Save(&in).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengupdate customer"})
		return
	}
	ctx.JSON(http.StatusOK, in)
}
func (c *CustomerController) Delete(ctx *gin.Context) {
	tenant := strings.TrimSpace(ctx.GetString("tenant_id"))
	if err := model.GetDB(ctx).WithContext(ctx.Request.Context()).Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, ctx.Param("id")).Delete(&sellingmodel.Customer{}).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus customer"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "Customer berhasil dihapus"})
}
