package controller

import (
	"fmt"
	"gin-template/model"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

func generateSlug(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	reg := regexp.MustCompile(`[^a-z0-9]+`)
	s = reg.ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")
	if s == "" {
		s = "item-" + uuid.New().String()[:8]
	}
	return s
}

var validTargetRoles = map[string]bool{
	"student": true,
	"mentor":  true,
	"parent":  true,
}

func isValidTargetRole(role string) bool {
	return validTargetRoles[strings.ToLower(strings.TrimSpace(role))]
}

func sanitizeTargetRoles(roles []string) []string {
	roleMap := make(map[string]bool)
	var result []string
	for _, r := range roles {
		clean := strings.ToLower(strings.TrimSpace(r))
		if isValidTargetRole(clean) && !roleMap[clean] {
			roleMap[clean] = true
			result = append(result, clean)
		}
	}
	return result
}

func getUserTargetRoleNames(db *gorm.DB, userID uuid.UUID, roleInt int) []string {
	rolesMap := make(map[string]bool)

	switch roleInt {
	case 10:
		rolesMap["parent"] = true
	case 20:
		rolesMap["student"] = true
	case 30, 40:
		rolesMap["mentor"] = true
	}

	if userID != uuid.Nil {
		var userRoles []model.UserRole
		if err := db.Where("user_id = ?", userID).Find(&userRoles).Error; err == nil {
			for _, ur := range userRoles {
				roleStr := strings.ToLower(strings.TrimSpace(string(ur.Role)))
				if isValidTargetRole(roleStr) {
					rolesMap[roleStr] = true
				}
			}
		}
	}

	var result []string
	for r := range rolesMap {
		result = append(result, r)
	}
	return result
}

func isInternalMentor(db *gorm.DB, userID uuid.UUID, roleInt int) bool {
	if roleInt != model.RoleMentor || userID == uuid.Nil {
		return false
	}

	var mentorType string
	if err := db.Model(&model.User{}).
		Where("id = ?", userID).
		Pluck("mentor_type", &mentorType).Error; err != nil {
		return false
	}

	return strings.EqualFold(strings.TrimSpace(mentorType), "internal")
}

func scopeCourseCategoriesForUser(db, query *gorm.DB, userID uuid.UUID, roleInt int) (*gorm.DB, error) {
	if userID == uuid.Nil || roleInt >= model.RoleAdmin || isInternalMentor(db, userID, roleInt) {
		return query, nil
	}

	hasAllAccess, subscribedCourseIDs, err := activeUserSubscriptionCourseScope(db, userID, roleInt, time.Now())
	if err != nil {
		return nil, err
	}
	if hasAllAccess {
		return query, nil
	}

	userRoles := getUserTargetRoleNames(db, userID, roleInt)
	subscribedIDs := make([]uuid.UUID, 0, len(subscribedCourseIDs))
	for courseID := range subscribedCourseIDs {
		subscribedIDs = append(subscribedIDs, courseID)
	}

	switch {
	case len(userRoles) > 0 && len(subscribedIDs) > 0:
		return query.Where(
			"(course_categories.id IN (SELECT course_category_id FROM course_category_target_roles WHERE role IN ?) "+
				"OR course_categories.id IN (SELECT course_category_id FROM courses WHERE id IN ?))",
			userRoles,
			subscribedIDs,
		), nil
	case len(userRoles) > 0:
		return query.Where(
			"course_categories.id IN (SELECT course_category_id FROM course_category_target_roles WHERE role IN ?)",
			userRoles,
		), nil
	case len(subscribedIDs) > 0:
		return query.Where(
			"course_categories.id IN (SELECT course_category_id FROM courses WHERE id IN ?)",
			subscribedIDs,
		), nil
	default:
		return query.Where("1 = 0"), nil
	}
}

func scopeCoursesForUser(db, query *gorm.DB, userID uuid.UUID, roleInt int) (*gorm.DB, error) {
	if roleInt >= model.RoleAdmin || isInternalMentor(db, userID, roleInt) {
		return query, nil
	}

	hasAllAccess, subscribedCourseIDs, err := activeUserSubscriptionCourseScope(db, userID, roleInt, time.Now())
	if err != nil {
		return nil, err
	}
	if hasAllAccess {
		return query, nil
	}

	userRoles := getUserTargetRoleNames(db, userID, roleInt)
	subscribedIDs := make([]uuid.UUID, 0, len(subscribedCourseIDs))
	for courseID := range subscribedCourseIDs {
		subscribedIDs = append(subscribedIDs, courseID)
	}

	switch {
	case len(userRoles) > 0 && len(subscribedIDs) > 0:
		return query.Where(
			"((courses.id IN (SELECT course_id FROM course_target_roles WHERE role IN ?) "+
				"AND courses.course_category_id IN (SELECT course_category_id FROM course_category_target_roles WHERE role IN ?)) "+
				"OR courses.id IN ?)",
			userRoles,
			userRoles,
			subscribedIDs,
		), nil
	case len(userRoles) > 0:
		return query.Where(
			"courses.id IN (SELECT course_id FROM course_target_roles WHERE role IN ?) "+
				"AND courses.course_category_id IN (SELECT course_category_id FROM course_category_target_roles WHERE role IN ?)",
			userRoles,
			userRoles,
		), nil
	case len(subscribedIDs) > 0:
		return query.Where("courses.id IN ?", subscribedIDs), nil
	default:
		return query.Where("1 = 0"), nil
	}
}

func getCourseCategoryTargetRoles(db *gorm.DB, categoryID uuid.UUID) []string {
	var categoryRoles []model.CourseCategoryTargetRole
	if err := db.Where("course_category_id = ?", categoryID).Find(&categoryRoles).Error; err != nil {
		return []string{}
	}
	var result []string
	for _, r := range categoryRoles {
		result = append(result, r.Role)
	}
	return result
}

func setCourseCategoryTargetRoles(tx *gorm.DB, categoryID uuid.UUID, tenantID *uuid.UUID, roles []string) error {
	cleanRoles := sanitizeTargetRoles(roles)
	if len(cleanRoles) == 0 {
		return fmt.Errorf("minimal satu target role wajib dipilih untuk Course Category")
	}

	if err := tx.Unscoped().Where("course_category_id = ?", categoryID).Delete(&model.CourseCategoryTargetRole{}).Error; err != nil {
		return err
	}

	for _, role := range cleanRoles {
		item := model.CourseCategoryTargetRole{
			ID:               uuid.New(),
			CourseCategoryID: categoryID,
			Role:             role,
			TenantID:         tenantID,
		}
		if err := tx.Create(&item).Error; err != nil {
			return err
		}
	}
	return nil
}

func getCourseTargetRoles(db *gorm.DB, courseID uuid.UUID) []string {
	var courseRoles []model.CourseTargetRole
	if err := db.Where("course_id = ?", courseID).Find(&courseRoles).Error; err != nil {
		return []string{}
	}
	var result []string
	for _, r := range courseRoles {
		result = append(result, r.Role)
	}
	return result
}

func setCourseTargetRoles(tx *gorm.DB, courseID uuid.UUID, tenantID *uuid.UUID, roles []string) error {
	cleanRoles := sanitizeTargetRoles(roles)
	if len(cleanRoles) == 0 {
		return fmt.Errorf("minimal satu target role wajib dipilih untuk Course")
	}

	if err := tx.Unscoped().Where("course_id = ?", courseID).Delete(&model.CourseTargetRole{}).Error; err != nil {
		return err
	}

	for _, role := range cleanRoles {
		item := model.CourseTargetRole{
			ID:       uuid.New(),
			CourseID: courseID,
			Role:     role,
			TenantID: tenantID,
		}
		if err := tx.Create(&item).Error; err != nil {
			return err
		}
	}
	return nil
}

func validateCourseTargetRolesAgainstCategory(db *gorm.DB, categoryID uuid.UUID, courseRoles []string) (bool, string) {
	cleanCourseRoles := sanitizeTargetRoles(courseRoles)
	if len(cleanCourseRoles) == 0 {
		return false, "Minimal satu target role wajib dipilih untuk Course"
	}
	if categoryID == uuid.Nil {
		return false, "Course Category wajib dipilih"
	}

	categoryRoles := getCourseCategoryTargetRoles(db, categoryID)
	if len(categoryRoles) == 0 {
		return false, "Course Category belum memiliki target role"
	}

	catRoleMap := make(map[string]bool)
	for _, r := range categoryRoles {
		catRoleMap[r] = true
	}

	for _, r := range cleanCourseRoles {
		if !catRoleMap[r] {
			return false, fmt.Sprintf("Target role '%s' tidak tersedia pada Course Category ini", r)
		}
	}
	return true, ""
}

func syncCoursesForCategoryRoleUpdate(tx *gorm.DB, categoryID uuid.UUID, newCatRoles []string) error {
	cleanCatRoles := sanitizeTargetRoles(newCatRoles)
	newCatMap := make(map[string]bool)
	for _, r := range cleanCatRoles {
		newCatMap[r] = true
	}

	var courses []model.Course
	if err := tx.Where("course_category_id = ?", categoryID).Find(&courses).Error; err != nil {
		return err
	}

	for _, course := range courses {
		var courseRoles []model.CourseTargetRole
		if err := tx.Where("course_id = ?", course.ID).Find(&courseRoles).Error; err != nil {
			return err
		}

		validCount := 0
		for _, cr := range courseRoles {
			if !newCatMap[cr.Role] {
				if err := tx.Unscoped().Delete(&cr).Error; err != nil {
					return err
				}
			} else {
				validCount++
			}
		}

		if validCount == 0 {
			if err := tx.Model(&model.Course{}).Where("id = ?", course.ID).Update("status", model.CourseStatusDraft).Error; err != nil {
				return err
			}
		}
	}
	return nil
}

func userCanAccessCourseTargetRoles(db *gorm.DB, userID uuid.UUID, roleInt int, courseID uuid.UUID, categoryID uuid.UUID) bool {
	if roleInt >= 99 {
		return true
	}
	userRoles := getUserTargetRoleNames(db, userID, roleInt)
	if len(userRoles) == 0 {
		return false
	}

	courseRoles := getCourseTargetRoles(db, courseID)
	categoryRoles := getCourseCategoryTargetRoles(db, categoryID)

	courseRoleMatch := false
	for _, ur := range userRoles {
		for _, cr := range courseRoles {
			if ur == cr {
				courseRoleMatch = true
				break
			}
		}
		if courseRoleMatch {
			break
		}
	}

	if !courseRoleMatch {
		return false
	}

	categoryRoleMatch := false
	for _, ur := range userRoles {
		for _, catR := range categoryRoles {
			if ur == catR {
				categoryRoleMatch = true
				break
			}
		}
		if categoryRoleMatch {
			break
		}
	}

	return categoryRoleMatch
}
