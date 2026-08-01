package repository

import (
	"gin-template/dto"
	"gin-template/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type PromoRepository interface {
	Create(c *gin.Context, promo *model.PromoCode) error
	FindAll(c *gin.Context, req *dto.GetPromosRequest) ([]model.PromoCode, int64, error)
	FindByID(c *gin.Context, id uuid.UUID) (*model.PromoCode, error)
	FindByCode(c *gin.Context, code string) (*model.PromoCode, error)
	Update(c *gin.Context, promo *model.PromoCode) error
	Delete(c *gin.Context, promo *model.PromoCode) error
}

type promoRepository struct {
	db *gorm.DB
}

func NewPromoRepository(db *gorm.DB) PromoRepository {
	return &promoRepository{
		db: db,
	}
}

func (r *promoRepository) Create(c *gin.Context, promo *model.PromoCode) error {
	db := model.GetDB(c)
	return db.WithContext(c).Create(promo).Error
}

func (r *promoRepository) FindAll(c *gin.Context, req *dto.GetPromosRequest) ([]model.PromoCode, int64, error) {
	var promos []model.PromoCode
	var total int64
	db := model.GetDB(c)

	query := db.Model(&model.PromoCode{})
	query = query.Where("tenant_id = ?", req.TenantID)

	// Filter by is_active jika ada
	if req.IsActive != nil {
		query = query.Where("is_active = ?", *req.IsActive)
	}

	// Search by code jika ada
	if req.Code != "" {
		query = query.Where("code LIKE ?", "%"+req.Code+"%")
	}

	// Count total
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// Pagination
	offset := (req.Page - 1) * req.Limit
	if err := query.
		Order("created_at DESC").
		Limit(req.Limit).
		Offset(offset).
		Find(&promos).Error; err != nil {
		return nil, 0, err
	}

	return promos, total, nil
}

func (r *promoRepository) FindByID(c *gin.Context, id uuid.UUID) (*model.PromoCode, error) {
	var promo model.PromoCode
	db := model.GetDB(c)
	if err := db.Where("id = ?", id).First(&promo).Error; err != nil {
		return nil, err
	}
	return &promo, nil
}

func (r *promoRepository) FindByCode(c *gin.Context, code string) (*model.PromoCode, error) {
	var promo model.PromoCode
	db := model.GetDB(c)

	if err := db.Where("code = ?", code).First(&promo).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &promo, nil
}

func (r *promoRepository) Update(c *gin.Context, promo *model.PromoCode) error {
	db := model.GetDB(c)

	return db.Save(promo).Error
}

func (r *promoRepository) Delete(c *gin.Context, promo *model.PromoCode) error {
	db := model.GetDB(c)

	return db.Delete(promo).Error
}
