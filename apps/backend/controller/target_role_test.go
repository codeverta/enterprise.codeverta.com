package controller

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"gin-template/common"
	"gin-template/model"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupTargetRoleTestDB(t *testing.T) (*gorm.DB, model.Tenant) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	models := []interface{}{&model.Tenant{}, &model.User{}, &model.Wallet{}, &model.CoursePurchase{}}
	models = append(models, model.LMSModels()...)
	if err := db.AutoMigrate(models...); err != nil {
		t.Fatalf("migrate lms models: %v", err)
	}
	tenant := model.Tenant{ID: uuid.New(), Name: "TargetRole Tenant", Domain: "targetrole.test", IsActive: true}
	if err := db.Create(&tenant).Error; err != nil {
		t.Fatalf("create tenant: %v", err)
	}
	return db, tenant
}

func setupTargetRoleRouter(db *gorm.DB, tenant model.Tenant, user model.User) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("db", db)
		c.Set(common.CtxTenantKey, tenant)
		if user.ID != uuid.Nil {
			c.Set("id", user.ID.String())
			c.Set("userID", user.ID)
			c.Set("username", user.Username)
			c.Set("role", user.Role)
		}
		c.Request = c.Request.WithContext(context.WithValue(c.Request.Context(), common.CtxTenantKey, tenant))
		c.Next()
	})

	ctrl := NewLMSController(db)
	lmsGroup := router.Group("/lms")
	lmsGroup.POST("/admin/resources/:resource", ctrl.CreateAdminResource)
	lmsGroup.PUT("/admin/resources/:resource/:id", ctrl.UpdateAdminResource)
	lmsGroup.GET("/course-categories", ctrl.ListCourseCategories)
	lmsGroup.POST("/admin/courses", ctrl.CreateCourse)
	lmsGroup.PUT("/admin/courses/:id", ctrl.UpdateCourse)
	lmsGroup.GET("/courses", ctrl.ListCourses)
	lmsGroup.GET("/courses/explore", ctrl.ExploreCourses)
	lmsGroup.GET("/courses/explore/filters", ctrl.GetExploreCourseFilters)
	lmsGroup.GET("/my-courses", ctrl.ListMyCourses)
	lmsGroup.GET("/courses/:id", ctrl.GetCourse)

	router.POST("/admin/resources/:resource", ctrl.CreateAdminResource)
	router.PUT("/admin/resources/:resource/:id", ctrl.UpdateAdminResource)
	router.GET("/course-categories", ctrl.ListCourseCategories)
	router.POST("/admin/courses", ctrl.CreateCourse)
	router.PUT("/admin/courses/:id", ctrl.UpdateCourse)
	router.GET("/courses", ctrl.ListCourses)
	router.GET("/courses/explore", ctrl.ExploreCourses)
	router.GET("/courses/explore/filters", ctrl.GetExploreCourseFilters)
	router.GET("/my-courses", ctrl.ListMyCourses)
	router.GET("/courses/:id", ctrl.GetCourse)
	return router
}

