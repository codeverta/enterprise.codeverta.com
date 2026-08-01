package controller

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"gin-template/common"
	"gin-template/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupCourseTreeTestDB(t *testing.T) (*gorm.DB, model.Tenant, model.User, model.Course, model.Module, model.Lesson, model.Lesson) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+strings.ReplaceAll(t.Name(), "/", "_")+"?mode=memory&cache=shared"), &gorm.Config{SkipDefaultTransaction: true})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}

	_ = db.AutoMigrate(
		&model.Tenant{},
		&model.User{},
		&model.Profile{},
		&model.CourseCategory{},
		&model.Course{},
		&model.Module{},
		&model.Lesson{},
		&model.Quiz{},
		&model.StudentProgress{},
		&model.QuizProgress{},
	)

	tenant := model.Tenant{ID: uuid.New(), Name: "Test Tenant", Domain: "test.domain", IsActive: true}
	db.Create(&tenant)

	dbCtx := db.WithContext(context.WithValue(context.Background(), common.CtxTenantKey, tenant))

	user := model.User{ID: uuid.New(), Username: "student1", Role: 20}
	dbCtx.Create(&user)

	cat := model.CourseCategory{ID: uuid.New(), Name: "Math", Slug: "math", IsActive: true}
	dbCtx.Create(&cat)

	course := model.Course{ID: uuid.New(), TenantID: &tenant.ID, Title: "Matematika SMA", CourseCategoryID: cat.ID, Status: "published"}
	if err := dbCtx.Create(&course).Error; err != nil {
		t.Fatalf("create course: %v", err)
	}

	module := model.Module{ID: uuid.New(), TenantID: &tenant.ID, CourseID: course.ID, Title: "Aljabar", SortOrder: 1, IsPublished: true}
	if err := dbCtx.Create(&module).Error; err != nil {
		t.Fatalf("create module: %v", err)
	}

	lesson1 := model.Lesson{ID: uuid.New(), TenantID: &tenant.ID, ModuleID: module.ID, Title: "Eksponen dan Logaritma", SortOrder: 1, IsPublished: true}
	lesson2 := model.Lesson{ID: uuid.New(), TenantID: &tenant.ID, ModuleID: module.ID, Title: "Logaritma", SortOrder: 2, IsPublished: true}
	if err := dbCtx.Create(&lesson1).Error; err != nil {
		t.Fatalf("create lesson1: %v", err)
	}
	if err := dbCtx.Create(&lesson2).Error; err != nil {
		t.Fatalf("create lesson2: %v", err)
	}

	return db, tenant, user, course, module, lesson1, lesson2
}

func TestGetCourseTreePopulatesIsCompleted(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, tenant, user, course, module, lesson1, _ := setupCourseTreeTestDB(t)

	ctxDb := db.WithContext(context.WithValue(context.Background(), common.CtxTenantKey, tenant))

	// Create completed progress for lesson 1
	progress1 := model.StudentProgress{
		TenantID:    &tenant.ID,
		StudentID:   user.ID,
		CourseID:    course.ID,
		ModuleID:    module.ID,
		LessonID:    lesson1.ID,
		IsCompleted: true,
	}
	if err := ctxDb.Create(&progress1).Error; err != nil {
		t.Fatalf("create progress error: %v", err)
	}

	model.DB = db

	ctrl := &LMSController{DB: db}
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set(string(common.CtxTenantKey), tenant)
		c.Set("db", db)
		c.Set("user_id", user.ID)
		c.Set("userID", user.ID)
		c.Set("user_role", 20)
		c.Next()
	})
	router.GET("/lms/courses/:id/tree", ctrl.GetCourseTree)

	req, _ := http.NewRequest("GET", "/lms/courses/"+course.ID.String()+"/tree", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d. Body: %s", w.Code, w.Body.String())
	}

	var resp struct {
		Success bool `json:"success"`
		Data    struct {
			CourseID string `json:"course_id"`
			Modules  []struct {
				ID      string `json:"id"`
				Title   string `json:"title"`
				Lessons []struct {
					ID          string `json:"id"`
					Title       string `json:"title"`
					IsCompleted bool   `json:"is_completed"`
				} `json:"lessons"`
			} `json:"modules"`
		} `json:"data"`
	}

	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}

	if len(resp.Data.Modules) == 0 {
		t.Fatalf("expected modules in tree, got 0")
	}

	lessons := resp.Data.Modules[0].Lessons
	if len(lessons) != 2 {
		t.Fatalf("expected 2 lessons, got %d", len(lessons))
	}

	// Verify lesson 1 is marked as completed (is_completed = true)
	if !lessons[0].IsCompleted {
		t.Errorf("expected lesson 1 (%s) to have is_completed = true, got false", lessons[0].Title)
	}

	// Verify lesson 2 is NOT marked as completed (is_completed = false)
	if lessons[1].IsCompleted {
		t.Errorf("expected lesson 2 (%s) to have is_completed = false, got true", lessons[1].Title)
	}
}
