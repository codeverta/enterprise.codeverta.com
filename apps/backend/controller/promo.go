package controller

import (
	"gin-template/common"
	"gin-template/dto"
	"gin-template/model"
	"gin-template/services"
	"net/http"

	// utils dihapus

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type PromoController struct {
	promoService services.PromoService
}

func NewPromoController(promoService services.PromoService) *PromoController {
	return &PromoController{
		promoService: promoService,
	}
}

// CreatePromo godoc
// @Summary Create new promo code
// @Tags Promo
// @Accept json
// @Produce json
// @Param body body dto.CreatePromoRequest true "Promo data"
// @Success 201 {object} map[string]interface{}
// @Router /promo-codes [post]
func (pc *PromoController) CreatePromo(c *gin.Context) {
	var req dto.CreatePromoRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "Invalid request body",
			"error":   err.Error(),
		})
		return
	}
	promo, err := pc.promoService.CreatePromo(c, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"message": "Failed to create promo",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Promo created successfully",
		"data":    promo,
	})
}

// GetPromos godoc
// @Summary Get all promo codes
// @Tags Promo
// @Accept json
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Limit per page" default(10)
// @Param is_active query bool false "Filter by active status"
// @Param code query string false "Search by code"
// @Success 200 {object} map[string]interface{}
// @Router /promo-codes [get]
func (pc *PromoController) GetPromos(c *gin.Context) {
	var req dto.GetPromosRequest

	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "Invalid query parameters",
			"error":   err.Error(),
		})
		return
	}

	// Set default values
	if req.Page < 1 {
		req.Page = 1
	}
	if req.Limit < 1 {
		req.Limit = 10
	}

	tenantVal, _ := c.Get(common.CtxTenantKey)
	tenant := tenantVal.(model.Tenant)

	req.TenantID = tenant.ID
	promos, total, err := pc.promoService.GetPromos(c, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"message": "Failed to get promos",
			"error":   err.Error(),
		})
		return
	}

	response := dto.PaginatedPromoResponse{
		Data:       promos,
		Total:      total,
		Page:       req.Page,
		Limit:      req.Limit,
		TotalPages: (total + int64(req.Limit) - 1) / int64(req.Limit),
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Promos retrieved successfully",
		"data":    response,
	})
}

// GetPromoByID godoc
// @Summary Get promo code by ID
// @Tags Promo
// @Accept json
// @Produce json
// @Param id path string true "Promo ID"
// @Success 200 {object} map[string]interface{}
// @Router /promo-codes/{id} [get]
func (pc *PromoController) GetPromoByID(c *gin.Context) {
	idParam := c.Param("id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "Invalid promo ID",
			"error":   err.Error(),
		})
		return
	}
	promo, err := pc.promoService.GetPromoByID(c, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"message": "Promo not found",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Promo retrieved successfully",
		"data":    promo,
	})
}

// UpdatePromo godoc
// @Summary Update promo code
// @Tags Promo
// @Accept json
// @Produce json
// @Param id path string true "Promo ID"
// @Param body body dto.UpdatePromoRequest true "Promo data"
// @Success 200 {object} map[string]interface{}
// @Router /promo-codes/{id} [put]
func (pc *PromoController) UpdatePromo(c *gin.Context) {
	idParam := c.Param("id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "Invalid promo ID",
			"error":   err.Error(),
		})
		return
	}

	var req dto.UpdatePromoRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "Invalid request body",
			"error":   err.Error(),
		})
		return
	}
	promo, err := pc.promoService.UpdatePromo(c, id, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"message": "Failed to update promo",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Promo updated successfully",
		"data":    promo,
	})
}

// ArchivePromo godoc (Soft Delete)
// @Summary Archive promo code (soft delete)
// @Tags Promo
// @Accept json
// @Produce json
// @Param id path string true "Promo ID"
// @Success 200 {object} map[string]interface{}
// @Router /promo-codes/{id} [delete]
func (pc *PromoController) ArchivePromo(c *gin.Context) {
	idParam := c.Param("id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "Invalid promo ID",
			"error":   err.Error(),
		})
		return
	}
	err = pc.promoService.ArchivePromo(c, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"message": "Failed to archive promo",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Promo archived successfully",
	})
}