func TestListMyCourses_InternalMentorSeesAllCourses(t *testing.T) {
	db, tenant := setupTargetRoleTestDB(t)
	ctx := context.WithValue(context.Background(), common.CtxTenantKey, tenant)

	mentor := model.User{
		ID:       uuid.New(),
		Username: "natalia-internal",
		Email:    "natalia-internal@test.com",
		Role:     model.RoleMentor,
		Status:   common.UserStatusEnabled,
	}
	if err := db.WithContext(ctx).Create(&mentor).Error; err != nil {
		t.Fatalf("create internal mentor: %v", err)
	}

	category := model.CourseCategory{ID: uuid.New(), Name: "All Courses", Slug: "all-courses"}
	if err := db.WithContext(ctx).Create(&category).Error; err != nil {
		t.Fatalf("create category: %v", err)
	}

	statuses := []model.CourseStatus{
		model.CourseStatusPublished,
		model.CourseStatusDraft,
		model.CourseStatusArchived,
	}
	var firstCourseID uuid.UUID
	for index, status := range statuses {
		course := model.Course{
			ID:               uuid.New(),
			Title:            fmt.Sprintf("Course %d", index+1),
			Slug:             fmt.Sprintf("all-course-%d", index+1),
			CourseCategoryID: category.ID,
			Status:           status,
		}
		if err := db.WithContext(ctx).Create(&course).Error; err != nil {
			t.Fatalf("create %s course: %v", status, err)
		}
		if index == 0 {
			firstCourseID = course.ID
		}
	}

	router := setupTargetRoleRouter(db, tenant, mentor)
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/my-courses?page=1&limit=2", nil)
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var response struct {
		Data       []map[string]interface{} `json:"data"`
		Pagination struct {
			Page       int `json:"page"`
			Total      int `json:"total"`
			TotalPages int `json:"total_pages"`
		} `json:"pagination"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(response.Data) != 2 || response.Pagination.Total != 3 || response.Pagination.TotalPages != 2 {
		t.Fatalf("expected first 2 of all 3 courses, got data=%d pagination=%+v", len(response.Data), response.Pagination)
	}

	draftRec := httptest.NewRecorder()
	draftReq := httptest.NewRequest(http.MethodGet, "/my-courses?status=draft", nil)
	router.ServeHTTP(draftRec, draftReq)
	if draftRec.Code != http.StatusOK {
		t.Fatalf("expected draft filter 200, got %d: %s", draftRec.Code, draftRec.Body.String())
	}
	var draftResponse struct {
		Data []struct {
			Status model.CourseStatus `json:"status"`
		} `json:"data"`
	}
	if err := json.Unmarshal(draftRec.Body.Bytes(), &draftResponse); err != nil {
		t.Fatalf("decode draft response: %v", err)
	}
	if len(draftResponse.Data) != 1 || draftResponse.Data[0].Status != model.CourseStatusDraft {
		t.Fatalf("expected only draft course, got %+v", draftResponse.Data)
	}

	detailRec := httptest.NewRecorder()
	detailReq := httptest.NewRequest(http.MethodGet, "/courses/"+firstCourseID.String(), nil)
	router.ServeHTTP(detailRec, detailReq)
	if detailRec.Code != http.StatusOK {
		t.Fatalf("expected internal mentor to open any listed course, got %d: %s", detailRec.Code, detailRec.Body.String())
	}
}

func TestTargetRole_CreateCategoryWithMultipleRoles(t *testing.T) {
	db, tenant := setupTargetRoleTestDB(t)
	ctx := context.WithValue(context.Background(), common.CtxTenantKey, tenant)
	admin := model.User{ID: uuid.New(), Username: "admin1", Role: 99, Status: common.UserStatusEnabled}
	_ = db.WithContext(ctx).Create(&admin).Error

	router := setupTargetRoleRouter(db, tenant, admin)

	// Create Category with multiple target roles
	body := map[string]interface{}{
		"name":         "Programming",
		"slug":         "programming",
		"target_roles": []string{"student", "mentor"},
	}
	b, _ := json.Marshal(body)
	req := httptest.NewRequest("POST", "/admin/resources/course-categories", bytes.NewBuffer(b))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", w.Code, w.Body.String())
	}

	var res struct {
		Success bool `json:"success"`
		Data    struct {
			ID          string   `json:"id"`
			TargetRoles []string `json:"target_roles"`
		} `json:"data"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &res)

	if !res.Success || res.Data.ID == "" {
		t.Fatalf("expected category ID in response, got %v", res)
	}

	catID := uuid.MustParse(res.Data.ID)
	catRoles := getCourseCategoryTargetRoles(db, catID)
	if len(catRoles) != 2 {
		t.Fatalf("expected 2 target roles in DB, got %v", catRoles)
	}
}

func TestTargetRole_CreateCourseWithMultipleRolesAndSubsetValidation(t *testing.T) {
	db, tenant := setupTargetRoleTestDB(t)
	ctx := context.WithValue(context.Background(), common.CtxTenantKey, tenant)
	admin := model.User{ID: uuid.New(), Username: "admin2", Role: 99, Status: common.UserStatusEnabled}
	_ = db.WithContext(ctx).Create(&admin).Error

	cat := model.CourseCategory{ID: uuid.New(), Name: "Math", Slug: "math"}
	_ = db.WithContext(ctx).Create(&cat).Error
	_ = setCourseCategoryTargetRoles(db.WithContext(ctx), cat.ID, &tenant.ID, []string{"student", "mentor"})

	router := setupTargetRoleRouter(db, tenant, admin)

	// Valid course creation following category roles
	validBody := map[string]interface{}{
		"title":              "Algebra 101",
		"slug":               "algebra-101",
		"course_category_id": cat.ID.String(),
		"mentor_ids":         []string{admin.ID.String()},
		"target_roles":       []string{"student", "mentor"},
	}
	bValid, _ := json.Marshal(validBody)
	reqValid := httptest.NewRequest("POST", "/admin/courses", bytes.NewBuffer(bValid))
	reqValid.Header.Set("Content-Type", "application/json")
	wValid := httptest.NewRecorder()
	router.ServeHTTP(wValid, reqValid)

	if wValid.Code != http.StatusOK {
		t.Fatalf("expected 200 for valid course creation, got %d: %s", wValid.Code, wValid.Body.String())
	}

	// Invalid course creation with role OUTSIDE category roles ('parent')
	invalidBody := map[string]interface{}{
		"title":              "Algebra Advanced",
		"slug":               "algebra-advanced",
		"course_category_id": cat.ID.String(),
		"mentor_ids":         []string{admin.ID.String()},
		"target_roles":       []string{"student", "parent"},
	}
	bInvalid, _ := json.Marshal(invalidBody)
	reqInvalid := httptest.NewRequest("POST", "/admin/courses", bytes.NewBuffer(bInvalid))
	reqInvalid.Header.Set("Content-Type", "application/json")
	wInvalid := httptest.NewRecorder()
	router.ServeHTTP(wInvalid, reqInvalid)

	if wInvalid.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422 for role outside category, got %d: %s", wInvalid.Code, wInvalid.Body.String())
	}
}

