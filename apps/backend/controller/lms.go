package controller

import (
	"context"
	"encoding/json"
	"errors"
	"gin-template/common"
	"gin-template/model"
	"gin-template/services"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type LMSController struct {
	DB                          *gorm.DB
	GenerateCourseCoverImage    func(context.Context, string) ([]byte, string, error)
	UploadCourseCoverImage      func([]byte) (string, error)
	ValidateCourseCoverProvider func() error
	ValidateCourseCoverStorage  func() error
}

func NewLMSController(db *gorm.DB) *LMSController {
	return &LMSController{
		DB:                          db,
		GenerateCourseCoverImage:    services.GenerateOpenAIImage,
		UploadCourseCoverImage:      services.ProcessAndUploadImageBytes,
		ValidateCourseCoverProvider: services.ValidateOpenAIImageConfig,
		ValidateCourseCoverStorage:  services.ValidateImageUploadConfig,
	}
}

type MentorDTO struct {
	ID          uuid.UUID  `json:"id"`
	UserID      uuid.UUID  `json:"user_id"`
	Name        string     `json:"name"`
	DisplayName string     `json:"display_name"`
	Headline    string     `json:"headline"`
	Bio         string     `json:"bio"`
	AvatarURL   string     `json:"avatar_url"`
	IsActive    bool       `json:"is_active"`
	TenantID    *uuid.UUID `json:"tenant_id"`
}

func lmsDB(c *gin.Context, fallback *gorm.DB) *gorm.DB {
	if db := model.GetDB(c); db != nil {
		return db
	}
	return fallback
}

func parseLimit(c *gin.Context) int {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	if limit < 1 || limit > 1000 {
		return 50
	}
	return limit
}

func parseUUIDParam(c *gin.Context, name string) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param(name))
	if err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return uuid.Nil, false
	}
	return id, true
}

func currentLMSUser(c *gin.Context) (uuid.UUID, int, bool) {
	userID, err := uuid.Parse(c.GetString("id"))
	if err != nil {
		sendError(c, http.StatusUnauthorized, "Unauthorized: login is required", nil)
		return uuid.Nil, 0, false
	}
	role, _ := c.Get("role")
	roleValue, _ := role.(int)
	return userID, roleValue, true
}

func optionalLMSUser(c *gin.Context) (uuid.UUID, int) {
	var userID uuid.UUID
	if uid, exists := c.Get("userID"); exists {
		if idVal, ok := uid.(uuid.UUID); ok {
			userID = idVal
		}
	}
	if userID == uuid.Nil {
		userIDStr := c.GetString("id")
		if userIDStr == "" {
			userIDStr = c.GetString("user_id")
		}
		if userIDStr != "" {
			userID, _ = uuid.Parse(userIDStr)
		}
	}

	roleValue := 0
	if role, exists := c.Get("role"); exists {
		if rVal, ok := role.(int); ok {
			roleValue = rVal
		} else if rValFloat, ok := role.(float64); ok {
			roleValue = int(rValFloat)
		}
	} else if role, exists := c.Get("user_role"); exists {
		if rVal, ok := role.(int); ok {
			roleValue = rVal
		} else if rValFloat, ok := role.(float64); ok {
			roleValue = int(rValFloat)
		}
	}
	return userID, roleValue
}

func (ctrl *LMSController) requireLearningAccess(c *gin.Context, courseID *uuid.UUID) bool {
	userID, role, ok := currentLMSUser(c)
	if !ok {
		return false
	}
	// mentor
	if role == 30 {
		return true
	}
	// admin
	if role >= 99 {
		return true
	}

	now := time.Now()
	db := lmsDB(c, ctrl.DB)
	var pendingSubscriptions []model.Subscription
	if err := db.
		Where("student_id = ?", userID).
		Where("pending_change_type = ? AND current_period_end <= ?", "downgrade", now).
		Find(&pendingSubscriptions).Error; err != nil {
		sendInternalError(c, err)
		return false
	}
	for i := range pendingSubscriptions {
		if err := applyPendingDowngradeIfDue(db, &pendingSubscriptions[i], now); err != nil {
			sendInternalError(c, err)
			return false
		}
	}

	query := db.Model(&model.Subscription{}).
		Where("student_id = ?", userID).
		Where("status IN ?", []model.SubscriptionStatus{
			model.SubscriptionStatusActive,
			model.SubscriptionStatusTrialing,
		}).
		Where("(current_period_end IS NULL OR current_period_end >= ?)", now)

	if courseID == nil || *courseID == uuid.Nil {
		var count int64
		if err := query.Count(&count).Error; err != nil {
			sendInternalError(c, err)
			return false
		}
		if count == 0 {
			sendError(c, http.StatusForbidden, "Active subscription is required to access this learning content", nil)
			return false
		}
		return true
	}

	var subscriptions []model.Subscription
	if err := query.Find(&subscriptions).Error; err != nil {
		sendInternalError(c, err)
		return false
	}
	for _, subscription := range subscriptions {
		granted, err := subscriptionGrantsCourse(db, subscription, *courseID)
		if err != nil {
			sendInternalError(c, err)
			return false
		}
		if granted {
			return true
		}
	}
	sendError(c, http.StatusForbidden, "Your active subscription does not include this course", nil)
	return false
}

type subscriptionCheckoutRequest struct {
	PricingID     string `json:"pricing_id" binding:"required"`
	PaymentMethod string `json:"payment_method"`
	StudentID     string `json:"student_id"`
	CourseID      string `json:"course_id"`
}

func lmsResourceModels(resource string) (interface{}, interface{}, bool) {
	switch resource {
	case "profiles":
		return &model.Profile{}, &[]model.Profile{}, true
	case "user-roles":
		return &model.UserRole{}, &[]model.UserRole{}, true
	case "classes":
		return &model.Class{}, &[]model.Class{}, true
	case "class-students":
		return &model.ClassStudent{}, &[]model.ClassStudent{}, true
	case "courses":
		return &model.Course{}, &[]model.Course{}, true
	case "course-categories":
		return &model.CourseCategory{}, &[]model.CourseCategory{}, true
	case "course-bundles":
		return &model.CourseBundle{}, &[]model.CourseBundle{}, true
	case "course-bundle-items":
		return &model.CourseBundleItem{}, &[]model.CourseBundleItem{}, true
	case "modules":
		return &model.Module{}, &[]model.Module{}, true
	case "lessons":
		return &model.Lesson{}, &[]model.Lesson{}, true
	case "learning-assets":
		return &model.LearningAsset{}, &[]model.LearningAsset{}, true
	case "library-items":
		return &model.LibraryItem{}, &[]model.LibraryItem{}, true
	case "memberships":
		return &model.Membership{}, &[]model.Membership{}, true
	case "subscriptions":
		return &model.Subscription{}, &[]model.Subscription{}, true
	case "payments":
		return &model.LMSPayment{}, &[]model.LMSPayment{}, true
	case "student-progress":
		return &model.StudentProgress{}, &[]model.StudentProgress{}, true
	case "subscription-plans":
		return &model.SubscriptionPlan{}, &[]model.SubscriptionPlan{}, true
	case "pricing-settings":
		return &model.SubscriptionPlan{}, &[]model.SubscriptionPlan{}, true
	case "guide-categories":
		return &model.GuideCategory{}, &[]model.GuideCategory{}, true
	case "guides":
		return &model.Guide{}, &[]model.Guide{}, true
	case "pricing-categories":
		return &model.PricingCategory{}, &[]model.PricingCategory{}, true
	case "organizations":
		return &model.Organization{}, &[]model.Organization{}, true
	case "faqs":
		return &model.FAQ{}, &[]model.FAQ{}, true
	case "testimonials":
		return &model.Testimonial{}, &[]model.Testimonial{}, true
	case "site-content":
		return &model.SiteContent{}, &[]model.SiteContent{}, true
	case "community-posts":
		return &model.CommunityPost{}, &[]model.CommunityPost{}, true
	case "parent-guides":
		return &model.ParentGuide{}, &[]model.ParentGuide{}, true
	case "level-unlocks":
		return &model.LevelUnlock{}, &[]model.LevelUnlock{}, true
	default:
		return nil, nil, false
	}
}

