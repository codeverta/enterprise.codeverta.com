package handler

import "github.com/google/uuid"

type CreateTenantInput struct {
	ID       uuid.UUID `json:"id"` // Akan di-generate di controller
	Name     string    `json:"name" binding:"required"`
	Domain   string    `json:"domain" binding:"required"`
	IsActive bool      `json:"is_active" binding:"required"`
}