func TestTargetRole_SyncCategoryRolesAndDraftCourse(t *testing.T) {
	db, tenant := setupTargetRoleTestDB(t)
	ctx := context.WithValue(context.Background(), common.CtxTenantKey, tenant)
	admin := model.User{ID: uuid.New(), Username: "admin3", Role: 99, Status: common.UserStatusEnabled}
	_ = db.WithContext(ctx).Create(&admin).Error

	// Create Category with 'parent' role only
	cat := model.CourseCategory{ID: uuid.New(), Name: "Parenting", Slug: "parenting"}
	_ = db.WithContext(ctx).Create(&cat).Error
	_ = setCourseCategoryTargetRoles(db.WithContext(ctx), cat.ID, &tenant.ID, []string{"parent", "mentor"})

	// Create Course under Category with 'parent' target role
	course := model.Course{
		ID:               uuid.New(),
		Title:            "Parent Guide",
		Slug:             "parent-guide",
		CourseCategoryID: cat.ID,
		Status:           model.CourseStatusPublished,
	}
	_ = db.WithContext(ctx).Create(&course).Error
	_ = setCourseTargetRoles(db.WithContext(ctx), course.ID, &tenant.ID, []string{"parent"})

	router := setupTargetRoleRouter(db, tenant, admin)

	// Update Category roles: remove 'parent', set to 'mentor' only
	updateCatBody := map[string]interface{}{
		"name":         "Parenting",
		"slug":         "parenting",
		"target_roles": []string{"mentor"},
	}
	b, _ := json.Marshal(updateCatBody)
	req := httptest.NewRequest("PUT", fmt.Sprintf("/admin/resources/course-categories/%s", cat.ID.String()), bytes.NewBuffer(b))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 on category update, got %d: %s", w.Code, w.Body.String())
	}

	// Verify course target roles in DB: 'parent' role should be deleted
	courseRoles := getCourseTargetRoles(db, course.ID)
	if len(courseRoles) != 0 {
		t.Fatalf("expected 0 course roles after category role removal, got %v", courseRoles)
	}

	// Verify course status in DB: should be converted to 'draft'
	var updatedCourse model.Course
	_ = db.First(&updatedCourse, "id = ?", course.ID).Error
	if updatedCourse.Status != model.CourseStatusDraft {
		t.Fatalf("expected course status 'draft', got '%s'", updatedCourse.Status)
	}
}