func subscriptionGrantsCourse(db *gorm.DB, subscription model.Subscription, courseID uuid.UUID) (bool, error) {
	if subscription.CourseID != nil {
		return *subscription.CourseID == courseID, nil
	}

	planID, ok := subscriptionPlanID(subscription)
	if !ok {
		return false, nil
	}

	var plan model.SubscriptionPlan
	if err := db.Select("id", "bundle_id").First(&plan, "id = ?", *planID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return false, nil
		}
		return false, err
	}
	bundleIDs, err := model.SubscriptionPlanBundleIDs(db, plan.ID, plan.BundleID)
	if err != nil {
		return false, err
	}
	if len(bundleIDs) == 0 {
		return false, nil
	}

	var count int64
	err = db.Model(&model.CourseBundleItem{}).
		Where("bundle_id IN ? AND course_id = ?", bundleIDs, courseID).
		Count(&count).Error
	return count > 0, err
}

func subscriptionPlanID(subscription model.Subscription) (*uuid.UUID, bool) {
	if parsedPlanID, err := uuid.Parse(subscription.ProviderPlanID); err == nil {
		return &parsedPlanID, true
	}
	if subscription.PlanID != nil && *subscription.PlanID != uuid.Nil {
		return subscription.PlanID, true
	}
	return nil, false
}

func appendBundleCourseIDs(db *gorm.DB, subscription model.Subscription, target map[uuid.UUID]bool) (bool, error) {
	planID, ok := subscriptionPlanID(subscription)
	if !ok {
		return false, nil
	}

	var plan model.SubscriptionPlan
	if err := db.Select("id", "bundle_id").First(&plan, "id = ?", *planID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return false, nil
		}
		return false, err
	}
	bundleIDs, err := model.SubscriptionPlanBundleIDs(db, plan.ID, plan.BundleID)
	if err != nil {
		return false, err
	}
	if len(bundleIDs) == 0 {
		return false, nil
	}

	courseIDs, err := model.BundleCourseIDs(db, bundleIDs)
	if err != nil {
		return false, err
	}
	for _, courseID := range courseIDs {
		target[courseID] = true
	}
	return false, nil
}

func hydrateSubscriptionPlanBundleIDs(db *gorm.DB, plans []model.SubscriptionPlan) {
	for i := range plans {
		bundleIDs, err := model.SubscriptionPlanBundleIDs(db, plans[i].ID, plans[i].BundleID)
		if err == nil {
			plans[i].BundleIDs = bundleIDs
		}
	}
}

func bundleIDsFromPayload(payload map[string]interface{}) ([]uuid.UUID, bool, error) {
	raw, exists := payload["bundle_ids"]
	if !exists {
		return nil, false, nil
	}
	seen := map[uuid.UUID]bool{}
	ids := []uuid.UUID{}
	appendID := func(value string) error {
		value = strings.TrimSpace(value)
		if value == "" || value == "all_access" {
			return nil
		}
		parsed, err := uuid.Parse(value)
		if err != nil {
			return err
		}
		if parsed != uuid.Nil && !seen[parsed] {
			seen[parsed] = true
			ids = append(ids, parsed)
		}
		return nil
	}
	switch values := raw.(type) {
	case []interface{}:
		for _, value := range values {
			if str, ok := value.(string); ok {
				if err := appendID(str); err != nil {
					return nil, true, err
				}
			}
		}
	case []string:
		for _, value := range values {
			if err := appendID(value); err != nil {
				return nil, true, err
			}
		}
	case string:
		if err := appendID(values); err != nil {
			return nil, true, err
		}
	case nil:
		return ids, true, nil
	default:
		return nil, true, errors.New("invalid bundle_ids")
	}
	return ids, true, nil
}

func syncSubscriptionPlanBundles(tx *gorm.DB, planID uuid.UUID, tenantID *uuid.UUID, bundleIDs []uuid.UUID) error {
	if err := tx.Unscoped().Where("plan_id = ?", planID).Delete(&model.SubscriptionPlanBundle{}).Error; err != nil {
		return err
	}
	for _, bundleID := range bundleIDs {
		row := model.SubscriptionPlanBundle{
			PlanID:   planID,
			BundleID: bundleID,
			TenantID: tenantID,
		}
		if err := tx.Create(&row).Error; err != nil {
			return err
		}
	}
	return nil
}

func activeSubscriptionCourseScope(db *gorm.DB, userID uuid.UUID, now time.Time) (bool, map[uuid.UUID]bool, error) {
	var pendingSubscriptions []model.Subscription
	if err := db.
		Where("student_id = ? AND pending_change_type = ? AND current_period_end <= ?", userID, "downgrade", now).
		Find(&pendingSubscriptions).Error; err != nil {
		return false, nil, err
	}
	for i := range pendingSubscriptions {
		if err := applyPendingDowngradeIfDue(db, &pendingSubscriptions[i], now); err != nil {
			return false, nil, err
		}
	}

	var subscriptions []model.Subscription
	if err := db.Where("student_id = ? AND status IN ?",
		userID,
		[]model.SubscriptionStatus{model.SubscriptionStatusActive, model.SubscriptionStatusTrialing},
	).Where("(current_period_end IS NULL OR current_period_end >= ?)", now).Find(&subscriptions).Error; err != nil {
		return false, nil, err
	}

	courseIDs := map[uuid.UUID]bool{}
	hasAllAccess := false
	for _, sub := range subscriptions {
		if sub.CourseID != nil {
			courseIDs[*sub.CourseID] = true
			continue
		}
		allAccess, err := appendBundleCourseIDs(db, sub, courseIDs)
		if err != nil {
			return false, nil, err
		}
		if allAccess {
			hasAllAccess = true
		}
	}
	return hasAllAccess, courseIDs, nil
}

func bindLMSResource(c *gin.Context, target interface{}) error {
	var payload map[string]interface{}
	if err := c.ShouldBindJSON(&payload); err != nil {
		return err
	}
	delete(payload, "tenant_id")
	delete(payload, "deleted_at")
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	return json.Unmarshal(raw, target)
}

// ─── Rich DTOs ───────────────────────────────────────────────────────────────

type SubscriptionDTO struct {
	model.Subscription
	StudentName string `json:"student_name"`
	ParentName  string `json:"parent_name"`
	PlanName    string `json:"plan_name"`
}

type PaymentDTO struct {
	model.LMSPayment
	StudentName string `json:"student_name"`
	ParentName  string `json:"parent_name"`
}

// ─── ListAdminResource (patched) ─────────────────────────────────────────────

func (ctrl *LMSController) ListAdminResource(c *gin.Context) {
	resource := c.Param("resource")
	_, role, ok := currentLMSUser(c)
	if ok && role == 30 {
		if resource != "modules" && resource != "lessons" && resource != "learning-assets" {
			sendError(c, http.StatusForbidden, "Forbidden: Insufficient permissions", nil)
			return
		}
	}
	db := lmsDB(c, ctrl.DB)
	limit := parseLimit(c)

	if resource == "mentors" {
		var users []model.User
		if err := db.Order("created_at desc").Where("role = 30").Limit(limit).Find(&users).Error; err != nil {
			sendInternalError(c, err)
			return
		}
		dtos := make([]MentorDTO, len(users))
		for i, u := range users {
			var profile model.Profile
			_ = db.First(&profile, "user_id = ?", u.ID).Error
			name := u.DisplayName
			if name == "" {
				name = u.Username
			}
			dtos[i] = MentorDTO{
				ID:          u.ID,
				UserID:      u.ID,
				Name:        name,
				DisplayName: u.DisplayName,
				Headline:    profile.Headline,
				Bio:         profile.Bio,
				AvatarURL:   profile.AvatarURL,
				IsActive:    u.Status != common.UserStatusDisabled,
				TenantID:    u.TenantID,
			}
		}
		sendSuccess(c, dtos, "LMS resource retrieved successfully")
		return
	}

	switch resource {
	case "subscriptions":
		var rows []model.Subscription
		if err := db.Order("created_at desc").Limit(limit).Find(&rows).Error; err != nil {
			sendInternalError(c, err)
			return
		}
		sendSuccess(c, enrichSubscriptions(db, rows), "LMS resource retrieved successfully")
		return

	case "payments":
		var rows []model.LMSPayment
		if err := db.Order("created_at desc").Limit(limit).Find(&rows).Error; err != nil {
			sendInternalError(c, err)
			return
		}
		sendSuccess(c, enrichPayments(db, rows), "LMS resource retrieved successfully")
		return

	case "pricing-settings", "subscription-plans":
		var rows []model.SubscriptionPlan
		if err := db.Preload("Features").Preload("PricingCategory").Preload("PlanBundles").Order("created_at desc").Limit(limit).Find(&rows).Error; err != nil {
			sendInternalError(c, err)
			return
		}
		hydrateSubscriptionPlanBundleIDs(db, rows)
		sendSuccess(c, rows, "LMS resource retrieved successfully")
		return

	case "course-bundle-items":
		var rows []model.CourseBundleItem
		query := db.Preload("Course")
		if bundleID := strings.TrimSpace(c.Query("bundle_id")); bundleID != "" {
			query = query.Where("bundle_id = ?", bundleID)
		}
		if err := query.Order("sort_order asc, created_at asc").Limit(limit).Find(&rows).Error; err != nil {
			sendInternalError(c, err)
			return
		}
		// Filter out items where the course was deleted (title is empty)
		var filtered []model.CourseBundleItem
		for _, item := range rows {
			if item.Course.ID != uuid.Nil && item.Course.Title != "" {
				filtered = append(filtered, item)
			}
		}
		sendSuccess(c, filtered, "LMS resource retrieved successfully")
		return
	}

	_, slice, ok := lmsResourceModels(resource)
	if !ok {
		sendError(c, http.StatusNotFound, "LMS resource not found", nil)
		return
	}
	if err := db.Order("created_at desc").Limit(limit).Find(slice).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccess(c, slice, "LMS resource retrieved successfully")
}

