package services

import (
	"errors"
	"gin-template/dto"
	"gin-template/model"
	"gin-template/repository"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type PromoService interface {
	CreatePromo(c *gin.Context, req *dto.CreatePromoRequest) (*dto.PromoResponse, error)
	GetPromos(c *gin.Context, req *dto.GetPromosRequest) ([]dto.PromoResponse, int64, error)
	GetPromoByID(c *gin.Context, id uuid.UUID) (*dto.PromoResponse, error)
	UpdatePromo(c *gin.Context, id uuid.UUID, req *dto.UpdatePromoRequest) (*dto.PromoResponse, error)
	ArchivePromo(c *gin.Context, id uuid.UUID) error
}

type promoService struct {
	promoRepo repository.PromoRepository
}

func NewPromoService(promoRepo repository.PromoRepository) PromoService {
	return &promoService{
		promoRepo: promoRepo,
	}
}

func (s *promoService) CreatePromo(c *gin.Context, req *dto.CreatePromoRequest) (*dto.PromoResponse, error) {
	// Validasi business logic
	if req.StartAt.After(req.EndAt) {
		return nil, errors.New("start date must be before end date")
	}

	if req.DiscountType == model.DiscountPercent && req.DiscountValue > 100 {
		return nil, errors.New("percentage discount cannot exceed 100%")
	}

	if req.DiscountValue <= 0 {
		return nil, errors.New("discount value must be greater than 0")
	}

	if req.Quota < 0 {
		return nil, errors.New("quota cannot be negative")
	}

	// Check apakah kode promo sudah ada
	existingPromo, _ := s.promoRepo.FindByCode(c, req.Code)
	if existingPromo != nil {
		return nil, errors.New("promo code already exists")
	}
	startAt := req.StartAt.UTC()
	endAt := req.EndAt.UTC()

	promo := &model.PromoCode{
		Code:          req.Code,
		DiscountType:  req.DiscountType,
		DiscountValue: req.DiscountValue,
		MaxDiscount:   req.MaxDiscount,
		Quota:         req.Quota,
		UsedQuota:     0,
		StartAt:       &startAt,
		EndAt:         &endAt,
		IsActive:      req.IsActive,
	}

	if err := s.promoRepo.Create(c, promo); err != nil {
		return nil, err
	}

	return s.toPromoResponse(promo), nil
}

func (s *promoService) GetPromos(c *gin.Context, req *dto.GetPromosRequest) ([]dto.PromoResponse, int64, error) {
	promos, total, err := s.promoRepo.FindAll(c, req)
	if err != nil {
		return nil, 0, err
	}

	responses := make([]dto.PromoResponse, 0, len(promos))
	for _, promo := range promos {
		responses = append(responses, *s.toPromoResponse(&promo))
	}

	return responses, total, nil
}

func (s *promoService) GetPromoByID(c *gin.Context, id uuid.UUID) (*dto.PromoResponse, error) {
	promo, err := s.promoRepo.FindByID(c, id)
	if err != nil {
		return nil, err
	}

	return s.toPromoResponse(promo), nil
}

func (s *promoService) UpdatePromo(c *gin.Context, id uuid.UUID, req *dto.UpdatePromoRequest) (*dto.PromoResponse, error) {
	promo, err := s.promoRepo.FindByID(c, id)
	if err != nil {
		return nil, err
	}

	// Validasi business logic
	if req.StartAt != nil && req.EndAt != nil && req.StartAt.After(*req.EndAt) {
		return nil, errors.New("start date must be before end date")
	}

	if req.DiscountType != nil && *req.DiscountType == model.DiscountPercent &&
		req.DiscountValue != nil && *req.DiscountValue > 100 {
		return nil, errors.New("percentage discount cannot exceed 100%")
	}

	if req.DiscountValue != nil && *req.DiscountValue <= 0 {
		return nil, errors.New("discount value must be greater than 0")
	}

	// Update fields jika ada
	if req.Code != nil {
		// Check duplikasi kode selain current promo
		existingPromo, _ := s.promoRepo.FindByCode(c, *req.Code)
		if existingPromo != nil && existingPromo.ID != id {
			return nil, errors.New("promo code already exists")
		}
		promo.Code = *req.Code
	}
	if req.DiscountType != nil {
		promo.DiscountType = *req.DiscountType
	}
	if req.DiscountValue != nil {
		promo.DiscountValue = *req.DiscountValue
	}
	if req.MaxDiscount != nil {
		promo.MaxDiscount = *req.MaxDiscount
	}
	if req.MinParticipants != nil {
		promo.MinParticipants = *req.MinParticipants
	}
	if req.Quota != nil {
		promo.Quota = *req.Quota
	}
	if req.StartAt != nil {
		startAt := req.StartAt.UTC()
		promo.StartAt = &startAt
	}
	if req.EndAt != nil {
		endAt := req.EndAt.UTC()
		promo.EndAt = &endAt
	}
	if req.IsActive != nil {
		promo.IsActive = *req.IsActive
	}

	if err := s.promoRepo.Update(c, promo); err != nil {
		return nil, err
	}

	return s.toPromoResponse(promo), nil
}

func (s *promoService) ArchivePromo(c *gin.Context, id uuid.UUID) error {
	promo, err := s.promoRepo.FindByID(c, id)
	if err != nil {
		return err
	}

	return s.promoRepo.Delete(c, promo)
}

// Helper function untuk convert model ke response DTO
func (s *promoService) toPromoResponse(promo *model.PromoCode) *dto.PromoResponse {
	return &dto.PromoResponse{
		ID:              promo.ID,
		Code:            promo.Code,
		DiscountType:    promo.DiscountType,
		DiscountValue:   promo.DiscountValue,
		MaxDiscount:     promo.MaxDiscount,
		MinParticipants: promo.MinParticipants,
		Quota:           promo.Quota,
		UsedQuota:       promo.UsedQuota,
		StartAt:         *promo.StartAt,
		EndAt:           *promo.EndAt,
		IsActive:        promo.IsActive,
		CreatedAt:       *promo.CreatedAt,
		UpdatedAt:       *promo.UpdatedAt,
	}
}
