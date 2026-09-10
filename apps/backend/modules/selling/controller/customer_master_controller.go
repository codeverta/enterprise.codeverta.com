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

type CustomerMasterController struct{}

func NewCustomerMasterController() *CustomerMasterController { return &CustomerMasterController{} }

func sellingTenant(ctx *gin.Context) string { return strings.TrimSpace(ctx.GetString("tenant_id")) }

func scopedSelling(ctx *gin.Context, value interface{}) *gorm.DB {
	return model.GetDB(ctx).WithContext(ctx.Request.Context()).Model(value).Where("tenant_id = ?", sellingTenant(ctx))
}

func (c *CustomerMasterController) ListCustomerGroups(ctx *gin.Context) {
	query := scopedSelling(ctx, &sellingmodel.CustomerGroup{})
	if term := strings.TrimSpace(ctx.Query("q")); term != "" {
		like := "%" + term + "%"
		query = query.Where("group_name LIKE ? OR parent_group LIKE ?", like, like)
	}
	var rows []sellingmodel.CustomerGroup
	if err := query.Order("parent_group asc, group_name asc").Find(&rows).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil customer group"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": rows})
}

func (c *CustomerMasterController) GetCustomerGroup(ctx *gin.Context) {
	var row sellingmodel.CustomerGroup
	if err := scopedSelling(ctx, &sellingmodel.CustomerGroup{}).Where("id = ?", ctx.Param("id")).First(&row).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Customer Group tidak ditemukan"})
		return
	}
	ctx.JSON(http.StatusOK, row)
}

func (c *CustomerMasterController) CreateCustomerGroup(ctx *gin.Context) {
	var row sellingmodel.CustomerGroup
	if err := ctx.ShouldBindJSON(&row); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	row.GroupName = strings.TrimSpace(row.GroupName)
	if row.GroupName == row.ParentGroup {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Customer Group tidak boleh menjadi induknya sendiri"})
		return
	}
	var count int64
	scopedSelling(ctx, &sellingmodel.CustomerGroup{}).Where("group_name = ?", row.GroupName).Count(&count)
	if count > 0 {
		ctx.JSON(http.StatusConflict, gin.H{"error": "Nama Customer Group sudah digunakan"})
		return
	}
	row.ID, row.TenantID, row.CreatedAt, row.UpdatedAt = uuid.NewString(), sellingTenant(ctx), time.Now(), time.Now()
	if err := model.GetDB(ctx).WithContext(ctx.Request.Context()).Create(&row).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat Customer Group"})
		return
	}
	ctx.JSON(http.StatusCreated, row)
}

func (c *CustomerMasterController) UpdateCustomerGroup(ctx *gin.Context) {
	var old sellingmodel.CustomerGroup
	if err := scopedSelling(ctx, &sellingmodel.CustomerGroup{}).Where("id = ?", ctx.Param("id")).First(&old).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Customer Group tidak ditemukan"})
		return
	}
	var row sellingmodel.CustomerGroup
	if err := ctx.ShouldBindJSON(&row); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	row.GroupName = strings.TrimSpace(row.GroupName)
	if row.GroupName == row.ParentGroup {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Customer Group tidak boleh menjadi induknya sendiri"})
		return
	}
	var count int64
	scopedSelling(ctx, &sellingmodel.CustomerGroup{}).Where("group_name = ? AND id <> ?", row.GroupName, old.ID).Count(&count)
	if count > 0 {
		ctx.JSON(http.StatusConflict, gin.H{"error": "Nama Customer Group sudah digunakan"})
		return
	}
	row.ID, row.TenantID, row.CreatedAt, row.UpdatedAt = old.ID, old.TenantID, old.CreatedAt, time.Now()
	if err := model.GetDB(ctx).WithContext(ctx.Request.Context()).Save(&row).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengubah Customer Group"})
		return
	}
	ctx.JSON(http.StatusOK, row)
}

func (c *CustomerMasterController) DeleteCustomerGroup(ctx *gin.Context) {
	var row sellingmodel.CustomerGroup
	if err := scopedSelling(ctx, &sellingmodel.CustomerGroup{}).Where("id = ?", ctx.Param("id")).First(&row).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Customer Group tidak ditemukan"})
		return
	}
	var children int64
	scopedSelling(ctx, &sellingmodel.CustomerGroup{}).Where("parent_group = ?", row.GroupName).Count(&children)
	if children > 0 {
		ctx.JSON(http.StatusConflict, gin.H{"error": "Customer Group masih memiliki grup turunan"})
		return
	}
	if err := model.GetDB(ctx).WithContext(ctx.Request.Context()).Delete(&row).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus Customer Group"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "Customer Group berhasil dihapus"})
}

