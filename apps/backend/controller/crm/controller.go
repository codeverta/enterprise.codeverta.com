package crm

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"reflect"
	"strconv"
	"strings"
	"time"

	"gin-template/model"
	crmmodel "gin-template/model/crm"
	sellingcontroller "gin-template/modules/selling/controller"
	sellingmodel "gin-template/modules/selling/model"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type resource struct {
	newModel     func() interface{}
	newSlice     func() interface{}
	searchFields []string
	mutable      map[string]string
}

type Controller struct {
	resources map[string]resource
}

func NewController() *Controller {
	return &Controller{resources: map[string]resource{
		"leads":            resourceOf[crmmodel.Lead]("name", "email", "phone", "company_name", "source_detail", "region", "product_interest", "utm_campaign"),
		"accounts":         resourceOf[crmmodel.Account]("name", "industry", "region", "phone"),
		"contacts":         resourceOf[crmmodel.Contact]("first_name", "last_name", "email", "phone"),
		"pipeline-stages":  resourceOf[crmmodel.PipelineStage]("name"),
		"opportunities":    resourceOf[crmmodel.Opportunity]("name", "source", "lost_reason"),
		"activities":       resourceOf[crmmodel.Activity]("subject", "description"),
		"products":         resourceOf[crmmodel.Product]("name", "sku", "description"),
		"quotations":       resourceOf[crmmodel.Quotation]("quote_number"),
		"quotation-items":  resourceOf[crmmodel.QuotationItem](),
		"sales-orders":     resourceOf[crmmodel.SalesOrder]("order_number", "customer", "customer_email"),
		"invoices":         resourceOf[crmmodel.Invoice]("invoice_number"),
		"tickets":          resourceOf[crmmodel.Ticket]("subject", "description"),
		"ticket-comments":  resourceOf[crmmodel.TicketComment]("comment"),
		"campaigns":        resourceOf[crmmodel.Campaign]("name", "type"),
		"campaign-members": resourceOf[crmmodel.CampaignMember](),
		"notes":            resourceOf[crmmodel.Note]("content"),
		"attachments":      resourceOf[crmmodel.Attachment](),
		"tags":             resourceOf[crmmodel.Tag]("name"),
		"taggables":        resourceOf[crmmodel.Taggable](),
	}}
}

func resourceOf[T any](searchFields ...string) resource {
	typeOf := reflect.TypeOf((*T)(nil)).Elem()
	return resource{
		newModel:     func() interface{} { return new(T) },
		newSlice:     func() interface{} { return &[]T{} },
		searchFields: searchFields,
		mutable:      mutableJSONFields(typeOf),
	}
}

func mutableJSONFields(t reflect.Type) map[string]string {
	result := make(map[string]string)
	var walk func(reflect.Type)
	walk = func(current reflect.Type) {
		for i := 0; i < current.NumField(); i++ {
			field := current.Field(i)
			if field.Anonymous {
				walk(field.Type)
				continue
			}
			name := strings.Split(field.Tag.Get("json"), ",")[0]
			if name == "" || name == "-" || name == "id" || name == "tenant_id" || name == "created_at" || name == "updated_at" || name == "deleted_at" || name == "user_id" || name == "created_by" || name == "uploaded_by" {
				continue
			}
			column := strings.Split(field.Tag.Get("gorm"), ";")[0]
			if strings.HasPrefix(column, "column:") {
				column = strings.TrimPrefix(column, "column:")
			} else {
				column = toSnakeCase(field.Name)
			}
			result[name] = column
		}
	}
	walk(t)
	return result
}

func toSnakeCase(value string) string {
	var b strings.Builder
	for i, r := range value {
		if i > 0 && r >= 'A' && r <= 'Z' {
			b.WriteByte('_')
		}
		b.WriteRune(r)
	}
	return strings.ToLower(b.String())
}

