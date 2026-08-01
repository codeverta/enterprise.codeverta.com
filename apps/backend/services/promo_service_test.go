package services

import (
	"errors"
	"gin-template/dto"
	"gin-template/model"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type fakePromoRepo struct {
	byID     map[uuid.UUID]*model.PromoCode
	byCode   map[string]*model.PromoCode
	createFn func(*model.PromoCode) error
	updateFn func(*model.PromoCode) error
	deleteFn func(*model.PromoCode) error
	findErr  error
}

func newFakePromoRepo() *fakePromoRepo {
	return &fakePromoRepo{
		byID:   map[uuid.UUID]*model.PromoCode{},
		byCode: map[string]*model.PromoCode{},
	}
}

func (r *fakePromoRepo) Create(c *gin.Context, promo *model.PromoCode) error {
	if r.createFn != nil {
		return r.createFn(promo)
	}
	now := time.Now().UTC()
	if promo.ID == uuid.Nil {
		promo.ID = uuid.New()
	}
	promo.CreatedAt = &now
	promo.UpdatedAt = &now
	r.byID[promo.ID] = promo
	r.byCode[promo.Code] = promo
	return nil
}

func (r *fakePromoRepo) FindAll(c *gin.Context, req *dto.GetPromosRequest) ([]model.PromoCode, int64, error) {
	if r.findErr != nil {
		return nil, 0, r.findErr
	}
	promos := make([]model.PromoCode, 0, len(r.byID))
	for _, promo := range r.byID {
		promos = append(promos, *promo)
	}
	return promos, int64(len(promos)), nil
}

func (r *fakePromoRepo) FindByID(c *gin.Context, id uuid.UUID) (*model.PromoCode, error) {
	if r.findErr != nil {
		return nil, r.findErr
	}
	promo, ok := r.byID[id]
	if !ok {
		return nil, errors.New("not found")
	}
	return promo, nil
}

func (r *fakePromoRepo) FindByCode(c *gin.Context, code string) (*model.PromoCode, error) {
	if r.findErr != nil {
		return nil, r.findErr
	}
	return r.byCode[code], nil
}

func (r *fakePromoRepo) Update(c *gin.Context, promo *model.PromoCode) error {
	if r.updateFn != nil {
		return r.updateFn(promo)
	}
	now := time.Now().UTC()
	promo.UpdatedAt = &now
	r.byID[promo.ID] = promo
	r.byCode[promo.Code] = promo
	return nil
}

func (r *fakePromoRepo) Delete(c *gin.Context, promo *model.PromoCode) error {
	if r.deleteFn != nil {
		return r.deleteFn(promo)
	}
	delete(r.byID, promo.ID)
	delete(r.byCode, promo.Code)
	return nil
}

func validPromoRequest() dto.CreatePromoRequest {
	start := time.Date(2026, 5, 26, 0, 0, 0, 0, time.UTC)
	end := start.Add(24 * time.Hour)
	return dto.CreatePromoRequest{
		Code:            "TRAIL10",
		DiscountType:    model.DiscountPercent,
		DiscountValue:   10,
		MaxDiscount:     50000,
		MinParticipants: 1,
		Quota:           100,
		StartAt:         start,
		EndAt:           end,
		IsActive:        true,
	}
}

func seedFakePromo(repo *fakePromoRepo, code string) *model.PromoCode {
	req := validPromoRequest()
	now := time.Now().UTC()
	promo := &model.PromoCode{
		ID:              uuid.New(),
		Code:            code,
		DiscountType:    req.DiscountType,
		DiscountValue:   req.DiscountValue,
		MaxDiscount:     req.MaxDiscount,
		MinParticipants: req.MinParticipants,
		Quota:           req.Quota,
		UsedQuota:       2,
		StartAt:         &req.StartAt,
		EndAt:           &req.EndAt,
		IsActive:        true,
		CreatedAt:       &now,
		UpdatedAt:       &now,
	}
	repo.byID[promo.ID] = promo
	repo.byCode[promo.Code] = promo
	return promo
}

func TestPromoServiceCreatePromo(t *testing.T) {
	t.Run("creates valid promo", func(t *testing.T) {
		repo := newFakePromoRepo()
		service := NewPromoService(repo)
		resp, err := service.CreatePromo(nil, &[]dto.CreatePromoRequest{validPromoRequest()}[0])
		if err != nil {
			t.Fatalf("create failed: %v", err)
		}
		if resp.Code != "TRAIL10" || resp.UsedQuota != 0 {
			t.Fatalf("unexpected response: %#v", resp)
		}
	})

	for _, tc := range []struct {
		name string
		edit func(*dto.CreatePromoRequest)
		want string
	}{
		{name: "start after end", edit: func(req *dto.CreatePromoRequest) { req.StartAt = req.EndAt.Add(time.Hour) }, want: "start date must be before end date"},
		{name: "percent too high", edit: func(req *dto.CreatePromoRequest) { req.DiscountValue = 101 }, want: "percentage discount cannot exceed 100%"},
		{name: "zero discount", edit: func(req *dto.CreatePromoRequest) { req.DiscountValue = 0 }, want: "discount value must be greater than 0"},
		{name: "negative quota", edit: func(req *dto.CreatePromoRequest) { req.Quota = -1 }, want: "quota cannot be negative"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			req := validPromoRequest()
			tc.edit(&req)
			_, err := NewPromoService(newFakePromoRepo()).CreatePromo(nil, &req)
			if err == nil || err.Error() != tc.want {
				t.Fatalf("expected %q, got %v", tc.want, err)
			}
		})
	}

	t.Run("duplicate code", func(t *testing.T) {
		repo := newFakePromoRepo()
		seedFakePromo(repo, "TRAIL10")
		_, err := NewPromoService(repo).CreatePromo(nil, &[]dto.CreatePromoRequest{validPromoRequest()}[0])
		if err == nil || err.Error() != "promo code already exists" {
			t.Fatalf("unexpected duplicate error: %v", err)
		}
	})

	t.Run("repository create error", func(t *testing.T) {
		repo := newFakePromoRepo()
		repo.createFn = func(*model.PromoCode) error { return errors.New("db down") }
		_, err := NewPromoService(repo).CreatePromo(nil, &[]dto.CreatePromoRequest{validPromoRequest()}[0])
		if err == nil || err.Error() != "db down" {
			t.Fatalf("expected repo error, got %v", err)
		}
	})
}