// ─── Enrichment ───────────────────────────────────────────────────────────────

func enrichSubscriptions(db *gorm.DB, rows []model.Subscription) []SubscriptionDTO {
	if len(rows) == 0 {
		return []SubscriptionDTO{}
	}

	userIDs := uniqueUUIDs(func() []uuid.UUID {
		ids := make([]uuid.UUID, 0, len(rows)*2)
		for _, r := range rows {
			ids = append(ids, r.StudentID, r.ParentID)
		}
		return ids
	}())

	profiles := fetchProfileNames(db, userIDs)
	planIDs := make([]string, 0, len(rows))
	for _, row := range rows {
		if row.PlanID != nil && *row.PlanID != uuid.Nil {
			planIDs = append(planIDs, row.PlanID.String())
		} else if row.ProviderPlanID != "" {
			planIDs = append(planIDs, row.ProviderPlanID)
		}
	}
	var plans []model.SubscriptionPlan
	if len(planIDs) > 0 {
		db.Select("id, name").Where("id IN ?", planIDs).Find(&plans)
	}
	planNames := make(map[string]string, len(plans))
	for _, plan := range plans {
		planNames[plan.ID.String()] = plan.Name
	}

	out := make([]SubscriptionDTO, len(rows))
	for i, r := range rows {
		planID := r.ProviderPlanID
		if r.PlanID != nil && *r.PlanID != uuid.Nil {
			planID = r.PlanID.String()
		}
		out[i] = SubscriptionDTO{
			Subscription: r,
			StudentName:  profiles[r.StudentID.String()],
			ParentName:   profiles[r.ParentID.String()],
			PlanName:     planNames[planID],
		}
	}
	return out
}

func enrichPayments(db *gorm.DB, rows []model.LMSPayment) []PaymentDTO {
	if len(rows) == 0 {
		return []PaymentDTO{}
	}

	userIDs := uniqueUUIDs(func() []uuid.UUID {
		ids := make([]uuid.UUID, 0, len(rows)*2)
		for _, r := range rows {
			ids = append(ids, r.StudentID, r.ParentID)
		}
		return ids
	}())

	profiles := fetchProfileNames(db, userIDs)

	out := make([]PaymentDTO, len(rows))
	for i, r := range rows {
		out[i] = PaymentDTO{
			LMSPayment:  r,
			StudentName: profiles[r.StudentID.String()],
			ParentName:  profiles[r.ParentID.String()],
		}
	}
	return out
}

// ─── Shared utilities ─────────────────────────────────────────────────────────

// fetchProfileNames returns map[user_id string] → full_name, 1 query.
func fetchProfileNames(db *gorm.DB, userIDs []string) map[string]string {
	if len(userIDs) == 0 {
		return map[string]string{}
	}
	var rows []struct {
		ID    string `gorm:"column:id"`
		Email string `gorm:"column:email"`
	}
	db.Table("users").
		Select("id, email").
		Where("id IN ?", userIDs).
		Scan(&rows)

	m := make(map[string]string, len(rows))
	for _, r := range rows {
		m[r.ID] = r.Email
	}
	return m
}

