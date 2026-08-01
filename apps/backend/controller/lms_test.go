package controller

import (
	"context"
	"encoding/json"
	"fmt"
	"gin-template/common"
	"gin-template/model"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"gin-template/middleware"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupLMSControllerTest(t *testing.T) (*gin.Engine, *gorm.DB, model.Tenant, model.User) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	models := []interface{}{
		&model.Tenant{},
		&model.User{},
		&model.SubscriptionPlan{},
		&model.SubscriptionFeature{},
	}
	models = append(models, model.LMSModels()...)
	if err := db.AutoMigrate(models...); err != nil {
		t.Fatalf("migrate lms models: %v", err)
	}
	tenant := model.Tenant{ID: uuid.New(), Name: "LMS Tenant", Domain: "controller.test", IsActive: true}
	if err := db.Create(&tenant).Error; err != nil {
		t.Fatalf("create tenant: %v", err)
	}

	// Create a mentor user for authenticated operations
	ctx := context.WithValue(context.Background(), common.CtxTenantKey, tenant)
	mentor := model.User{ID: uuid.New(), Username: "lms-admin", Email: "lmsadmin@test.com", Role: 99, Status: common.UserStatusEnabled}
	if err := db.WithContext(ctx).Create(&mentor).Error; err != nil {
		t.Fatalf("create mentor: %v", err)
	}

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("db", db)
		c.Set(common.CtxTenantKey, tenant)
		c.Set("id", mentor.ID.String())
		c.Set("userID", mentor.ID)
		c.Set("username", mentor.Username)
		c.Set("role", mentor.Role)
		c.Request = c.Request.WithContext(context.WithValue(c.Request.Context(), common.CtxTenantKey, tenant))
		c.Next()
	})
	ctrl := NewLMSController(db)
	router.POST("/courses", ctrl.CreateCourse)
	router.GET("/courses", ctrl.ListCourses)
	router.GET("/courses/:id/public", ctrl.GetPublicCourse)
	router.GET("/courses/stats", ctrl.GetCourseStats)
	router.POST("/subscriptions", ctrl.CreateSubscription)
	router.GET("/access", ctrl.CheckLearningAccess)
	router.GET("/subscription-plans", ctrl.ListSubscriptionPlans)
	return router, db, tenant, mentor
}