func (h *Controller) Create(c *gin.Context) {
	res, ok := h.resource(c)
	if !ok {
		return
	}
	record := res.newModel()
	if err := c.ShouldBindJSON(record); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if resetter, ok := record.(interface{ ResetForCreate() }); ok {
		resetter.ResetForCreate()
	}
	assignActor(record, actorID(c))
	db := model.GetDB(c).WithContext(c.Request.Context())
	if lead, ok := record.(*crmmodel.Lead); ok {
		if err := prepareLead(db, lead); err != nil {
			writeDBError(c, err)
			return
		}
	}
	if account, ok := record.(*crmmodel.Account); ok {
		if err := validateAccountParent(db, uuid.Nil, account.ParentAccountID); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
	}
	if contact, ok := record.(*crmmodel.Contact); ok {
		if err := validateContactAccount(db, contact.AccountID); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "account_id tidak ditemukan"})
			return
		}
	}
	createErr := error(nil)
	if salesOrder, ok := record.(*crmmodel.SalesOrder); ok {
		createErr = db.Transaction(func(tx *gorm.DB) error {
			if err := tx.Create(salesOrder).Error; err != nil {
				return err
			}
			postingDate := salesOrder.TransactionDate
			if postingDate.IsZero() {
				postingDate = time.Now()
			}
			_, err := sellingcontroller.AwardLoyaltyPoints(tx, sellingcontroller.LoyaltyAwardInput{
				TenantID:       salesOrder.TenantID.String(),
				Customer:       salesOrder.Customer,
				Company:        salesOrder.Company,
				Reference:      salesOrder.OrderNumber,
				ReferenceType:  "Sales Order",
				PurchaseAmount: salesOrder.TotalAmount,
				PostingDate:    postingDate,
			})
			return err
		})
	} else {
		createErr = db.Create(record).Error
	}
	if createErr != nil {
		writeDBError(c, createErr)
		return
	}
	if lead, ok := record.(*crmmodel.Lead); ok {
		dispatchLeadCreated(db, lead)
	}
	c.JSON(http.StatusCreated, record)
}

func (h *Controller) List(c *gin.Context) {
	res, ok := h.resource(c)
	if !ok {
		return
	}
	page := positiveInt(c.DefaultQuery("page", "1"), 1)
	pageSize := positiveInt(c.DefaultQuery("page_size", "20"), 20)
	if pageSize > 100 {
		pageSize = 100
	}
	db := model.GetDB(c).WithContext(c.Request.Context()).Model(res.newModel())
	if c.Param("resource") == "sales-orders" {
		db = db.Preload("Items")
	}
	for _, filter := range []string{"status", "owner_id", "assigned_to", "account_id", "contact_id", "stage_id", "campaign_id", "opportunity_id", "quotation_id", "ticket_id", "related_to_type", "related_to_id", "is_active"} {
		if value := strings.TrimSpace(c.Query(filter)); value != "" {
			db = db.Where(filter+" = ?", value)
		}
	}
	if query := strings.TrimSpace(c.Query("q")); query != "" && len(res.searchFields) > 0 {
		parts := make([]string, 0, len(res.searchFields))
		args := make([]interface{}, 0, len(res.searchFields))
		for _, field := range res.searchFields {
			parts = append(parts, field+" LIKE ?")
			args = append(args, "%"+query+"%")
		}
		db = db.Where("("+strings.Join(parts, " OR ")+")", args...)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		writeDBError(c, err)
		return
	}
	rows := res.newSlice()
	if err := db.Order("created_at DESC").Limit(pageSize).Offset((page - 1) * pageSize).Find(rows).Error; err != nil {
		writeDBError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows, "meta": gin.H{"page": page, "page_size": pageSize, "total": total}})
}

func (h *Controller) Get(c *gin.Context) {
	res, ok := h.resource(c)
	if !ok {
		return
	}
	id, ok := parseID(c)
	if !ok {
		return
	}
	record := res.newModel()
	db := model.GetDB(c).WithContext(c.Request.Context())
	if c.Param("resource") == "sales-orders" {
		db = db.Preload("Items")
	}
	if err := db.First(record, "id = ?", id).Error; err != nil {
		writeLookupError(c, err)
		return
	}
	if salesOrder, isSalesOrder := record.(*crmmodel.SalesOrder); isSalesOrder && salesOrder.StoreOrderID != nil {
		var storeOrder sellingmodel.StoreOrder
		if err := db.Preload("Items").Where("tenant_id = ? AND id = ?", salesOrder.TenantID, *salesOrder.StoreOrderID).First(&storeOrder).Error; err == nil {
			paidAt := time.Now()
			if storeOrder.PaidAt != nil {
				paidAt = *storeOrder.PaidAt
			}
			if err := sellingcontroller.EnsureERPSalesOrder(db, &storeOrder, paidAt); err != nil {
				writeDBError(c, err)
				return
			}
			if err := db.Preload("Items").First(record, "id = ?", id).Error; err != nil {
				writeLookupError(c, err)
				return
			}
		}
	}
	c.JSON(http.StatusOK, record)
}

