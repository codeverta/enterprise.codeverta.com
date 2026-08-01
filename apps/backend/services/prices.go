package services

import (
	"errors"
	"fmt"
	"gin-template/model"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type CheckPriceRequest struct {
	Tickets       map[string]int `json:"tickets"` // Key: Price UUID string
	PromoCode     string         `json:"promo_code"`
	ReservationID string         `json:"reservation_id"` // Field Baru (Optional)

}

type TicketItemDetail struct {
	CategoryID   string `json:"category_id"` // PENTING: Untuk mapping balik di controller
	PriceID      string `json:"price_id"`    // PENTING: ID price yang digunakan
	CategoryName string `json:"category_name"`

	Count       int     `json:"count"`
	UnitPrice   float64 `json:"unit_price"`   // Harga yang dipakai (EB/Normal)
	NormalPrice float64 `json:"normal_price"` // Harga coret
	IsEarlyBird bool    `json:"is_early_bird"`
	SubTotal    float64 `json:"subtotal"`
}

type CheckPriceResponse struct {
	Items          []TicketItemDetail `json:"items"`
	OriginalTotal  float64            `json:"original_total"`
	FinalPrice     float64            `json:"final_price"`
	DiscountAmount float64            `json:"discount_amount"` // Total Hemat (EB + Promo)
	PromoApplied   bool               `json:"promo_applied"`
	PromoCode      string             `json:"promo_code"`
}

func CalculateBatchPrice(db *gorm.DB, req CheckPriceRequest) (*CheckPriceResponse, error) {
	if len(req.Tickets) == 0 {
		return nil, errors.New("no tickets selected")
	}

	totalTickets := 0
	for _, count := range req.Tickets {
		if count > 0 {
			totalTickets += count
		}
	}

	response := &CheckPriceResponse{
		Items: []TicketItemDetail{},
	}

	now := time.Now().UTC()

	// 2. FETCH & VALIDATE PROMO CODE (if provided)
	var promo *model.PromoCode
	var totalParticipants int

	for _, count := range req.Tickets {
		totalParticipants += count
	}

	if req.PromoCode != "" {
		var promoData model.PromoCode
		if err := db.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("code = ?", req.PromoCode).
			First(&promoData).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, errors.New("invalid promo code")
			}
			return nil, fmt.Errorf("failed to validate promo code: %w", err)
		}

		// Validasi promo standard...
		if totalParticipants < promoData.MinParticipants {
			return nil, fmt.Errorf("promo code '%s' requires a minimum of %d participants", promoData.Code, promoData.MinParticipants)
		}
		if !promoData.IsActive {
			return nil, errors.New("promo code is no longer active")
		}
		if now.Before(*promoData.StartAt) {
			return nil, errors.New("promo code has not started yet")
		}
		if now.After(*promoData.EndAt) {
			return nil, errors.New("promo code has expired")
		}
		if promoData.UsedQuota+totalParticipants > promoData.Quota {
			return nil, fmt.Errorf("promo code quota insufficient")
		}

		promo = &promoData
	}

	totalPromoSaving := 0.0

	for id, count := range req.Tickets {
		if count <= 0 {
			continue
		}

		var ticketPrice model.TicketPrice
		if err := db.Preload("TicketCategory.Event").First(&ticketPrice, "id = ?", id).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, errors.New("ticket unavailable")
			}
			return nil, fmt.Errorf("failed to fetch ticket price: %w", err)
		}
		if ticketPrice.TicketCategory == nil || ticketPrice.TicketCategory.Event == nil || !ticketPrice.TicketCategory.Event.IsActive {
			return nil, errors.New("ticket unavailable")
		}
		if now.Before(ticketPrice.StartAt) || now.After(ticketPrice.EndAt) {
			return nil, errors.New("ticket unavailable")
		}
		if ticketPrice.Quota > 0 && count > ticketPrice.Quota {
			return nil, errors.New("ticket quota insufficient")
		}

		unitPrice := ticketPrice.Price
		promoDiscountPerItem := 0.0
		if promo != nil {
			switch promo.DiscountType {
			case model.DiscountFixed:
				promoDiscountPerItem = promo.DiscountValue
			case model.DiscountPercent:
				promoDiscountPerItem = unitPrice * (promo.DiscountValue / 100)

				if promo.MaxDiscount > 0 && promoDiscountPerItem > promo.MaxDiscount {
					promoDiscountPerItem = promo.MaxDiscount
				}
			}
			if promoDiscountPerItem > unitPrice {
				promoDiscountPerItem = unitPrice
			}
			totalPromoSaving += promoDiscountPerItem * float64(count)
		}

		finalPricePerItem := unitPrice - promoDiscountPerItem
		subtotal := finalPricePerItem * float64(count)

		response.OriginalTotal += unitPrice * float64(count)
		response.FinalPrice += subtotal

		response.Items = append(response.Items, TicketItemDetail{
			CategoryID:   ticketPrice.TicketCategoryID.String(),
			PriceID:      ticketPrice.ID.String(),
			CategoryName: ticketPrice.TicketCategory.Name,
			Count:        count,
			UnitPrice:    finalPricePerItem,
			NormalPrice:  unitPrice,
			IsEarlyBird:  ticketPrice.Type == model.PriceEarlyBird,
			SubTotal:     subtotal,
		})
	}

	// 4. SET FINAL DISCOUNT INFO
	response.DiscountAmount = response.OriginalTotal - response.FinalPrice

	if promo != nil && totalPromoSaving > 0 && response.DiscountAmount > 0 {
		response.PromoApplied = true
		response.PromoCode = promo.Code
	}

	return response, nil
}
