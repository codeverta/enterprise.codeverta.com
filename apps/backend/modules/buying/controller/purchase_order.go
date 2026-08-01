package controller

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	coremodel "gin-template/model"
	buyingmodel "gin-template/modules/buying/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type PurchaseOrderController struct{}

func NewPurchaseOrderController() *PurchaseOrderController { return &PurchaseOrderController{} }

func (h *PurchaseOrderController) List(c *gin.Context) {
	page := positiveInt(c.DefaultQuery("page", "1"), 1)
	pageSize := positiveInt(c.DefaultQuery("page_size", "20"), 20)
	if pageSize > 100 {
		pageSize = 100
	}
	db := coremodel.GetDB(c).WithContext(c.Request.Context()).Model(&buyingmodel.PurchaseOrder{})
	if search := strings.TrimSpace(c.Query("q")); search != "" {
		like := "%" + search + "%"
		db = db.Where("number LIKE ? OR supplier LIKE ? OR company LIKE ?", like, like, like)
	}
	if status := strings.TrimSpace(c.Query("status")); status != "" {
		db = db.Where("status = ?", status)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		writeError(c, err)
		return
	}
	rows := make([]buyingmodel.PurchaseOrder, 0)
	if err := db.Order("transaction_date DESC, created_at DESC").Limit(pageSize).Offset((page - 1) * pageSize).Find(&rows).Error; err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows, "meta": gin.H{"page": page, "page_size": pageSize, "total": total}})
}

func (h *PurchaseOrderController) Get(c *gin.Context) {
	id, ok := purchaseOrderID(c)
	if !ok {
		return
	}
	var order buyingmodel.PurchaseOrder
	if err := coremodel.GetDB(c).WithContext(c.Request.Context()).Preload("Items", func(db *gorm.DB) *gorm.DB { return db.Order("idx ASC") }).Preload("Taxes", func(db *gorm.DB) *gorm.DB { return db.Order("idx ASC") }).First(&order, "id = ?", id).Error; err != nil {
		writeLookupError(c, err)
		return
	}
	c.JSON(http.StatusOK, order)
}

func (h *PurchaseOrderController) Create(c *gin.Context) {
	var order buyingmodel.PurchaseOrder
	if err := c.ShouldBindJSON(&order); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	resetOrderIDs(&order)
	order.Status = buyingmodel.PurchaseOrderDraft
	order.Calculate()
	db := coremodel.GetDB(c).WithContext(c.Request.Context())
	err := db.Transaction(func(tx *gorm.DB) error {
		number, err := nextPurchaseOrderNumber(tx, order.NamingSeries, order.TransactionDate)
		if err != nil {
			return err
		}
		order.Number = number
		if err := tx.Omit("Items", "Taxes").Create(&order).Error; err != nil {
			return err
		}
		return createOrderChildren(tx, &order)
	})
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusCreated, order)
}

func (h *PurchaseOrderController) Update(c *gin.Context) {
	id, ok := purchaseOrderID(c)
	if !ok {
		return
	}
	var input buyingmodel.PurchaseOrder
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	db := coremodel.GetDB(c).WithContext(c.Request.Context())
	var order buyingmodel.PurchaseOrder
	if err := db.First(&order, "id = ?", id).Error; err != nil {
		writeLookupError(c, err)
		return
	}
	if order.Status != buyingmodel.PurchaseOrderDraft {
		c.JSON(http.StatusConflict, gin.H{"error": "only draft purchase orders can be edited"})
		return
	}
	preserveOrderIdentity(&input, order)
	input.Calculate()
	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Omit("Items", "Taxes", "ID", "TenantID", "Number", "Status", "CreatedAt", "DeletedAt").Save(&input).Error; err != nil {
			return err
		}
		if err := tx.Where("purchase_order_id = ?", id).Delete(&buyingmodel.PurchaseOrderItem{}).Error; err != nil {
			return err
		}
		if err := tx.Where("purchase_order_id = ?", id).Delete(&buyingmodel.PurchaseOrderTax{}).Error; err != nil {
			return err
		}
		return createOrderChildren(tx, &input)
	})
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, input)
}