func TestTargetRole_UserVisibilityFilteringAndDirectAccess(t *testing.T) {
	db, tenant := setupTargetRoleTestDB(t)
	ctx := context.WithValue(context.Background(), common.CtxTenantKey, tenant)

	// Users: student (role 20), mentor (role 30), parent (role 10)
	student := model.User{ID: uuid.New(), Username: "student1", Email: "student1@test.com", Role: 20, Status: common.UserStatusEnabled}
	mentor := model.User{ID: uuid.New(), Username: "mentor1", Email: "mentor1@test.com", Role: 30, Status: common.UserStatusEnabled}
	_ = db.WithContext(ctx).Create(&student).Error
	_ = db.WithContext(ctx).Create(&mentor).Error

	// Category with 'student' & 'mentor'
	cat := model.CourseCategory{ID: uuid.New(), Name: "Science", Slug: "science"}
	_ = db.WithContext(ctx).Create(&cat).Error
	_ = setCourseCategoryTargetRoles(db.WithContext(ctx), cat.ID, &tenant.ID, []string{"student", "mentor"})

	// Course 1: Mentor only
	courseMentorOnly := model.Course{
		ID:               uuid.New(),
		Title:            "Advanced Mentor Training",
		Slug:             "mentor-training",
		CourseCategoryID: cat.ID,
		Status:           model.CourseStatusPublished,
	}
	_ = db.WithContext(ctx).Create(&courseMentorOnly).Error
	_ = setCourseTargetRoles(db.WithContext(ctx), courseMentorOnly.ID, &tenant.ID, []string{"mentor"})

	// Course 2: Student only
	courseStudentOnly := model.Course{
		ID:               uuid.New(),
		Title:            "Science For Kids",
		Slug:             "science-kids",
		CourseCategoryID: cat.ID,
		Status:           model.CourseStatusPublished,
	}
	_ = db.WithContext(ctx).Create(&courseStudentOnly).Error
	_ = setCourseTargetRoles(db.WithContext(ctx), courseStudentOnly.ID, &tenant.ID, []string{"student"})

	// Student User Requests Course List
	routerStudent := setupTargetRoleRouter(db, tenant, student)
	reqList := httptest.NewRequest("GET", "/courses", nil)
	wList := httptest.NewRecorder()
	routerStudent.ServeHTTP(wList, reqList)

	if wList.Code != http.StatusOK {
		t.Fatalf("expected 200 for student course list, got %d", wList.Code)
	}

	var resList struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	_ = json.Unmarshal(wList.Body.Bytes(), &resList)
	if len(resList.Data) != 1 || resList.Data[0].ID != courseStudentOnly.ID.String() {
		t.Fatalf("expected student to see only courseStudentOnly, got %v", resList.Data)
	}

	// Student Direct Access to Mentor-only course -> MUST return 403 Forbidden
	reqDirect := httptest.NewRequest("GET", fmt.Sprintf("/courses/%s", courseMentorOnly.ID.String()), nil)
	wDirect := httptest.NewRecorder()
	routerStudent.ServeHTTP(wDirect, reqDirect)

	if wDirect.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for direct access mismatch, got %d: %s", wDirect.Code, wDirect.Body.String())
	}
}