func (h *Controller) Update(c *gin.Context) {
	res, ok := h.resource(c)
	if !ok {
		return
	}
	id, ok := parseID(c)
	if !ok {
		return
	}
	record := res.newModel()
	db := model.GetDB(c).WithContext(c.Request.Context())
	if err := db.First(record, "id = ?", id).Error; err != nil {
		writeLookupError(c, err)
		return
	}
	var payload map[string]interface{}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	updates := make(map[string]interface{})
	for jsonName, value := range payload {
		if column, allowed := res.mutable[jsonName]; allowed {
			updates[column] = value
		}
	}
	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no mutable CRM fields supplied"})
		return
	}
	// Merge into a typed copy so the same validation rules used by Create also
	// protect partial updates.
	encoded, _ := json.Marshal(payload)
	if err := json.Unmarshal(encoded, record); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := binding.Validator.ValidateStruct(record); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if account, ok := record.(*crmmodel.Account); ok {
		if err := validateAccountParent(db, id, account.ParentAccountID); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
	}
	if contact, ok := record.(*crmmodel.Contact); ok {
		if err := validateContactAccount(db, contact.AccountID); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "account_id tidak ditemukan"})
			return
		}
	}
	if lead, ok := record.(*crmmodel.Lead); ok {
		updates["score"] = calculateLeadScore(lead, nil)
	}
	if err := db.Model(record).Updates(updates).Error; err != nil {
		writeDBError(c, err)
		return
	}
	if err := db.First(record, "id = ?", id).Error; err != nil {
		writeDBError(c, err)
		return
	}
	if salesOrder, ok := record.(*crmmodel.SalesOrder); ok {
		postingDate := salesOrder.TransactionDate
		if postingDate.IsZero() {
			postingDate = time.Now()
		}
		if _, err := sellingcontroller.AwardLoyaltyPoints(db, sellingcontroller.LoyaltyAwardInput{
			TenantID:       salesOrder.TenantID.String(),
			Customer:       salesOrder.Customer,
			Company:        salesOrder.Company,
			Reference:      salesOrder.OrderNumber,
			ReferenceType:  "Sales Order",
			PurchaseAmount: salesOrder.TotalAmount,
			PostingDate:    postingDate,
		}); err != nil {
			writeDBError(c, err)
			return
		}
	}
	c.JSON(http.StatusOK, record)
}

func (h *Controller) Delete(c *gin.Context) {
	res, ok := h.resource(c)
	if !ok {
		return
	}
	id, ok := parseID(c)
	if !ok {
		return
	}
	result := model.GetDB(c).WithContext(c.Request.Context()).Delete(res.newModel(), "id = ?", id)
	if result.Error != nil {
		writeDBError(c, result.Error)
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "CRM record not found"})
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Controller) resource(c *gin.Context) (resource, bool) {
	res, ok := h.resources[c.Param("resource")]
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "CRM resource not found"})
	}
	return res, ok
}

func parseID(c *gin.Context) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid UUID"})
		return uuid.Nil, false
	}
	return id, true
}

func actorID(c *gin.Context) uuid.UUID {
	if value, ok := c.Get("userID"); ok {
		if id, valid := value.(uuid.UUID); valid {
			return id
		}
		if id, err := uuid.Parse(fmt.Sprint(value)); err == nil {
			return id
		}
	}
	if value, ok := c.Get("id"); ok {
		id, _ := uuid.Parse(fmt.Sprint(value))
		return id
	}
	return uuid.Nil
}

func assignActor(record interface{}, actor uuid.UUID) {
	if actor == uuid.Nil {
		return
	}
	switch value := record.(type) {
	case *crmmodel.TicketComment:
		value.UserID = actor
	case *crmmodel.Note:
		value.CreatedBy = actor
	case *crmmodel.Attachment:
		value.UploadedBy = actor
	case *crmmodel.Campaign:
		value.CreatedBy = actor
	}
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
		c.JSON(http.StatusNotFound, gin.H{"error": "CRM record not found"})
		return
	}
	writeDBError(c, err)
}

func writeDBError(c *gin.Context, err error) {
	message := strings.ToLower(err.Error())
	if strings.Contains(message, "duplicate") || strings.Contains(message, "unique constraint") {
		c.JSON(http.StatusConflict, gin.H{"error": "CRM record conflicts with existing data"})
		return
	}
	c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to process CRM data"})
}
