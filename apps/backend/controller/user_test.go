package controller

import (
	"context"
	"encoding/json"
	"gin-template/common"
	"gin-template/model"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func TestLoadActiveSubscriptionSummaries(t *testing.T) {
	db, tenant := setupAuthTestDB(t)
	if err := db.AutoMigrate(&model.SubscriptionPlan{}, &model.Subscription{}); err != nil {
		t.Fatalf("migrate subscriptions: %v", err)
	}
	if !db.Migrator().HasIndex(&model.Subscription{}, "idx_sub_tenant_student_status") {
		t.Fatal("expected composite student subscription lookup index")
	}
	if !db.Migrator().HasIndex(&model.Subscription{}, "idx_sub_tenant_parent_status") {
		t.Fatal("expected composite parent subscription lookup index")
	}

	ctx := context.WithValue(context.Background(), common.CtxTenantKey, tenant)
	plan := model.SubscriptionPlan{
		Name:         "Student Plus",
		Slug:         "student-plus-" + uuid.NewString(),
		DurationDays: 30,
		Interval:     "monthly",
		IsActive:     true,
	}
	if err := db.WithContext(ctx).Create(&plan).Error; err != nil {
		t.Fatalf("create plan: %v", err)
	}

	studentID := uuid.New()
	parentID := uuid.New()
	now := time.Now().UTC().Truncate(time.Second)
	activeUntil := now.Add(24 * time.Hour)
	expiredAt := now.Add(-24 * time.Hour)
	subscriptions := []model.Subscription{
		{
			ParentID:         uuid.New(),
			StudentID:        studentID,
			Status:           model.SubscriptionStatusActive,
			PlanID:           &plan.ID,
			CurrentPeriodEnd: &activeUntil,
		},
		{
			ParentID:         parentID,
			StudentID:        uuid.New(),
			Status:           model.SubscriptionStatusTrialing,
			ProviderPlanID:   plan.ID.String(),
			CurrentPeriodEnd: &activeUntil,
		},
		{
			ParentID:         uuid.New(),
			StudentID:        uuid.New(),
			Status:           model.SubscriptionStatusActive,
			PlanID:           &plan.ID,
			CurrentPeriodEnd: &expiredAt,
		},
	}
	for index := range subscriptions {
		subscriptions[index].ProviderSubscriptionID = "test-subscription-" + uuid.NewString()
		if err := db.WithContext(ctx).Create(&subscriptions[index]).Error; err != nil {
			t.Fatalf("create subscription %d: %v", index, err)
		}
	}

	planNames, expiries, err := loadActiveSubscriptionSummaries(db.WithContext(ctx), []uuid.UUID{studentID, parentID}, now)
	if err != nil {
		t.Fatalf("load summaries: %v", err)
	}
	if planNames[studentID] != plan.Name {
		t.Fatalf("expected student plan %q, got %q", plan.Name, planNames[studentID])
	}
	if planNames[parentID] != plan.Name {
		t.Fatalf("expected legacy parent plan %q, got %q", plan.Name, planNames[parentID])
	}
	expectedExpiry := activeUntil.Format("2006-01-02 15:04:05")
	if expiries[studentID] != expectedExpiry || expiries[parentID] != expectedExpiry {
		t.Fatalf("expected expiry %q, got student=%q parent=%q", expectedExpiry, expiries[studentID], expiries[parentID])
	}
}

func setupUserTest(t *testing.T) (*gin.Engine, *gorm.DB, model.Tenant, model.User) {
	t.Helper()
	db, tenant := setupAuthTestDB(t)
	u := seedUser(t, db, tenant)

	ctrl := NewUserController(db)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("db", db)
		c.Set(common.CtxTenantKey, tenant)
		c.Set("id", u.ID.String())
		c.Set("userID", u.ID)
		c.Set("username", u.Username)
		c.Set("role", u.Role)
		c.Next()
	})
	router.GET("/user/self", ctrl.GetSelf)
	router.PUT("/user/self", ctrl.UpdateSelf)
	return router, db, tenant, u
}

func TestUserGetSelf(t *testing.T) {
	router, _, _, u := setupUserTest(t)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/user/self", nil)
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}

	var body map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body["success"] != true {
		t.Fatalf("expected success=true, got %v", body)
	}
	data := body["data"].(map[string]interface{})
	if data["id"] != u.ID.String() {
		t.Fatalf("expected id %s, got %v", u.ID.String(), data["id"])
	}
	if data["username"] != "testrunner" {
		t.Fatalf("expected username testrunner, got %v", data["username"])
	}
}