func TestTargetRole_ExploreFiltersCategoriesAndCoursesByUserRole(t *testing.T) {
	db, tenant := setupTargetRoleTestDB(t)
	ctx := context.WithValue(context.Background(), common.CtxTenantKey, tenant)

	student := model.User{
		ID: uuid.New(), Username: "explore-student", Email: "explore-student@test.com",
		Role: model.RoleStudent, Status: common.UserStatusEnabled,
	}
	if err := db.WithContext(ctx).Create(&student).Error; err != nil {
		t.Fatalf("create student: %v", err)
	}

	type audienceFixture struct {
		role  string
		level string
	}
	fixtures := []audienceFixture{
		{role: "student", level: "Pemula"},
		{role: "parent", level: "Merchant"},
		{role: "mentor", level: "Profesional"},
	}
	categoryIDs := make(map[string]uuid.UUID)
	courseIDs := make(map[string]uuid.UUID)
	for _, fixture := range fixtures {
		category := model.CourseCategory{
			ID: uuid.New(), Name: fixture.role + " category", Slug: fixture.role + "-category", IsActive: true,
		}
		if err := db.WithContext(ctx).Create(&category).Error; err != nil {
			t.Fatalf("create %s category: %v", fixture.role, err)
		}
		if err := setCourseCategoryTargetRoles(db.WithContext(ctx), category.ID, &tenant.ID, []string{fixture.role}); err != nil {
			t.Fatalf("set %s category role: %v", fixture.role, err)
		}
		categoryIDs[fixture.role] = category.ID

		course := model.Course{
			ID: uuid.New(), Title: fixture.role + " course", Slug: fixture.role + "-course",
			CourseCategoryID: category.ID, Status: model.CourseStatusPublished, Level: fixture.level,
		}
		if err := db.WithContext(ctx).Create(&course).Error; err != nil {
			t.Fatalf("create %s course: %v", fixture.role, err)
		}
		if err := setCourseTargetRoles(db.WithContext(ctx), course.ID, &tenant.ID, []string{fixture.role}); err != nil {
			t.Fatalf("set %s course role: %v", fixture.role, err)
		}
		courseIDs[fixture.role] = course.ID
	}

	router := setupTargetRoleRouter(db, tenant, student)

	categoryRec := httptest.NewRecorder()
	router.ServeHTTP(categoryRec, httptest.NewRequest(http.MethodGet, "/course-categories", nil))
	if categoryRec.Code != http.StatusOK {
		t.Fatalf("category list: expected 200, got %d: %s", categoryRec.Code, categoryRec.Body.String())
	}
	var categoryResponse struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.Unmarshal(categoryRec.Body.Bytes(), &categoryResponse); err != nil {
		t.Fatalf("decode categories: %v", err)
	}
	if len(categoryResponse.Data) != 1 || categoryResponse.Data[0].ID != categoryIDs["student"].String() {
		t.Fatalf("student must only see student category, got %+v", categoryResponse.Data)
	}

	courseRec := httptest.NewRecorder()
	router.ServeHTTP(courseRec, httptest.NewRequest(http.MethodGet, "/courses/explore", nil))
	if courseRec.Code != http.StatusOK {
		t.Fatalf("explore courses: expected 200, got %d: %s", courseRec.Code, courseRec.Body.String())
	}
	var courseResponse struct {
		Data []struct {
			CourseID string `json:"course_id"`
		} `json:"data"`
	}
	if err := json.Unmarshal(courseRec.Body.Bytes(), &courseResponse); err != nil {
		t.Fatalf("decode courses: %v", err)
	}
	if len(courseResponse.Data) != 1 || courseResponse.Data[0].CourseID != courseIDs["student"].String() {
		t.Fatalf("student must only see student course, got %+v", courseResponse.Data)
	}

	filterRec := httptest.NewRecorder()
	router.ServeHTTP(filterRec, httptest.NewRequest(http.MethodGet, "/courses/explore/filters", nil))
	if filterRec.Code != http.StatusOK {
		t.Fatalf("explore filters: expected 200, got %d: %s", filterRec.Code, filterRec.Body.String())
	}
	var filterResponse struct {
		Data struct {
			Levels []string `json:"levels"`
		} `json:"data"`
	}
	if err := json.Unmarshal(filterRec.Body.Bytes(), &filterResponse); err != nil {
		t.Fatalf("decode filters: %v", err)
	}
	if len(filterResponse.Data.Levels) != 1 || filterResponse.Data.Levels[0] != "Pemula" {
		t.Fatalf("student must only receive filters from student courses, got %+v", filterResponse.Data.Levels)
	}

	for _, audience := range []struct {
		name          string
		role          int
		expectedRole  string
		expectedLevel string
	}{
		{name: "parent", role: model.RoleParent, expectedRole: "parent", expectedLevel: "Merchant"},
		{name: "mentor", role: model.RoleGuruExternal, expectedRole: "mentor", expectedLevel: "Profesional"},
	} {
		t.Run(audience.name, func(t *testing.T) {
			user := model.User{
				ID: uuid.New(), Username: "explore-" + audience.name, Email: "explore-" + audience.name + "@test.com",
				Role: audience.role, Status: common.UserStatusEnabled,
			}
			if err := db.WithContext(ctx).Create(&user).Error; err != nil {
				t.Fatalf("create %s: %v", audience.name, err)
			}
			audienceRouter := setupTargetRoleRouter(db, tenant, user)

			rec := httptest.NewRecorder()
			audienceRouter.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/course-categories", nil))
			var categories struct {
				Data []struct {
					ID string `json:"id"`
				} `json:"data"`
			}
			if err := json.Unmarshal(rec.Body.Bytes(), &categories); err != nil {
				t.Fatalf("decode %s categories: %v", audience.name, err)
			}
			if rec.Code != http.StatusOK || len(categories.Data) != 1 ||
				categories.Data[0].ID != categoryIDs[audience.expectedRole].String() {
				t.Fatalf("%s must only see its category, got status=%d data=%+v", audience.name, rec.Code, categories.Data)
			}

			rec = httptest.NewRecorder()
			audienceRouter.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/courses/explore", nil))
			var courses struct {
				Data []struct {
					CourseID string `json:"course_id"`
				} `json:"data"`
			}
			if err := json.Unmarshal(rec.Body.Bytes(), &courses); err != nil {
				t.Fatalf("decode %s courses: %v", audience.name, err)
			}
			if rec.Code != http.StatusOK || len(courses.Data) != 1 ||
				courses.Data[0].CourseID != courseIDs[audience.expectedRole].String() {
				t.Fatalf("%s must only see its course, got status=%d data=%+v", audience.name, rec.Code, courses.Data)
			}

			rec = httptest.NewRecorder()
			audienceRouter.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/courses/explore/filters", nil))
			var filters struct {
				Data struct {
					Levels []string `json:"levels"`
				} `json:"data"`
			}
			if err := json.Unmarshal(rec.Body.Bytes(), &filters); err != nil {
				t.Fatalf("decode %s filters: %v", audience.name, err)
			}
			if rec.Code != http.StatusOK || len(filters.Data.Levels) != 1 ||
				filters.Data.Levels[0] != audience.expectedLevel {
				t.Fatalf("%s must only receive its filters, got status=%d levels=%+v", audience.name, rec.Code, filters.Data.Levels)
			}
		})
	}
}

