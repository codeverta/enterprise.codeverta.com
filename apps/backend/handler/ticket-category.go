package handler

import (
	"time"
	// Sesuaikan path import model
)

// DTO untuk Create/Update Category
type CreateCategoryInput struct {
	EventID      string   `json:"event_id" binding:"required,uuid"`
	Name         string   `json:"name" binding:"required"`
	DistanceKM   float64  `json:"distance_km" binding:"required"`
	Requirements []string `json:"requirements"`
}

type UpdateCategoryInput struct {
	Name         string   `json:"name"`
	DistanceKM   float64  `json:"distance_km"`
	Requirements []string `json:"requirements"`
}

// DTO untuk Create/Update Price
type CreatePriceInput struct {
	TicketCategoryID string    `json:"ticket_category_id" binding:"required,uuid"`
	Price            float64   `json:"price" binding:"required,min=0"`
	Type             string    `json:"type" binding:"required,oneof=NORMAL EARLY_BIRD"`
	Quota            int       `json:"quota" binding:"required,min=1"`
	StartAt          time.Time `json:"start_at" binding:"required"`
	EndAt            time.Time `json:"end_at" binding:"required"`
}

type UpdatePriceInput struct {
	Price   float64   `json:"price"`
	Type    string    `json:"type"`
	Quota   int       `json:"quota"`
	StartAt time.Time `json:"start_at"`
	EndAt   time.Time `json:"end_at"`
}