// uniqueUUIDs deduplicates and converts []uuid.UUID → []string for SQL IN.
func uniqueUUIDs(ids []uuid.UUID) []string {
	seen := make(map[string]struct{}, len(ids))
	out := make([]string, 0, len(ids))
	for _, id := range ids {
		s := id.String()
		if _, ok := seen[s]; !ok {
			seen[s] = struct{}{}
			out = append(out, s)
		}
	}
	return out
}
func (ctrl *LMSController) CreateAdminResource(c *gin.Context) {
	resource := c.Param("resource")
	_, role, ok := currentLMSUser(c)
	if ok && role == 30 {
		if resource != "modules" && resource != "lessons" && resource != "learning-assets" {
			sendError(c, http.StatusForbidden, "Forbidden: Insufficient permissions", nil)
			return
		}
	}

	if resource == "mentors" {
		var payload struct {
			UserID    uuid.UUID `json:"user_id"`
			Name      string    `json:"name"`
			Headline  string    `json:"headline"`
			Bio       string    `json:"bio"`
			AvatarURL string    `json:"avatar_url"`
			IsActive  bool      `json:"is_active"`
		}
		if err := c.ShouldBindJSON(&payload); err != nil {
			sendBadRequest(c, ErrInvalidParameters, nil)
			return
		}
		db := lmsDB(c, ctrl.DB).WithContext(c)
		var user model.User
		if err := db.First(&user, "id = ?", payload.UserID).Error; err != nil {
			sendError(c, http.StatusNotFound, "User not found", nil)
			return
		}

		user.Role = 30
		if payload.IsActive {
			user.Status = common.UserStatusEnabled
		} else {
			user.Status = common.UserStatusDisabled
		}
		if err := db.Model(&user).Updates(map[string]interface{}{"role": 30, "status": user.Status}).Error; err != nil {
			sendInternalError(c, err)
			return
		}

		var profile model.Profile
		err := db.First(&profile, "user_id = ?", user.ID).Error
		if err != nil {
			profile = model.Profile{
				ID:          uuid.New(),
				UserID:      user.ID,
				FullName:    payload.Name,
				DisplayName: payload.Name,
				Headline:    payload.Headline,
				Bio:         payload.Bio,
				AvatarURL:   payload.AvatarURL,
				TenantID:    user.TenantID,
			}
			_ = db.Create(&profile).Error
		} else {
			_ = db.Model(&profile).Updates(map[string]interface{}{
				"full_name":    payload.Name,
				"display_name": payload.Name,
				"headline":     payload.Headline,
				"bio":          payload.Bio,
				"avatar_url":   payload.AvatarURL,
			}).Error
		}

		dto := MentorDTO{
			ID:          user.ID,
			UserID:      user.ID,
			Name:        payload.Name,
			DisplayName: payload.Name,
			Headline:    payload.Headline,
			Bio:         payload.Bio,
			AvatarURL:   payload.AvatarURL,
			IsActive:    payload.IsActive,
			TenantID:    user.TenantID,
		}
		sendSuccess(c, dto, "Mentor created successfully")
		return
	}

	if resource == "course-bundle-items" {
		var item model.CourseBundleItem
		if err := bindLMSResource(c, &item); err != nil {
			sendBadRequest(c, ErrInvalidParameters, nil)
			return
		}
		db := lmsDB(c, ctrl.DB).WithContext(c)

		var existing model.CourseBundleItem
		// Menggunakan Unscoped() untuk mendeteksi data yang terkena soft-delete
		err := db.Unscoped().Where("bundle_id = ? AND course_id = ?", item.BundleID, item.CourseID).First(&existing).Error

		if err == nil {
			// Jika data ada dan deleted_at tidak null (berarti pernah di-soft-delete)
			if existing.DeletedAt.Valid {
				// Restore data: set deleted_at menjadi NULL kembali dan update sort_order jika dikirim baru
				if err := db.Unscoped().Model(&existing).Updates(map[string]interface{}{
					"deleted_at": gorm.DeletedAt{Valid: false},
					"sort_order": item.SortOrder,
				}).Error; err != nil {
					sendInternalError(c, err)
					return
				}
				syncCourseBundleCount(db, item.BundleID)
				sendSuccess(c, existing, "Course bundle item restored successfully")
				return
			}

			// Jika data benar-benar aktif (belum di-soft delete)
			sendSuccess(c, existing, "Course already exists in this bundle")
			return
		}

		if !errors.Is(err, gorm.ErrRecordNotFound) {
			sendInternalError(c, err)
			return
		}

		if err := db.Create(&item).Error; err != nil {
			sendInternalError(c, err)
			return
		}
		syncCourseBundleCount(db, item.BundleID)
		sendSuccess(c, item, "LMS resource created successfully")
		return
	}

	resource = c.Param("resource")
	if resource == "pricing-settings" || resource == "subscription-plans" {
		var payload map[string]interface{}
		if err := c.ShouldBindJSON(&payload); err != nil {
			sendBadRequest(c, ErrInvalidParameters, nil)
			return
		}

		var incomingFeatures []interface{}
		featuresExist := false
		if feats, exists := payload["features"]; exists {
			if list, ok := feats.([]interface{}); ok {
				incomingFeatures = list
				featuresExist = true
			}
			delete(payload, "features")
		}
		var featureMetaJSON []byte
		if meta, exists := payload["feature_meta"]; exists {
			if jsonBytes, err := json.Marshal(meta); err == nil {
				featureMetaJSON = jsonBytes
			}
		}
		bundleIDs, bundleIDsExist, err := bundleIDsFromPayload(payload)
		if err != nil {
			sendBadRequest(c, ErrInvalidParameters, nil)
			return
		}
		if bundleIDsExist {
			if len(bundleIDs) > 0 {
				payload["bundle_id"] = bundleIDs[0].String()
			} else {
				payload["bundle_id"] = nil
			}
		}
		delete(payload, "feature_meta")
		delete(payload, "bundle_ids")
		delete(payload, "plan_bundles")
		delete(payload, "bundle")
		delete(payload, "subscriptions")

		payloadBytes, err := json.Marshal(payload)
		if err != nil {
			sendInternalError(c, err)
			return
		}

		var plan model.SubscriptionPlan
		if err := json.Unmarshal(payloadBytes, &plan); err != nil {
			sendBadRequest(c, ErrInvalidParameters, nil)
			return
		}

		if featureMetaJSON != nil {
			plan.FeatureMeta = datatypes.JSON(featureMetaJSON)
		}

		db := lmsDB(c, ctrl.DB).WithContext(c)
		err = db.Transaction(func(tx *gorm.DB) error {
			if err := tx.Create(&plan).Error; err != nil {
				return err
			}
			if bundleIDsExist {
				if err := syncSubscriptionPlanBundles(tx, plan.ID, plan.TenantID, bundleIDs); err != nil {
					return err
				}
			}

			if featuresExist {
				for _, f := range incomingFeatures {
					var feature model.SubscriptionFeature
					feature.PlanID = plan.ID
					feature.TenantID = plan.TenantID

					if str, ok := f.(string); ok {
						feature.FeatureKey = str
					} else if obj, ok := f.(map[string]interface{}); ok {
						if key, ok := obj["feature_key"].(string); ok {
							feature.FeatureKey = key
						}
						if val, ok := obj["feature_value"].(string); ok {
							feature.FeatureValue = val
						}
						if desc, ok := obj["description"].(string); ok {
							feature.Description = desc
						}
					}

					if feature.FeatureKey != "" {
						feature.ID = uuid.New()
						if err := tx.Create(&feature).Error; err != nil {
							return err
						}
					}
				}
			}
			return nil
		})
		if err != nil {
			sendInternalError(c, err)
			return
		}

		_ = db.Preload("Features").Preload("PlanBundles").First(&plan, "id = ?", plan.ID).Error
		createdPlans := []model.SubscriptionPlan{plan}
		hydrateSubscriptionPlanBundleIDs(db, createdPlans)
		plan = createdPlans[0]
		sendSuccess(c, plan, "LMS resource created successfully")
		return
	}

	if resource == "course-categories" {
		var payload struct {
			Name        string   `json:"name" binding:"required"`
			Slug        string   `json:"slug"`
			Description string   `json:"description"`
			SortOrder   int      `json:"sort_order"`
			IsActive    *bool    `json:"is_active"`
			TargetRoles []string `json:"target_roles"`
		}
		if err := c.ShouldBindJSON(&payload); err != nil {
			sendBadRequest(c, ErrInvalidParameters, nil)
			return
		}
		if strings.TrimSpace(payload.Slug) == "" {
			payload.Slug = generateSlug(payload.Name)
		}
		cleanRoles := sanitizeTargetRoles(payload.TargetRoles)
		if len(cleanRoles) == 0 {
			sendError(c, http.StatusUnprocessableEntity, "Minimal satu target role wajib dipilih untuk Course Category", map[string]string{
				"target_roles": "Minimal satu target role wajib dipilih",
			})
			return
		}

		db := lmsDB(c, ctrl.DB).WithContext(c)
		isActive := true
		if payload.IsActive != nil {
			isActive = *payload.IsActive
		}

		category := model.CourseCategory{
			Name:        payload.Name,
			Slug:        payload.Slug,
			Description: payload.Description,
			SortOrder:   payload.SortOrder,
			IsActive:    isActive,
		}

		err := db.Transaction(func(tx *gorm.DB) error {
			if err := tx.Create(&category).Error; err != nil {
				return err
			}
			if err := setCourseCategoryTargetRoles(tx, category.ID, category.TenantID, cleanRoles); err != nil {
				return err
			}
			return nil
		})

		if err != nil {
			sendInternalError(c, err)
			return
		}

		resJSON := gin.H{
			"id":           category.ID,
			"name":         category.Name,
			"slug":         category.Slug,
			"description":  category.Description,
			"sort_order":   category.SortOrder,
			"is_active":    category.IsActive,
			"target_roles": cleanRoles,
		}
		sendSuccess(c, resJSON, "Course category created successfully")
		return
	}

	modelValue, _, ok := lmsResourceModels(resource)
	if !ok {
		sendError(c, http.StatusNotFound, "LMS resource not found", nil)
		return
	}
	if err := bindLMSResource(c, modelValue); err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}
	if err := lmsDB(c, ctrl.DB).WithContext(c).Create(modelValue).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccess(c, modelValue, "LMS resource created successfully")
}

