package controller

import (
	"context"
	"gin-template/common"
	"gin-template/model"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func TestParentStudentActivityIncludesCourseName(t *testing.T) {
	_, db, tenant, _ := setupLMSControllerTest(t)
	ctx := context.WithValue(context.Background(), common.CtxTenantKey, tenant)

	category := model.CourseCategory{Name: "Matematika", Slug: "matematika-" + uuid.NewString(), IsActive: true}
	if err := db.WithContext(ctx).Create(&category).Error; err != nil {
		t.Fatalf("create category: %v", err)
	}
	course := model.Course{
		Title:            "Matematika Dasar",
		Slug:             "matematika-dasar-" + uuid.NewString(),
		CourseCategoryID: category.ID,
		Status:           model.CourseStatusPublished,
	}
	if err := db.WithContext(ctx).Create(&course).Error; err != nil {
		t.Fatalf("create course: %v", err)
	}

	studentID := uuid.New()
	completedAt := time.Now().UTC().Truncate(time.Second)
	progress := model.StudentProgress{
		StudentID:   studentID,
		CourseID:    course.ID,
		ModuleID:    uuid.New(),
		LessonID:    uuid.New(),
		Status:      "completed",
		IsCompleted: true,
		CompletedAt: &completedAt,
	}
	if err := db.WithContext(ctx).Create(&progress).Error; err != nil {
		t.Fatalf("create progress: %v", err)
	}

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("GET", "/", nil).WithContext(ctx)
	c.Set("db", db.WithContext(ctx))

	activity, err := NewLMSController(db).parentStudentActivity(c, studentID)
	if err != nil {
		t.Fatalf("load activity: %v", err)
	}
	if len(activity) != 1 {
		t.Fatalf("expected one activity, got %d", len(activity))
	}
	if activity[0].CourseName != course.Title || activity[0].Description != course.Title {
		t.Fatalf("expected course name %q, got course_name=%q description=%q", course.Title, activity[0].CourseName, activity[0].Description)
	}
	if activity[0].CourseID != course.ID.String() {
		t.Fatalf("expected course id %s, got %s", course.ID, activity[0].CourseID)
	}
}
