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

type PurchaseInvoiceController struct{}

func NewPurchaseInvoiceController() *PurchaseInvoiceController { return &PurchaseInvoiceController{} }

func (h *PurchaseInvoiceController) List(c *gin.Context) {
	page, pageSize := positiveInt(c.DefaultQuery("page", "1"), 1), positiveInt(c.DefaultQuery("page_size", "20"), 20)
	if pageSize > 100 {
		pageSize = 100
	}
	db := coremodel.GetDB(c).WithContext(c.Request.Context()).Model(&buyingmodel.PurchaseInvoice{})
	if search := strings.TrimSpace(c.Query("q")); search != "" {
		like := "%" + search + "%"
		db = db.Where("number LIKE ? OR supplier LIKE ? OR bill_no LIKE ? OR company LIKE ?", like, like, like, like)
	}
	if status := strings.TrimSpace(c.Query("status")); status != "" {
		db = db.Where("status = ?", status)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		writeInvoiceError(c, err)
		return
	}
	rows := make([]buyingmodel.PurchaseInvoice, 0)
	if err := db.Order("posting_date DESC, created_at DESC").Limit(pageSize).Offset((page - 1) * pageSize).Find(&rows).Error; err != nil {
		writeInvoiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows, "meta": gin.H{"page": page, "page_size": pageSize, "total": total}})
}

func (h *PurchaseInvoiceController) Get(c *gin.Context) {
	id, ok := purchaseInvoiceID(c)
	if !ok {
		return
	}
	var invoice buyingmodel.PurchaseInvoice
	err := coremodel.GetDB(c).WithContext(c.Request.Context()).Preload("Items", func(db *gorm.DB) *gorm.DB { return db.Order("idx ASC") }).Preload("Taxes", func(db *gorm.DB) *gorm.DB { return db.Order("idx ASC") }).First(&invoice, "id = ?", id).Error
	if err != nil {
		writeInvoiceLookupError(c, err)
		return
	}
	c.JSON(http.StatusOK, invoice)
}

func (h *PurchaseInvoiceController) Create(c *gin.Context) {
	var invoice buyingmodel.PurchaseInvoice
	if err := c.ShouldBindJSON(&invoice); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	resetInvoiceIDs(&invoice)
	invoice.Status = buyingmodel.PurchaseInvoiceDraft
	invoice.Calculate()
	db := coremodel.GetDB(c).WithContext(c.Request.Context())
	err := db.Transaction(func(tx *gorm.DB) error {
		number, err := nextPurchaseInvoiceNumber(tx, invoice.NamingSeries, invoice.PostingDate)
		if err != nil {
			return err
		}
		invoice.Number = number
		if err := tx.Omit("Items", "Taxes").Create(&invoice).Error; err != nil {
			return err
		}
		return createInvoiceChildren(tx, &invoice)
	})
	if err != nil {
		writeInvoiceError(c, err)
		return
	}
	c.JSON(http.StatusCreated, invoice)
}

func (h *PurchaseInvoiceController) Update(c *gin.Context) {
	id, ok := purchaseInvoiceID(c)
	if !ok {
		return
	}
	var input buyingmodel.PurchaseInvoice
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	db := coremodel.GetDB(c).WithContext(c.Request.Context())
	var existing buyingmodel.PurchaseInvoice
	if err := db.First(&existing, "id = ?", id).Error; err != nil {
		writeInvoiceLookupError(c, err)
		return
	}
	if existing.Status != buyingmodel.PurchaseInvoiceDraft {
		c.JSON(http.StatusConflict, gin.H{"error": "only draft purchase invoices can be edited"})
		return
	}
	preserveInvoiceIdentity(&input, existing)
	input.Calculate()
	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Omit("Items", "Taxes", "ID", "TenantID", "Number", "Status", "CreatedAt", "DeletedAt").Save(&input).Error; err != nil {
			return err
		}
		if err := tx.Where("purchase_invoice_id = ?", id).Delete(&buyingmodel.PurchaseInvoiceItem{}).Error; err != nil {
			return err
		}
		if err := tx.Where("purchase_invoice_id = ?", id).Delete(&buyingmodel.PurchaseInvoiceTax{}).Error; err != nil {
			return err
		}
		return createInvoiceChildren(tx, &input)
	})
	if err != nil {
		writeInvoiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, input)
}