func (ctrl *LMSController) UpdateAdminResource(c *gin.Context) {
	resource := c.Param("resource")

	if resource == "course-categories" {
		id, ok := parseUUIDParam(c, "id")
		if !ok {
			return
		}
		var payload struct {
			Name        string   `json:"name"`
			Slug        string   `json:"slug"`
			Description string   `json:"description"`
			SortOrder   int      `json:"sort_order"`
			IsActive    *bool    `json:"is_active"`
			TargetRoles []string `json:"target_roles"`
		}
		if err := c.ShouldBindJSON(&payload); err != nil {
			sendBadRequest(c, ErrInvalidParameters, nil)
			return
		}
		cleanRoles := sanitizeTargetRoles(payload.TargetRoles)
		if len(cleanRoles) == 0 {
			sendError(c, http.StatusUnprocessableEntity, "Minimal satu target role wajib dipilih untuk Course Category", map[string]string{
				"target_roles": "Minimal satu target role wajib dipilih",
			})
			return
		}

		db := lmsDB(c, ctrl.DB).WithContext(c)
		var category model.CourseCategory
		if err := db.First(&category, "id = ?", id).Error; err != nil {
			sendError(c, http.StatusNotFound, "Course category not found", nil)
			return
		}

		err := db.Transaction(func(tx *gorm.DB) error {
			updates := map[string]interface{}{}
			if payload.Name != "" {
				updates["name"] = payload.Name
			}
			if payload.Slug != "" {
				updates["slug"] = payload.Slug
			} else if payload.Name != "" {
				updates["slug"] = generateSlug(payload.Name)
			}
			updates["description"] = payload.Description
			updates["sort_order"] = payload.SortOrder
			if payload.IsActive != nil {
				updates["is_active"] = *payload.IsActive
			}

			if err := tx.Model(&category).Updates(updates).Error; err != nil {
				return err
			}
			if err := setCourseCategoryTargetRoles(tx, category.ID, category.TenantID, cleanRoles); err != nil {
				return err
			}
			if err := syncCoursesForCategoryRoleUpdate(tx, category.ID, cleanRoles); err != nil {
				return err
			}
			return nil
		})

		if err != nil {
			sendInternalError(c, err)
			return
		}

		resJSON := gin.H{
			"id":           category.ID,
			"name":         category.Name,
			"slug":         category.Slug,
			"description":  category.Description,
			"sort_order":   category.SortOrder,
			"is_active":    category.IsActive,
			"target_roles": cleanRoles,
		}
		sendSuccess(c, resJSON, "Course category updated successfully")
		return
	}
	if resource == "mentors" {
		id, ok := parseUUIDParam(c, "id")
		if !ok {
			return
		}
		var payload struct {
			Name      string `json:"name"`
			Headline  string `json:"headline"`
			Bio       string `json:"bio"`
			AvatarURL string `json:"avatar_url"`
			IsActive  bool   `json:"is_active"`
		}
		if err := c.ShouldBindJSON(&payload); err != nil {
			sendBadRequest(c, ErrInvalidParameters, nil)
			return
		}
		db := lmsDB(c, ctrl.DB).WithContext(c)
		var user model.User
		if err := db.First(&user, "id = ?", id).Error; err != nil {
			sendError(c, http.StatusNotFound, "User not found", nil)
			return
		}

		if payload.IsActive {
			user.Status = common.UserStatusEnabled
		} else {
			user.Status = common.UserStatusDisabled
		}
		if err := db.Model(&user).Update("status", user.Status).Error; err != nil {
			sendInternalError(c, err)
			return
		}

		var profile model.Profile
		err := db.First(&profile, "user_id = ?", user.ID).Error
		if err != nil {
			profile = model.Profile{
				ID:          uuid.New(),
				UserID:      user.ID,
				FullName:    payload.Name,
				DisplayName: payload.Name,
				Headline:    payload.Headline,
				Bio:         payload.Bio,
				AvatarURL:   payload.AvatarURL,
				TenantID:    user.TenantID,
			}
			_ = db.Create(&profile).Error
		} else {
			_ = db.Model(&profile).Updates(map[string]interface{}{
				"full_name":    payload.Name,
				"display_name": payload.Name,
				"headline":     payload.Headline,
				"bio":          payload.Bio,
				"avatar_url":   payload.AvatarURL,
			}).Error
		}

		dto := MentorDTO{
			ID:          user.ID,
			UserID:      user.ID,
			Name:        payload.Name,
			DisplayName: payload.Name,
			Headline:    payload.Headline,
			Bio:         payload.Bio,
			AvatarURL:   payload.AvatarURL,
			IsActive:    payload.IsActive,
			TenantID:    user.TenantID,
		}
		sendSuccess(c, dto, "Mentor updated successfully")
		return
	}

	if resource == "pricing-settings" || resource == "subscription-plans" {
		var payload map[string]interface{}
		if err := c.ShouldBindJSON(&payload); err != nil {
			sendBadRequest(c, ErrInvalidParameters, nil)
			return
		}
		id, ok := parseUUIDParam(c, "id")
		if !ok {
			return
		}

		delete(payload, "id")
		delete(payload, "tenant_id")
		delete(payload, "created_at")
		delete(payload, "updated_at")
		delete(payload, "deleted_at")

		var incomingFeatures []interface{}
		featuresExist := false
		if feats, exists := payload["features"]; exists {
			if list, ok := feats.([]interface{}); ok {
				incomingFeatures = list
				featuresExist = true
			}
			delete(payload, "features")
		}
		var featureMetaJSON []byte
		if meta, exists := payload["feature_meta"]; exists {
			if jsonBytes, err := json.Marshal(meta); err == nil {
				featureMetaJSON = jsonBytes
			}
		}
		bundleIDs, bundleIDsExist, err := bundleIDsFromPayload(payload)
		if err != nil {
			sendBadRequest(c, ErrInvalidParameters, nil)
			return
		}
		if bundleIDsExist {
			if len(bundleIDs) > 0 {
				payload["bundle_id"] = bundleIDs[0].String()
			} else {
				payload["bundle_id"] = nil
			}
		}
		delete(payload, "feature_meta")
		delete(payload, "bundle_ids")
		delete(payload, "plan_bundles")
		delete(payload, "bundle")
		delete(payload, "subscriptions")
		delete(payload, "pricing_category")

		db := lmsDB(c, ctrl.DB).WithContext(c)
		err = db.Transaction(func(tx *gorm.DB) error {
			var plan model.SubscriptionPlan
			if err := tx.First(&plan, "id = ?", id).Error; err != nil {
				return err
			}

			if err := tx.Model(&plan).Updates(payload).Error; err != nil {
				return err
			}

			if featureMetaJSON != nil {
				if err := tx.Model(&plan).Update("features", featureMetaJSON).Error; err != nil {
					return err
				}
			}
			if bundleIDsExist {
				if err := syncSubscriptionPlanBundles(tx, plan.ID, plan.TenantID, bundleIDs); err != nil {
					return err
				}
			}

			if featuresExist {
				// Delete existing features
				if err := tx.Where("plan_id = ?", id).Delete(&model.SubscriptionFeature{}).Error; err != nil {
					return err
				}

				// Insert new ones
				for _, f := range incomingFeatures {
					var feature model.SubscriptionFeature
					feature.PlanID = id
					feature.TenantID = plan.TenantID

					if str, ok := f.(string); ok {
						feature.FeatureKey = str
					} else if obj, ok := f.(map[string]interface{}); ok {
						if key, ok := obj["feature_key"].(string); ok {
							feature.FeatureKey = key
						}
						if val, ok := obj["feature_value"].(string); ok {
							feature.FeatureValue = val
						}
						if desc, ok := obj["description"].(string); ok {
							feature.Description = desc
						}
					}

					if feature.FeatureKey != "" {
						feature.ID = uuid.New()
						if err := tx.Create(&feature).Error; err != nil {
							return err
						}
					}
				}
			}
			return nil
		})
		if err != nil {
			sendInternalError(c, err)
			return
		}

		var updatedPlan model.SubscriptionPlan
		_ = db.Preload("Features").Preload("PlanBundles").First(&updatedPlan, "id = ?", id).Error
		updatedPlans := []model.SubscriptionPlan{updatedPlan}
		hydrateSubscriptionPlanBundleIDs(db, updatedPlans)
		updatedPlan = updatedPlans[0]
		sendSuccess(c, updatedPlan, "LMS resource updated successfully")
		return
	}

	modelValue, _, ok := lmsResourceModels(resource)
	if !ok {
		sendError(c, http.StatusNotFound, "LMS resource not found", nil)
		return
	}
	id, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	var payload map[string]interface{}
	if err := c.ShouldBindJSON(&payload); err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}
	delete(payload, "id")
	delete(payload, "tenant_id")
	delete(payload, "created_at")
	delete(payload, "updated_at")
	delete(payload, "deleted_at")
	delete(payload, "target_roles")

	db := lmsDB(c, ctrl.DB)
	_, role, ok := currentLMSUser(c)
	if ok && role == 30 {
		allowed, errMsg := ctrl.checkResourcePermission(c, db, resource, id)
		if !allowed {
			sendError(c, http.StatusForbidden, errMsg, nil)
			return
		}
	}

	if err := db.Model(modelValue).Where("id = ?", id).Updates(payload).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccess(c, payload, "LMS resource updated successfully")
}

func (ctrl *LMSController) DeleteAdminResource(c *gin.Context) {
	resource := c.Param("resource")
	if resource == "course-bundle-items" {
		id, ok := parseUUIDParam(c, "id")
		if !ok {
			return
		}
		db := lmsDB(c, ctrl.DB).WithContext(c)
		var item model.CourseBundleItem
		if err := db.First(&item, "id = ?", id).Error; err == nil {
			bundleID := item.BundleID
			if err := db.Delete(&item).Error; err != nil {
				sendInternalError(c, err)
				return
			}
			syncCourseBundleCount(db, bundleID)
			sendSuccessNoData(c)
			return
		}
	}

	if resource == "mentors" {
		id, ok := parseUUIDParam(c, "id")
		if !ok {
			return
		}
		db := lmsDB(c, ctrl.DB)
		if err := db.Model(&model.User{}).Where("id = ?", id).Update("role", 20).Error; err != nil {
			sendInternalError(c, err)
			return
		}
		sendSuccessNoData(c)
		return
	}

	modelValue, _, ok := lmsResourceModels(resource)
	if !ok {
		sendError(c, http.StatusNotFound, "LMS resource not found", nil)
		return
	}
	id, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}

	db := lmsDB(c, ctrl.DB)
	_, role, ok := currentLMSUser(c)
	if ok && role == 30 {
		allowed, errMsg := ctrl.checkResourcePermission(c, db, resource, id)
		if !allowed {
			sendError(c, http.StatusForbidden, errMsg, nil)
			return
		}
	}

	if err := db.Delete(modelValue, "id = ?", id).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccessNoData(c)
}

func (ctrl *LMSController) UploadImage(c *gin.Context) {
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		sendBadRequest(c, "file is required", nil)
		return
	}
	defer file.Close()

	key, err := services.ProcessAndUploadImage(file, header)
	if err != nil {
		sendBadRequest(c, err.Error(), nil)
		return
	}

	url := publicCOSURL(key)

	sendSuccess(c, gin.H{"key": key, "url": url}, "Image uploaded successfully")
}

