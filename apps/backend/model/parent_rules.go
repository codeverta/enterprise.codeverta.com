package model

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type PlanRules struct {
	CanCreateCourse             bool        `json:"can_create_course"`
	CreateRequirement           string      `json:"create_requirement,omitempty"`
	MinCompletedCoursesToCreate int         `json:"min_completed_courses_to_create,omitempty"`
	CreateRequiredCourseIDs     []uuid.UUID `json:"create_required_course_ids,omitempty"`
	CanSellCourse               *bool       `json:"can_sell_course,omitempty"`
	MinCoursesToSell            int         `json:"min_courses_to_sell,omitempty"`
	MinLessonsToSell            int         `json:"min_lessons_to_sell"`
	SellRequirement             string      `json:"sell_requirement,omitempty"`
	MinCompletedCoursesToSell   int         `json:"min_completed_courses_to_sell,omitempty"`
	SellRequiredCourseIDs       []uuid.UUID `json:"sell_required_course_ids,omitempty"`

	// Legacy fields remain readable so existing plans keep their behaviour.
	RequireModulesCompletion bool        `json:"require_modules_completion,omitempty"`
	RequiredCourseIDs        []uuid.UUID `json:"required_course_ids,omitempty"`

	// LegacyMinVideosToSell keeps plans saved before the lesson-based rule
	// compatible. New writes must use min_lessons_to_sell.
	LegacyMinVideosToSell int `json:"min_videos_to_sell,omitempty"`
}

const (
	CourseRequirementNone     = "none"
	CourseRequirementAll      = "all"
	CourseRequirementMinimum  = "minimum"
	CourseRequirementSelected = "selected"
)

func (rules *PlanRules) AllowsSelling() bool {
	if rules == nil {
		return false
	}
	if rules.CanSellCourse != nil {
		return *rules.CanSellCourse
	}
	return rules.CanCreateCourse
}

func normalizeRequirement(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case CourseRequirementAll, CourseRequirementMinimum, CourseRequirementSelected:
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return CourseRequirementNone
	}
}

func deduplicateCourseIDs(values []uuid.UUID) []uuid.UUID {
	seen := make(map[uuid.UUID]bool, len(values))
	result := make([]uuid.UUID, 0, len(values))
	for _, courseID := range values {
		if courseID != uuid.Nil && !seen[courseID] {
			seen[courseID] = true
			result = append(result, courseID)
		}
	}
	return result
}

func (rules *PlanRules) normalize() {
	rules.CreateRequiredCourseIDs = deduplicateCourseIDs(rules.CreateRequiredCourseIDs)
	rules.SellRequiredCourseIDs = deduplicateCourseIDs(rules.SellRequiredCourseIDs)
	rules.RequiredCourseIDs = deduplicateCourseIDs(rules.RequiredCourseIDs)

	rules.CreateRequirement = normalizeRequirement(rules.CreateRequirement)
	if rules.CreateRequirement == CourseRequirementSelected && len(rules.CreateRequiredCourseIDs) == 0 {
		rules.CreateRequirement = CourseRequirementNone
	}

	if strings.TrimSpace(rules.SellRequirement) == "" {
		switch {
		case rules.RequireModulesCompletion:
			rules.SellRequirement = CourseRequirementAll
		case len(rules.RequiredCourseIDs) > 0:
			rules.SellRequirement = CourseRequirementSelected
			rules.SellRequiredCourseIDs = rules.RequiredCourseIDs
		default:
			rules.SellRequirement = CourseRequirementNone
		}
	} else {
		rules.SellRequirement = normalizeRequirement(rules.SellRequirement)
	}
	if rules.SellRequirement == CourseRequirementSelected && len(rules.SellRequiredCourseIDs) == 0 {
		rules.SellRequirement = CourseRequirementNone
	}
}

func normalizeRuleCheckoutType(value string) string {
	return strings.ReplaceAll(strings.ToLower(strings.TrimSpace(value)), "_", "-")
}

// NormalizeSellerCheckoutType keeps checkout type comparisons consistent across
// controllers, middleware, and older records that used underscores.
func NormalizeSellerCheckoutType(value string) string {
	return normalizeRuleCheckoutType(value)
}

func IsParentExternalPlan(plan *SubscriptionPlan) bool {
	return plan != nil && plan.PricingCategory != nil &&
		normalizeRuleCheckoutType(plan.PricingCategory.CheckoutType) == "parent-external"
}

func checkoutTypeCanGrantSellerRules(checkoutType string, role int) bool {
	checkoutType = normalizeRuleCheckoutType(checkoutType)
	switch role {
	case RoleParent:
		return checkoutType == "parent" || checkoutType == "parent-external" || checkoutType == "parent-child"
	case RoleGuruExternal:
		return checkoutType == "teacher" || checkoutType == "mentor-external" || checkoutType == "teacher-external"
	default:
		return false
	}
}