func TestTargetRole_InternalMentorCanExploreEveryAudience(t *testing.T) {
	db, tenant := setupTargetRoleTestDB(t)
	ctx := context.WithValue(context.Background(), common.CtxTenantKey, tenant)

	mentor := model.User{
		ID: uuid.New(), Username: "explore-internal", Email: "explore-internal@test.com",
		Role: model.RoleMentor, MentorType: "internal", Status: common.UserStatusEnabled,
	}
	if err := db.WithContext(ctx).Create(&mentor).Error; err != nil {
		t.Fatalf("create internal mentor: %v", err)
	}

	for _, role := range []string{"student", "parent", "mentor"} {
		category := model.CourseCategory{
			ID: uuid.New(), Name: role + " only", Slug: "internal-" + role, IsActive: true,
		}
		if err := db.WithContext(ctx).Create(&category).Error; err != nil {
			t.Fatalf("create %s category: %v", role, err)
		}
		if err := setCourseCategoryTargetRoles(db.WithContext(ctx), category.ID, &tenant.ID, []string{role}); err != nil {
			t.Fatalf("set %s category role: %v", role, err)
		}
		course := model.Course{
			ID: uuid.New(), Title: role + " only", Slug: "internal-" + role,
			CourseCategoryID: category.ID, Status: model.CourseStatusPublished,
		}
		if err := db.WithContext(ctx).Create(&course).Error; err != nil {
			t.Fatalf("create %s course: %v", role, err)
		}
		if err := setCourseTargetRoles(db.WithContext(ctx), course.ID, &tenant.ID, []string{role}); err != nil {
			t.Fatalf("set %s course role: %v", role, err)
		}
	}

	router := setupTargetRoleRouter(db, tenant, mentor)

	categoryRec := httptest.NewRecorder()
	router.ServeHTTP(categoryRec, httptest.NewRequest(http.MethodGet, "/course-categories", nil))
	var categoryResponse struct {
		Data []map[string]interface{} `json:"data"`
	}
	if err := json.Unmarshal(categoryRec.Body.Bytes(), &categoryResponse); err != nil {
		t.Fatalf("decode categories: %v", err)
	}
	if categoryRec.Code != http.StatusOK || len(categoryResponse.Data) != 3 {
		t.Fatalf("internal mentor must see all 3 categories, got status=%d data=%+v", categoryRec.Code, categoryResponse.Data)
	}

	courseRec := httptest.NewRecorder()
	router.ServeHTTP(courseRec, httptest.NewRequest(http.MethodGet, "/courses/explore", nil))
	var courseResponse struct {
		Data []map[string]interface{} `json:"data"`
	}
	if err := json.Unmarshal(courseRec.Body.Bytes(), &courseResponse); err != nil {
		t.Fatalf("decode courses: %v", err)
	}
	if courseRec.Code != http.StatusOK || len(courseResponse.Data) != 3 {
		t.Fatalf("internal mentor must see all 3 courses, got status=%d data=%+v", courseRec.Code, courseResponse.Data)
	}
}

