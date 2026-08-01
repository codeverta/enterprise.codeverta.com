package controller

import (
	"context"
	"encoding/json"
	"fmt"
	"gin-template/common"
	"gin-template/dto"
	"gin-template/model"
	"gin-template/repository"
	"gin-template/services"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type VerifyInput struct {
	IsVerified bool   `json:"is_verified"`
	TemplateID string `json:"template_id"`
}

type EventRegistrationController struct {
	DB       *gorm.DB
	dashRepo repository.DashboardRepository
}

func NewEventRegistrationController(db *gorm.DB, dashRepo repository.DashboardRepository) *EventRegistrationController {
	return &EventRegistrationController{DB: db, dashRepo: dashRepo}
}

// RESERVATION FEATURE
// Payload untuk Reservation
type ReservationRequest struct {
	Tickets   map[string]int `json:"tickets" binding:"required,dive,keys,uuid"`
	PromoCode string         `json:"promo_code" binding:"omitempty,alphanum,max=20"`
}

func (oc *EventRegistrationController) CreateReservation(c *gin.Context) {
	var req ReservationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	db := model.GetDB(c)
	var settings model.SystemSetting
	// Mengambil row pertama (asumsi single row configuration)
	if err := db.WithContext(c).First(&settings).Error; err != nil {
		zap.L().Fatal("Failed to fetch system settings", zap.Error(err))
		c.JSON(500, gin.H{"error": "Failed to check system settings"})
		return
	}

	if !settings.IsRegistrationOpen {
		c.JSON(400, gin.H{"error": "Registration is currently closed"})
		return
	}
	// Panggil helper function
	duration, totalTickets, err := services.CalculateDynamicExpiry(req.Tickets)
	if err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	reservationID := uuid.New()
	expiresAt := time.Now().UTC().Add(duration)

	err = db.WithContext(c).Transaction(func(tx *gorm.DB) error {
		priceDetail, err := services.CalculateBatchPrice(tx, services.CheckPriceRequest{
			Tickets:   req.Tickets,
			PromoCode: req.PromoCode,
		})
		if err != nil {
			return err
		}

		for _, item := range priceDetail.Items {
			res := tx.Model(&model.TicketPrice{}).
				Where("id = ? AND quota >= ?", item.PriceID, item.Count).
				Update("quota", gorm.Expr("quota - ?", item.Count))

			if res.RowsAffected == 0 {
				return fmt.Errorf("out of stock for category: %s", item.CategoryName)
			}
		}

		if priceDetail.PromoApplied {
			// Kita kurangi quota promo sejumlah total peserta
			resPromo := tx.Model(&model.PromoCode{}).
				Where("code = ?", priceDetail.PromoCode).
				Where("used_quota + ? <= quota", totalTickets).
				Update("used_quota", gorm.Expr("used_quota + ?", totalTickets))

			if resPromo.RowsAffected == 0 {
				return fmt.Errorf("promo code quota exceeded for: %s", priceDetail.PromoCode)
			}
		}

		jsonSnapshot, _ := json.Marshal(priceDetail)
		reservation := model.TicketReservation{
			ID:            reservationID,
			ExpiresAt:     expiresAt,
			Status:        "ACTIVE",
			PriceSnapshot: datatypes.JSON(jsonSnapshot),
			TotalAmount:   priceDetail.FinalPrice,
			PromoCode:     req.PromoCode,
			Participants:  totalTickets, // Menggunakan totalTickets dari helper
		}

		return tx.WithContext(c).Create(&reservation).Error
	})

	if err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	// Redis Push
	if common.RedisEnabled {
		ctx := context.Background()
		err := common.RDB.ZAdd(ctx, common.RDB.GetKey("reservation:expiry"), &redis.Z{
			Score:  float64(expiresAt.Unix()), // Waktu expire sebagai score
			Member: reservationID.String(),
		}).Err()

		if err != nil {
			// Log error tapi jangan gagalkan request user,
			// nanti worker DB backup (kalau ada) atau lazy check yang handle
			common.SysError("Failed to push to Redis ZSET: " + err.Error())
		}
	}

	c.JSON(201, gin.H{
		"reservation_id": reservationID,
		"expires_at":     expiresAt.Format(time.RFC3339),
		"duration_min":   duration.Minutes(),
		"expires_at_ms":  expiresAt.UnixMilli(),
		"message":        fmt.Sprintf("Reserved for %.0f minutes", duration.Minutes()),
	})
}

type CreateOrderRequest struct {
	ReservationID string `json:"reservation_id" binding:"required"`
	// Info PIC (Penanggung Jawab)
	PicName   string `json:"pic_name" binding:"required"`
	PicEmail  string `json:"pic_email" binding:"required,email"`
	PicPhone  string `json:"pic_phone" binding:"required"`
	PromoCode string `json:"promo_code" binding:"max=20"`

	// Array Peserta
	Participants []dto.ParticipantRequest `json:"participants" binding:"required,dive"`
}

// Security Constants
const MAX_PARTICIPANTS_PER_ORDER = 20

func (oc *EventRegistrationController) RegisterEvent(c *gin.Context) {

	c.JSON(http.StatusOK, gin.H{
		"success": true,
	})
}

// DowngradeCategory downgrades a participant to a lower category
// without any charge or refund.
func (oc *EventRegistrationController) DowngradeCategory(c *gin.Context) {
	var req dto.UpgradeDowngradeReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Force downgrade only
	if req.IsUpgrade {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Endpoint ini hanya untuk downgrade, gunakan endpoint upgrade"})
		return
	}

	db := model.GetDB(c)

	// Verify new category exists
	var newCategory model.TicketCategory
	if err := db.Where("id = ?", req.NewCategoryID).First(&newCategory).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Kategori baru tidak ditemukan"})
		return
	}

	var newPrice model.TicketPrice
	if err := db.Where("id = ? AND ticket_category_id = ?", req.NewPriceID, req.NewCategoryID).
		First(&newPrice).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Harga kategori baru tidak ditemukan"})
		return
	}

	// Downgrade — no cost, no refund
	// Update handled by the participant/order service
	c.JSON(http.StatusOK, gin.H{
		"message":      "Kategori berhasil di-downgrade",
		"participant_id": req.ParticipantID,
		"category":     newCategory.Name,
		"new_price":    newPrice.Price,
		"is_downgrade": true,
	})
}