func TestUserUpdateSelf(t *testing.T) {
	router, _, _, _ := setupUserTest(t)

	t.Run("update display_name", func(t *testing.T) {
		rec := performJSON(router, http.MethodPut, "/user/self", `{"display_name":"Updated Runner"}`)
		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
		}
		var body map[string]interface{}
		if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
			t.Fatalf("decode: %v", err)
		}
		if body["success"] != true {
			t.Fatalf("expected success=true, got %v", body)
		}
	})

	t.Run("empty display_name defaults to username", func(t *testing.T) {
		rec := performJSON(router, http.MethodPut, "/user/self", `{"display_name":""}`)
		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
		}
	})
}

func TestUpdateUserAdmin(t *testing.T) {
	db, tenant := setupAuthTestDB(t)

	// Seed an admin user (role 99)
	adminUser := seedUserWithRole(t, db, tenant, "adminrunner", 99)
	// Seed target user (role 20)
	targetUser := seedUserWithRole(t, db, tenant, "targetrunner", 20)
	// Seed duplicate target user
	_ = seedUserWithRole(t, db, tenant, "duprunner", 20)

	ctrl := NewUserController(db)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("db", db)
		c.Set(common.CtxTenantKey, tenant)
		c.Set("id", adminUser.ID.String())
		c.Set("userID", adminUser.ID)
		c.Set("username", adminUser.Username)
		c.Set("role", adminUser.Role)
		c.Next()
	})
	router.PUT("/users/:id", ctrl.UpdateUser)

	t.Run("successful update display_name and status", func(t *testing.T) {
		payload := `{"username":"targetrunner_new", "display_name":"New Display Name", "email":"targetrunner_new@hskita.com", "role":20, "status":1}`
		rec := performJSON(router, http.MethodPut, "/users/"+targetUser.ID.String(), payload)
		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
		}

		// Verify in DB
		var updated model.User
		if err := db.First(&updated, "id = ?", targetUser.ID).Error; err != nil {
			t.Fatalf("find user: %v", err)
		}
		if updated.DisplayName != "New Display Name" {
			t.Fatalf("expected display name New Display Name, got %s", updated.DisplayName)
		}
		if updated.Username != "targetrunner_new" {
			t.Fatalf("expected username targetrunner_new, got %s", updated.Username)
		}
		if updated.Email != "targetrunner_new@hskita.com" {
			t.Fatalf("expected email targetrunner_new@hskita.com, got %s", updated.Email)
		}
	})

	t.Run("duplicate username fails with 400", func(t *testing.T) {
		payload := `{"username":"duprunner", "display_name":"Some Name", "email":"targetrunner_unique@hskita.com", "role":20, "status":1}`
		rec := performJSON(router, http.MethodPut, "/users/"+targetUser.ID.String(), payload)
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 Bad Request, got %d body=%s", rec.Code, rec.Body.String())
		}
	})

	t.Run("duplicate email fails with 400", func(t *testing.T) {
		payload := `{"username":"targetrunner_another", "display_name":"Some Name", "email":"duprunner@hskita.com", "role":20, "status":1}`
		rec := performJSON(router, http.MethodPut, "/users/"+targetUser.ID.String(), payload)
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 Bad Request, got %d body=%s", rec.Code, rec.Body.String())
		}
	})
}

func TestCheckUsernameAvailability(t *testing.T) {
	db, tenant := setupAuthTestDB(t)

	// Seed a user
	seedUserWithRole(t, db, tenant, "takenuser", 20)

	ctrl := NewLMSController(db)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("db", db)
		c.Set(common.CtxTenantKey, tenant)
		c.Next()
	})
	router.GET("/checkout/check-username", ctrl.CheckUsernameAvailability)

	t.Run("taken username", func(t *testing.T) {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/checkout/check-username?username=takenuser", nil)
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
		}
		var body map[string]interface{}
		_ = json.Unmarshal(rec.Body.Bytes(), &body)
		data := body["data"].(map[string]interface{})
		if data["available"] != false {
			t.Fatalf("expected available=false, got %v", data["available"])
		}
	})

	t.Run("available username", func(t *testing.T) {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/checkout/check-username?username=freeuser", nil)
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
		}
		var body map[string]interface{}
		_ = json.Unmarshal(rec.Body.Bytes(), &body)
		data := body["data"].(map[string]interface{})
		if data["available"] != true {
			t.Fatalf("expected available=true, got %v", data["available"])
		}
	})

	t.Run("soft-deleted username remains unavailable", func(t *testing.T) {
		deletedUser := seedUserWithRole(t, db, tenant, "deletedname", 20)
		if err := db.Delete(&deletedUser).Error; err != nil {
			t.Fatalf("soft delete user: %v", err)
		}

		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/checkout/check-username?username=deletedname", nil)
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
		}
		var body map[string]interface{}
		_ = json.Unmarshal(rec.Body.Bytes(), &body)
		data := body["data"].(map[string]interface{})
		if data["available"] != false {
			t.Fatalf("expected soft-deleted username to remain unavailable, got %v", data["available"])
		}
	})
}

