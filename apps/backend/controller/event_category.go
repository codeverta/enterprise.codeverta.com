package controller

import (
	"gin-template/handler"
	"gin-template/model"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type TicketHandler struct {
	DB *gorm.DB
}

// Tidak perlu inject logger di sini karena pakai zap.L()
func NewTicketHandler(db *gorm.DB) *TicketHandler {
	return &TicketHandler{DB: db}
}

// ==========================
// Ticket Category CRUD
// ==========================

func (h *TicketHandler) CreateCategory(c *gin.Context) {
	// Setup logger context untuk function ini
	log := zap.L().With(
		zap.String("func", "CreateCategory"),
	)

	var input handler.CreateCategoryInput
	if err := c.ShouldBindJSON(&input); err != nil {
		log.Warn("invalid input", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Tambahkan context nama event ke logger
	log = log.With(zap.String("event_id", input.EventID))

	eventUUID, _ := uuid.Parse(input.EventID)
	category := model.TicketCategory{
		EventID:      eventUUID,
		Name:         input.Name,
		DistanceKM:   input.DistanceKM,
		Requirements: input.Requirements,
	}

	db := model.GetDB(c)

	if err := db.WithContext(c).Create(&category).Error; err != nil {
		log.Error("db create error", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create category"})
		return
	}

	log.Info("success created category", zap.String("category_id", category.ID.String()))
	c.JSON(http.StatusCreated, category)
}

func (h *TicketHandler) GetCategories(c *gin.Context) {
	var categories []model.TicketCategory
	db := model.GetDB(c)
	query := db.Model(&model.TicketCategory{})

	// Hanya filter "Active Event" jika parameter "active=true" ada di URL
	if c.Query("active") == "true" {
		query = query.
			Joins("JOIN events ON events.id = ticket_categories.event_id").
			Where("events.is_active = ?", true)
	}

	err := query.
		Preload("Prices").
		Order("distance_km asc").
		Find(&categories).Error

	if err != nil {
		zap.L().Error("Error fetching categories", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch categories"})
		return
	}

	c.JSON(http.StatusOK, categories)
}

// Get Single Category
func (h *TicketHandler) GetCategoryByID(c *gin.Context) {
	var category model.TicketCategory
	db := model.GetDB(c)

	if err := db.First(&category, "id = ?", c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Category not found"})
		return
	}
	c.JSON(http.StatusOK, category)
}

// Update Category
func (h *TicketHandler) UpdateCategory(c *gin.Context) {
	id := c.Param("id")

	log := zap.L().With(
		zap.String("func", "UpdateCategory"),
		zap.String("category_id", id),
	)

	var category model.TicketCategory
	db := model.GetDB(c)

	// 1. Cari dulu datanya
	if err := db.First(&category, "id = ?", id).Error; err != nil {
		log.Warn("category not found")
		c.JSON(http.StatusNotFound, gin.H{"error": "Category not found"})
		return
	}

	var input handler.UpdateCategoryInput
	if err := c.ShouldBindJSON(&input); err != nil {
		log.Warn("invalid input", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	log.Info("attempt update", zap.Any("payload", input))

	// 2. UPDATE MANUAL FIELDNYA (Solusi Fix)
	// Dengan cara ini, GORM akan melihat tag `gorm:"serializer:json"` yang ada di struct model.TicketCategory
	category.Name = input.Name
	category.DistanceKM = input.DistanceKM
	category.Requirements = input.Requirements

	// 3. Simpan menggunakan .Save()
	if err := db.WithContext(c).Save(&category).Error; err != nil {
		log.Error("db update error", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update category"})
		return
	}

	log.Info("success update")
	c.JSON(http.StatusOK, category)
}

func (h *TicketHandler) DeleteCategory(c *gin.Context) {
	id := c.Param("id")
	log := zap.L().With(
		zap.String("func", "DeleteCategory"),
		zap.String("category_id", id),
	)
	db := model.GetDB(c)

	if err := db.Delete(&model.TicketCategory{}, "id = ?", id).Error; err != nil {
		log.Error("db delete error", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete category"})
		return
	}

	log.Info("success delete")
	c.JSON(http.StatusOK, gin.H{"message": "Category deleted"})
}

// ==========================
// Ticket Price CRUD
// ==========================

func (h *TicketHandler) CreatePrice(c *gin.Context) {
	log := zap.L().With(
		zap.String("func", "CreatePrice"),
	)

	var input handler.CreatePriceInput
	if err := c.ShouldBindJSON(&input); err != nil {
		log.Warn("invalid input", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Enrich context
	log = log.With(
		zap.String("category_id", input.TicketCategoryID),
		zap.Float64("price", input.Price),
	)

	catUUID, _ := uuid.Parse(input.TicketCategoryID)
	price := model.TicketPrice{
		TicketCategoryID: catUUID,
		Price:            input.Price,
		Type:             model.TicketPriceType(input.Type),
		Quota:            input.Quota,
		StartAt:          input.StartAt,
		EndAt:            input.EndAt,
	}
	db := model.GetDB(c)

	if err := db.WithContext(c).Create(&price).Error; err != nil {
		log.Error("db create error", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create price"})
		return
	}

	log.Info("success create price", zap.String("price_id", price.ID.String()))
	c.JSON(http.StatusCreated, price)
}

func (h *TicketHandler) GetPrices(c *gin.Context) {
	var prices []model.TicketPrice
	db := model.GetDB(c)

	query := db.WithContext(c).Model(&model.TicketPrice{})

	if catID := c.Query("category_id"); catID != "" {
		query = query.Where("ticket_category_id = ?", catID)
	}

	if err := query.Find(&prices).Error; err != nil {
		zap.L().Error("Error fetching prices", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch prices"})
		return
	}

	c.JSON(http.StatusOK, prices)
}

func (h *TicketHandler) UpdatePrice(c *gin.Context) {
	id := c.Param("id")
	log := zap.L().With(
		zap.String("func", "UpdatePrice"),
		zap.String("price_id", id),
	)

	var price model.TicketPrice
	db := model.GetDB(c)

	if err := db.WithContext(c).First(&price, "id = ?", id).Error; err != nil {
		log.Warn("price not found")
		c.JSON(http.StatusNotFound, gin.H{"error": "Price record not found"})
		return
	}

	var input handler.UpdatePriceInput
	if err := c.ShouldBindJSON(&input); err != nil {
		log.Warn("invalid input", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input format"})
		return
	}

	// Validasi Logic
	if !input.StartAt.IsZero() && !input.EndAt.IsZero() {
		if input.StartAt.After(input.EndAt) || input.StartAt.Equal(input.EndAt) {
			log.Warn("logic error: start_at >= end_at")
			c.JSON(http.StatusBadRequest, gin.H{"error": "end_at must be after start_at"})
			return
		}
	}

	updateData := make(map[string]interface{})
	if input.Price >= 0 {
		updateData["price"] = input.Price
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "price cannot be negative"})
		return
	}

	updateData["quota"] = input.Quota
	updateData["start_at"] = input.StartAt
	updateData["end_at"] = input.EndAt
	if input.Type != "" {
		// Strict Validation untuk Enum
		inputType := model.TicketPriceType(input.Type)
		if inputType == model.PriceNormal || inputType == model.PriceEarlyBird {
			updateData["type"] = inputType
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid ticket type"})
			return
		}
	}

	log.Info("attempt update", zap.Any("update_data", updateData))

	if err := db.WithContext(c).Model(&price).Updates(updateData).Error; err != nil {
		log.Error("db update error", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database update failed"})
		return
	}

	log.Info("success update price")
	c.JSON(http.StatusOK, price)
}

func (h *TicketHandler) DeletePrice(c *gin.Context) {
	id := c.Param("id")
	log := zap.L().With(
		zap.String("func", "DeletePrice"),
		zap.String("price_id", id),
	)
	db := model.GetDB(c)

	if err := db.WithContext(c).Delete(&model.TicketPrice{}, "id = ?", id).Error; err != nil {
		log.Error("db delete error", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete price"})
		return
	}

	log.Info("success delete price")
	c.JSON(http.StatusOK, gin.H{"message": "Price deleted"})
}