// GetCourseSellerActiveRules evaluates active plan rules for parent and external mentor sellers.
func GetCourseSellerActiveRules(db *gorm.DB, userID uuid.UUID, role int) (*PlanRules, *SubscriptionPlan, error) {
	var subscriptions []Subscription
	now := time.Now()
	err := db.Preload("Plan").
		Preload("Plan.PricingCategory").
		Where("(parent_id = ? OR student_id = ?) AND status IN ?", userID, userID, []SubscriptionStatus{SubscriptionStatusActive, SubscriptionStatusTrialing}).
		Where("(current_period_end IS NULL OR current_period_end >= ?)", now).
		Order("created_at DESC").
		Find(&subscriptions).Error
	if err != nil {
		return nil, nil, err
	}

	var fallbackRules *PlanRules
	var fallbackPlan *SubscriptionPlan
	hasSellerPlan := false

	for _, sub := range subscriptions {
		// provider_plan_id is the canonical current plan after an upgrade. Older
		// subscription rows may still have a stale plan_id, so resolve the current
		// UUID first and only fall back to the preloaded relation when necessary.
		activePlan := sub.Plan
		if providerPlanID, parseErr := uuid.Parse(strings.TrimSpace(sub.ProviderPlanID)); parseErr == nil && providerPlanID != uuid.Nil {
			if activePlan == nil || activePlan.ID != providerPlanID {
				var providerPlan SubscriptionPlan
				if findErr := db.Preload("PricingCategory").First(&providerPlan, "id = ?", providerPlanID).Error; findErr == nil {
					activePlan = &providerPlan
				}
			}
		}

		if activePlan != nil && activePlan.PricingCategory != nil && checkoutTypeCanGrantSellerRules(activePlan.PricingCategory.CheckoutType, role) {
			hasSellerPlan = true
			var parsed struct {
				Rules PlanRules `json:"rules"`
			}
			if len(activePlan.FeatureMeta) > 0 {
				_ = json.Unmarshal(activePlan.FeatureMeta, &parsed)
			}
			if parsed.Rules.MinLessonsToSell == 0 && parsed.Rules.LegacyMinVideosToSell > 0 {
				parsed.Rules.MinLessonsToSell = parsed.Rules.LegacyMinVideosToSell
			}
			if activePlan.Slug == "legacy-contributor" {
				parsed.Rules.MinLessonsToSell = 5
			}

			parsed.Rules.normalize()

			if parsed.Rules.CanCreateCourse {
				return &parsed.Rules, activePlan, nil
			}
			if fallbackRules == nil {
				rulesCopy := parsed.Rules
				fallbackRules = &rulesCopy
				fallbackPlan = activePlan
			}
		}
	}

	if !hasSellerPlan {
		return nil, nil, nil
	}

	return fallbackRules, fallbackPlan, nil
}

// GetParentActiveRules is kept for existing parent dashboard integrations.
func GetParentActiveRules(db *gorm.DB, userID uuid.UUID) (*PlanRules, *SubscriptionPlan, error) {
	return GetCourseSellerActiveRules(db, userID, RoleParent)
}

func planCourseIDs(db *gorm.DB, plan *SubscriptionPlan) ([]uuid.UUID, error) {
	if plan == nil {
		return nil, nil
	}
	bundleIDs, err := SubscriptionPlanBundleIDs(db, plan.ID, plan.BundleID)
	if err != nil || len(bundleIDs) == 0 {
		return nil, err
	}
	return BundleCourseIDs(db, bundleIDs)
}

func completedCourseCount(db *gorm.DB, userID uuid.UUID, courseIDs []uuid.UUID) int {
	completed := 0
	for _, courseID := range deduplicateCourseIDs(courseIDs) {
		if CheckCourseCompleted(db, userID, courseID) {
			completed++
		}
	}
	return completed
}

func checkCompletionRequirement(db *gorm.DB, userID uuid.UUID, plan *SubscriptionPlan, mode string, minimum int, selected []uuid.UUID) (bool, string, error) {
	switch normalizeRequirement(mode) {
	case CourseRequirementAll:
		courseIDs, err := planCourseIDs(db, plan)
		if err != nil {
			return false, "", err
		}
		if len(courseIDs) == 0 || completedCourseCount(db, userID, courseIDs) != len(courseIDs) {
			return false, "Selesaikan semua course dalam paket", nil
		}
	case CourseRequirementMinimum:
		courseIDs, err := planCourseIDs(db, plan)
		if err != nil {
			return false, "", err
		}
		completed := completedCourseCount(db, userID, courseIDs)
		if minimum > 0 && completed < minimum {
			return false, fmt.Sprintf("Selesaikan minimal %d course dalam paket (%d/%d selesai)", minimum, completed, minimum), nil
		}
	case CourseRequirementSelected:
		for _, courseID := range deduplicateCourseIDs(selected) {
			if !CheckCourseCompleted(db, userID, courseID) {
				return false, "Selesaikan semua course yang ditentukan", nil
			}
		}
	}
	return true, "", nil
}

