package repository

import (
	"context"
	"fmt"
	"gin-template/common"
	"gin-template/dto"
	"gin-template/model"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupPromoRepoTest(t *testing.T) (*gorm.DB, *gin.Context, model.Tenant) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.Exec(`CREATE TABLE promo_codes (
		id char(36) PRIMARY KEY,
		code text,
		discount_type text,
		discount_value real,
		max_discount real,
		min_participants integer,
		quota integer,
		used_quota integer,
		start_at datetime,
		end_at datetime,
		is_active boolean,
		tenant_id char(36),
		created_at datetime,
		updated_at datetime,
		deleted_at datetime
	)`).Error; err != nil {
		t.Fatalf("create promo table: %v", err)
	}

	tenant := model.Tenant{ID: uuid.New(), Name: "Tenant"}
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest("GET", "/", nil)
	ctx.Set("db", db.WithContext(context.WithValue(context.Background(), common.CtxTenantKey, tenant)))
	ctx.Set(common.CtxTenantKey, tenant)
	return db, ctx, tenant
}

func repoPromo(code string, tenantID uuid.UUID, active bool, createdAt time.Time) model.PromoCode {
	start := createdAt.Add(-time.Hour)
	end := createdAt.Add(time.Hour)
	now := createdAt
	return model.PromoCode{
		ID:              uuid.New(),
		Code:            code,
		DiscountType:    model.DiscountFixed,
		DiscountValue:   10000,
		MaxDiscount:     0,
		MinParticipants: 1,
		Quota:           10,
		UsedQuota:       0,
		StartAt:         &start,
		EndAt:           &end,
		IsActive:        active,
		TenantID:        &tenantID,
		CreatedAt:       &now,
		UpdatedAt:       &now,
	}
}

func TestPromoRepositoryCRUDAndFilters(t *testing.T) {
	db, ctx, tenant := setupPromoRepoTest(t)
	repo := NewPromoRepository(db)

	now := time.Now().UTC()
	promo := repoPromo("TRAIL10", tenant.ID, true, now)
	if err := repo.Create(ctx, &promo); err != nil {
		t.Fatalf("create failed: %v", err)
	}

	inactive := repoPromo("OLD20", tenant.ID, false, now.Add(-time.Hour))
	if err := db.WithContext(context.WithValue(context.Background(), common.CtxTenantKey, tenant)).Create(&inactive).Error; err != nil {
		t.Fatalf("seed inactive: %v", err)
	}

	otherTenant := uuid.New()
	otherTenantModel := model.Tenant{ID: otherTenant, Name: "Other"}
	other := repoPromo("TRAIL99", otherTenant, true, now)
	if err := db.WithContext(context.WithValue(context.Background(), common.CtxTenantKey, otherTenantModel)).Create(&other).Error; err != nil {
		t.Fatalf("seed other tenant: %v", err)
	}

	active := true
	items, total, err := repo.FindAll(ctx, &dto.GetPromosRequest{
		Page:     1,
		Limit:    10,
		IsActive: &active,
		Code:     "TRAIL",
		TenantID: tenant.ID,
	})
	if err != nil {
		t.Fatalf("FindAll failed: %v", err)
	}
	if total != 1 || len(items) != 1 || items[0].Code != "TRAIL10" {
		t.Fatalf("unexpected FindAll result total=%d items=%#v", total, items)
	}

	byID, err := repo.FindByID(ctx, promo.ID)
	if err != nil || byID.Code != promo.Code {
		t.Fatalf("FindByID failed: %#v %v", byID, err)
	}

	byCode, err := repo.FindByCode(ctx, "TRAIL10")
	if err != nil || byCode == nil || byCode.ID != promo.ID {
		t.Fatalf("FindByCode failed: %#v %v", byCode, err)
	}

	missing, err := repo.FindByCode(ctx, "NONE")
	if err != nil || missing != nil {
		t.Fatalf("missing FindByCode should return nil,nil got %#v %v", missing, err)
	}

	promo.Quota = 99
	if err := repo.Update(ctx, &promo); err != nil {
		t.Fatalf("update failed: %v", err)
	}
	var updated model.PromoCode
	if err := db.First(&updated, "id = ?", promo.ID).Error; err != nil {
		t.Fatalf("fetch updated: %v", err)
	}
	if updated.Quota != 99 {
		t.Fatalf("quota not updated: %d", updated.Quota)
	}

	if err := repo.Delete(ctx, &promo); err != nil {
		t.Fatalf("delete failed: %v", err)
	}
	var count int64
	db.Model(&model.PromoCode{}).Where("id = ?", promo.ID).Count(&count)
	if count != 0 {
		t.Fatalf("expected soft-deleted row hidden from default scope, count=%d", count)
	}
}


