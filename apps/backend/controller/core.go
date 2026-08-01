package controller

import (
	"gin-template/model"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type CoreController struct{ DB *gorm.DB }

func NewCoreController(db *gorm.DB) *CoreController { return &CoreController{DB: db} }

func (ctrl *CoreController) Dashboard(c *gin.Context) {
	db := model.GetDB(c)
	counts := gin.H{}
	for key, target := range map[string]interface{}{
		"users": &model.User{}, "subscriptions": &model.Subscription{},
		"promos": &model.PromoCode{}, "notifications": &model.Notification{},
	} {
		var count int64
		query := db.Model(target)
		if key == "promos" {
			query = query.Where("is_active = ?", true)
		}
		_ = query.Count(&count).Error
		counts[key] = count
	}
	c.JSON(http.StatusOK, gin.H{"data": counts})
}

type orderInput struct {
	CustomerID    *uuid.UUID `json:"customer_id"`
	Currency      string     `json:"currency" binding:"omitempty,max=8"`
	Subtotal      float64    `json:"subtotal" binding:"gte=0"`
	DiscountTotal float64    `json:"discount_total" binding:"gte=0"`
	TaxTotal      float64    `json:"tax_total" binding:"gte=0"`
	PromoCodeID   *uuid.UUID `json:"promo_code_id"`
	ReferenceType string     `json:"reference_type" binding:"omitempty,max=64"`
	ReferenceID   string     `json:"reference_id" binding:"omitempty,max=128"`
	Notes         string     `json:"notes"`
}

func (ctrl *CoreController) ListOrders(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "25"))
	if limit < 1 || limit > 100 {
		limit = 25
	}
	db := model.GetDB(c).Model(&model.Order{})
	if status := c.Query("status"); status != "" {
		db = db.Where("status = ?", status)
	}
	var total int64
	_ = db.Count(&total).Error
	var orders []model.Order
	if err := db.Order("created_at DESC").Limit(limit).Offset((page - 1) * limit).Find(&orders).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list orders"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": orders, "meta": gin.H{"page": page, "limit": limit, "total": total}})
}

func (ctrl *CoreController) CreateOrder(c *gin.Context) {
	var input orderInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if input.DiscountTotal > input.Subtotal {
		c.JSON(http.StatusBadRequest, gin.H{"error": "discount_total cannot exceed subtotal"})
		return
	}
	order := model.Order{CustomerID: input.CustomerID, Currency: input.Currency, Subtotal: input.Subtotal,
		DiscountTotal: input.DiscountTotal, TaxTotal: input.TaxTotal, PromoCodeID: input.PromoCodeID,
		ReferenceType: input.ReferenceType, ReferenceID: input.ReferenceID, Notes: input.Notes, Status: model.OrderDraft}
	if err := model.GetDB(c).Create(&order).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create order"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": order})
}

func (ctrl *CoreController) GetOrder(c *gin.Context) {
	var order model.Order
	if err := model.GetDB(c).First(&order, "id = ?", c.Param("id")).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "order not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get order"})
		}
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": order})
}

func (ctrl *CoreController) UpdateOrderStatus(c *gin.Context) {
	var input struct {
		Status model.OrderStatus `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	valid := map[model.OrderStatus]bool{model.OrderDraft: true, model.OrderPending: true, model.OrderPaid: true, model.OrderCancelled: true, model.OrderRefunded: true}
	if !valid[input.Status] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid order status"})
		return
	}
	updates := map[string]interface{}{"status": input.Status}
	if input.Status == model.OrderPaid {
		now := time.Now().UTC()
		updates["paid_at"] = &now
	}
	result := model.GetDB(c).Model(&model.Order{}).Where("id = ?", c.Param("id")).Updates(updates)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update order"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "order not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "order status updated"})
}
