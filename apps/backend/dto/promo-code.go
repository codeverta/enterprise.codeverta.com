package dto

import (
	"gin-template/model"
	"time"

	"github.com/google/uuid"
)

// CreatePromoRequest untuk create promo baru
type CreatePromoRequest struct {
	Code            string             `json:"code" binding:"required,min=3,max=20"`
	DiscountType    model.DiscountType `json:"discount_type" binding:"required,oneof=PERCENT FIXED"`
	DiscountValue   float64            `json:"discount_value" binding:"required,gt=0"`
	MaxDiscount     float64            `json:"max_discount" binding:"omitempty,gte=0"`
	MinParticipants int                `json:"min_participants" binding:"required,gte=0"`
	Quota           int                `json:"quota" binding:"required,gte=0"`
	StartAt         time.Time          `json:"start_at" binding:"required"`
	EndAt           time.Time          `json:"end_at" binding:"required"`
	IsActive        bool               `json:"is_active"`
}

// UpdatePromoRequest untuk update promo
type UpdatePromoRequest struct {
	Code            *string             `json:"code" binding:"omitempty,min=3,max=20"`
	DiscountType    *model.DiscountType `json:"discount_type" binding:"omitempty,oneof=PERCENT FIXED"`
	DiscountValue   *float64            `json:"discount_value" binding:"omitempty,gt=0"`
	MaxDiscount     *float64            `json:"max_discount" binding:"omitempty,gte=0"`
	MinParticipants *int                `json:"min_participants" binding:"omitempty,gte=0"`
	Quota           *int                `json:"quota" binding:"omitempty,gte=0"`
	StartAt         *time.Time          `json:"start_at"`
	EndAt           *time.Time          `json:"end_at"`
	IsActive        *bool               `json:"is_active"`
}

// GetPromosRequest untuk query parameters
type GetPromosRequest struct {
	Page     int       `form:"page" binding:"omitempty,min=1"`
	Limit    int       `form:"limit" binding:"omitempty,min=1,max=100"`
	IsActive *bool     `form:"is_active"`
	Code     string    `form:"code"`
	TenantID uuid.UUID `form:"tenant_id"`
}

// PromoResponse untuk response API
type PromoResponse struct {
	ID              uuid.UUID          `json:"id"`
	Code            string             `json:"code"`
	DiscountType    model.DiscountType `json:"discount_type"`
	DiscountValue   float64            `json:"discount_value"`
	MaxDiscount     float64            `json:"max_discount"`
	MinParticipants int                `json:"min_participants"`
	Quota           int                `json:"quota"`
	UsedQuota       int                `json:"used_quota"`
	StartAt         time.Time          `json:"start_at"`
	EndAt           time.Time          `json:"end_at"`
	IsActive        bool               `json:"is_active"`
	CreatedAt       time.Time          `json:"created_at"`
	UpdatedAt       time.Time          `json:"updated_at"`
}

// PaginatedPromoResponse untuk response dengan pagination
type PaginatedPromoResponse struct {
	Data       []PromoResponse `json:"data"`
	Total      int64           `json:"total"`
	Page       int             `json:"page"`
	Limit      int             `json:"limit"`
	TotalPages int64           `json:"total_pages"`
}