func TestListSubscriptionPlansFiltersStudentCheckoutType(t *testing.T) {
	router, db, tenant, _ := setupLMSControllerTest(t)
	ctx := context.WithValue(context.Background(), common.CtxTenantKey, tenant)

	studentCategory := model.PricingCategory{
		Name:         "SD",
		Slug:         "sd",
		CheckoutType: "student",
		IsActive:     true,
	}
	parentCategory := model.PricingCategory{
		Name:         "Parent",
		Slug:         "parent-system",
		CheckoutType: "parent",
		IsActive:     true,
	}
	if err := db.WithContext(ctx).Create(&studentCategory).Error; err != nil {
		t.Fatalf("create student pricing category: %v", err)
	}
	if err := db.WithContext(ctx).Create(&parentCategory).Error; err != nil {
		t.Fatalf("create parent pricing category: %v", err)
	}

	plans := []model.SubscriptionPlan{
		{
			Name:              "SD Student",
			Slug:              "sd-student",
			Amount:            189000,
			DurationDays:      30,
			Interval:          "monthly",
			IsActive:          true,
			PricingCategoryID: &studentCategory.ID,
		},
		{
			Name:              "Parent Plan",
			Slug:              "parent-plan",
			Amount:            99000,
			DurationDays:      30,
			Interval:          "monthly",
			IsActive:          true,
			PricingCategoryID: &parentCategory.ID,
		},
	}
	for i := range plans {
		if err := db.WithContext(ctx).Create(&plans[i]).Error; err != nil {
			t.Fatalf("create subscription plan %d: %v", i, err)
		}
	}

	recorder := performJSON(
		router,
		http.MethodGet,
		"/subscription-plans?filter%5Bcheckout_type%5D=student",
		"",
	)
	if recorder.Code != http.StatusOK {
		t.Fatalf("student plan list status=%d body=%s", recorder.Code, recorder.Body.String())
	}

	var response struct {
		Data []model.SubscriptionPlan `json:"data"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode student plans: %v", err)
	}
	if len(response.Data) != 1 || response.Data[0].Slug != "sd-student" {
		t.Fatalf("expected only student plan, got %+v", response.Data)
	}
	if response.Data[0].PricingCategory == nil || response.Data[0].PricingCategory.CheckoutType != "student" {
		t.Fatalf("expected student pricing category preload, got %+v", response.Data[0].PricingCategory)
	}
}

func TestPublicCourseSupportsSlugAndLegacyUUID(t *testing.T) {
	router, db, tenant, _ := setupLMSControllerTest(t)
	ctx := context.WithValue(context.Background(), common.CtxTenantKey, tenant)
	category := model.CourseCategory{
		ID:   uuid.New(),
		Name: "Sains",
		Slug: "sains",
	}
	if err := db.WithContext(ctx).Create(&category).Error; err != nil {
		t.Fatalf("create category: %v", err)
	}
	if err := setCourseCategoryTargetRoles(
		db.WithContext(ctx),
		category.ID,
		&tenant.ID,
		[]string{"student"},
	); err != nil {
		t.Fatalf("set category target roles: %v", err)
	}
	course := model.Course{
		ID:               uuid.New(),
		Title:            "Eksperimen Cahaya",
		Slug:             "eksperimen-cahaya",
		CourseCategoryID: category.ID,
		Status:           model.CourseStatusPublished,
	}
	if err := db.WithContext(ctx).Create(&course).Error; err != nil {
		t.Fatalf("create course: %v", err)
	}

	for _, reference := range []string{course.Slug, course.ID.String()} {
		recorder := performJSON(
			router,
			http.MethodGet,
			"/courses/"+reference+"/public",
			"",
		)
		if recorder.Code != http.StatusOK {
			t.Fatalf("public detail %q status=%d body=%s", reference, recorder.Code, recorder.Body.String())
		}
		data := responseData(t, recorder.Body.Bytes())
		if data["slug"] != course.Slug {
			t.Fatalf("unexpected course for %q: %+v", reference, data)
		}
	}
}

func TestListCoursesSupportsAdvancedFilters(t *testing.T) {
	router, db, tenant, _ := setupLMSControllerTest(t)
	ctx := context.WithValue(context.Background(), common.CtxTenantKey, tenant)
	category := model.CourseCategory{
		ID:   uuid.New(),
		Name: "Filter Category",
		Slug: "filter-category",
	}
	if err := db.WithContext(ctx).Create(&category).Error; err != nil {
		t.Fatalf("create category: %v", err)
	}
	courses := []model.Course{
		{
			Title:            "Paid Elementary",
			Slug:             "paid-elementary",
			CourseCategoryID: category.ID,
			Level:            "SD / Elementary",
			Status:           model.CourseStatusPublished,
			SellIndividual:   true,
			Price:            125000,
			OwnerType:        "internal",
		},
		{
			Title:            "Subscription Middle",
			Slug:             "subscription-middle",
			CourseCategoryID: category.ID,
			Level:            "SMP / Middle School",
			Status:           model.CourseStatusPublished,
			SellIndividual:   false,
			OwnerType:        "external",
		},
	}
	for index := range courses {
		if err := db.WithContext(ctx).Create(&courses[index]).Error; err != nil {
			t.Fatalf("create course %d: %v", index, err)
		}
	}

	recorder := performJSON(
		router,
		http.MethodGet,
		"/courses?level=SD%20%2F%20Elementary&availability=paid&owner_type=internal&min_price=100000",
		"",
	)
	if recorder.Code != http.StatusOK {
		t.Fatalf("filtered list status=%d body=%s", recorder.Code, recorder.Body.String())
	}
	var response struct {
		Data []struct {
			Slug string `json:"slug"`
		} `json:"data"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(response.Data) != 1 || response.Data[0].Slug != courses[0].Slug {
		t.Fatalf("unexpected filtered courses: %+v", response.Data)
	}
}

func TestInternalMentorScopeIncludesAdminOwnedCourses(t *testing.T) {
	router, db, tenant, admin := setupLMSControllerTest(t)
	ctx := context.WithValue(context.Background(), common.CtxTenantKey, tenant)

	category := model.CourseCategory{ID: uuid.New(), Name: "Internal", Slug: "internal"}
	if err := db.WithContext(ctx).Create(&category).Error; err != nil {
		t.Fatalf("create category: %v", err)
	}
	mentor := model.User{ID: uuid.New(), Username: "scope-mentor", Email: "scope-mentor@test.com", Role: model.RoleMentor, Status: common.UserStatusEnabled}
	if err := db.WithContext(ctx).Create(&mentor).Error; err != nil {
		t.Fatalf("create mentor: %v", err)
	}

	adminDraft := model.Course{ID: uuid.New(), Title: "Admin Draft", Slug: "admin-draft", CourseCategoryID: category.ID, Status: model.CourseStatusDraft}
	mentorPublished := model.Course{ID: uuid.New(), Title: "Mentor Published", Slug: "mentor-published", CourseCategoryID: category.ID, Status: model.CourseStatusPublished}
	if err := db.WithContext(ctx).Create(&adminDraft).Error; err != nil {
		t.Fatalf("create admin course: %v", err)
	}
	if err := db.WithContext(ctx).Create(&mentorPublished).Error; err != nil {
		t.Fatalf("create mentor course: %v", err)
	}
	if err := db.Model(&adminDraft).Association("Mentors").Append(&admin); err != nil {
		t.Fatalf("assign admin mentor: %v", err)
	}
	if err := db.Model(&mentorPublished).Association("Mentors").Append(&mentor); err != nil {
		t.Fatalf("assign role-30 mentor: %v", err)
	}

	listRec := performJSON(router, http.MethodGet, "/courses?include_drafts=true&creator_scope=internal_mentors", "")
	if listRec.Code != http.StatusOK {
		t.Fatalf("list status = %d, body = %s", listRec.Code, listRec.Body.String())
	}
	var listPayload struct {
		Data []model.Course `json:"data"`
	}
	if err := json.Unmarshal(listRec.Body.Bytes(), &listPayload); err != nil {
		t.Fatalf("decode list: %v", err)
	}
	if len(listPayload.Data) != 2 {
		t.Fatalf("expected admin and mentor courses, got %d: %s", len(listPayload.Data), listRec.Body.String())
	}

	statsRec := performJSON(router, http.MethodGet, "/courses/stats?include_drafts=true&creator_scope=internal_mentors", "")
	if statsRec.Code != http.StatusOK {
		t.Fatalf("stats status = %d, body = %s", statsRec.Code, statsRec.Body.String())
	}
	stats := responseData(t, statsRec.Body.Bytes())
	if stats["total"] != float64(2) || stats["draft"] != float64(1) || stats["published"] != float64(1) {
		t.Fatalf("unexpected stats: %+v", stats)
	}
}

func responseData(t *testing.T, body []byte) map[string]interface{} {
	t.Helper()
	var payload map[string]interface{}
	if err := json.Unmarshal(body, &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	return payload["data"].(map[string]interface{})
}

func TestLMSControllerCreatesAndListsPublishedCourses(t *testing.T) {
	router, db, tenant, _ := setupLMSControllerTest(t)

	ctx := context.WithValue(context.Background(), common.CtxTenantKey, tenant)
	category := model.CourseCategory{ID: uuid.New(), Name: "Programming", Slug: "programming"}
	if err := db.WithContext(ctx).Create(&category).Error; err != nil {
		t.Fatalf("create category: %v", err)
	}
	if err := setCourseCategoryTargetRoles(
		db.WithContext(ctx),
		category.ID,
		&tenant.ID,
		[]string{"student"},
	); err != nil {
		t.Fatalf("set category target roles: %v", err)
	}

	mentor := model.User{ID: uuid.New(), Username: "mentor1", Status: 1, Role: 30}
	if err := db.WithContext(ctx).Create(&mentor).Error; err != nil {
		t.Fatalf("create mentor: %v", err)
	}

	rec := performJSON(router, http.MethodPost, "/courses", fmt.Sprintf(
		`{"title":"AI Dasar","slug":"ai-dasar","course_category_id":"%s","status":"published","mentor_ids":["%s"],"target_roles":["student"]}`,
		category.ID, mentor.ID))
	if rec.Code != http.StatusOK {
		t.Fatalf("create course status = %d, body = %s", rec.Code, rec.Body.String())
	}
	data := responseData(t, rec.Body.Bytes())
	if data["id"] == "" {
		t.Fatal("expected generated course id")
	}

	rec = performJSON(router, http.MethodGet, "/courses", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("list courses status = %d, body = %s", rec.Code, rec.Body.String())
	}
	var payload struct {
		Data []struct {
			Slug string `json:"slug"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode list: %v", err)
	}
	if len(payload.Data) != 1 || payload.Data[0].Slug != "ai-dasar" {
		t.Fatalf("unexpected courses: %+v", payload.Data)
	}
}

func TestLMSControllerChecksLearningAccessFromSubscription(t *testing.T) {
	router, _, _, _ := setupLMSControllerTest(t)
	studentID := uuid.New()

	rec := performJSON(router, http.MethodGet, fmt.Sprintf("/access?student_id=%s", studentID), "")
	if rec.Code != http.StatusOK {
		t.Fatalf("check access status = %d, body = %s", rec.Code, rec.Body.String())
	}
	data := responseData(t, rec.Body.Bytes())
	if data["has_access"].(bool) {
		t.Fatal("expected no access before subscription")
	}

	periodEnd := time.Now().AddDate(0, 1, 0).Format(time.RFC3339)
	body := fmt.Sprintf(`{"parent_id":"%s","student_id":"%s","status":"active","amount":350000,"currency":"IDR","current_period_end":"%s"}`, uuid.New(), studentID, periodEnd)
	rec = performJSON(router, http.MethodPost, "/subscriptions", body)
	if rec.Code != http.StatusOK {
		t.Fatalf("create subscription status = %d, body = %s", rec.Code, rec.Body.String())
	}

	rec = performJSON(router, http.MethodGet, fmt.Sprintf("/access?student_id=%s", studentID), "")
	if rec.Code != http.StatusOK {
		t.Fatalf("check access after subscription status = %d, body = %s", rec.Code, rec.Body.String())
	}
	data = responseData(t, rec.Body.Bytes())
	if !data["has_access"].(bool) {
		t.Fatal("expected access after active subscription")
	}
}

func TestGuideCategoriesReadAccess(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	models := []interface{}{&model.Tenant{}, &model.User{}, &model.GuideCategory{}, &model.Guide{}}
	models = append(models, model.LMSModels()...)
	if err := db.AutoMigrate(models...); err != nil {
		t.Fatalf("migrate lms models: %v", err)
	}

	tenant := model.Tenant{ID: uuid.New(), Name: "LMS Tenant", Domain: "controller.test", IsActive: true}
	_ = db.Create(&tenant).Error

	// Create a parent user with role = 10 and NO rules (or CanCreateCourse = false)
	parent := model.User{ID: uuid.New(), Username: "parent-user", Email: "parent@test.com", Role: 10, Status: common.UserStatusEnabled, TenantID: &tenant.ID}
	_ = db.Create(&parent).Error

	// Seed a guide category
	cat := model.GuideCategory{ID: uuid.New(), Name: "General Guides", Slug: "general-guides", TenantID: &tenant.ID}
	_ = db.Create(&cat).Error

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("db", db)
		c.Set(common.CtxTenantKey, tenant)
		c.Set("id", parent.ID.String())
		c.Set("userID", parent.ID)
		c.Set("username", parent.Username)
		c.Set("role", parent.Role)
		c.Request = c.Request.WithContext(context.WithValue(c.Request.Context(), common.CtxTenantKey, tenant))
		c.Next()
	})

	ctrl := NewLMSController(db)
	// Register the admin routes wrapped in MentorAuth
	resourceRoute := router.Group("/admin")
	resourceRoute.Use(middleware.MentorAuth())
	{
		resourceRoute.GET("/resources/:resource", ctrl.ListAdminResource)
	}

	accessToken, _, err := generateTokens(&parent)
	if err != nil {
		t.Fatalf("failed to generate token: %v", err)
	}

	t.Run("allow guide-categories GET", func(t *testing.T) {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/admin/resources/guide-categories", nil)
		req.Header.Set("Authorization", "Bearer "+accessToken)
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
		}
	})

	t.Run("forbid other resources GET", func(t *testing.T) {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/admin/resources/courses", nil)
		req.Header.Set("Authorization", "Bearer "+accessToken)
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusForbidden {
			t.Fatalf("expected 403, got %d body=%s", rec.Code, rec.Body.String())
		}
	})
}
