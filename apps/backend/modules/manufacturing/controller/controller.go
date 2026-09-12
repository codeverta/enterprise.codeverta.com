package controller

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	coremodel "gin-template/model"
	buyingmodel "gin-template/modules/buying/model"
	manufacturingmodel "gin-template/modules/manufacturing/model"
	sellingmodel "gin-template/modules/selling/model"
	stockmodel "gin-template/modules/stock/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Controller struct{}

func New() *Controller               { return &Controller{} }
func db(ctx *gin.Context) *gorm.DB   { return coremodel.GetDB(ctx).WithContext(ctx.Request.Context()) }
func tenant(ctx *gin.Context) string { return strings.TrimSpace(ctx.GetString("tenant_id")) }

func list[T any](ctx *gin.Context, model *T, rows any, order, searchColumn string) {
	q := db(ctx).Model(model).Where("tenant_id = ?", tenant(ctx))
	if s := strings.TrimSpace(ctx.Query("q")); s != "" {
		q = q.Where(searchColumn+" LIKE ?", "%"+s+"%")
	}
	if err := q.Order(order).Find(rows).Error; err != nil {
		ctx.JSON(500, gin.H{"error": "Gagal mengambil data"})
		return
	}
	ctx.JSON(200, gin.H{"data": rows})
}
func saveMaster(ctx *gin.Context, value any, id *string) {
	if err := ctx.ShouldBindJSON(value); err != nil {
		ctx.JSON(400, gin.H{"error": "Data tidak valid"})
		return
	}
	*id = uuid.NewString()
	now := time.Now()
	switch v := value.(type) {
	case *manufacturingmodel.Operation:
		v.TenantID = tenant(ctx)
		v.CreatedAt = now
		v.UpdatedAt = now
	case *manufacturingmodel.WorkstationType:
		v.TenantID = tenant(ctx)
		v.CreatedAt = now
		v.UpdatedAt = now
	case *manufacturingmodel.Workstation:
		v.TenantID = tenant(ctx)
		if v.JobCapacity < 1 {
			v.JobCapacity = 1
		}
		v.CreatedAt = now
		v.UpdatedAt = now
	}
	if err := db(ctx).Create(value).Error; err != nil {
		ctx.JSON(500, gin.H{"error": "Gagal menyimpan data"})
		return
	}
	ctx.JSON(201, value)
}
func updateMaster(ctx *gin.Context, value any, id *string) {
	if err := db(ctx).Where("tenant_id = ? AND id = ?", tenant(ctx), ctx.Param("id")).First(value).Error; err != nil {
		ctx.JSON(404, gin.H{"error": "Data tidak ditemukan"})
		return
	}
	existing := *id
	if err := ctx.ShouldBindJSON(value); err != nil {
		ctx.JSON(400, gin.H{"error": "Data tidak valid"})
		return
	}
	*id = existing
	if err := db(ctx).Save(value).Error; err != nil {
		ctx.JSON(500, gin.H{"error": "Gagal memperbarui data"})
		return
	}
	ctx.JSON(200, value)
}
func remove[T any](ctx *gin.Context, model *T) {
	r := db(ctx).Where("tenant_id = ? AND id = ?", tenant(ctx), ctx.Param("id")).Delete(model)
	if r.Error != nil {
		ctx.JSON(500, gin.H{"error": "Gagal menghapus data"})
		return
	}
	if r.RowsAffected == 0 {
		ctx.JSON(404, gin.H{"error": "Data tidak ditemukan"})
		return
	}
	ctx.JSON(200, gin.H{"message": "Data terhapus"})
}

