package model

import (
	"context"
	"gin-template/common"
	"testing"
	"time"

	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupLMSTestDB(t *testing.T) (*gorm.DB, Tenant) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	models := []interface{}{&Tenant{}, &User{}}
	models = append(models, LMSModels()...)
	if err := db.AutoMigrate(models...); err != nil {
		t.Fatalf("migrate lms models: %v", err)
	}
	tenant := Tenant{ID: uuid.New(), Name: "LMS Tenant", Domain: "lms.test", IsActive: true}
	if err := db.Create(&tenant).Error; err != nil {
		t.Fatalf("create tenant: %v", err)
	}
	return db, tenant
}

func TestLMSModelRequiresTenant(t *testing.T) {
	db, _ := setupLMSTestDB(t)
	err := db.Create(&Course{Title: "No Tenant", Slug: "no-tenant"}).Error
	if err == nil {
		t.Fatal("expected tenant isolation error")
	}
}

func TestCreatingUserAlsoCreatesProfile(t *testing.T) {
	db, tenant := setupLMSTestDB(t)
	ctx := context.WithValue(context.Background(), common.CtxTenantKey, tenant)
	user := User{
		Username:    "profile-user",
		Email:       "profile-user@example.com",
		DisplayName: "Profile User",
		Password:    "hashed-for-test",
		TenantID:    &tenant.ID,
	}

	if err := db.WithContext(ctx).Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	var profile Profile
	if err := db.First(&profile, "user_id = ?", user.ID).Error; err != nil {
		t.Fatalf("find generated profile: %v", err)
	}
	if profile.FullName != user.DisplayName {
		t.Fatalf("expected profile name %q, got %q", user.DisplayName, profile.FullName)
	}
	if profile.TenantID == nil || *profile.TenantID != tenant.ID {
		t.Fatalf("expected profile tenant %s, got %v", tenant.ID, profile.TenantID)
	}
}

func TestMigrateUsersToProfilesBackfillsLegacyUsers(t *testing.T) {
	db, tenant := setupLMSTestDB(t)
	legacy := User{
		ID:          uuid.New(),
		Username:    "legacy-user",
		Email:       "legacy-user@example.com",
		DisplayName: "Legacy User",
		Password:    "hashed-for-test",
		TenantID:    &tenant.ID,
	}
	if err := db.Session(&gorm.Session{SkipHooks: true}).Create(&legacy).Error; err != nil {
		t.Fatalf("create legacy user: %v", err)
	}

	if err := migrateUsersToProfiles(db); err != nil {
		t.Fatalf("migrate profiles: %v", err)
	}

	var profile Profile
	if err := db.First(&profile, "user_id = ?", legacy.ID).Error; err != nil {
		t.Fatalf("find backfilled profile: %v", err)
	}
	if profile.FullName != legacy.DisplayName {
		t.Fatalf("expected backfilled name %q, got %q", legacy.DisplayName, profile.FullName)
	}
}

func TestLMSCourseAndSubscriptionLifecycle(t *testing.T) {
	db, tenant := setupLMSTestDB(t)
	ctx := context.WithValue(context.Background(), common.CtxTenantKey, tenant)
	tenantDB := db.WithContext(ctx)

	course := Course{
		Title:  "Python Anak",
		Slug:   "python-anak",
		Status: CourseStatusPublished,
	}
	if err := tenantDB.Create(&course).Error; err != nil {
		t.Fatalf("create course: %v", err)
	}
	if course.ID == uuid.Nil {
		t.Fatal("expected course UUID to be generated")
	}
	if course.TenantID == nil || *course.TenantID != tenant.ID {
		t.Fatalf("expected tenant id %s, got %v", tenant.ID, course.TenantID)
	}

	periodEnd := time.Now().AddDate(0, 1, 0)
	subscription := Subscription{
		ParentID:         uuid.New(),
		StudentID:        uuid.New(),
		CourseID:         &course.ID,
		Status:           SubscriptionStatusActive,
		Amount:           350000,
		Currency:         "IDR",
		CurrentPeriodEnd: &periodEnd,
	}
	if err := tenantDB.Create(&subscription).Error; err != nil {
		t.Fatalf("create subscription: %v", err)
	}

	var count int64
	if err := tenantDB.Model(&Subscription{}).
		Where("student_id = ? AND status = ? AND current_period_end >= ?", subscription.StudentID, SubscriptionStatusActive, time.Now()).
		Count(&count).Error; err != nil {
		t.Fatalf("count active subscriptions: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected active learning access, got %d", count)
	}
}