func TestPromoServiceReadUpdateArchive(t *testing.T) {
	repo := newFakePromoRepo()
	promo := seedFakePromo(repo, "TRAIL10")
	service := NewPromoService(repo)

	list, total, err := service.GetPromos(nil, &dto.GetPromosRequest{Page: 1, Limit: 10})
	if err != nil || total != 1 || len(list) != 1 {
		t.Fatalf("GetPromos failed list=%#v total=%d err=%v", list, total, err)
	}

	got, err := service.GetPromoByID(nil, promo.ID)
	if err != nil || got.ID != promo.ID {
		t.Fatalf("GetPromoByID failed: %#v %v", got, err)
	}

	newCode := "TRAIL20"
	fixed := model.DiscountFixed
	value := 20000.0
	maxDiscount := 0.0
	minParticipants := 2
	quota := 50
	start := promo.StartAt.Add(time.Hour)
	end := promo.EndAt.Add(time.Hour)
	active := false
	updated, err := service.UpdatePromo(nil, promo.ID, &dto.UpdatePromoRequest{
		Code:            &newCode,
		DiscountType:    &fixed,
		DiscountValue:   &value,
		MaxDiscount:     &maxDiscount,
		MinParticipants: &minParticipants,
		Quota:           &quota,
		StartAt:         &start,
		EndAt:           &end,
		IsActive:        &active,
	})
	if err != nil {
		t.Fatalf("UpdatePromo failed: %v", err)
	}
	if updated.Code != newCode || updated.DiscountType != fixed || updated.Quota != quota || updated.IsActive {
		t.Fatalf("unexpected update response: %#v", updated)
	}

	other := seedFakePromo(repo, "OTHER")
	duplicateCode := other.Code
	_, err = service.UpdatePromo(nil, promo.ID, &dto.UpdatePromoRequest{Code: &duplicateCode})
	if err == nil || err.Error() != "promo code already exists" {
		t.Fatalf("expected duplicate update error, got %v", err)
	}

	invalidValue := 0.0
	_, err = service.UpdatePromo(nil, promo.ID, &dto.UpdatePromoRequest{DiscountValue: &invalidValue})
	if err == nil || err.Error() != "discount value must be greater than 0" {
		t.Fatalf("expected invalid value error, got %v", err)
	}

	percent := model.DiscountPercent
	tooHigh := 101.0
	_, err = service.UpdatePromo(nil, promo.ID, &dto.UpdatePromoRequest{DiscountType: &percent, DiscountValue: &tooHigh})
	if err == nil || err.Error() != "percentage discount cannot exceed 100%" {
		t.Fatalf("expected percent error, got %v", err)
	}

	badStart := promo.EndAt.Add(time.Hour)
	_, err = service.UpdatePromo(nil, promo.ID, &dto.UpdatePromoRequest{StartAt: &badStart, EndAt: promo.EndAt})
	if err == nil || err.Error() != "start date must be before end date" {
		t.Fatalf("expected date error, got %v", err)
	}

	if err := service.ArchivePromo(nil, promo.ID); err != nil {
		t.Fatalf("archive failed: %v", err)
	}
	if _, ok := repo.byID[promo.ID]; ok {
		t.Fatal("promo should have been deleted from fake repo")
	}
}