func listAddresses(ctx *gin.Context) {
	query := scopedSelling(ctx, &sellingmodel.Address{})
	if term := strings.TrimSpace(ctx.Query("q")); term != "" {
		like := "%" + term + "%"
		query = query.Where("address_title LIKE ? OR city LIKE ? OR linked_name LIKE ? OR phone LIKE ?", like, like, like, like)
	}
	var rows []sellingmodel.Address
	if err := query.Order("address_title asc").Find(&rows).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil alamat"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": rows})
}
func listContacts(ctx *gin.Context) {
	query := scopedSelling(ctx, &sellingmodel.Contact{})
	if term := strings.TrimSpace(ctx.Query("q")); term != "" {
		like := "%" + term + "%"
		query = query.Where("first_name LIKE ? OR last_name LIKE ? OR email_id LIKE ? OR mobile_no LIKE ? OR linked_name LIKE ?", like, like, like, like, like)
	}
	var rows []sellingmodel.Contact
	if err := query.Order("first_name asc, last_name asc").Find(&rows).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil kontak"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": rows})
}

func (c *CustomerMasterController) ListAddresses(ctx *gin.Context) { listAddresses(ctx) }
func (c *CustomerMasterController) ListContacts(ctx *gin.Context)  { listContacts(ctx) }

func getMaster[T sellingmodel.Address | sellingmodel.Contact](ctx *gin.Context, label string) {
	var row T
	if err := scopedSelling(ctx, &row).Where("id = ?", ctx.Param("id")).First(&row).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": label + " tidak ditemukan"})
		return
	}
	ctx.JSON(http.StatusOK, row)
}
func createMaster[T sellingmodel.Address | sellingmodel.Contact](ctx *gin.Context, label string) {
	var row T
	if err := ctx.ShouldBindJSON(&row); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	now := time.Now()
	switch v := any(&row).(type) {
	case *sellingmodel.Address:
		v.ID = uuid.NewString()
		v.TenantID = sellingTenant(ctx)
		v.CreatedAt = now
		v.UpdatedAt = now
		if v.Country == "" {
			v.Country = "Indonesia"
		}
		if v.AddressType == "" {
			v.AddressType = "Billing"
		}
	case *sellingmodel.Contact:
		v.ID = uuid.NewString()
		v.TenantID = sellingTenant(ctx)
		v.CreatedAt = now
		v.UpdatedAt = now
		if v.Status == "" {
			v.Status = "Open"
		}
	}
	if err := model.GetDB(ctx).WithContext(ctx.Request.Context()).Create(&row).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat " + label})
		return
	}
	ctx.JSON(http.StatusCreated, row)
}
func updateMaster[T sellingmodel.Address | sellingmodel.Contact](ctx *gin.Context, label string) {
	var old T
	if err := scopedSelling(ctx, &old).Where("id = ?", ctx.Param("id")).First(&old).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": label + " tidak ditemukan"})
		return
	}
	var row T
	if err := ctx.ShouldBindJSON(&row); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	now := time.Now()
	switch v := any(&row).(type) {
	case *sellingmodel.Address:
		o := any(&old).(*sellingmodel.Address)
		v.ID = o.ID
		v.TenantID = o.TenantID
		v.CreatedAt = o.CreatedAt
		v.UpdatedAt = now
	case *sellingmodel.Contact:
		o := any(&old).(*sellingmodel.Contact)
		v.ID = o.ID
		v.TenantID = o.TenantID
		v.CreatedAt = o.CreatedAt
		v.UpdatedAt = now
	}
	if err := model.GetDB(ctx).WithContext(ctx.Request.Context()).Save(&row).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengubah " + label})
		return
	}
	ctx.JSON(http.StatusOK, row)
}
func deleteMaster[T sellingmodel.Address | sellingmodel.Contact](ctx *gin.Context, label string) {
	var row T
	if err := scopedSelling(ctx, &row).Where("id = ?", ctx.Param("id")).First(&row).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": label + " tidak ditemukan"})
		return
	}
	if err := model.GetDB(ctx).WithContext(ctx.Request.Context()).Delete(&row).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus " + label})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": label + " berhasil dihapus"})
}
func (c *CustomerMasterController) GetAddress(ctx *gin.Context) {
	getMaster[sellingmodel.Address](ctx, "Alamat")
}
func (c *CustomerMasterController) CreateAddress(ctx *gin.Context) {
	createMaster[sellingmodel.Address](ctx, "Alamat")
}
func (c *CustomerMasterController) UpdateAddress(ctx *gin.Context) {
	updateMaster[sellingmodel.Address](ctx, "Alamat")
}
func (c *CustomerMasterController) DeleteAddress(ctx *gin.Context) {
	deleteMaster[sellingmodel.Address](ctx, "Alamat")
}
func (c *CustomerMasterController) GetContact(ctx *gin.Context) {
	getMaster[sellingmodel.Contact](ctx, "Kontak")
}
func (c *CustomerMasterController) CreateContact(ctx *gin.Context) {
	createMaster[sellingmodel.Contact](ctx, "Kontak")
}
func (c *CustomerMasterController) UpdateContact(ctx *gin.Context) {
	updateMaster[sellingmodel.Contact](ctx, "Kontak")
}
func (c *CustomerMasterController) DeleteContact(ctx *gin.Context) {
	deleteMaster[sellingmodel.Contact](ctx, "Kontak")
}