func (ctrl *LMSController) UploadMedia(c *gin.Context) {
	mediaType := c.PostForm("type")
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		sendBadRequest(c, "file is required", nil)
		return
	}
	defer file.Close()

	key, err := services.ProcessAndUploadMedia(file, header, mediaType)
	if err != nil {
		sendBadRequest(c, err.Error(), nil)
		return
	}

	sendSuccess(c, gin.H{"key": key, "url": publicCOSURL(key)}, "Media uploaded successfully")
}

func publicCOSURL(key string) string {
	baseURL := strings.TrimRight(os.Getenv("COS_CDN_BASE_URL"), "/")
	if baseURL == "" {
		baseURL = strings.TrimRight(os.Getenv("COS_PUBLIC_BASE_URL"), "/")
	}
	if baseURL == "" {
		baseURL = "https://cdn.codeverta.com"
	}
	return strings.TrimRight(baseURL, "/") + "/" + strings.TrimLeft(key, "/")
}

// Tipe data payload yang dikirimkan oleh frontend React
type ReorderModulesRequest struct {
	CourseID string `json:"course_id" binding:"required"`
	Modules  []struct {
		ID        string `json:"id" binding:"required"`
		SortOrder int    `json:"sort_order"`
	} `json:"modules" binding:"required"`
}

func (ctrl *LMSController) CreateLearningAsset(c *gin.Context) {
	var asset model.LearningAsset
	if err := c.ShouldBindJSON(&asset); err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}
	db := lmsDB(c, ctrl.DB).WithContext(c)

	var courseID uuid.UUID
	err := db.Table("lessons").
		Select("modules.course_id").
		Joins("JOIN modules ON modules.id = lessons.module_id").
		Where("lessons.id = ?", asset.LessonID).
		Row().Scan(&courseID)
	if err != nil {
		sendError(c, http.StatusNotFound, "Lesson associated with asset not found", nil)
		return
	}

	allowed, errMsg := ctrl.checkCoursePermission(c, db, courseID)
	if !allowed {
		sendError(c, http.StatusForbidden, errMsg, nil)
		return
	}

	if err := db.Create(&asset).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccess(c, asset, "Learning asset created successfully")
}

var youtubeIDPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{11}$`)

func youtubeVideoID(raw string) (string, bool) {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return "", false
	}
	host := strings.TrimPrefix(strings.ToLower(parsed.Hostname()), "www.")
	videoID := ""
	if host == "youtu.be" {
		videoID = strings.Split(strings.Trim(parsed.Path, "/"), "/")[0]
	} else if host == "youtube.com" || host == "m.youtube.com" || host == "music.youtube.com" {
		parts := strings.Split(strings.Trim(parsed.Path, "/"), "/")
		if len(parts) > 0 && parts[0] == "watch" {
			videoID = parsed.Query().Get("v")
		} else if len(parts) > 1 && (parts[0] == "embed" || parts[0] == "shorts" || parts[0] == "live") {
			videoID = parts[1]
		}
	}
	return videoID, youtubeIDPattern.MatchString(videoID)
}

func (ctrl *LMSController) CreateYouTubeLearningAsset(c *gin.Context) {
	_, role, ok := currentLMSUser(c)
	if !ok {
		return
	}
	if role != model.RoleMentor && role < 99 {
		sendError(c, http.StatusForbidden, "Mentor or admin access is required", nil)
		return
	}
	var req struct {
		LessonID    uuid.UUID `json:"lesson_id" binding:"required"`
		Title       string    `json:"title" binding:"required,max=180"`
		YouTubeURL  string    `json:"youtube_url" binding:"required"`
		Description string    `json:"description"`
		SortOrder   int       `json:"sort_order"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}
	videoID, valid := youtubeVideoID(req.YouTubeURL)
	if !valid {
		sendBadRequest(c, "YouTube URL is invalid", nil)
		return
	}
	db := lmsDB(c, ctrl.DB).WithContext(c)

	var courseID uuid.UUID
	err := db.Table("lessons").
		Select("modules.course_id").
		Joins("JOIN modules ON modules.id = lessons.module_id").
		Where("lessons.id = ?", req.LessonID).
		Row().Scan(&courseID)
	if err != nil {
		sendError(c, http.StatusNotFound, "Lesson associated with asset not found", nil)
		return
	}

	allowed, errMsg := ctrl.checkCoursePermission(c, db, courseID)
	if !allowed {
		sendError(c, http.StatusForbidden, errMsg, nil)
		return
	}

	asset := model.LearningAsset{
		LessonID: req.LessonID, Type: model.LearningAssetVideo,
		Title: strings.TrimSpace(req.Title), Description: req.Description,
		FileURL:      "https://www.youtube.com/watch?v=" + videoID,
		ThumbnailURL: "https://img.youtube.com/vi/" + videoID + "/hqdefault.jpg",
		SortOrder:    req.SortOrder,
	}
	if err := db.Create(&asset).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccess(c, asset, "YouTube video attached successfully")
}

func (ctrl *LMSController) DeleteLearningAsset(c *gin.Context) {
	_, role, ok := currentLMSUser(c)
	if !ok {
		return
	}
	if role != model.RoleMentor && role < 99 {
		sendError(c, http.StatusForbidden, "Mentor or admin access is required", nil)
		return
	}
	assetID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}

	db := lmsDB(c, ctrl.DB).WithContext(c)
	allowed, errMsg := ctrl.checkResourcePermission(c, db, "learning-assets", assetID)
	if !allowed {
		sendError(c, http.StatusForbidden, errMsg, nil)
		return
	}

	result := db.Delete(&model.LearningAsset{}, "id = ?", assetID)
	if result.Error != nil {
		sendInternalError(c, result.Error)
		return
	}
	if result.RowsAffected == 0 {
		sendError(c, http.StatusNotFound, "Learning asset not found", nil)
		return
	}
	sendSuccessNoData(c)
}

func (ctrl *LMSController) ListLearningAssets(c *gin.Context) {
	var assets []model.LearningAsset
	query := lmsDB(c, ctrl.DB).Order("sort_order asc, created_at asc").Limit(parseLimit(c))
	if lessonID := c.Query("lesson_id"); lessonID != "" {
		parsedLessonID, err := uuid.Parse(lessonID)
		if err != nil {
			sendBadRequest(c, ErrInvalidParameters, nil)
			return
		}
		var lesson model.Lesson
		err = lmsDB(c, ctrl.DB).Preload("Module").First(&lesson, "id = ?", parsedLessonID).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			sendError(c, http.StatusNotFound, "Lesson not found", nil)
			return
		}
		if err != nil {
			sendInternalError(c, err)
			return
		}
		if !ctrl.requireLearningAccess(c, &lesson.Module.CourseID) {
			return
		}
		query = query.Where("lesson_id = ?", parsedLessonID)
	} else if !ctrl.requireLearningAccess(c, nil) {
		return
	}
	if err := query.Find(&assets).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccess(c, assets, "Learning assets retrieved successfully")
}

func (ctrl *LMSController) UpsertLibraryItem(c *gin.Context) {
	var item model.LibraryItem
	if err := c.ShouldBindJSON(&item); err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}
	db := lmsDB(c, ctrl.DB).WithContext(c)
	if item.ID == uuid.Nil {
		if err := db.Create(&item).Error; err != nil {
			sendInternalError(c, err)
			return
		}
		sendSuccess(c, item, "Library item created successfully")
		return
	}
	if err := db.Model(&model.LibraryItem{}).Where("id = ?", item.ID).Updates(item).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccess(c, item, "Library item updated successfully")
}

func (ctrl *LMSController) ListLibraryItems(c *gin.Context) {
	var items []model.LibraryItem
	query := lmsDB(c, ctrl.DB).Order("created_at desc").Limit(parseLimit(c))
	if c.Query("include_drafts") != "true" {
		query = query.Where("is_published = ?", true)
	}
	if err := query.Find(&items).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccess(c, items, "Library items retrieved successfully")
}

func (ctrl *LMSController) GetPricing(c *gin.Context) {
	var pricing model.SubscriptionPlan
	db := lmsDB(c, ctrl.DB)
	err := db.Where("is_active = ?", true).Order("created_at desc").First(&pricing).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		sendError(c, http.StatusNotFound, "Pricing setting not found", nil)
		return
	}
	if err != nil {
		sendInternalError(c, err)
		return
	}
	pricingPlans := []model.SubscriptionPlan{pricing}
	hydrateSubscriptionPlanBundleIDs(db, pricingPlans)
	pricing = pricingPlans[0]
	sendSuccess(c, pricing, "Pricing retrieved successfully")
}