func (h *PurchaseInvoiceController) Submit(c *gin.Context) {
	id, ok := purchaseInvoiceID(c)
	if !ok {
		return
	}
	now := time.Now()
	result := coremodel.GetDB(c).WithContext(c.Request.Context()).Model(&buyingmodel.PurchaseInvoice{}).Where("id = ? AND status = ?", id, buyingmodel.PurchaseInvoiceDraft).Updates(map[string]interface{}{"status": buyingmodel.PurchaseInvoiceSubmitted, "submitted_at": &now})
	if result.Error != nil {
		writeInvoiceError(c, result.Error)
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "purchase invoice is not an editable draft"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": buyingmodel.PurchaseInvoiceSubmitted, "submitted_at": now})
}

func (h *PurchaseInvoiceController) Delete(c *gin.Context) {
	id, ok := purchaseInvoiceID(c)
	if !ok {
		return
	}
	result := coremodel.GetDB(c).WithContext(c.Request.Context()).Where("status = ?", buyingmodel.PurchaseInvoiceDraft).Delete(&buyingmodel.PurchaseInvoice{}, "id = ?", id)
	if result.Error != nil {
		writeInvoiceError(c, result.Error)
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "only draft purchase invoices can be deleted"})
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *PurchaseInvoiceController) Options(c *gin.Context) {
	db := coremodel.GetDB(c).WithContext(c.Request.Context())
	distinct := func(value interface{}, column string) []string {
		rows := make([]string, 0)
		_ = db.Model(value).Where(column+" <> ''").Distinct().Order(column+" ASC").Pluck(column, &rows).Error
		return rows
	}
	merge := func(groups ...[]string) []string {
		seen := map[string]bool{}
		out := make([]string, 0)
		for _, group := range groups {
			for _, value := range group {
				if value != "" && !seen[value] {
					seen[value] = true
					out = append(out, value)
				}
			}
		}
		return out
	}
	companies := merge(distinct(&buyingmodel.PurchaseInvoice{}, "company"), distinct(&buyingmodel.PurchaseOrder{}, "company"))
	if len(companies) == 0 {
		companies = []string{"PT ZENIT TECHNOLOGY SOLUTION"}
	}
	c.JSON(http.StatusOK, gin.H{
		"companies":    companies,
		"suppliers":    merge(distinct(&buyingmodel.Supplier{}, "supplier_name"), distinct(&buyingmodel.PurchaseInvoice{}, "supplier"), distinct(&buyingmodel.PurchaseOrder{}, "supplier")),
		"warehouses":   merge(distinct(&buyingmodel.PurchaseInvoiceItem{}, "warehouse"), distinct(&buyingmodel.PurchaseOrderItem{}, "target_warehouse")),
		"items":        merge(distinct(&buyingmodel.Item{}, "item_code"), distinct(&buyingmodel.PurchaseInvoiceItem{}, "item_code"), distinct(&buyingmodel.PurchaseOrderItem{}, "item_code")),
		"cost_centers": merge(distinct(&buyingmodel.PurchaseInvoice{}, "cost_center"), distinct(&buyingmodel.PurchaseOrder{}, "cost_center")),
		"projects":     merge(distinct(&buyingmodel.PurchaseInvoice{}, "project"), distinct(&buyingmodel.PurchaseOrder{}, "project")),
		"currencies":   []string{"IDR", "USD", "SGD", "EUR"}, "price_lists": []string{"Standard Buying"},
		"uoms": []string{"Unit", "Pcs", "Box", "Kg", "Meter", "Set"}, "modes_of_payment": []string{"Cash", "Bank Transfer", "Credit Card", "Cheque"},
		"accounts": merge(
			distinct(&buyingmodel.PurchaseInvoice{}, "cash_bank_account"),
			distinct(&buyingmodel.PurchaseInvoiceTax{}, "account_head"),
		),
	})
}

func createInvoiceChildren(tx *gorm.DB, invoice *buyingmodel.PurchaseInvoice) error {
	for index := range invoice.Items {
		invoice.Items[index].ID = uuid.Nil
		invoice.Items[index].TenantID = invoice.TenantID
		invoice.Items[index].PurchaseInvoiceID = invoice.ID
	}
	for index := range invoice.Taxes {
		invoice.Taxes[index].ID = uuid.Nil
		invoice.Taxes[index].TenantID = invoice.TenantID
		invoice.Taxes[index].PurchaseInvoiceID = invoice.ID
	}
	if len(invoice.Items) > 0 {
		if err := tx.Create(&invoice.Items).Error; err != nil {
			return err
		}
	}
	if len(invoice.Taxes) > 0 {
		return tx.Create(&invoice.Taxes).Error
	}
	return nil
}

func nextPurchaseInvoiceNumber(tx *gorm.DB, series string, date time.Time) (string, error) {
	if series == "" {
		series = "ACC-PINV-.YYYY.-"
	}
	year := date.Year()
	if year == 0 {
		year = time.Now().Year()
	}
	prefix := strings.ReplaceAll(series, ".YYYY.", strconv.Itoa(year))
	var sequence buyingmodel.PurchaseInvoiceSequence
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("year = ? AND prefix = ?", year, prefix).First(&sequence).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		sequence = buyingmodel.PurchaseInvoiceSequence{Year: year, Prefix: prefix, Current: 1}
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

func resetInvoiceIDs(invoice *buyingmodel.PurchaseInvoice) {
	invoice.ID, invoice.TenantID, invoice.Number = uuid.Nil, uuid.Nil, ""
	invoice.CreatedAt, invoice.UpdatedAt = time.Time{}, time.Time{}
	for index := range invoice.Items {
		invoice.Items[index].ID, invoice.Items[index].TenantID, invoice.Items[index].PurchaseInvoiceID = uuid.Nil, uuid.Nil, uuid.Nil
	}
	for index := range invoice.Taxes {
		invoice.Taxes[index].ID, invoice.Taxes[index].TenantID, invoice.Taxes[index].PurchaseInvoiceID = uuid.Nil, uuid.Nil, uuid.Nil
	}
}

func preserveInvoiceIdentity(input *buyingmodel.PurchaseInvoice, existing buyingmodel.PurchaseInvoice) {
	input.ID, input.TenantID, input.Number, input.Status, input.CreatedAt = existing.ID, existing.TenantID, existing.Number, existing.Status, existing.CreatedAt
}
func purchaseInvoiceID(c *gin.Context) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid purchase invoice UUID"})
		return uuid.Nil, false
	}
	return id, true
}
func writeInvoiceLookupError(c *gin.Context, err error) {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "purchase invoice not found"})
		return
	}
	writeInvoiceError(c, err)
}
func writeInvoiceError(c *gin.Context, err error) {
	if strings.Contains(strings.ToLower(err.Error()), "duplicate") {
		c.JSON(http.StatusConflict, gin.H{"error": "purchase invoice number already exists"})
		return
	}
	c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to process purchase invoice"})
}