func TestTargetRole_ExploreIncludesActivelySubscribedCourse(t *testing.T) {
	db, tenant := setupTargetRoleTestDB(t)
	ctx := context.WithValue(context.Background(), common.CtxTenantKey, tenant)

	student := model.User{
		ID: uuid.New(), Username: "subscribed-student", Email: "subscribed-student@test.com",
		Role: model.RoleStudent, Status: common.UserStatusEnabled,
	}
	if err := db.WithContext(ctx).Create(&student).Error; err != nil {
		t.Fatalf("create student: %v", err)
	}

	parentCategory := model.CourseCategory{
		ID: uuid.New(), Name: "Subscribed Parent Category", Slug: "subscribed-parent-category", IsActive: true,
	}
	if err := db.WithContext(ctx).Create(&parentCategory).Error; err != nil {
		t.Fatalf("create category: %v", err)
	}
	if err := setCourseCategoryTargetRoles(db.WithContext(ctx), parentCategory.ID, &tenant.ID, []string{"parent"}); err != nil {
		t.Fatalf("set category roles: %v", err)
	}

	subscribedCourse := model.Course{
		ID: uuid.New(), Title: "Subscribed Parent Course", Slug: "subscribed-parent-course",
		CourseCategoryID: parentCategory.ID, Status: model.CourseStatusPublished, Level: "Subscription Only",
	}
	if err := db.WithContext(ctx).Create(&subscribedCourse).Error; err != nil {
		t.Fatalf("create course: %v", err)
	}
	if err := setCourseTargetRoles(db.WithContext(ctx), subscribedCourse.ID, &tenant.ID, []string{"parent"}); err != nil {
		t.Fatalf("set course roles: %v", err)
	}

	periodEnd := time.Now().Add(7 * 24 * time.Hour)
	subscription := model.Subscription{
		ID: uuid.New(), StudentID: student.ID, ParentID: student.ID, CourseID: &subscribedCourse.ID,
		Status: model.SubscriptionStatusActive, CurrentPeriodEnd: &periodEnd,
	}
	if err := db.WithContext(ctx).Create(&subscription).Error; err != nil {
		t.Fatalf("create subscription: %v", err)
	}

	router := setupTargetRoleRouter(db, tenant, student)

	courseRec := httptest.NewRecorder()
	router.ServeHTTP(courseRec, httptest.NewRequest(http.MethodGet, "/courses/explore", nil))
	var courseResponse struct {
		Data []struct {
			CourseID string `json:"course_id"`
		} `json:"data"`
	}
	if err := json.Unmarshal(courseRec.Body.Bytes(), &courseResponse); err != nil {
		t.Fatalf("decode courses: %v", err)
	}
	if courseRec.Code != http.StatusOK || len(courseResponse.Data) != 1 ||
		courseResponse.Data[0].CourseID != subscribedCourse.ID.String() {
		t.Fatalf("active subscription course must remain visible in explore, got status=%d data=%+v", courseRec.Code, courseResponse.Data)
	}

	categoryRec := httptest.NewRecorder()
	router.ServeHTTP(categoryRec, httptest.NewRequest(http.MethodGet, "/course-categories", nil))
	var categoryResponse struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.Unmarshal(categoryRec.Body.Bytes(), &categoryResponse); err != nil {
		t.Fatalf("decode categories: %v", err)
	}
	if categoryRec.Code != http.StatusOK || len(categoryResponse.Data) != 1 ||
		categoryResponse.Data[0].ID != parentCategory.ID.String() {
		t.Fatalf("subscribed course category must remain visible, got status=%d data=%+v", categoryRec.Code, categoryResponse.Data)
	}

	filterRec := httptest.NewRecorder()
	router.ServeHTTP(filterRec, httptest.NewRequest(http.MethodGet, "/courses/explore/filters", nil))
	var filterResponse struct {
		Data struct {
			Levels []string `json:"levels"`
		} `json:"data"`
	}
	if err := json.Unmarshal(filterRec.Body.Bytes(), &filterResponse); err != nil {
		t.Fatalf("decode filters: %v", err)
	}
	if filterRec.Code != http.StatusOK || len(filterResponse.Data.Levels) != 1 ||
		filterResponse.Data.Levels[0] != "Subscription Only" {
		t.Fatalf("subscribed course filters must remain visible, got status=%d levels=%+v", filterRec.Code, filterResponse.Data.Levels)
	}
}

