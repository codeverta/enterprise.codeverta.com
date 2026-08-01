package controller

import (
	"net/http"
	"strings"

	coremodel "gin-template/model"
	buyingmodel "gin-template/modules/buying/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type MasterDataController struct{}

func NewMasterDataController() *MasterDataController { return &MasterDataController{} }

func masterID(c *gin.Context) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return uuid.Nil, false
	}
	return id, true
}

func masterError(c *gin.Context, err error) {
	if err == gorm.ErrRecordNotFound {
		c.JSON(http.StatusNotFound, gin.H{"error": "record not found"})
		return
	}
	if strings.Contains(strings.ToLower(err.Error()), "unique") || strings.Contains(strings.ToLower(err.Error()), "duplicate") {
		c.JSON(http.StatusConflict, gin.H{"error": "kode atau nama sudah digunakan"})
		return
	}
	c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
}

func (h *MasterDataController) SupplierList(c *gin.Context) {
	db := coremodel.GetDB(c).WithContext(c.Request.Context()).Model(&buyingmodel.Supplier{})
	if q := strings.TrimSpace(c.Query("q")); q != "" {
		like := "%" + q + "%"
		db = db.Where("supplier_name LIKE ? OR supplier_group LIKE ? OR tax_id LIKE ?", like, like, like)
	}
	var rows []buyingmodel.Supplier
	if err := db.Order("supplier_name ASC").Limit(100).Find(&rows).Error; err != nil {
		masterError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}

func (h *MasterDataController) SupplierGet(c *gin.Context) {
	id, ok := masterID(c)
	if !ok {
		return
	}
	var row buyingmodel.Supplier
	if err := coremodel.GetDB(c).Preload("CustomerNumbers", func(db *gorm.DB) *gorm.DB { return db.Order("idx ASC") }).First(&row, "id = ?", id).Error; err != nil {
		masterError(c, err)
		return
	}
	c.JSON(http.StatusOK, row)
}

func resetSupplierChildren(row *buyingmodel.Supplier) {
	for i := range row.CustomerNumbers {
		row.CustomerNumbers[i].ID = uuid.Nil
		row.CustomerNumbers[i].SupplierID = row.ID
		row.CustomerNumbers[i].TenantID = row.TenantID
		row.CustomerNumbers[i].Idx = i + 1
	}
}

func (h *MasterDataController) SupplierCreate(c *gin.Context) {
	var row buyingmodel.Supplier
	if err := c.ShouldBindJSON(&row); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	row.ID = uuid.Nil
	children := row.CustomerNumbers
	row.CustomerNumbers = nil
	db := coremodel.GetDB(c).WithContext(c.Request.Context())
	if err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&row).Error; err != nil {
			return err
		}
		row.CustomerNumbers = children
		resetSupplierChildren(&row)
		if len(row.CustomerNumbers) > 0 {
			return tx.Create(&row.CustomerNumbers).Error
		}
		return nil
	}); err != nil {
		masterError(c, err)
		return
	}
	c.JSON(http.StatusCreated, row)
}

func (h *MasterDataController) SupplierUpdate(c *gin.Context) {
	id, ok := masterID(c)
	if !ok {
		return
	}
	var input, existing buyingmodel.Supplier
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	db := coremodel.GetDB(c).WithContext(c.Request.Context())
	if err := db.First(&existing, "id = ?", id).Error; err != nil {
		masterError(c, err)
		return
	}
	input.ID, input.TenantID, input.CreatedAt = existing.ID, existing.TenantID, existing.CreatedAt
	children := input.CustomerNumbers
	input.CustomerNumbers = nil
	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Omit("CustomerNumbers").Save(&input).Error; err != nil {
			return err
		}
		if err := tx.Where("supplier_id = ?", id).Delete(&buyingmodel.SupplierCustomerNumber{}).Error; err != nil {
			return err
		}
		input.CustomerNumbers = children
		resetSupplierChildren(&input)
		if len(input.CustomerNumbers) > 0 {
			return tx.Create(&input.CustomerNumbers).Error
		}
		return nil
	})
	if err != nil {
		masterError(c, err)
		return
	}
	c.JSON(http.StatusOK, input)
}