func (c *Controller) ListOperations(ctx *gin.Context) {
	var rows []manufacturingmodel.Operation
	list(ctx, &manufacturingmodel.Operation{}, &rows, "name asc", "name")
}
func (c *Controller) CreateOperation(ctx *gin.Context) {
	var v manufacturingmodel.Operation
	saveMaster(ctx, &v, &v.ID)
}
func (c *Controller) UpdateOperation(ctx *gin.Context) {
	var v manufacturingmodel.Operation
	updateMaster(ctx, &v, &v.ID)
}
func (c *Controller) DeleteOperation(ctx *gin.Context) { remove(ctx, &manufacturingmodel.Operation{}) }
func (c *Controller) ListWorkstationTypes(ctx *gin.Context) {
	var rows []manufacturingmodel.WorkstationType
	list(ctx, &manufacturingmodel.WorkstationType{}, &rows, "name asc", "name")
}
func (c *Controller) CreateWorkstationType(ctx *gin.Context) {
	var v manufacturingmodel.WorkstationType
	saveMaster(ctx, &v, &v.ID)
}
func (c *Controller) UpdateWorkstationType(ctx *gin.Context) {
	var v manufacturingmodel.WorkstationType
	updateMaster(ctx, &v, &v.ID)
}
func (c *Controller) DeleteWorkstationType(ctx *gin.Context) {
	remove(ctx, &manufacturingmodel.WorkstationType{})
}
func (c *Controller) ListWorkstations(ctx *gin.Context) {
	var rows []manufacturingmodel.Workstation
	list(ctx, &manufacturingmodel.Workstation{}, &rows, "workstation_name asc", "workstation_name")
}
func (c *Controller) CreateWorkstation(ctx *gin.Context) {
	var v manufacturingmodel.Workstation
	saveMaster(ctx, &v, &v.ID)
}
func (c *Controller) UpdateWorkstation(ctx *gin.Context) {
	var v manufacturingmodel.Workstation
	updateMaster(ctx, &v, &v.ID)
}
func (c *Controller) DeleteWorkstation(ctx *gin.Context) {
	remove(ctx, &manufacturingmodel.Workstation{})
}

func calculate(v *manufacturingmodel.BOM) {
	v.RawMaterialCost = 0
	for i := range v.Items {
		v.Items[i].Amount = v.Items[i].Qty * v.Items[i].Rate
		v.RawMaterialCost += v.Items[i].Amount
	}
	v.TotalCost = v.RawMaterialCost
}
func preload(q *gorm.DB) *gorm.DB {
	return q.Preload("Items").Preload("ScrapItems").Preload("Operations")
}
func (c *Controller) ListBOM(ctx *gin.Context) {
	var rows []manufacturingmodel.BOM
	q := preload(db(ctx)).Where("tenant_id = ?", tenant(ctx))
	if s := strings.TrimSpace(ctx.Query("q")); s != "" {
		q = q.Where("bom_no LIKE ? OR item_code LIKE ? OR item_name LIKE ?", "%"+s+"%", "%"+s+"%", "%"+s+"%")
	}
	if err := q.Order("created_at desc").Find(&rows).Error; err != nil {
		ctx.JSON(500, gin.H{"error": "Gagal mengambil BOM"})
		return
	}
	ctx.JSON(200, gin.H{"data": rows})
}
func (c *Controller) GetBOM(ctx *gin.Context) {
	var v manufacturingmodel.BOM
	if err := preload(db(ctx)).Where("tenant_id = ? AND id = ?", tenant(ctx), ctx.Param("id")).First(&v).Error; err != nil {
		ctx.JSON(404, gin.H{"error": "BOM tidak ditemukan"})
		return
	}
	ctx.JSON(200, v)
}
func prepareBOM(v *manufacturingmodel.BOM, t string) {
	v.ID = uuid.NewString()
	v.TenantID = t
	if v.BOMNo == "" {
		v.BOMNo = fmt.Sprintf("BOM-%s", strings.ToUpper(uuid.NewString()[:8]))
	}
	if v.Quantity <= 0 {
		v.Quantity = 1
	}
	if v.Currency == "" {
		v.Currency = "IDR"
	}
	if v.RMCostAsPer == "" {
		v.RMCostAsPer = "Price List"
	}
	if v.TransferMaterialAgainst == "" {
		v.TransferMaterialAgainst = "Work Order"
	}
	now := time.Now()
	v.CreatedAt = now
	v.UpdatedAt = now
	for i := range v.Items {
		v.Items[i].ID = uuid.NewString()
		v.Items[i].BOMID = v.ID
	}
	for i := range v.ScrapItems {
		v.ScrapItems[i].ID = uuid.NewString()
		v.ScrapItems[i].BOMID = v.ID
	}
	for i := range v.Operations {
		v.Operations[i].ID = uuid.NewString()
		v.Operations[i].BOMID = v.ID
	}
	calculate(v)
}
func (c *Controller) CreateBOM(ctx *gin.Context) {
	var v manufacturingmodel.BOM
	if err := ctx.ShouldBindJSON(&v); err != nil || strings.TrimSpace(v.ItemCode) == "" {
		ctx.JSON(400, gin.H{"error": "Item wajib diisi"})
		return
	}
	prepareBOM(&v, tenant(ctx))
	if err := db(ctx).Create(&v).Error; err != nil {
		ctx.JSON(500, gin.H{"error": "Gagal membuat BOM"})
		return
	}
	ctx.JSON(201, v)
}
func (c *Controller) UpdateBOM(ctx *gin.Context) {
	var old manufacturingmodel.BOM
	if err := db(ctx).Where("tenant_id = ? AND id = ?", tenant(ctx), ctx.Param("id")).First(&old).Error; err != nil {
		ctx.JSON(404, gin.H{"error": "BOM tidak ditemukan"})
		return
	}
	var v manufacturingmodel.BOM
	if err := ctx.ShouldBindJSON(&v); err != nil {
		ctx.JSON(400, gin.H{"error": "Data tidak valid"})
		return
	}
	prepareBOM(&v, tenant(ctx))
	v.ID = old.ID
	v.BOMNo = old.BOMNo
	v.CreatedAt = old.CreatedAt
	tx := db(ctx).Begin()
	tx.Where("bom_id = ?", v.ID).Delete(&manufacturingmodel.BOMItem{})
	tx.Where("bom_id = ?", v.ID).Delete(&manufacturingmodel.BOMScrapItem{})
	tx.Where("bom_id = ?", v.ID).Delete(&manufacturingmodel.BOMOperation{})
	for i := range v.Items {
		v.Items[i].BOMID = v.ID
	}
	for i := range v.ScrapItems {
		v.ScrapItems[i].BOMID = v.ID
	}
	for i := range v.Operations {
		v.Operations[i].BOMID = v.ID
	}
	err := tx.Omit("Items", "ScrapItems", "Operations").Save(&v).Error
	if err == nil {
		if len(v.Items) > 0 {
			err = tx.Create(&v.Items).Error
		}
		if len(v.ScrapItems) > 0 && err == nil {
			err = tx.Create(&v.ScrapItems).Error
		}
		if len(v.Operations) > 0 && err == nil {
			err = tx.Create(&v.Operations).Error
		}
	}
	if err != nil {
		tx.Rollback()
		ctx.JSON(500, gin.H{"error": "Gagal memperbarui BOM"})
		return
	}
	tx.Commit()
	ctx.JSON(200, v)
}
func (c *Controller) DeleteBOM(ctx *gin.Context) { remove(ctx, &manufacturingmodel.BOM{}) }