func (ctrl *LMSController) ListSubscriptionPlans(c *gin.Context) {
	var plans []model.SubscriptionPlan
	query := lmsDB(c, ctrl.DB).
		Preload("Features").
		Preload("PricingCategory").
		Where("subscription_plans.is_active = ?", true)

	hasJoin := false
	if catSlug := c.Query("pricing_category_slug"); catSlug != "" {
		query = query.Joins("JOIN pricing_categories ON pricing_categories.id = subscription_plans.pricing_category_id").
			Where("pricing_categories.slug = ?", catSlug)
		hasJoin = true
	}

	checkoutType := c.Query("checkout_type")
	if checkoutType == "" {
		checkoutType = c.Query("filter[checkout_type]")
	}
	if checkoutType != "" {
		if !hasJoin {
			query = query.Joins("JOIN pricing_categories ON pricing_categories.id = subscription_plans.pricing_category_id")
		}
		query = query.Where("pricing_categories.checkout_type = ?", checkoutType)
	}

	if err := query.Order("subscription_plans.amount asc, subscription_plans.created_at asc").Find(&plans).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	hydrateSubscriptionPlanBundleIDs(lmsDB(c, ctrl.DB), plans)
	sendSuccess(c, plans, "Subscription plans retrieved successfully")
}

func (ctrl *LMSController) ListPaymentMethods(c *gin.Context) {
	amount, _ := strconv.ParseFloat(c.DefaultQuery("amount", "0"), 64)
	methods, err := services.BuildPaymentMethodOptions(lmsDB(c, ctrl.DB), amount)
	if err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccess(c, methods, "Payment methods retrieved successfully")
}

func (ctrl *LMSController) UpsertPricing(c *gin.Context) {
	var pricing model.SubscriptionPlan
	if err := c.ShouldBindJSON(&pricing); err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}
	db := lmsDB(c, ctrl.DB).WithContext(c)
	if pricing.ID == uuid.Nil {
		if err := db.Create(&pricing).Error; err != nil {
			sendInternalError(c, err)
			return
		}
		sendSuccess(c, pricing, "Pricing created successfully")
		return
	}
	if err := db.Model(&model.SubscriptionPlan{}).Where("id = ?", pricing.ID).Updates(pricing).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccess(c, pricing, "Pricing updated successfully")
}

func defaultCurrency(currency string) string {
	if currency == "" {
		return "IDR"
	}
	return currency
}

func defaultInterval(interval string) string {
	if interval == "" {
		return "month"
	}
	return interval
}

func addPlanInterval(base time.Time, interval string) time.Time {
	switch strings.ToLower(defaultInterval(interval)) {
	case "year", "yearly", "annual":
		return base.AddDate(1, 0, 0)
	case "week", "weekly":
		return base.AddDate(0, 0, 7)
	case "day", "daily":
		return base.AddDate(0, 0, 1)
	default:
		return base.AddDate(0, 1, 0)
	}
}

func planPeriodFrom(start time.Time, interval string) (time.Time, time.Time) {
	return start, addPlanInterval(start, interval)
}

func consolidateVisibleSubscriptionStacks(db *gorm.DB, userID uuid.UUID, now time.Time) error {
	var subscriptions []model.Subscription
	if err := db.
		Where("parent_id = ? OR student_id = ?", userID, userID).
		Order("current_period_end DESC").
		Order("created_at DESC").
		Find(&subscriptions).Error; err != nil {
		return err
	}

	scopes := map[string]model.Subscription{}
	for _, subscription := range subscriptions {
		scope := subscription.ParentID.String() + ":" + subscription.StudentID.String() + ":"
		if subscription.CourseID != nil {
			scope += subscription.CourseID.String()
		}
		if _, exists := scopes[scope]; exists {
			continue
		}
		scopes[scope] = subscription
	}

	for _, subscription := range scopes {
		courseID := subscription.CourseID
		if err := ConsolidateSubscriptionStack(db, subscription.ParentID, subscription.StudentID, courseID, now); err != nil {
			return err
		}
	}
	return nil
}

func applyPendingDowngradeIfDue(db *gorm.DB, subscription *model.Subscription, now time.Time) error {
	if subscription.PendingChangeType != "downgrade" || subscription.PendingProviderPlanID == "" {
		return nil
	}
	if subscription.CurrentPeriodEnd == nil || subscription.CurrentPeriodEnd.After(now) {
		return nil
	}

	periodStart := *subscription.CurrentPeriodEnd
	periodEnd := addPlanInterval(periodStart, subscription.PendingInterval)
	updates := ClearPendingSubscriptionChange()
	updates["status"] = model.SubscriptionStatusActive
	updates["provider_plan_id"] = subscription.PendingProviderPlanID
	if pendingPlanID, err := uuid.Parse(subscription.PendingProviderPlanID); err == nil {
		updates["plan_id"] = &pendingPlanID
	}
	updates["amount"] = subscription.PendingAmount
	updates["currency"] = defaultCurrency(subscription.PendingCurrency)
	updates["interval"] = defaultInterval(subscription.PendingInterval)
	updates["current_period_start"] = &periodStart
	if strings.ToLower(subscription.PendingInterval) == "lifetime" {
		updates["current_period_end"] = nil
	} else {
		updates["current_period_end"] = &periodEnd
	}
	updates["cancel_at_period_end"] = false

	if err := db.Model(subscription).Updates(updates).Error; err != nil {
		return err
	}
	subscription.Status = model.SubscriptionStatusActive
	subscription.ProviderPlanID = updates["provider_plan_id"].(string)
	subscription.Amount = updates["amount"].(float64)
	subscription.Currency = updates["currency"].(string)
	subscription.Interval = updates["interval"].(string)
	subscription.CurrentPeriodStart = &periodStart
	if strings.ToLower(subscription.PendingInterval) == "lifetime" {
		subscription.CurrentPeriodEnd = nil
	} else {
		subscription.CurrentPeriodEnd = &periodEnd
	}
	subscription.CancelAtPeriodEnd = false
	subscription.PendingChangeType = ""
	subscription.PendingProviderPlanID = ""
	subscription.PendingAmount = 0
	subscription.PendingCurrency = ""
	subscription.PendingInterval = ""
	subscription.PendingChangeAt = nil
	return nil
}

func paidSubscriptionUpdates(subscription model.Subscription, paidAt time.Time) map[string]interface{} {
	if subscription.PendingChangeType == "upgrade" && subscription.PendingProviderPlanID != "" {
		periodStart, periodEnd := planPeriodFrom(paidAt, subscription.PendingInterval)
		updates := ClearPendingSubscriptionChange()
		updates["status"] = model.SubscriptionStatusActive
		updates["provider_plan_id"] = subscription.PendingProviderPlanID
		if pendingPlanID, err := uuid.Parse(subscription.PendingProviderPlanID); err == nil {
			updates["plan_id"] = &pendingPlanID
		}
		updates["amount"] = subscription.PendingAmount
		updates["currency"] = defaultCurrency(subscription.PendingCurrency)
		updates["interval"] = defaultInterval(subscription.PendingInterval)
		updates["current_period_start"] = &periodStart
		if strings.ToLower(subscription.PendingInterval) == "lifetime" {
			updates["current_period_end"] = nil
		} else {
			updates["current_period_end"] = &periodEnd
		}
		updates["cancel_at_period_end"] = false
		return updates
	}

	periodStart, periodEnd := extendSubscriptionPeriod(subscription, paidAt)
	updates := ClearPendingSubscriptionChange()
	updates["status"] = model.SubscriptionStatusActive
	updates["current_period_start"] = &periodStart
	if strings.ToLower(subscription.Interval) == "lifetime" {
		updates["current_period_end"] = nil
	} else {
		updates["current_period_end"] = &periodEnd
	}
	updates["cancel_at_period_end"] = false
	return updates
}

func (ctrl *LMSController) syncLMSPaymentWithXendit(c *gin.Context, payment *model.LMSPayment) error {
	if payment.Status != model.LMSPaymentPending || payment.TransactionID == "" {
		return nil
	}

	remoteStatus, err := services.GetXenditPaymentStatus(payment.TransactionID)
	if err != nil {
		return err
	}

	db := lmsDB(c, ctrl.DB).WithContext(c)
	switch strings.ToUpper(remoteStatus) {
	case "PAID", "SETTLED", "SUCCEEDED":
		now := time.Now()
		if err := processLMSPaymentSuccess(db, payment, now); err != nil {
			return err
		}
	case "FAILED", "VOIDED", "EXPIRED":
		if err := db.Model(payment).Update("status", model.LMSPaymentExpired).Error; err != nil {
			return err
		}
		payment.Status = model.LMSPaymentExpired
	}
	return nil
}