func TestCheckEmailAvailabilityIncludesAllUsers(t *testing.T) {
	db, tenant := setupAuthTestDB(t)

	deletedUser := seedUserWithRole(t, db, tenant, "deletedcheckout", 20)
	if err := db.Delete(&deletedUser).Error; err != nil {
		t.Fatalf("soft delete user: %v", err)
	}

	otherTenant := model.Tenant{ID: uuid.New(), Name: "Other Tenant", Domain: "other.test", IsActive: true}
	if err := db.Create(&otherTenant).Error; err != nil {
		t.Fatalf("create other tenant: %v", err)
	}
	seedUserWithRole(t, db, otherTenant, "othertenantcheckout", 20)

	ctrl := NewLMSController(db)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("db", db)
		c.Set(common.CtxTenantKey, tenant)
		c.Next()
	})
	router.GET("/checkout/check-email", ctrl.CheckEmailAvailability)

	assertAvailability := func(t *testing.T, email string, expected bool) {
		t.Helper()
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/checkout/check-email?email="+email, nil)
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
		}
		var body map[string]interface{}
		if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
			t.Fatalf("decode: %v", err)
		}
		data := body["data"].(map[string]interface{})
		if data["available"] != expected {
			t.Fatalf("expected available=%v, got %v", expected, data["available"])
		}
	}

	t.Run("soft-deleted user is unavailable", func(t *testing.T) {
		assertAvailability(t, "deletedcheckout@hskita.com", false)
	})

	t.Run("user from another tenant is unavailable", func(t *testing.T) {
		assertAvailability(t, "othertenantcheckout@hskita.com", false)
	})

	t.Run("unused email is available", func(t *testing.T) {
		assertAvailability(t, "availablecheckout@hskita.com", true)
	})
}

func seedUserWithRole(t *testing.T, db *gorm.DB, tenant model.Tenant, username string, role int) model.User {
	t.Helper()
	u := model.User{
		Username:    username,
		Email:       username + "@hskita.com",
		DisplayName: username + " Display",
		Password:    "password123",
		Role:        role,
		TenantID:    &tenant.ID,
	}
	if err := db.Create(&u).Error; err != nil {
		t.Fatalf("failed to seed user with role %d: %v", role, err)
	}
	return u
}

func TestNotifications(t *testing.T) {
	db, tenant := setupAuthTestDB(t)
	// Migrate Notification table
	if err := db.AutoMigrate(&model.Notification{}); err != nil {
		t.Fatalf("failed to migrate Notification: %v", err)
	}

	user := seedUserWithRole(t, db, tenant, "notifuser", 20)

	ctrl := NewUserController(db)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("db", db)
		c.Set(common.CtxTenantKey, tenant)
		c.Set("id", user.ID.String())
		c.Set("userID", user.ID)
		c.Set("username", user.Username)
		c.Set("role", user.Role)
		c.Next()
	})
	router.GET("/user/notifications", ctrl.GetMyNotifications)
	router.PUT("/user/notifications/:id/read", ctrl.MarkNotificationRead)
	router.PUT("/user/notifications/read-all", ctrl.MarkAllNotificationsRead)
	router.DELETE("/user/notifications/:id", ctrl.DeleteNotification)

	// Seed a notification
	err := model.PushNotification(db, user.ID, &tenant.ID, "Test Title", "Test Content", "info")
	if err != nil {
		t.Fatalf("failed to push notification: %v", err)
	}

	t.Run("get notifications", func(t *testing.T) {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/user/notifications", nil)
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
		}

		var body map[string]interface{}
		_ = json.Unmarshal(rec.Body.Bytes(), &body)
		data := body["data"].([]interface{})
		if len(data) != 1 {
			t.Fatalf("expected 1 notification, got %d", len(data))
		}
		notif := data[0].(map[string]interface{})
		if notif["title"] != "Test Title" {
			t.Fatalf("expected title Test Title, got %v", notif["title"])
		}
		if notif["is_read"] != false {
			t.Fatalf("expected is_read=false, got %v", notif["is_read"])
		}
	})

	t.Run("mark as read", func(t *testing.T) {
		var notif model.Notification
		db.First(&notif)

		rec := performJSON(router, http.MethodPut, "/user/notifications/"+notif.ID.String()+"/read", "")
		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
		}

		var updated model.Notification
		db.First(&updated, "id = ?", notif.ID)
		if !updated.IsRead {
			t.Fatalf("expected is_read=true")
		}
	})

	t.Run("delete notification", func(t *testing.T) {
		var notif model.Notification
		db.First(&notif)

		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodDelete, "/user/notifications/"+notif.ID.String(), nil)
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
		}

		var count int64
		db.Model(&model.Notification{}).Count(&count)
		if count != 0 {
			t.Fatalf("expected 0 notifications, got %d", count)
		}
	})
}
