package model

import (
	"context"
	"gin-template/common"
	"testing"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

func TestGetCourseSellerActiveRulesForExternalMentor(t *testing.T) {
	db, tenant := setupLMSTestDB(t)
	tenantDB := db.WithContext(context.WithValue(context.Background(), common.CtxTenantKey, tenant))
	sellerID := uuid.New()
	requiredCourseID := uuid.New()

	category := PricingCategory{
		ID: uuid.New(), Name: "Mentor External", Slug: "mentor-external", CheckoutType: "teacher", IsActive: true,
	}
	if err := tenantDB.Create(&category).Error; err != nil {
		t.Fatalf("create pricing category: %v", err)
	}
	plan := SubscriptionPlan{
		ID: uuid.New(), Name: "Seller", Slug: "external-seller", Interval: "monthly", DurationDays: 30,
		PricingCategoryID: &category.ID,
		FeatureMeta:       datatypes.JSON([]byte(`{"rules":{"can_create_course":true,"min_lessons_to_sell":3,"required_course_ids":["` + requiredCourseID.String() + `"]}}`)),
		TenantID:          &tenant.ID,
	}
	if err := tenantDB.Create(&plan).Error; err != nil {
		t.Fatalf("create subscription plan: %v", err)
	}
	periodEnd := time.Now().Add(24 * time.Hour)
	subscription := Subscription{
		ID: uuid.New(), ParentID: sellerID, StudentID: sellerID, PlanID: &plan.ID,
		Status: SubscriptionStatusActive, CurrentPeriodEnd: &periodEnd, TenantID: &tenant.ID,
	}
	if err := tenantDB.Create(&subscription).Error; err != nil {
		t.Fatalf("create subscription: %v", err)
	}

	rules, activePlan, err := GetCourseSellerActiveRules(tenantDB, sellerID, RoleGuruExternal)
	if err != nil {
		t.Fatalf("get seller rules: %v", err)
	}
	if rules == nil || activePlan == nil {
		t.Fatal("expected active external mentor seller rules")
	}
	if !rules.CanCreateCourse || rules.MinLessonsToSell != 3 {
		t.Fatalf("unexpected rules: %+v", rules)
	}
	if len(rules.RequiredCourseIDs) != 1 || rules.RequiredCourseIDs[0] != requiredCourseID {
		t.Fatalf("unexpected required courses: %+v", rules.RequiredCourseIDs)
	}
}

func TestGetCourseSellerActiveRulesForParentExternal(t *testing.T) {
	db, tenant := setupLMSTestDB(t)
	tenantDB := db.WithContext(context.WithValue(context.Background(), common.CtxTenantKey, tenant))
	sellerID := uuid.New()
	category := PricingCategory{
		ID: uuid.New(), Name: "Parent External", Slug: "parent-external", CheckoutType: "parent-external", IsActive: true,
	}
	if err := tenantDB.Create(&category).Error; err != nil {
		t.Fatalf("create pricing category: %v", err)
	}
	plan := SubscriptionPlan{
		ID: uuid.New(), Name: "Parent Seller", Slug: "parent-seller", Interval: "monthly", DurationDays: 30,
		PricingCategoryID: &category.ID,
		FeatureMeta:       datatypes.JSON([]byte(`{"rules":{"can_create_course":true,"min_lessons_to_sell":2}}`)),
		TenantID:          &tenant.ID,
	}
	if err := tenantDB.Create(&plan).Error; err != nil {
		t.Fatalf("create subscription plan: %v", err)
	}
	periodEnd := time.Now().Add(24 * time.Hour)
	if err := tenantDB.Create(&Subscription{
		ID: uuid.New(), ParentID: sellerID, StudentID: sellerID, PlanID: &plan.ID,
		Status: SubscriptionStatusActive, CurrentPeriodEnd: &periodEnd, TenantID: &tenant.ID,
	}).Error; err != nil {
		t.Fatalf("create subscription: %v", err)
	}

	rules, _, err := GetCourseSellerActiveRules(tenantDB, sellerID, RoleParent)
	if err != nil {
		t.Fatalf("get parent external rules: %v", err)
	}
	if rules == nil || !rules.CanCreateCourse || rules.MinLessonsToSell != 2 {
		t.Fatalf("unexpected parent external rules: %+v", rules)
	}
}

func TestGetCourseSellerActiveRulesPrefersProviderPlanAfterUpgrade(t *testing.T) {
	db, tenant := setupLMSTestDB(t)
	tenantDB := db.WithContext(context.WithValue(context.Background(), common.CtxTenantKey, tenant))
	sellerID := uuid.New()

	legacyCategory := PricingCategory{
		ID: uuid.New(), Name: "Parent", Slug: "parent", CheckoutType: "parent", IsActive: true,
	}
	externalCategory := PricingCategory{
		ID: uuid.New(), Name: "Parent External", Slug: "parent-external-upgrade", CheckoutType: "parent-external", IsActive: true,
	}
	if err := tenantDB.Create(&legacyCategory).Error; err != nil {
		t.Fatalf("create legacy category: %v", err)
	}
	if err := tenantDB.Create(&externalCategory).Error; err != nil {
		t.Fatalf("create external category: %v", err)
	}

	legacyPlan := SubscriptionPlan{
		ID: uuid.New(), Name: "Legacy Parent", Slug: "legacy-parent", Interval: "monthly", DurationDays: 30,
		PricingCategoryID: &legacyCategory.ID,
		FeatureMeta:       datatypes.JSON([]byte(`{"rules":{"can_create_course":true,"min_lessons_to_sell":0}}`)),
		TenantID:          &tenant.ID,
	}
	externalPlan := SubscriptionPlan{
		ID: uuid.New(), Name: "Business Parent AI Club", Slug: "business-parent-ai-club", Interval: "monthly", DurationDays: 30,
		PricingCategoryID: &externalCategory.ID,
		FeatureMeta:       datatypes.JSON([]byte(`{"rules":{"can_create_course":true,"min_lessons_to_sell":5}}`)),
		TenantID:          &tenant.ID,
	}
	if err := tenantDB.Create(&legacyPlan).Error; err != nil {
		t.Fatalf("create legacy plan: %v", err)
	}
	if err := tenantDB.Create(&externalPlan).Error; err != nil {
		t.Fatalf("create external plan: %v", err)
	}

	periodEnd := time.Now().Add(24 * time.Hour)
	if err := tenantDB.Create(&Subscription{
		ID: uuid.New(), ParentID: sellerID, StudentID: sellerID,
		PlanID: &legacyPlan.ID, ProviderPlanID: externalPlan.ID.String(),
		Status: SubscriptionStatusActive, CurrentPeriodEnd: &periodEnd, TenantID: &tenant.ID,
	}).Error; err != nil {
		t.Fatalf("create upgraded subscription: %v", err)
	}

	rules, activePlan, err := GetCourseSellerActiveRules(tenantDB, sellerID, RoleParent)
	if err != nil {
		t.Fatalf("get upgraded seller rules: %v", err)
	}
	if activePlan == nil || activePlan.ID != externalPlan.ID {
		t.Fatalf("expected provider plan %s, got %+v", externalPlan.ID, activePlan)
	}
	if rules == nil || rules.MinLessonsToSell != 5 {
		t.Fatalf("expected min lessons 5 from provider plan, got %+v", rules)
	}
}

func TestCheckCourseCompletedRequiresAllPublishedLessons(t *testing.T) {
	db, tenant := setupLMSTestDB(t)
	tenantDB := db.WithContext(context.WithValue(context.Background(), common.CtxTenantKey, tenant))
	studentID := uuid.New()
	course := Course{Title: "Prerequisite", Slug: "prerequisite", Status: CourseStatusPublished}
	if err := tenantDB.Create(&course).Error; err != nil {
		t.Fatalf("create course: %v", err)
	}
	module := Module{CourseID: course.ID, Title: "Module", IsPublished: true}
	if err := tenantDB.Create(&module).Error; err != nil {
		t.Fatalf("create module: %v", err)
	}
	lessons := []Lesson{
		{ModuleID: module.ID, Title: "One", IsPublished: true},
		{ModuleID: module.ID, Title: "Two", IsPublished: true},
	}
	for i := range lessons {
		if err := tenantDB.Create(&lessons[i]).Error; err != nil {
			t.Fatalf("create lesson: %v", err)
		}
	}
	if CheckCourseCompleted(tenantDB, studentID, course.ID) {
		t.Fatal("course must not be completed without progress")
	}
	for _, lesson := range lessons {
		progress := StudentProgress{
			StudentID: studentID, CourseID: course.ID, ModuleID: module.ID, LessonID: lesson.ID, IsCompleted: true,
		}
		if err := tenantDB.Create(&progress).Error; err != nil {
			t.Fatalf("create progress: %v", err)
		}
	}
	if !CheckCourseCompleted(tenantDB, studentID, course.ID) {
		t.Fatal("expected course to be completed after all published lessons")
	}
}

func TestSeparateCreateAndSellRequirements(t *testing.T) {
	db, tenant := setupLMSTestDB(t)
	tenantDB := db.WithContext(context.WithValue(context.Background(), common.CtxTenantKey, tenant))
	userID := uuid.New()
	prerequisite := Course{Title: "Required Course", Slug: "required-course", Status: CourseStatusPublished}
	if err := tenantDB.Create(&prerequisite).Error; err != nil {
		t.Fatalf("create prerequisite: %v", err)
	}
	module := Module{CourseID: prerequisite.ID, Title: "Module", IsPublished: true}
	if err := tenantDB.Create(&module).Error; err != nil {
		t.Fatalf("create module: %v", err)
	}
	lesson := Lesson{ModuleID: module.ID, Title: "Lesson", IsPublished: true}
	if err := tenantDB.Create(&lesson).Error; err != nil {
		t.Fatalf("create lesson: %v", err)
	}

	canSell := true
	rules := &PlanRules{
		CanCreateCourse:         true,
		CreateRequirement:       CourseRequirementSelected,
		CreateRequiredCourseIDs: []uuid.UUID{prerequisite.ID},
		CanSellCourse:           &canSell,
		SellRequirement:         CourseRequirementSelected,
		SellRequiredCourseIDs:   []uuid.UUID{prerequisite.ID},
	}
	plan := &SubscriptionPlan{ID: uuid.New()}

	createUnlocked, _, err := CheckCourseCreationRequirements(tenantDB, userID, rules, plan)
	if err != nil || createUnlocked {
		t.Fatalf("creation must remain locked before prerequisite completion: unlocked=%v err=%v", createUnlocked, err)
	}
	sellUnlocked, _, err := CheckCourseSellerRequirements(tenantDB, userID, rules, plan)
	if err != nil || sellUnlocked {
		t.Fatalf("selling must remain locked before prerequisite completion: unlocked=%v err=%v", sellUnlocked, err)
	}

	progress := StudentProgress{
		StudentID:   userID,
		CourseID:    prerequisite.ID,
		ModuleID:    module.ID,
		LessonID:    lesson.ID,
		IsCompleted: true,
	}
	if err := tenantDB.Create(&progress).Error; err != nil {
		t.Fatalf("create progress: %v", err)
	}

	createUnlocked, _, err = CheckCourseCreationRequirements(tenantDB, userID, rules, plan)
	if err != nil || !createUnlocked {
		t.Fatalf("creation must unlock after prerequisite completion: unlocked=%v err=%v", createUnlocked, err)
	}
	sellUnlocked, _, err = CheckCourseSellerRequirements(tenantDB, userID, rules, plan)
	if err != nil || !sellUnlocked {
		t.Fatalf("selling must unlock after prerequisite completion: unlocked=%v err=%v", sellUnlocked, err)
	}
}