func (ctrl *LMSController) CreateSubscription(c *gin.Context) {
	var subscription model.Subscription
	if err := c.ShouldBindJSON(&subscription); err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}
	if subscription.Status == "" {
		subscription.Status = model.SubscriptionStatusActive
	}
	if subscription.CurrentPeriodStart == nil {
		now := time.Now()
		subscription.CurrentPeriodStart = &now
	}
	if subscription.CurrentPeriodEnd == nil {
		end := subscription.CurrentPeriodStart.AddDate(0, 1, 0)
		subscription.CurrentPeriodEnd = &end
	}
	if err := lmsDB(c, ctrl.DB).WithContext(c).Create(&subscription).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccess(c, subscription, "Subscription created successfully")
}

func (ctrl *LMSController) CancelSubscription(c *gin.Context) {
	id, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	now := time.Now()
	err := lmsDB(c, ctrl.DB).Model(&model.Subscription{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status":               model.SubscriptionStatusCanceled,
		"cancel_at_period_end": true,
		"canceled_at":          &now,
	}).Error
	if err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccessNoData(c)
}

func (ctrl *LMSController) CreatePaymentRecord(c *gin.Context) {
	var payment model.LMSPayment
	if err := c.ShouldBindJSON(&payment); err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}
	if payment.Status == "" {
		payment.Status = model.LMSPaymentPending
	}
	if err := lmsDB(c, ctrl.DB).WithContext(c).Create(&payment).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccess(c, payment, "Payment record created successfully")
}

func (ctrl *LMSController) MarkLessonProgress(c *gin.Context) {
	var progress model.StudentProgress
	if err := c.ShouldBindJSON(&progress); err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}
	if progress.IsCompleted && progress.CompletedAt == nil {
		now := time.Now()
		progress.CompletedAt = &now
		progress.ProgressPercent = 100
	}
	db := lmsDB(c, ctrl.DB).WithContext(c)
	var existing model.StudentProgress
	err := db.Where("student_id = ? AND lesson_id = ?", progress.StudentID, progress.LessonID).First(&existing).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		if err := db.Create(&progress).Error; err != nil {
			sendInternalError(c, err)
			return
		}
		sendSuccess(c, progress, "Progress created successfully")
		return
	}
	if err != nil {
		sendInternalError(c, err)
		return
	}
	progress.ID = existing.ID
	if err := db.Model(&existing).Updates(progress).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccess(c, progress, "Progress updated successfully")
}

func (ctrl *LMSController) CheckLearningAccess(c *gin.Context) {
	studentID, err := uuid.Parse(c.Query("student_id"))
	if err != nil {
		sendBadRequest(c, "student_id is required", nil)
		return
	}
	now := time.Now()
	var count int64
	err = lmsDB(c, ctrl.DB).Model(&model.Subscription{}).
		Where("student_id = ? AND status = ? AND (current_period_end IS NULL OR current_period_end >= ?)", studentID, model.SubscriptionStatusActive, now).
		Count(&count).Error
	if err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccess(c, gin.H{"has_access": count > 0}, "Learning access checked successfully")
}

func (ctrl *LMSController) hasCourseAccess(c *gin.Context, courseID uuid.UUID) bool {
	userID, role, ok := currentLMSUser(c)
	if !ok {
		return false
	}
	// Admin / SuperAdmin
	if role >= 99 {
		return true
	}
	db := lmsDB(c, ctrl.DB)
	// Mentor of this course
	if role == 30 {
		var count int64
		if err := db.Table("course_mentors").Where("course_id = ? AND mentor_id = ?", courseID, userID).Count(&count).Error; err == nil && count > 0 {
			return true
		}
	}

	// Student (role == 20) or Parent (role == 10)
	// 1. Check active subscription
	now := time.Now()
	var subscriptions []model.Subscription
	err := db.Model(&model.Subscription{}).
		Where("student_id = ?", userID).
		Where("status IN ?", []model.SubscriptionStatus{
			model.SubscriptionStatusActive,
			model.SubscriptionStatusTrialing,
		}).
		Where("(current_period_end IS NULL OR current_period_end >= ?)", now).
		Find(&subscriptions).Error
	if err == nil {
		for _, sub := range subscriptions {
			granted, err := subscriptionGrantsCourse(db, sub, courseID)
			if err == nil && granted {
				return true
			}
		}
	}

	// 2. Check individual purchase (LMSPayment paid)
	var paymentCount int64
	if err := db.Model(&model.LMSPayment{}).
		Where("student_id = ? AND status = ? AND course_id = ?", userID, model.LMSPaymentPaid, courseID).
		Count(&paymentCount).Error; err == nil && paymentCount > 0 {
		return true
	}

	// 3. Check individual purchase (CoursePurchase paid)
	var purchaseCount int64
	if err := db.Model(&model.CoursePurchase{}).
		Where("student_id = ? AND status = ? AND course_id = ?", userID, model.PurchasePaid, courseID).
		Count(&purchaseCount).Error; err == nil && purchaseCount > 0 {
		return true
	}

	// 4. Check if course is free and sell individual
	var course model.Course
	if err := db.First(&course, "id = ?", courseID).Error; err == nil {
		if course.SellIndividual && course.Price <= 0 {
			return true
		}
	}

	return false
}

func (ctrl *LMSController) isCourseMentor(db *gorm.DB, userID uuid.UUID, courseID uuid.UUID) (bool, error) {
	var count int64
	if err := db.Table("course_mentors").Where("course_id = ? AND mentor_id = ?", courseID, userID).Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

func (ctrl *LMSController) checkCoursePermission(c *gin.Context, db *gorm.DB, courseID uuid.UUID) (bool, string) {
	userID, role, ok := currentLMSUser(c)
	if !ok {
		return false, "Unauthorized"
	}
	if role >= 99 {
		return true, ""
	}
	if role == 30 {
		isMentor, err := ctrl.isCourseMentor(db, userID, courseID)
		if err != nil {
			return false, "Error checking permission: " + err.Error()
		}
		if !isMentor {
			return false, "Forbidden: You are not authorized to manage content for this course"
		}
		return true, ""
	}
	return false, "Forbidden: Insufficient permissions"
}

func (ctrl *LMSController) checkResourcePermission(c *gin.Context, db *gorm.DB, resource string, id uuid.UUID) (bool, string) {
	userID, role, ok := currentLMSUser(c)
	if !ok {
		return false, "Unauthorized"
	}
	if role >= 99 {
		return true, ""
	}
	if role != 30 {
		return false, "Forbidden: Insufficient permissions"
	}

	var courseID uuid.UUID
	switch resource {
	case "modules":
		err := db.Table("modules").Select("course_id").Where("id = ?", id).Row().Scan(&courseID)
		if err != nil {
			return false, "Module not found"
		}
	case "lessons":
		err := db.Table("lessons").
			Select("modules.course_id").
			Joins("JOIN modules ON modules.id = lessons.module_id").
			Where("lessons.id = ?", id).
			Row().Scan(&courseID)
		if err != nil {
			return false, "Lesson not found"
		}
	case "learning-assets":
		err := db.Table("learning_assets").
			Select("modules.course_id").
			Joins("JOIN lessons ON lessons.id = learning_assets.lesson_id").
			Joins("JOIN modules ON modules.id = lessons.module_id").
			Where("learning_assets.id = ?", id).
			Row().Scan(&courseID)
		if err != nil {
			return false, "Learning asset not found"
		}
	default:
		return false, "Forbidden: Insufficient permissions"
	}

	isMentor, err := ctrl.isCourseMentor(db, userID, courseID)
	if err != nil {
		return false, "Error checking permission: " + err.Error()
	}
	if !isMentor {
		return false, "Forbidden: You are not authorized to manage content for this course"
	}
	return true, ""
}

func syncCourseBundleCount(db *gorm.DB, bundleID uuid.UUID) {
	if bundleID == uuid.Nil {
		return
	}
	var count int64
	db.Model(&model.CourseBundleItem{}).Where("bundle_id = ? AND deleted_at IS NULL", bundleID).Count(&count)
	_ = db.Model(&model.CourseBundle{}).Where("id = ?", bundleID).Update("course_count", count).Error
}