func (h *MasterDataController) SupplierDelete(c *gin.Context) {
	id, ok := masterID(c)
	if !ok {
		return
	}
	if err := coremodel.GetDB(c).Delete(&buyingmodel.Supplier{}, "id = ?", id).Error; err != nil {
		masterError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *MasterDataController) GroupList(c *gin.Context) {
	db := coremodel.GetDB(c).WithContext(c.Request.Context())
	var rows []buyingmodel.SupplierGroup
	if err := db.Order("parent_group ASC, group_name ASC").Find(&rows).Error; err != nil {
		masterError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}

func (h *MasterDataController) GroupGet(c *gin.Context) {
	id, ok := masterID(c)
	if !ok {
		return
	}
	var row buyingmodel.SupplierGroup
	if err := coremodel.GetDB(c).First(&row, "id = ?", id).Error; err != nil {
		masterError(c, err)
		return
	}
	c.JSON(http.StatusOK, row)
}
func (h *MasterDataController) GroupCreate(c *gin.Context) {
	var row buyingmodel.SupplierGroup
	if err := c.ShouldBindJSON(&row); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	row.ID = uuid.Nil
	if err := coremodel.GetDB(c).Create(&row).Error; err != nil {
		masterError(c, err)
		return
	}
	c.JSON(http.StatusCreated, row)
}
func (h *MasterDataController) GroupUpdate(c *gin.Context) {
	id, ok := masterID(c)
	if !ok {
		return
	}
	var input, existing buyingmodel.SupplierGroup
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	db := coremodel.GetDB(c)
	if err := db.First(&existing, "id = ?", id).Error; err != nil {
		masterError(c, err)
		return
	}
	input.ID, input.TenantID, input.CreatedAt = existing.ID, existing.TenantID, existing.CreatedAt
	if err := db.Save(&input).Error; err != nil {
		masterError(c, err)
		return
	}
	c.JSON(http.StatusOK, input)
}
func (h *MasterDataController) GroupDelete(c *gin.Context) {
	id, ok := masterID(c)
	if !ok {
		return
	}
	if err := coremodel.GetDB(c).Delete(&buyingmodel.SupplierGroup{}, "id = ?", id).Error; err != nil {
		masterError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func preloadItem(db *gorm.DB) *gorm.DB {
	return db.Preload("UOMs", func(d *gorm.DB) *gorm.DB { return d.Order("idx ASC") }).Preload("Barcodes", func(d *gorm.DB) *gorm.DB { return d.Order("idx ASC") }).Preload("ReorderLevels", func(d *gorm.DB) *gorm.DB { return d.Order("idx ASC") }).Preload("SupplierItems", func(d *gorm.DB) *gorm.DB { return d.Order("idx ASC") })
}
func (h *MasterDataController) ItemList(c *gin.Context) {
	db := coremodel.GetDB(c).Model(&buyingmodel.Item{})
	if q := strings.TrimSpace(c.Query("q")); q != "" {
		like := "%" + q + "%"
		db = db.Where("item_code LIKE ? OR item_name LIKE ? OR item_group LIKE ?", like, like, like)
	}
	var rows []buyingmodel.Item
	if err := db.Order("item_name ASC").Limit(100).Find(&rows).Error; err != nil {
		masterError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}
func (h *MasterDataController) ItemGet(c *gin.Context) {
	id, ok := masterID(c)
	if !ok {
		return
	}
	var row buyingmodel.Item
	if err := preloadItem(coremodel.GetDB(c)).First(&row, "id = ?", id).Error; err != nil {
		masterError(c, err)
		return
	}
	c.JSON(http.StatusOK, row)
}

func resetItemChildren(row *buyingmodel.Item) {
	for i := range row.UOMs {
		row.UOMs[i].ID = uuid.Nil
		row.UOMs[i].ItemID = row.ID
		row.UOMs[i].TenantID = row.TenantID
		row.UOMs[i].Idx = i + 1
	}
	for i := range row.Barcodes {
		row.Barcodes[i].ID = uuid.Nil
		row.Barcodes[i].ItemID = row.ID
		row.Barcodes[i].TenantID = row.TenantID
		row.Barcodes[i].Idx = i + 1
	}
	for i := range row.ReorderLevels {
		row.ReorderLevels[i].ID = uuid.Nil
		row.ReorderLevels[i].ItemID = row.ID
		row.ReorderLevels[i].TenantID = row.TenantID
		row.ReorderLevels[i].Idx = i + 1
	}
	for i := range row.SupplierItems {
		row.SupplierItems[i].ID = uuid.Nil
		row.SupplierItems[i].ItemID = row.ID
		row.SupplierItems[i].TenantID = row.TenantID
		row.SupplierItems[i].Idx = i + 1
	}
}
func createItemChildren(tx *gorm.DB, row *buyingmodel.Item) error {
	resetItemChildren(row)
	if len(row.UOMs) > 0 {
		if err := tx.Create(&row.UOMs).Error; err != nil {
			return err
		}
	}
	if len(row.Barcodes) > 0 {
		if err := tx.Create(&row.Barcodes).Error; err != nil {
			return err
		}
	}
	if len(row.ReorderLevels) > 0 {
		if err := tx.Create(&row.ReorderLevels).Error; err != nil {
			return err
		}
	}
	if len(row.SupplierItems) > 0 {
		if err := tx.Create(&row.SupplierItems).Error; err != nil {
			return err
		}
	}
	return nil
}
func detachItemChildren(row *buyingmodel.Item) ([]buyingmodel.ItemUOM, []buyingmodel.ItemBarcode, []buyingmodel.ItemReorderLevel, []buyingmodel.ItemSupplier) {
	u, b, r, s := row.UOMs, row.Barcodes, row.ReorderLevels, row.SupplierItems
	row.UOMs, row.Barcodes, row.ReorderLevels, row.SupplierItems = nil, nil, nil, nil
	return u, b, r, s
}

func (h *MasterDataController) ItemCreate(c *gin.Context) {
	var row buyingmodel.Item
	if err := c.ShouldBindJSON(&row); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	row.ID = uuid.Nil
	u, b, r, s := detachItemChildren(&row)
	db := coremodel.GetDB(c)
	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&row).Error; err != nil {
			return err
		}
		row.UOMs, row.Barcodes, row.ReorderLevels, row.SupplierItems = u, b, r, s
		return createItemChildren(tx, &row)
	})
	if err != nil {
		masterError(c, err)
		return
	}
	c.JSON(http.StatusCreated, row)
}
func (h *MasterDataController) ItemUpdate(c *gin.Context) {
	id, ok := masterID(c)
	if !ok {
		return
	}
	var input, existing buyingmodel.Item
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	db := coremodel.GetDB(c)
	if err := db.First(&existing, "id = ?", id).Error; err != nil {
		masterError(c, err)
		return
	}
	input.ID, input.TenantID, input.CreatedAt = existing.ID, existing.TenantID, existing.CreatedAt
	u, b, r, s := detachItemChildren(&input)
	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Omit("UOMs", "Barcodes", "ReorderLevels", "SupplierItems").Save(&input).Error; err != nil {
			return err
		}
		for _, value := range []interface{}{&buyingmodel.ItemUOM{}, &buyingmodel.ItemBarcode{}, &buyingmodel.ItemReorderLevel{}, &buyingmodel.ItemSupplier{}} {
			if err := tx.Where("item_id = ?", id).Delete(value).Error; err != nil {
				return err
			}
		}
		input.UOMs, input.Barcodes, input.ReorderLevels, input.SupplierItems = u, b, r, s
		return createItemChildren(tx, &input)
	})
	if err != nil {
		masterError(c, err)
		return
	}
	c.JSON(http.StatusOK, input)
}
func (h *MasterDataController) ItemDelete(c *gin.Context) {
	id, ok := masterID(c)
	if !ok {
		return
	}
	if err := coremodel.GetDB(c).Delete(&buyingmodel.Item{}, "id = ?", id).Error; err != nil {
		masterError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *MasterDataController) Options(c *gin.Context) {
	db := coremodel.GetDB(c)
	distinct := func(value interface{}, column string) []string {
		var rows []string
		_ = db.Model(value).Where(column+" <> ''").Distinct().Order(column).Pluck(column, &rows).Error
		return rows
	}
	groups := distinct(&buyingmodel.SupplierGroup{}, "group_name")
	if len(groups) == 0 {
		groups = []string{"All Supplier Groups", "Distributor", "Electrical", "Hardware", "Local", "Pharmaceutical", "Raw Material", "Services"}
	}
	c.JSON(http.StatusOK, gin.H{"supplier_groups": groups, "suppliers": distinct(&buyingmodel.Supplier{}, "supplier_name"), "items": distinct(&buyingmodel.Item{}, "item_code"), "item_groups": []string{"All Item Groups", "Products", "Raw Material", "Services", "Consumable", "Sub Assemblies"}, "countries": []string{"Indonesia", "Singapore", "Malaysia", "China", "United States"}, "currencies": []string{"IDR", "USD", "SGD", "EUR"}, "price_lists": []string{"Standard Buying", "Standard Selling"}, "languages": []string{"English", "Bahasa Indonesia"}, "uoms": []string{"Nos", "Unit", "Pcs", "Box", "Kg", "Gram", "Meter", "Set"}, "weight_uoms": []string{"Kg", "Gram", "Pound"}, "warehouses": distinct(&buyingmodel.PurchaseOrderItem{}, "target_warehouse")})
}