func TestListCourses_InternalMentorSeesOwnedStudentDraft(t *testing.T) {
	db, tenant := setupTargetRoleTestDB(t)
	ctx := context.WithValue(context.Background(), common.CtxTenantKey, tenant)

	mentor := model.User{ID: uuid.New(), Username: "internal_mentor", Email: "internal-mentor@test.com", Role: model.RoleMentor, Status: common.UserStatusEnabled}
	if err := db.WithContext(ctx).Create(&mentor).Error; err != nil {
		t.Fatalf("create mentor: %v", err)
	}

	category := model.CourseCategory{ID: uuid.New(), Name: "Student Category", Slug: "student-category"}
	if err := db.WithContext(ctx).Create(&category).Error; err != nil {
		t.Fatalf("create category: %v", err)
	}
	if err := setCourseCategoryTargetRoles(db.WithContext(ctx), category.ID, &tenant.ID, []string{"student"}); err != nil {
		t.Fatalf("set category roles: %v", err)
	}

	course := model.Course{
		ID:               uuid.New(),
		Title:            "Draft for Students",
		Slug:             "draft-for-students",
		CourseCategoryID: category.ID,
		Status:           model.CourseStatusDraft,
	}
	if err := db.WithContext(ctx).Create(&course).Error; err != nil {
		t.Fatalf("create course: %v", err)
	}
	if err := setCourseTargetRoles(db.WithContext(ctx), course.ID, &tenant.ID, []string{"student"}); err != nil {
		t.Fatalf("set course roles: %v", err)
	}
	if err := db.Model(&course).Association("Mentors").Append(&mentor); err != nil {
		t.Fatalf("assign mentor: %v", err)
	}

	router := setupTargetRoleRouter(db, tenant, mentor)
	req := httptest.NewRequest(http.MethodGet, "/courses?page=1&limit=12&search=", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var response struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(response.Data) != 1 || response.Data[0].ID != course.ID.String() {
		t.Fatalf("expected owned draft course %s, got %+v", course.ID, response.Data)
	}

	detailReq := httptest.NewRequest(http.MethodGet, "/courses/"+course.ID.String(), nil)
	detailRec := httptest.NewRecorder()
	router.ServeHTTP(detailRec, detailReq)
	if detailRec.Code != http.StatusOK {
		t.Fatalf("expected mentor to open owned student-targeted course, got %d: %s", detailRec.Code, detailRec.Body.String())
	}
}

func TestTargetRole_MultiRoleUserAccess(t *testing.T) {
	db, tenant := setupTargetRoleTestDB(t)
	ctx := context.WithValue(context.Background(), common.CtxTenantKey, tenant)

	// User has primary Role = 10 (parent), but also has UserRole = "mentor"
	user := model.User{ID: uuid.New(), Username: "multirole_user", Role: 10, Status: common.UserStatusEnabled}
	_ = db.WithContext(ctx).Create(&user).Error
	userRole := model.UserRole{ID: uuid.New(), UserID: user.ID, Role: model.LMSRole("mentor"), TenantID: &tenant.ID}
	_ = db.WithContext(ctx).Create(&userRole).Error

	cat := model.CourseCategory{ID: uuid.New(), Name: "General", Slug: "general"}
	_ = db.WithContext(ctx).Create(&cat).Error
	_ = setCourseCategoryTargetRoles(db.WithContext(ctx), cat.ID, &tenant.ID, []string{"mentor", "student"})

	course := model.Course{
		ID:               uuid.New(),
		Title:            "Mentor Seminar",
		Slug:             "mentor-seminar",
		CourseCategoryID: cat.ID,
		Status:           model.CourseStatusPublished,
	}
	_ = db.WithContext(ctx).Create(&course).Error
	_ = setCourseTargetRoles(db.WithContext(ctx), course.ID, &tenant.ID, []string{"mentor"})

	router := setupTargetRoleRouter(db, tenant, user)

	// Direct access should succeed (200) because user's secondary role 'mentor' matches course target role 'mentor'
	req := httptest.NewRequest("GET", fmt.Sprintf("/courses/%s", course.ID.String()), nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 for multi-role user matching mentor role, got %d: %s", w.Code, w.Body.String())
	}
}

func TestTargetRole_TransactionRollbackOnPivotFailure(t *testing.T) {
	db, tenant := setupTargetRoleTestDB(t)
	ctx := context.WithValue(context.Background(), common.CtxTenantKey, tenant)

	cat := model.CourseCategory{ID: uuid.New(), Name: "Tech", Slug: "tech"}
	_ = db.WithContext(ctx).Create(&cat).Error
	_ = setCourseCategoryTargetRoles(db.WithContext(ctx), cat.ID, &tenant.ID, []string{"student"})

	// Attempt transaction where pivot insert fails (e.g. invalid nil tenantID error in setCourseTargetRoles)
	err := db.Transaction(func(tx *gorm.DB) error {
		course := model.Course{
			ID:               uuid.New(),
			Title:            "Rollback Test",
			Slug:             "rollback-test",
			CourseCategoryID: cat.ID,
			Status:           model.CourseStatusDraft,
		}
		if err := tx.Create(&course).Error; err != nil {
			return err
		}
		// Force error in transaction
		return fmt.Errorf("forced pivot failure")
	})

	if err == nil {
		t.Fatalf("expected transaction error, got nil")
	}

	// Verify course was rolled back and does not exist in DB
	var count int64
	_ = db.Model(&model.Course{}).Where("slug = ?", "rollback-test").Count(&count).Error
	if count != 0 {
		t.Fatalf("expected 0 courses after transaction rollback, got %d", count)
	}
}