// CheckCourseCreationRequirements controls access to creating a new course.
func CheckCourseCreationRequirements(db *gorm.DB, userID uuid.UUID, rules *PlanRules, plan *SubscriptionPlan) (bool, string, error) {
	if rules == nil || plan == nil || !rules.CanCreateCourse {
		return false, "Paket Anda tidak mendukung fitur tambah course", nil
	}
	return checkCompletionRequirement(db, userID, plan, rules.CreateRequirement, rules.MinCompletedCoursesToCreate, rules.CreateRequiredCourseIDs)
}

// CheckCourseSellerRequirements is the backend source of truth for publishing
// and selling standalone courses.
func CheckCourseSellerRequirements(db *gorm.DB, userID uuid.UUID, rules *PlanRules, plan *SubscriptionPlan) (bool, string, error) {
	if rules == nil || plan == nil || !rules.AllowsSelling() {
		return false, "Paket Anda tidak mendukung penjualan course satuan", nil
	}

	reasons := make([]string, 0, 4)
	var authoredCourseIDs []uuid.UUID
	if err := db.Table("course_mentors").Where("mentor_id = ?", userID).Pluck("course_id", &authoredCourseIDs).Error; err != nil {
		return false, "", err
	}
	if rules.MinCoursesToSell > 0 && len(deduplicateCourseIDs(authoredCourseIDs)) < rules.MinCoursesToSell {
		reasons = append(reasons, fmt.Sprintf("Buat minimal %d course terlebih dahulu", rules.MinCoursesToSell))
	}

	if rules.MinLessonsToSell > 0 {
		var highestLessonCount int64
		for _, courseID := range authoredCourseIDs {
			var lessonCount int64
			if err := db.Model(&Lesson{}).
				Joins("JOIN modules ON modules.id = lessons.module_id AND modules.deleted_at IS NULL").
				Where("modules.course_id = ?", courseID).
				Count(&lessonCount).Error; err != nil {
				return false, "", err
			}
			if lessonCount > highestLessonCount {
				highestLessonCount = lessonCount
			}
		}
		if highestLessonCount < int64(rules.MinLessonsToSell) {
			reasons = append(reasons, fmt.Sprintf("Miliki course dengan minimal %d lesson", rules.MinLessonsToSell))
		}
	}

	completed, reason, err := checkCompletionRequirement(db, userID, plan, rules.SellRequirement, rules.MinCompletedCoursesToSell, rules.SellRequiredCourseIDs)
	if err != nil {
		return false, "", err
	}
	if !completed {
		reasons = append(reasons, reason)
	}

	return len(reasons) == 0, strings.Join(reasons, ". "), nil
}

// CheckCourseCompleted requires every published lesson in a prerequisite course to be completed.
func CheckCourseCompleted(db *gorm.DB, userID uuid.UUID, courseID uuid.UUID) bool {
	var lessonIDs []uuid.UUID
	if err := db.Model(&Lesson{}).
		Joins("JOIN modules ON modules.id = lessons.module_id AND modules.deleted_at IS NULL").
		Where("modules.course_id = ? AND lessons.is_published = ?", courseID, true).
		Pluck("lessons.id", &lessonIDs).Error; err != nil || len(lessonIDs) == 0 {
		return false
	}

	var completedCount int64
	if err := db.Model(&StudentProgress{}).
		Where("student_id = ? AND lesson_id IN ? AND is_completed = ?", userID, lessonIDs, true).
		Count(&completedCount).Error; err != nil {
		return false
	}
	return completedCount == int64(len(lessonIDs))
}

// CheckBundleCompleted determines if a user has finished all courses, modules, and lessons inside a bundle.
func CheckBundleCompleted(db *gorm.DB, userID uuid.UUID, bundleID uuid.UUID) bool {
	var courseIDs []uuid.UUID
	if err := db.Model(&CourseBundleItem{}).Where("bundle_id = ?", bundleID).Pluck("course_id", &courseIDs).Error; err != nil || len(courseIDs) == 0 {
		return false
	}

	var moduleIDs []uuid.UUID
	if err := db.Model(&Module{}).Where("course_id IN ?", courseIDs).Pluck("id", &moduleIDs).Error; err != nil || len(moduleIDs) == 0 {
		return false
	}

	var lessonIDs []uuid.UUID
	if err := db.Model(&Lesson{}).Where("module_id IN ?", moduleIDs).Pluck("id", &lessonIDs).Error; err != nil || len(lessonIDs) == 0 {
		return false
	}

	var completedCount int64
	if err := db.Model(&StudentProgress{}).
		Where("student_id = ? AND lesson_id IN ? AND is_completed = ?", userID, lessonIDs, true).
		Count(&completedCount).Error; err != nil {
		return false
	}

	return completedCount == int64(len(lessonIDs))
}