func (h *PurchaseOrderController) Submit(c *gin.Context) {
	id, ok := purchaseOrderID(c)
	if !ok {
		return
	}
	now := time.Now()
	result := coremodel.GetDB(c).WithContext(c.Request.Context()).Model(&buyingmodel.PurchaseOrder{}).Where("id = ? AND status = ?", id, buyingmodel.PurchaseOrderDraft).Updates(map[string]interface{}{"status": buyingmodel.PurchaseOrderSubmitted, "submitted_at": &now})
	if result.Error != nil {
		writeError(c, result.Error)
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "purchase order is not an editable draft"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": buyingmodel.PurchaseOrderSubmitted, "submitted_at": now})
}

func (h *PurchaseOrderController) Delete(c *gin.Context) {
	id, ok := purchaseOrderID(c)
	if !ok {
		return
	}
	db := coremodel.GetDB(c).WithContext(c.Request.Context())
	result := db.Where("status = ?", buyingmodel.PurchaseOrderDraft).Delete(&buyingmodel.PurchaseOrder{}, "id = ?", id)
	if result.Error != nil {
		writeError(c, result.Error)
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "only draft purchase orders can be deleted"})
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *PurchaseOrderController) Options(c *gin.Context) {
	db := coremodel.GetDB(c).WithContext(c.Request.Context())
	distinct := func(model interface{}, column string) []string {
		values := make([]string, 0)
		_ = db.Model(model).Where(column+" <> ''").Distinct().Order(column+" ASC").Pluck(column, &values).Error
		return values
	}
	merge := func(groups ...[]string) []string {
		seen, values := map[string]bool{}, make([]string, 0)
		for _, group := range groups {
			for _, value := range group {
				if value != "" && !seen[value] {
					seen[value] = true
					values = append(values, value)
				}
			}
		}
		return values
	}
	companies := distinct(&buyingmodel.PurchaseOrder{}, "company")
	if len(companies) == 0 {
		companies = []string{"PT ZENIT TECHNOLOGY SOLUTION"}
	}
	c.JSON(http.StatusOK, gin.H{
		"companies": companies, "suppliers": merge(distinct(&buyingmodel.Supplier{}, "supplier_name"), distinct(&buyingmodel.PurchaseOrder{}, "supplier")),
		"warehouses": distinct(&buyingmodel.PurchaseOrderItem{}, "target_warehouse"), "items": merge(distinct(&buyingmodel.Item{}, "item_code"), distinct(&buyingmodel.PurchaseOrderItem{}, "item_code")),
		"cost_centers": distinct(&buyingmodel.PurchaseOrder{}, "cost_center"), "projects": distinct(&buyingmodel.PurchaseOrder{}, "project"),
		"currencies": []string{"IDR", "USD", "SGD", "EUR"}, "price_lists": []string{"Standard Buying"},
		"uoms": merge(distinct(&buyingmodel.ItemUOM{}, "uom"), []string{"Nos", "Unit", "Pcs", "Box", "Kg", "Meter", "Set"}),
	})
}

func createOrderChildren(tx *gorm.DB, order *buyingmodel.PurchaseOrder) error {
	for index := range order.Items {
		order.Items[index].ID = uuid.Nil
		order.Items[index].TenantID = order.TenantID
		order.Items[index].PurchaseOrderID = order.ID
	}
	for index := range order.Taxes {
		order.Taxes[index].ID = uuid.Nil
		order.Taxes[index].TenantID = order.TenantID
		order.Taxes[index].PurchaseOrderID = order.ID
	}
	if len(order.Items) > 0 {
		if err := tx.Create(&order.Items).Error; err != nil {
			return err
		}
	}
	if len(order.Taxes) > 0 {
		return tx.Create(&order.Taxes).Error
	}
	return nil
}

func nextPurchaseOrderNumber(tx *gorm.DB, series string, date time.Time) (string, error) {
	if series == "" {
		series = "PUR-ORD-.YYYY.-"
	}
	year := date.Year()
	if year == 0 {
		year = time.Now().Year()
	}
	prefix := strings.ReplaceAll(series, ".YYYY.", strconv.Itoa(year))
	var sequence buyingmodel.PurchaseOrderSequence
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("year = ? AND prefix = ?", year, prefix).First(&sequence).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		sequence = buyingmodel.PurchaseOrderSequence{Year: year, Prefix: prefix, Current: 1}
		if err := tx.Create(&sequence).Error; err != nil {
			return "", err
		}
	} else if err != nil {
		return "", err
	} else {
		sequence.Current++
		if err := tx.Model(&sequence).Update("current", sequence.Current).Error; err != nil {
			return "", err
		}
	}
	return fmt.Sprintf("%s%05d", prefix, sequence.Current), nil
}

func resetOrderIDs(order *buyingmodel.PurchaseOrder) {
	order.ID = uuid.Nil
	order.TenantID = uuid.Nil
	order.Number = ""
	order.CreatedAt = time.Time{}
	order.UpdatedAt = time.Time{}
	for index := range order.Items {
		order.Items[index].ID = uuid.Nil
		order.Items[index].TenantID = uuid.Nil
		order.Items[index].PurchaseOrderID = uuid.Nil
	}
	for index := range order.Taxes {
		order.Taxes[index].ID = uuid.Nil
		order.Taxes[index].TenantID = uuid.Nil
		order.Taxes[index].PurchaseOrderID = uuid.Nil
	}
}

func preserveOrderIdentity(input *buyingmodel.PurchaseOrder, existing buyingmodel.PurchaseOrder) {
	input.ID = existing.ID
	input.TenantID = existing.TenantID
	input.Number = existing.Number
	input.Status = existing.Status
	input.CreatedAt = existing.CreatedAt
}

func purchaseOrderID(c *gin.Context) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid purchase order UUID"})
		return uuid.Nil, false
	}
	return id, true
}

func positiveInt(value string, fallback int) int {
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed < 1 {
		return fallback
	}
	return parsed
}

func writeLookupError(c *gin.Context, err error) {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "purchase order not found"})
		return
	}
	writeError(c, err)
}

func writeError(c *gin.Context, err error) {
	if strings.Contains(strings.ToLower(err.Error()), "duplicate") {
		c.JSON(http.StatusConflict, gin.H{"error": "purchase order number already exists"})
		return
	}
	c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to process purchase order"})
}