func (c *Controller) Options(ctx *gin.Context) {
	t := tenant(ctx)
	var items []buyingmodel.Item
	db(ctx).Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", t).Find(&items)
	var prices []sellingmodel.PriceList
	db(ctx).Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", t).Find(&prices)
	var warehouses []stockmodel.Warehouse
	db(ctx).Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", t).Find(&warehouses)
	var operations []manufacturingmodel.Operation
	db(ctx).Where("tenant_id = ?", t).Find(&operations)
	var types []manufacturingmodel.WorkstationType
	db(ctx).Where("tenant_id = ?", t).Find(&types)
	var stations []manufacturingmodel.Workstation
	db(ctx).Where("tenant_id = ?", t).Find(&stations)
	var companies []coremodel.Company
	db(ctx).Find(&companies)
	ctx.JSON(http.StatusOK, gin.H{"items": items, "price_lists": prices, "warehouses": warehouses, "operations": operations, "workstation_types": types, "workstations": stations, "companies": companies, "currencies": []string{"IDR", "USD", "SGD", "EUR"}})
}

func (c *Controller) ListWorkOrders(ctx *gin.Context) {
	var rows []manufacturingmodel.WorkOrder
	q := db(ctx).Preload("RequiredItems").Where("tenant_id = ?", tenant(ctx))
	if s := strings.TrimSpace(ctx.Query("q")); s != "" {
		q = q.Where("work_order_no LIKE ? OR production_item LIKE ? OR item_name LIKE ?", "%"+s+"%", "%"+s+"%", "%"+s+"%")
	}
	if err := q.Order("created_at desc").Find(&rows).Error; err != nil {
		ctx.JSON(500, gin.H{"error": "Gagal mengambil Work Order"})
		return
	}
	ctx.JSON(200, gin.H{"data": rows})
}
func (c *Controller) GetWorkOrder(ctx *gin.Context) {
	var v manufacturingmodel.WorkOrder
	if err := db(ctx).Preload("RequiredItems").Where("tenant_id = ? AND id = ?", tenant(ctx), ctx.Param("id")).First(&v).Error; err != nil {
		ctx.JSON(404, gin.H{"error": "Work Order tidak ditemukan"})
		return
	}
	ctx.JSON(200, v)
}
func (c *Controller) CreateWorkOrder(ctx *gin.Context) {
	var v manufacturingmodel.WorkOrder
	if err := ctx.ShouldBindJSON(&v); err != nil || strings.TrimSpace(v.ProductionItem) == "" {
		ctx.JSON(400, gin.H{"error": "Production Item wajib diisi"})
		return
	}
	v.ID = uuid.NewString()
	v.TenantID = tenant(ctx)
	v.Status = "Draft"
	if v.WorkOrderNo == "" {
		v.WorkOrderNo = "MFG-WO-" + strings.ToUpper(uuid.NewString()[:8])
	}
	if v.NamingSeries == "" {
		v.NamingSeries = "MFG-WO-.YYYY.-"
	}
	if v.Qty <= 0 {
		v.Qty = 1
	}
	now := time.Now()
	v.CreatedAt = now
	v.UpdatedAt = now
	for i := range v.RequiredItems {
		v.RequiredItems[i].ID = uuid.NewString()
		v.RequiredItems[i].WorkOrderID = v.ID
	}
	if err := db(ctx).Create(&v).Error; err != nil {
		ctx.JSON(500, gin.H{"error": "Gagal membuat Work Order"})
		return
	}
	ctx.JSON(201, v)
}
func (c *Controller) UpdateWorkOrder(ctx *gin.Context) {
	var old manufacturingmodel.WorkOrder
	if err := db(ctx).Where("tenant_id = ? AND id = ?", tenant(ctx), ctx.Param("id")).First(&old).Error; err != nil {
		ctx.JSON(404, gin.H{"error": "Work Order tidak ditemukan"})
		return
	}
	if old.Status != "Draft" {
		ctx.JSON(409, gin.H{"error": "Hanya Work Order Draft yang dapat diubah"})
		return
	}
	var v manufacturingmodel.WorkOrder
	if err := ctx.ShouldBindJSON(&v); err != nil {
		ctx.JSON(400, gin.H{"error": "Data tidak valid"})
		return
	}
	v.ID = old.ID
	v.TenantID = old.TenantID
	v.WorkOrderNo = old.WorkOrderNo
	v.Status = old.Status
	v.CreatedAt = old.CreatedAt
	v.UpdatedAt = time.Now()
	tx := db(ctx).Begin()
	tx.Where("work_order_id = ?", v.ID).Delete(&manufacturingmodel.WorkOrderItem{})
	for i := range v.RequiredItems {
		v.RequiredItems[i].ID = uuid.NewString()
		v.RequiredItems[i].WorkOrderID = v.ID
	}
	err := tx.Omit("RequiredItems").Save(&v).Error
	if err == nil && len(v.RequiredItems) > 0 {
		err = tx.Create(&v.RequiredItems).Error
	}
	if err != nil {
		tx.Rollback()
		ctx.JSON(500, gin.H{"error": "Gagal memperbarui Work Order"})
		return
	}
	tx.Commit()
	ctx.JSON(200, v)
}
func (c *Controller) SubmitWorkOrder(ctx *gin.Context) {
	var v manufacturingmodel.WorkOrder
	if err := db(ctx).Where("tenant_id = ? AND id = ?", tenant(ctx), ctx.Param("id")).First(&v).Error; err != nil {
		ctx.JSON(404, gin.H{"error": "Work Order tidak ditemukan"})
		return
	}
	if v.Status == "Submitted" {
		ctx.JSON(200, v)
		return
	}
	if v.Status != "Draft" {
		ctx.JSON(409, gin.H{"error": "Work Order tidak dapat disubmit"})
		return
	}
	v.Status = "Submitted"
	v.UpdatedAt = time.Now()
	db(ctx).Save(&v)
	ctx.JSON(200, v)
}
func (c *Controller) DeleteWorkOrder(ctx *gin.Context) { remove(ctx, &manufacturingmodel.WorkOrder{}) }
