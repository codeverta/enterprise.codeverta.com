package controller

import (
	"errors"
	"fmt"
	"gin-template/model"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"os"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func (ctrl *LMSController) ListCourses(c *gin.Context) {
	db := lmsDB(c, ctrl.DB)

	// Gunakan optionalLMSUser agar aman untuk public access
	userID, roleValue := optionalLMSUser(c)
	isCourseOwnerRole := roleValue == model.RoleParent || roleValue == model.RoleMentor || roleValue == model.RoleGuruExternal

	// Log details to a file for debug
	if logFile, logErr := os.OpenFile("lms_debug.log", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666); logErr == nil {
		fmt.Fprintf(logFile, "[DEBUG ListCourses] userID: '%s', roleValue: %d\n", userID.String(), roleValue)
		logFile.Close()
	}
	fmt.Printf("[DEBUG ListCourses] userID: '%s', roleValue: %d\n", userID.String(), roleValue)

	query := db.Model(&model.Course{})

	if mentorID := c.Query("mentor_id"); mentorID != "" && mentorID != "ALL" {
		query = query.Joins("JOIN course_mentors cm ON cm.course_id = courses.id").Where("cm.mentor_id = ?", mentorID)
	} else if isCourseOwnerRole {
		query = query.Joins("JOIN course_mentors cm ON cm.course_id = courses.id").Where("cm.mentor_id = ?", userID)
	} else if roleValue >= model.RoleAdmin && c.Query("creator_scope") == "internal_mentors" {
		query = query.
			Joins("JOIN course_mentors cm ON cm.course_id = courses.id").
			Joins("JOIN users mentor_users ON mentor_users.id = cm.mentor_id AND mentor_users.deleted_at IS NULL").
			Where("mentor_users.role IN ?", []int{model.RoleMentor, model.RoleAdmin})
	}

	if search := c.Query("search"); search != "" {
		query = query.Where("(courses.title LIKE ? OR courses.description LIKE ? OR courses.short_description LIKE ?)", "%"+search+"%", "%"+search+"%", "%"+search+"%")
	}

	if categoryID := c.Query("course_category_id"); categoryID != "" && categoryID != "ALL" {
		query = query.Where("courses.course_category_id = ?", categoryID)
	}
	if status := c.Query("status"); status != "" && status != "ALL" {
		query = query.Where("courses.status = ?", status)
	} else if c.Query("include_drafts") != "true" && !isCourseOwnerRole {
		query = query.Where("courses.status = ?", model.CourseStatusPublished)
	}
	query = applyCourseListFilters(c, query)

	// Target roles control learner visibility. Course owners must still be able
	// to manage their assigned courses when the audience is student/parent.
	if roleValue < 99 && !isCourseOwnerRole {
		userRoles := getUserTargetRoleNames(db, userID, roleValue)
		if len(userRoles) > 0 {
			query = query.Where("(courses.id NOT IN (SELECT course_id FROM course_target_roles) OR courses.id IN (SELECT course_id FROM course_target_roles WHERE role IN ?))", userRoles)
		} else {
			// For public / unauthenticated / general student view:
			// Show all published courses that either have no target role restriction or target student/parent/public/all
			query = query.Where("(courses.id NOT IN (SELECT course_id FROM course_target_roles) OR courses.id IN (SELECT course_id FROM course_target_roles WHERE role IN ('student', 'parent', 'public', 'all', 'guest')))")
		}
	}

	var total int64
	countQuery := query.Session(&gorm.Session{})
	if err := countQuery.Model(&model.Course{}).Distinct("courses.id").Count(&total).Error; err != nil {
		sendInternalError(c, err)
		return
	}

	limit := parseLimit(c)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	if page < 1 {
		page = 1
	}
	totalPages := int((total + int64(limit) - 1) / int64(limit))
	offset := (page - 1) * limit

	var courses []model.Course
	orderClause := courseListOrder(c.Query("order"))
	if err := query.Preload("CourseCategory").
		Select("courses.*").
		Group("courses.id").
		Order(orderClause).
		Limit(limit).
		Offset(offset).
		Find(&courses).Error; err != nil {
		sendInternalError(c, err)
		return
	}

	// FIX: Ambil data Mentors secara terpisah dan preload Profile
	for i := range courses {
		var mentors []model.User
		if err := db.Table("users").
			Select("users.*").
			Joins("JOIN course_mentors ON course_mentors.mentor_id = users.id").
			Where("course_mentors.course_id = ? AND users.deleted_at IS NULL", courses[i].ID).
			Preload("Profile").
			Find(&mentors).Error; err == nil {
			courses[i].Mentors = mentors
		}
	}

	items := make([]gin.H, 0, len(courses))
	for _, course := range courses {
		items = append(items, courseWithStats(db, course, userID))
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Courses retrieved successfully",
		"data":    items,
		"pagination": gin.H{
			"page":        page,
			"limit":       limit,
			"total":       total,
			"total_pages": totalPages,
		},
	})
}

func applyCourseListFilters(c *gin.Context, query *gorm.DB) *gorm.DB {
	if level := strings.TrimSpace(c.Query("level")); level != "" && !strings.EqualFold(level, "all") {
		query = query.Where("courses.level = ?", level)
	}
	if ageRange := strings.TrimSpace(c.Query("age_range")); ageRange != "" && !strings.EqualFold(ageRange, "all") {
		query = query.Where("courses.age_range = ?", ageRange)
	}
	if ownerType := strings.TrimSpace(c.Query("owner_type")); ownerType != "" && !strings.EqualFold(ownerType, "all") {
		query = query.Where("courses.owner_type = ?", ownerType)
	}
	if sellIndividual := strings.TrimSpace(c.Query("sell_individual")); sellIndividual != "" {
		if parsed, err := strconv.ParseBool(sellIndividual); err == nil {
			query = query.Where("courses.sell_individual = ?", parsed)
		}
	}
	switch strings.ToLower(strings.TrimSpace(c.Query("availability"))) {
	case "individual":
		query = query.Where("courses.sell_individual = ?", true)
	case "subscription":
		query = query.Where("courses.sell_individual = ?", false)
	case "free":
		query = query.Where("courses.price = 0")
	case "paid":
		query = query.Where("courses.sell_individual = ? AND courses.price > 0", true)
	case "discounted":
		query = query.Where("courses.sell_individual = ? AND courses.discount_percent > 0", true)
	}
	if targetRole := strings.ToLower(strings.TrimSpace(c.Query("target_role"))); targetRole != "" && targetRole != "all" {
		query = query.Where(
			"EXISTS (SELECT 1 FROM course_target_roles ctr WHERE ctr.course_id = courses.id AND ctr.role = ?)",
			targetRole,
		)
	}
	if minPrice, err := strconv.ParseFloat(strings.TrimSpace(c.Query("min_price")), 64); err == nil && minPrice >= 0 {
		query = query.Where("courses.price * (1 - courses.discount_percent / 100) >= ?", minPrice)
	}
	if maxPrice, err := strconv.ParseFloat(strings.TrimSpace(c.Query("max_price")), 64); err == nil && maxPrice >= 0 {
		query = query.Where("courses.price * (1 - courses.discount_percent / 100) <= ?", maxPrice)
	}
	return query
}

func courseListOrder(order string) string {
	switch strings.ToLower(strings.TrimSpace(order)) {
	case "oldest":
		return "courses.created_at ASC"
	case "newest":
		return "courses.created_at DESC"
	case "popular":
		return "courses.view_count DESC, courses.created_at DESC"
	case "title_asc":
		return "courses.title ASC"
	case "title_desc":
		return "courses.title DESC"
	case "price_asc":
		return "courses.price * (1 - courses.discount_percent / 100) ASC, courses.title ASC"
	case "price_desc":
		return "courses.price * (1 - courses.discount_percent / 100) DESC, courses.title ASC"
	default:
		return "courses.sort_order ASC, courses.created_at DESC"
	}
}

func uniqueCourseSlug(db *gorm.DB, requested, title string, excludeID uuid.UUID) string {
	base := generateSlug(requested)
	if strings.TrimSpace(requested) == "" {
		base = generateSlug(title)
	}
	if len(base) > 190 {
		base = strings.Trim(base[:190], "-")
	}
	candidate := base
	for suffix := 2; suffix < 10000; suffix++ {
		var count int64
		query := db.Unscoped().Model(&model.Course{}).Where("slug = ?", candidate)
		if excludeID != uuid.Nil {
			query = query.Where("id <> ?", excludeID)
		}
		if err := query.Count(&count).Error; err == nil && count == 0 {
			return candidate
		}
		candidate = fmt.Sprintf("%s-%d", base, suffix)
	}
	return fmt.Sprintf("%s-%s", base, uuid.NewString()[:8])
}

func (ctrl *LMSController) GetCourseStats(c *gin.Context) {
	db := lmsDB(c, ctrl.DB)
	userID, roleValue := optionalLMSUser(c)

	query := db.Model(&model.Course{})

	if mentorID := c.Query("mentor_id"); mentorID != "" && mentorID != "ALL" {
		query = query.Joins("JOIN course_mentors cm ON cm.course_id = courses.id").Where("cm.mentor_id = ?", mentorID)
	} else if roleValue == model.RoleParent || roleValue == model.RoleMentor || roleValue == model.RoleGuruExternal {
		query = query.Joins("JOIN course_mentors cm ON cm.course_id = courses.id").Where("cm.mentor_id = ?", userID)
	} else if roleValue >= model.RoleAdmin && c.Query("creator_scope") == "internal_mentors" {
		query = query.
			Joins("JOIN course_mentors cm ON cm.course_id = courses.id").
			Joins("JOIN users mentor_users ON mentor_users.id = cm.mentor_id AND mentor_users.deleted_at IS NULL").
			Where("mentor_users.role IN ?", []int{model.RoleMentor, model.RoleAdmin})
	}

	if search := c.Query("search"); search != "" {
		query = query.Where("(courses.title LIKE ? OR courses.description LIKE ? OR courses.short_description LIKE ?)", "%"+search+"%", "%"+search+"%", "%"+search+"%")
	}
	query = applyCourseListFilters(c, query)

	if categoryID := c.Query("course_category_id"); categoryID != "" && categoryID != "ALL" {
		query = query.Where("courses.course_category_id = ?", categoryID)
	}

	var total int64
	var published int64
	var draft int64

	totalQuery := query.Session(&gorm.Session{})
	if roleValue != 30 && roleValue != 40 && c.Query("include_drafts") != "true" {
		totalQuery = totalQuery.Where("courses.status = ?", model.CourseStatusPublished)
	}
	if err := totalQuery.Distinct("courses.id").Count(&total).Error; err != nil {
		sendInternalError(c, err)
		return
	}

	pubQuery := query.Session(&gorm.Session{}).Where("courses.status = ?", model.CourseStatusPublished)
	if err := pubQuery.Distinct("courses.id").Count(&published).Error; err != nil {
		sendInternalError(c, err)
		return
	}

	draftQuery := query.Session(&gorm.Session{}).Where("courses.status = ?", model.CourseStatusDraft)
	if err := draftQuery.Distinct("courses.id").Count(&draft).Error; err != nil {
		sendInternalError(c, err)
		return
	}

	var categoriesCount int64
	catQuery := db.Model(&model.CourseCategory{})
	if c.Query("include_inactive") != "true" {
		catQuery = catQuery.Where("is_active = ?", true)
	}
	if err := catQuery.Count(&categoriesCount).Error; err != nil {
		sendInternalError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"total":      total,
			"published":  published,
			"draft":      draft,
			"categories": categoriesCount,
		},
	})
}

func (ctrl *LMSController) ListCourseCategories(c *gin.Context) {
	var categories []model.CourseCategory
	db := lmsDB(c, ctrl.DB)
	userID, roleValue := optionalLMSUser(c)
	query := db.Model(&model.CourseCategory{})
	if c.Query("include_inactive") != "true" {
		query = query.Where("course_categories.is_active = ?", true)
	}
	var err error
	query, err = scopeCourseCategoriesForUser(db, query, userID, roleValue)
	if err != nil {
		sendInternalError(c, err)
		return
	}
	query = query.Order("course_categories.sort_order asc, course_categories.name asc").
		Limit(parseLimit(c))
	if err := query.Find(&categories).Error; err != nil {
		sendInternalError(c, err)
		return
	}

	var dtos []gin.H
	for _, cat := range categories {
		targetRoles := getCourseCategoryTargetRoles(db, cat.ID)
		dtos = append(dtos, gin.H{
			"id":           cat.ID,
			"name":         cat.Name,
			"slug":         cat.Slug,
			"description":  cat.Description,
			"sort_order":   cat.SortOrder,
			"is_active":    cat.IsActive,
			"target_roles": targetRoles,
			"created_at":   cat.CreatedAt,
			"updated_at":   cat.UpdatedAt,
		})
	}
	sendSuccess(c, dtos, "Course categories retrieved successfully")
}

func (ctrl *LMSController) GetPublicCourse(c *gin.Context) {
	courseRef := strings.TrimSpace(c.Param("id"))
	if courseRef == "" {
		sendBadRequest(c, "Course reference is required", nil)
		return
	}
	userID, _ := optionalLMSUser(c)

	var course model.Course
	db := lmsDB(c, ctrl.DB)

	// 2. Hapus Preload("Mentors") dari sini
	query := db.
		Preload("CourseCategory").
		Where("status = ?", model.CourseStatusPublished)
	if id, parseErr := uuid.Parse(courseRef); parseErr == nil {
		query = query.Where("id = ?", id)
	} else {
		query = query.Where("slug = ?", generateSlug(courseRef))
	}
	err := query.First(&course).Error

	if errors.Is(err, gorm.ErrRecordNotFound) {
		sendError(c, http.StatusNotFound, "Course not found", nil)
		return
	}
	if err != nil {
		sendInternalError(c, err)
		return
	}

	if userID != uuid.Nil {
		_, roleValue := optionalLMSUser(c)
		if !userCanAccessCourseTargetRoles(db, userID, roleValue, course.ID, course.CourseCategoryID) {
			sendError(c, http.StatusForbidden, "Forbidden: User role does not match course target roles", nil)
			return
		}
	}

	// FIX: Ambil data Mentors secara terpisah dan preload Profile
	{
		var mentors []model.User
		if err := db.Table("users").
			Select("users.*").
			Joins("JOIN course_mentors ON course_mentors.mentor_id = users.id").
			Where("course_mentors.course_id = ? AND users.deleted_at IS NULL", course.ID).
			Preload("Profile").
			Find(&mentors).Error; err == nil {
			course.Mentors = mentors
		}
	}

	dbCtx := db.WithContext(c.Request.Context())
	go func(courseID uuid.UUID) {
		_ = dbCtx.Model(&model.Course{}).
			Where("id = ?", courseID).
			Update("view_count", gorm.Expr("view_count + ?", 1)).Error
	}(course.ID)

	course.ViewCount += 1

	hasAccess := false
	if userID != uuid.Nil {
		hasAccess = ctrl.hasCourseAccess(c, course.ID)
	}
	payload := courseWithStats(db, course, userID)
	payload["has_access"] = hasAccess
	sendSuccess(c, payload, "Course retrieved successfully")
}

func (ctrl *LMSController) GetCourse(c *gin.Context) {
	id, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	userID, _, ok := currentLMSUser(c)

	db := lmsDB(c, ctrl.DB)
	var course model.Course

	// 3. Hapus Preload("Mentors") dari sini
	err := db.
		Preload("CourseCategory").
		First(&course, "id = ?", id).Error

	if errors.Is(err, gorm.ErrRecordNotFound) {
		sendError(c, http.StatusNotFound, "Course not found", nil)
		return
	}
	if err != nil {
		sendInternalError(c, err)
		return
	}

	_, roleValue, _ := currentLMSUser(c)
	// Internal mentors can inspect the complete tenant course catalog from My
	// Courses. Mutation endpoints keep their existing assignment checks.
	canAccessCourse := roleValue == model.RoleMentor || userCanAccessCourseTargetRoles(db, userID, roleValue, course.ID, course.CourseCategoryID)
	if !canAccessCourse && (roleValue == model.RoleParent || roleValue == model.RoleMentor || roleValue == model.RoleGuruExternal) {
		isAssignedMentor, permissionErr := ctrl.isCourseMentor(db, userID, course.ID)
		if permissionErr != nil {
			sendInternalError(c, permissionErr)
			return
		}
		canAccessCourse = isAssignedMentor
	}
	if !canAccessCourse {
		sendError(c, http.StatusForbidden, "Forbidden: User role does not match course target roles", nil)
		return
	}

	// FIX: Ambil data Mentors secara terpisah dan preload Profile
	{
		var mentors []model.User
		if err := db.Table("users").
			Select("users.*").
			Joins("JOIN course_mentors ON course_mentors.mentor_id = users.id").
			Where("course_mentors.course_id = ? AND users.deleted_at IS NULL", course.ID).
			Preload("Profile").
			Find(&mentors).Error; err == nil {
			course.Mentors = mentors
		}
	}

	dbCtx := db.WithContext(c.Request.Context())
	go func(courseID uuid.UUID) {
		_ = dbCtx.Model(&model.Course{}).
			Where("id = ?", courseID).
			Update("view_count", gorm.Expr("view_count + ?", 1)).Error
	}(course.ID)

	course.ViewCount += 1
	hasAccess := ctrl.hasCourseAccess(c, course.ID)
	payload := courseWithStats(db, course, userID)
	payload["has_access"] = hasAccess
	sendSuccess(c, payload, "Course retrieved successfully")
}

func (ctrl *LMSController) GetCourseTree(c *gin.Context) {
	id, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	db := lmsDB(c, ctrl.DB)
	userID, _ := optionalLMSUser(c)

	var modules []model.Module
	if err := db.Where("course_id = ?", id).Order("sort_order asc, created_at asc").Find(&modules).Error; err != nil {
		sendInternalError(c, err)
		return
	}

	if len(modules) == 0 {
		sendSuccess(c, gin.H{
			"course_id": id,
			"modules":   []gin.H{},
		}, "Course tree retrieved successfully")
		return
	}

	moduleIDs := make([]uuid.UUID, len(modules))
	for i, m := range modules {
		moduleIDs[i] = m.ID
	}

	var lessons []model.Lesson
	_ = db.Where("module_id IN ?", moduleIDs).Order("sort_order asc, created_at asc").Find(&lessons).Error

	var quizzes []model.Quiz
	_ = db.Where("module_id IN ?", moduleIDs).Order("sort_order asc, created_at asc").Find(&quizzes).Error

	// Fetch student progress for lessons and quizzes
	completedLessonMap := make(map[uuid.UUID]bool)
	completedQuizMap := make(map[uuid.UUID]bool)
	if userID != uuid.Nil {
		var completedLessonIDs []uuid.UUID
		_ = db.Model(&model.StudentProgress{}).
			Where("student_id = ? AND course_id = ? AND is_completed = ?", userID, id, true).
			Pluck("lesson_id", &completedLessonIDs).Error
		for _, lid := range completedLessonIDs {
			completedLessonMap[lid] = true
		}

		var completedQuizIDs []uuid.UUID
		_ = db.Model(&model.QuizProgress{}).
			Where("student_id = ? AND course_id = ? AND is_completed = ?", userID, id, true).
			Pluck("quiz_id", &completedQuizIDs).Error
		for _, qid := range completedQuizIDs {
			completedQuizMap[qid] = true
		}
	}

	lessonsByModule := make(map[string][]model.Lesson)
	for _, l := range lessons {
		mID := l.ModuleID.String()
		lessonsByModule[mID] = append(lessonsByModule[mID], l)
	}

	quizzesByModule := make(map[string][]model.Quiz)
	for _, q := range quizzes {
		if q.ModuleID != nil {
			mID := q.ModuleID.String()
			quizzesByModule[mID] = append(quizzesByModule[mID], q)
		}
	}

	moduleTrees := make([]gin.H, len(modules))
	for i, m := range modules {
		mID := m.ID.String()
		mLessons := lessonsByModule[mID]

		mLessonItems := make([]gin.H, 0, len(mLessons))
		for _, l := range mLessons {
			mLessonItems = append(mLessonItems, gin.H{
				"id":                       l.ID,
				"module_id":                l.ModuleID,
				"title":                    l.Title,
				"summary":                  l.Summary,
				"duration_sec":             l.DurationSec,
				"sort_order":               l.SortOrder,
				"is_preview":               l.IsPreview,
				"is_published":             l.IsPublished,
				"require_attachment":       l.RequireAttachment,
				"attachment_passing_score": l.AttachmentPassingScore,
				"created_at":               l.CreatedAt,
				"updated_at":               l.UpdatedAt,
				"deleted_at":               l.DeletedAt,
				"tenant_id":                l.TenantID,
				"is_completed":             completedLessonMap[l.ID],
			})
		}

		mQuizzes := quizzesByModule[mID]
		mQuizItems := make([]gin.H, 0, len(mQuizzes))
		for _, q := range mQuizzes {
			mQuizItems = append(mQuizItems, gin.H{
				"id":                                    q.ID,
				"course_id":                             q.CourseID,
				"module_id":                             q.ModuleID,
				"lesson_id":                             q.LessonID,
				"title":                                 q.Title,
				"description":                           q.Description,
				"instructions":                          q.Instructions,
				"passing_score":                         q.PassingScore,
				"time_limit_min":                        q.TimeLimitMin,
				"max_attempts":                          q.MaxAttempts,
				"randomize_questions":                   q.RandomizeQuestions,
				"randomize_answers":                     q.RandomizeAnswers,
				"show_result_after_submit":              q.ShowResultAfterSubmit,
				"show_correct_answers":                  q.ShowCorrectAnswers,
				"require_passing_score_before_continue": q.RequirePassingScoreBeforeContinue,
				"is_published":                          q.IsPublished,
				"sort_order":                            q.SortOrder,
				"created_at":                            q.CreatedAt,
				"updated_at":                            q.UpdatedAt,
				"deleted_at":                            q.DeletedAt,
				"tenant_id":                             q.TenantID,
				"is_completed":                          completedQuizMap[q.ID],
			})
		}

		moduleTrees[i] = gin.H{
			"id":           m.ID,
			"course_id":    m.CourseID,
			"title":        m.Title,
			"description":  m.Description,
			"sort_order":   m.SortOrder,
			"is_published": m.IsPublished,
			"created_at":   m.CreatedAt,
			"updated_at":   m.UpdatedAt,
			"lessons":      mLessonItems,
			"quizzes":      mQuizItems,
		}
	}

	sendSuccess(c, gin.H{
		"course_id": id,
		"modules":   moduleTrees,
	}, "Course tree retrieved successfully")
}

func courseWithStats(db *gorm.DB, course model.Course, userID uuid.UUID) gin.H {
	var moduleCount int64
	var lessonCount int64
	var quizCount int64
	var completedLessons int64
	var completedQuizzes int64
	var totalDurationSec int64

	// 1. Hitung total komponen kurikulum yang ada di kursus ini
	db.Model(&model.Module{}).Where("course_id = ?", course.ID).Count(&moduleCount)
	db.Model(&model.Quiz{}).Where("course_id = ?", course.ID).Count(&quizCount)

	db.Model(&model.Lesson{}).
		Joins("JOIN modules ON modules.id = lessons.module_id").
		Where("modules.course_id = ?", course.ID).
		Count(&lessonCount)

	db.Model(&model.Lesson{}).
		Select("COALESCE(SUM(duration_sec), 0)").
		Joins("JOIN modules ON modules.id = lessons.module_id").
		Where("modules.course_id = ?", course.ID).
		Scan(&totalDurationSec)

	// 2. Hitung progress LESSON milik SISWA INI SAJA
	db.Model(&model.StudentProgress{}).
		Where("course_id = ? AND student_id = ? AND is_completed = ?", course.ID, userID, true).
		Count(&completedLessons)

	// 3. Hitung progress KUIS milik SISWA INI SAJA (dari tabel quiz_progresses)
	db.Model(&model.QuizProgress{}).
		Where("course_id = ? AND student_id = ? AND is_completed = ?", course.ID, userID, true).
		Count(&completedQuizzes)

	// 4. Kalkulasi Completion Rate Personal
	completionRate := 0.0
	totalItems := lessonCount + quizCount
	totalCompleted := completedLessons + completedQuizzes

	if totalItems > 0 {
		// Rumus personal murni: (Materi Selesai + Kuis Selesai) / Total Materi & Kuis keseluruhan
		completionRate = (float64(totalCompleted) / float64(totalItems)) * 100
		if completionRate > 100 {
			completionRate = 100
		}
	}

	locked, lockedName := isCourseLockedInBundles(db, userID, course.ID)

	return gin.H{
		"id":                 course.ID,
		"title":              course.Title,
		"slug":               course.Slug,
		"description":        course.Description,
		"short_description":  course.ShortDescription,
		"cover_image_url":    course.CoverImageURL,
		"course_category_id": course.CourseCategoryID,
		"course_category":    course.CourseCategory,
		"level":              course.Level,
		"age_range":          course.AgeRange,
		"status":             course.Status,
		"sort_order":         course.SortOrder,
		"mentors":            course.Mentors,
		"published_at":       course.PublishedAt,
		"created_at":         course.CreatedAt,
		"updated_at":         course.UpdatedAt,
		"view_count":         course.ViewCount,
		"rating":             0,
		"rating_count":       0,
		"completion_rate":    math.Round(completionRate), // Pembulatan presisi
		"total_duration":     formatCourseDuration(totalDurationSec),
		"total_duration_sec": totalDurationSec,
		"language":           "Bahasa Indonesia",
		"has_certificate":    true,
		"module_count":       moduleCount,
		"lesson_count":       lessonCount,
		"quiz_count":         quizCount,
		"allow_skip":         course.AllowSkip,
		"is_locked":          locked,
		"locked_by_course":   lockedName,
		"sell_individual":    course.SellIndividual,
		"price":              course.Price,
		"target_roles":       getCourseTargetRoles(db, course.ID),
		"category_roles":     getCourseCategoryTargetRoles(db, course.CourseCategoryID),
	}
}

// GET /lms/courses/explore — courses sold individually
func (ctrl *LMSController) ExploreCourses(c *gin.Context) {
	userID, roleValue, ok := currentLMSUser(c)
	if !ok {
		return
	}

	db := lmsDB(c, ctrl.DB)
	limit := 8
	if l, err := strconv.Atoi(c.DefaultQuery("limit", "8")); err == nil && l > 0 && l <= 100 {
		limit = l
	}
	page := 1
	if p, err := strconv.Atoi(c.DefaultQuery("page", "1")); err == nil && p > 0 {
		page = p
	}
	offset := (page - 1) * limit

	excludeEnrolled := c.Query("exclude_enrolled") == "true"

	query := db.Model(&model.Course{}).
		Where("courses.status = ?", model.CourseStatusPublished).
		Where("courses.deleted_at IS NULL")
	query, err := scopeCoursesForUser(db, query, userID, roleValue)
	if err != nil {
		sendInternalError(c, err)
		return
	}

	if excludeEnrolled {
		query = query.Where("courses.id NOT IN (?)",
			db.Table("course_purchases").Select("course_id").
				Where("student_id = ? AND status = ?", userID, model.PurchasePaid),
		)
	}

	// Search
	if search := c.Query("search"); search != "" {
		query = query.Where("courses.title LIKE ? OR courses.description LIKE ? OR courses.short_description LIKE ?", "%"+search+"%", "%"+search+"%", "%"+search+"%")
	}

	// Category
	if categoryID := strings.TrimSpace(c.Query("category_id")); categoryID != "" &&
		categoryID != "all" {
		if catUUID, err := uuid.Parse(categoryID); err == nil {
			query = query.Where("courses.course_category_id = ?", catUUID)
		}
	}

	// Level
	if level := strings.TrimSpace(c.Query("level")); level != "" && level != "all" {
		query = query.Where("courses.level = ?", level)
	}

	// Age range
	if ageRange := strings.TrimSpace(c.Query("age_range")); ageRange != "" &&
		ageRange != "all" {
		query = query.Where("courses.age_range = ?", ageRange)
	}

	// Price Range
	if minPriceStr := c.Query("min_price"); minPriceStr != "" {
		if minPrice, err := strconv.ParseFloat(minPriceStr, 64); err == nil {
			query = query.Where("courses.price * (1 - courses.discount_percent/100) >= ?", minPrice)
		}
	}
	if maxPriceStr := c.Query("max_price"); maxPriceStr != "" {
		if maxPrice, err := strconv.ParseFloat(maxPriceStr, 64); err == nil {
			query = query.Where("courses.price * (1 - courses.discount_percent/100) <= ?", maxPrice)
		}
	}

	// Ordering
	order := c.Query("order")
	switch order {
	case "price_asc":
		query = query.Order("courses.price * (1 - courses.discount_percent/100) ASC")
	case "price_desc":
		query = query.Order("courses.price * (1 - courses.discount_percent/100) DESC")
	case "oldest":
		query = query.Order("courses.created_at ASC")
	case "popular":
		query = query.Order("courses.view_count DESC, courses.created_at DESC")
	case "newest":
		fallthrough
	default:
		query = query.Order("courses.created_at DESC")
	}

	var courses []model.Course
	if err := query.
		Offset(offset).
		Limit(limit).
		Find(&courses).Error; err != nil {
		sendInternalError(c, err)
		return
	}

	for i := range courses {
		var mentors []model.User
		if err := db.Table("users").
			Select("users.*").
			Joins("JOIN course_mentors ON course_mentors.mentor_id = users.id").
			Where("course_mentors.course_id = ? AND users.deleted_at IS NULL", courses[i].ID).
			Preload("Profile").
			Find(&mentors).Error; err == nil {
			courses[i].Mentors = mentors
		}
	}

	type CourseResultOut struct {
		CourseID       string       `json:"course_id"`
		Title          string       `json:"title"`
		Slug           string       `json:"slug"`
		Price          float64      `json:"price"`
		OriginalPrice  float64      `json:"original_price"`
		DiscountPct    float64      `json:"discount_percent"`
		Thumbnail      string       `json:"thumbnail"`
		ShortDesc      string       `json:"short_description"`
		TotalStudents  int64        `json:"total_students"`
		Rating         float64      `json:"rating"`
		SellIndividual bool         `json:"sell_individual"`
		Mentors        []model.User `json:"mentors"`
		IsLocked       bool         `json:"is_locked"`
		LockedByCourse string       `json:"locked_by_course"`
	}

	out := make([]CourseResultOut, 0, len(courses))
	for _, course := range courses {
		var count int64
		db.Table("course_purchases").
			Where("course_id = ? AND status = ?", course.ID, model.PurchasePaid).
			Count(&count)

		originalPrice := course.Price
		effectivePrice := course.Price
		if course.DiscountPercent > 0 {
			effectivePrice = course.Price * (1 - course.DiscountPercent/100)
		}
		locked, lockedName := isCourseLockedInBundles(db, userID, course.ID)
		out = append(out, CourseResultOut{
			CourseID:       course.ID.String(),
			Title:          course.Title,
			Slug:           course.Slug,
			Price:          effectivePrice,
			OriginalPrice:  originalPrice,
			DiscountPct:    course.DiscountPercent,
			Thumbnail:      course.CoverImageURL,
			ShortDesc:      course.ShortDescription,
			TotalStudents:  count,
			Rating:         5.0,
			SellIndividual: course.SellIndividual,
			Mentors:        course.Mentors,
			IsLocked:       locked,
			LockedByCourse: lockedName,
		})
	}

	sendSuccess(c, out, "Courses retrieved")
}

// GET /lms/courses/explore/filters — distinct filter options from published courses
func (ctrl *LMSController) GetExploreCourseFilters(c *gin.Context) {
	userID, roleValue, ok := currentLMSUser(c)
	if !ok {
		return
	}

	db := lmsDB(c, ctrl.DB)

	base := db.Model(&model.Course{}).
		Where("courses.status = ?", model.CourseStatusPublished).
		Where("courses.deleted_at IS NULL")
	base, err := scopeCoursesForUser(db, base, userID, roleValue)
	if err != nil {
		sendInternalError(c, err)
		return
	}

	var levels []string
	if err := base.Session(&gorm.Session{}).
		Distinct("courses.level").
		Where("courses.level IS NOT NULL AND TRIM(courses.level) <> ''").
		Order("courses.level ASC").
		Pluck("courses.level", &levels).Error; err != nil {
		sendInternalError(c, err)
		return
	}

	var ageRanges []string
	if err := base.Session(&gorm.Session{}).
		Distinct("courses.age_range").
		Where("courses.age_range IS NOT NULL AND TRIM(courses.age_range) <> ''").
		Order("courses.age_range ASC").
		Pluck("courses.age_range", &ageRanges).Error; err != nil {
		sendInternalError(c, err)
		return
	}

	sendSuccess(c, gin.H{
		"levels":     levels,
		"age_ranges": ageRanges,
	}, "Course explore filters retrieved")
}

func (ctrl *LMSController) ListMyCourses(c *gin.Context) {
	userID, role, ok := currentLMSUser(c)
	if !ok {
		return
	}

	db := lmsDB(c, ctrl.DB)
	query := db.Model(&model.Course{})
	isInternalMentor := role == model.RoleMentor

	// Internal mentors manage the tenant's complete course catalog. Other roles
	// only see courses granted through subscriptions, purchases, or progress.
	if !isInternalMentor {
		// ─── Sumber 1: Active Subscription ───────────────────────────────────
		hasAllAccess, subscribedCourseIDs, err := activeUserSubscriptionCourseScope(db, userID, role, time.Now())
		if err != nil {
			sendInternalError(c, err)
			return
		}

		// ─── Sumber 2: Course satuan yang sudah dibeli ───────────────────────
		var paidPayments []model.LMSPayment
		if err := db.
			Where("(student_id = ? OR parent_id = ?) AND status = ? AND course_id IS NOT NULL", userID, userID, model.LMSPaymentPaid).
			Find(&paidPayments).Error; err != nil {
			sendInternalError(c, err)
			return
		}
		for _, p := range paidPayments {
			if p.CourseID != nil {
				subscribedCourseIDs[*p.CourseID] = true
			}
		}

		// ─── Sumber 2b: CoursePurchase ───────────────────────────────────────
		var coursePurchases []model.CoursePurchase
		if err := db.
			Select("DISTINCT course_id").
			Where("student_id = ? AND status = ?", userID, model.PurchasePaid).
			Find(&coursePurchases).Error; err != nil {
			sendInternalError(c, err)
			return
		}
		for _, cp := range coursePurchases {
			subscribedCourseIDs[cp.CourseID] = true
		}

		// ─── Sumber 3: Course yang pernah dikerjakan/dienroll ────────────────
		var progresses []model.StudentProgress
		if err := db.
			Select("DISTINCT course_id").
			Where("student_id = ?", userID).
			Find(&progresses).Error; err != nil {
			sendInternalError(c, err)
			return
		}
		for _, sp := range progresses {
			subscribedCourseIDs[sp.CourseID] = true
		}

		if !hasAllAccess {
			if len(subscribedCourseIDs) == 0 {
				c.JSON(http.StatusOK, gin.H{
					"success": true,
					"message": "No enrolled courses",
					"data":    []gin.H{},
					"pagination": gin.H{
						"page": 1, "limit": parseLimit(c), "total": 0, "total_pages": 0,
					},
				})
				return
			}
			ids := make([]uuid.UUID, 0, len(subscribedCourseIDs))
			for id := range subscribedCourseIDs {
				ids = append(ids, id)
			}
			query = query.Where("id IN ?", ids)
		}
	}

	if search := c.Query("search"); search != "" {
		query = query.Where("(title LIKE ? OR description LIKE ?)", "%"+search+"%", "%"+search+"%")
	}
	if categoryID := c.Query("course_category_id"); categoryID != "" && categoryID != "ALL" {
		query = query.Where("course_category_id = ?", categoryID)
	}
	if status := c.Query("status"); status != "" && status != "ALL" {
		query = query.Where("status = ?", status)
	} else if !isInternalMentor {
		query = query.Where("status = ?", model.CourseStatusPublished)
	}

	var total int64
	if err := query.Model(&model.Course{}).Count(&total).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	limit := parseLimit(c)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	if page < 1 {
		page = 1
	}

	var courses []model.Course
	if err := query.Preload("CourseCategory").
		Order("sort_order asc, created_at desc").
		Limit(limit).
		Offset((page - 1) * limit).
		Find(&courses).Error; err != nil {
		sendInternalError(c, err)
		return
	}

	// FIX: Ambil data Mentors secara terpisah dan preload Profile
	for i := range courses {
		var mentors []model.User
		if err := db.Table("users").
			Select("users.*").
			Joins("JOIN course_mentors ON course_mentors.mentor_id = users.id").
			Where("course_mentors.course_id = ? AND users.deleted_at IS NULL", courses[i].ID).
			Preload("Profile").
			Find(&mentors).Error; err == nil {
			courses[i].Mentors = mentors
		}
	}

	items := make([]gin.H, 0, len(courses))
	for _, course := range courses {
		items = append(items, courseWithStats(db, course, userID))
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "My courses retrieved successfully",
		"data":    items,
		"pagination": gin.H{
			"page": page, "limit": limit, "total": total,
			"total_pages": int(math.Ceil(float64(total) / float64(limit))),
		},
	})
}

func activeUserSubscriptionCourseScope(db *gorm.DB, userID uuid.UUID, role int, now time.Time) (bool, map[uuid.UUID]bool, error) {
	if userID == uuid.Nil {
		return false, map[uuid.UUID]bool{}, nil
	}

	scopeQuery := "student_id = ?"
	scopeArgs := []interface{}{userID}
	if role == model.RoleParent || role == model.RoleMentor || role == model.RoleGuruExternal {
		scopeQuery = "(parent_id = ? OR student_id = ?)"
		scopeArgs = []interface{}{userID, userID}
	}

	var pendingSubscriptions []model.Subscription
	pendingArgs := append(append([]interface{}{}, scopeArgs...), "downgrade", now)
	if err := db.
		Where(scopeQuery+" AND pending_change_type = ? AND current_period_end <= ?", pendingArgs...).
		Find(&pendingSubscriptions).Error; err != nil {
		return false, nil, err
	}
	for i := range pendingSubscriptions {
		if err := applyPendingDowngradeIfDue(db, &pendingSubscriptions[i], now); err != nil {
			return false, nil, err
		}
	}

	var subscriptions []model.Subscription
	activeArgs := append(append([]interface{}{}, scopeArgs...), []model.SubscriptionStatus{
		model.SubscriptionStatusActive,
		model.SubscriptionStatusTrialing,
	}, now)
	if err := db.
		Where(scopeQuery+" AND status IN ? AND (current_period_end IS NULL OR current_period_end >= ?)", activeArgs...).
		Find(&subscriptions).Error; err != nil {
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

func formatCourseDuration(totalSec int64) string {
	if totalSec <= 0 {
		return "0m"
	}
	hours := totalSec / 3600
	minutes := (totalSec % 3600) / 60
	if hours > 0 {
		return fmt.Sprintf("%dh %02dm", hours, minutes)
	}
	return fmt.Sprintf("%dm", minutes)
}

type CourseRequestDTO struct {
	Title               string    `json:"title" binding:"required"`
	Slug                string    `json:"slug"`
	Description         string    `json:"description"`
	ShortDescription    string    `json:"short_description"`
	CoverImageURL       string    `json:"cover_image_url"`
	CourseCategoryID    uuid.UUID `json:"course_category_id" binding:"required"`
	Level               string    `json:"level"`
	AgeRange            string    `json:"age_range"`
	Status              string    `json:"status"`
	MinimumPassingGrade float64   `json:"minimum_passing_grade"`
	AllowSkip           bool      `json:"allow_skip"`
	OwnerType           string    `json:"owner_type"`
	OrganizationID      *string   `json:"organization_id"`
	SellIndividual      bool      `json:"sell_individual"`
	Price               float64   `json:"price"`
	DiscountPercent     float64   `json:"discount_percent"`
	PromoStartDate      string    `json:"promo_start_date"`
	PromoEndDate        string    `json:"promo_end_date"`
	MentorIDs           []string  `json:"mentor_ids"`
	TargetRoles         []string  `json:"target_roles"`
}

type FieldError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

type ValidationError struct {
	Message     string            `json:"message"`
	FieldErrors map[string]string `json:"field_errors"`
}

func validateCoursePayload(payload CourseRequestDTO) *ValidationError {
	errs := make(map[string]string)

	if utf8.RuneCountInString(payload.Title) == 0 {
		errs["title"] = "Judul kursus wajib diisi"
	} else if utf8.RuneCountInString(payload.Title) > 180 {
		errs["title"] = "Judul kursus maksimal 180 karakter"
	}

	if utf8.RuneCountInString(payload.Slug) > 200 {
		errs["slug"] = "Slug maksimal 200 karakter"
	}

	if utf8.RuneCountInString(payload.ShortDescription) > 500 {
		errs["short_description"] = "Deskripsi singkat maksimal 500 karakter"
	}

	if utf8.RuneCountInString(payload.Description) > 5000 {
		errs["description"] = "Deskripsi lengkap maksimal 5.000 karakter"
	}

	if payload.CourseCategoryID == uuid.Nil {
		errs["course_category_id"] = "Kategori kursus wajib dipilih"
	}

	if len(payload.MentorIDs) == 0 {
		errs["mentor_ids"] = "Minimal pilih satu mentor untuk kursus ini"
	}

	if len(payload.TargetRoles) == 0 {
		errs["target_roles"] = "Minimal satu target role wajib dipilih untuk kursus ini"
	}

	if len(errs) > 0 {
		return &ValidationError{
			Message:     "Validasi gagal. Periksa field yang bermasalah.",
			FieldErrors: errs,
		}
	}
	return nil
}

func validateSellerCourseRequirements(db *gorm.DB, userID uuid.UUID, role int, courseID uuid.UUID) (int, string) {
	rules, plan, err := model.GetCourseSellerActiveRules(db, userID, role)
	if err != nil {
		return http.StatusInternalServerError, "Gagal memeriksa persyaratan penjualan course"
	}
	if rules == nil || plan == nil || !rules.AllowsSelling() {
		return http.StatusForbidden, "Paket langganan aktif Anda belum mendukung penjualan course satuan"
	}
	unlocked, reason, err := model.CheckCourseSellerRequirements(db, userID, rules, plan)
	if err != nil {
		return http.StatusInternalServerError, "Gagal memeriksa persyaratan penjualan course"
	}
	if !unlocked {
		return http.StatusUnprocessableEntity, reason
	}

	if rules.MinLessonsToSell > 0 {
		var lessonCount int64
		if courseID != uuid.Nil {
			if err := db.Model(&model.Lesson{}).
				Joins("JOIN modules ON modules.id = lessons.module_id AND modules.deleted_at IS NULL").
				Where("modules.course_id = ?", courseID).
				Count(&lessonCount).Error; err != nil {
				return http.StatusInternalServerError, "Gagal memeriksa jumlah lesson course"
			}
		}
		if lessonCount < int64(rules.MinLessonsToSell) {
			return http.StatusUnprocessableEntity, fmt.Sprintf(
				"Course harus memiliki minimal %d lesson sebelum dapat dijual satuan. Saat ini baru ada %d lesson.",
				rules.MinLessonsToSell,
				lessonCount,
			)
		}
	}

	return 0, ""
}

func validateCourseCreationRequirements(db *gorm.DB, userID uuid.UUID, role int) (int, string) {
	rules, plan, err := model.GetCourseSellerActiveRules(db, userID, role)
	if err != nil {
		return http.StatusInternalServerError, "Gagal memeriksa persyaratan tambah course"
	}
	unlocked, reason, err := model.CheckCourseCreationRequirements(db, userID, rules, plan)
	if err != nil {
		return http.StatusInternalServerError, "Gagal memeriksa persyaratan tambah course"
	}
	if !unlocked {
		return http.StatusForbidden, reason
	}
	return 0, ""
}

func (ctrl *LMSController) CreateCourse(c *gin.Context) {
	var payload CourseRequestDTO
	if err := c.ShouldBindJSON(&payload); err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}

	if verr := validateCoursePayload(payload); verr != nil {
		sendError(c, http.StatusUnprocessableEntity, verr.Message, verr.FieldErrors)
		return
	}

	db := lmsDB(c, ctrl.DB).WithContext(c)

	// Map ke model Course asli
	course := model.Course{
		Title:               payload.Title,
		Slug:                payload.Slug,
		Description:         payload.Description,
		ShortDescription:    payload.ShortDescription,
		CoverImageURL:       payload.CoverImageURL,
		CourseCategoryID:    payload.CourseCategoryID,
		Level:               payload.Level,
		AgeRange:            payload.AgeRange,
		Status:              model.CourseStatus(payload.Status),
		MinimumPassingGrade: payload.MinimumPassingGrade,
		AllowSkip:           payload.AllowSkip,
		SellIndividual:      payload.SellIndividual,
		Price:               payload.Price,
		DiscountPercent:     payload.DiscountPercent,
		OwnerType:           payload.OwnerType,
	}
	course.Slug = uniqueCourseSlug(ctrl.DB, course.Slug, course.Title, uuid.Nil)
	if course.OwnerType == "" {
		course.OwnerType = "external"
	}
	if payload.OrganizationID != nil && *payload.OrganizationID != "" {
		orgID, parseErr := uuid.Parse(*payload.OrganizationID)
		if parseErr == nil {
			course.OrganizationID = &orgID
		}
	}
	if course.Status == "" {
		course.Status = model.CourseStatusDraft
	}
	if payload.PromoStartDate != "" {
		t, err := time.Parse("2006-01-02", payload.PromoStartDate)
		if err == nil {
			course.PromoStartDate = &t
		}
	}
	if payload.PromoEndDate != "" {
		t, err := time.Parse("2006-01-02", payload.PromoEndDate)
		if err == nil {
			course.PromoEndDate = &t
		}
	}

	// Cari entitas mentor berdasarkan list ID yang dikirim
	if len(payload.MentorIDs) > 0 {
		var mentors []model.User
		if err := db.Where("id IN ?", payload.MentorIDs).Find(&mentors).Error; err == nil {
			course.Mentors = mentors
		}
	}

	userID, role, ok := currentLMSUser(c)
	if ok && (role == 30 || role == 40 || role == 10) {
		var mentor model.User
		if err := db.First(&mentor, "id = ?", userID).Error; err == nil {
			found := false
			for _, m := range course.Mentors {
				if m.ID == mentor.ID {
					found = true
					break
				}
			}
			if !found {
				course.Mentors = append(course.Mentors, mentor)
			}
		}
	}

	if role == model.RoleParent || role == model.RoleGuruExternal {
		if status, message := validateCourseCreationRequirements(db, userID, role); status != 0 {
			sendError(c, status, message, nil)
			return
		}
	}

	if (role == model.RoleParent || role == model.RoleGuruExternal) && payload.SellIndividual && course.Status == model.CourseStatusPublished {
		if status, message := validateSellerCourseRequirements(db, userID, role, uuid.Nil); status != 0 {
			sendError(c, status, message, nil)
			return
		}
	}

	if valid, errMsg := validateCourseTargetRolesAgainstCategory(db, payload.CourseCategoryID, payload.TargetRoles); !valid {
		sendError(c, http.StatusUnprocessableEntity, errMsg, map[string]string{"target_roles": errMsg})
		return
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&course).Error; err != nil {
			return err
		}
		if err := setCourseTargetRoles(tx, course.ID, course.TenantID, payload.TargetRoles); err != nil {
			return err
		}
		return nil
	})

	if err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccess(c, course, "Course created successfully")
}

func (ctrl *LMSController) UpdateCourse(c *gin.Context) {
	id, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	var payload CourseRequestDTO
	if err := c.ShouldBindJSON(&payload); err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}

	if verr := validateCoursePayload(payload); verr != nil {
		sendError(c, http.StatusUnprocessableEntity, verr.Message, verr.FieldErrors)
		return
	}

	db := lmsDB(c, ctrl.DB).WithContext(c)

	var course model.Course
	if err := db.First(&course, "id = ?", id).Error; err != nil {
		sendError(c, http.StatusNotFound, "Course not found", nil)
		return
	}

	userID, role, ok := currentLMSUser(c)
	if ok && (role == 30 || role == 40 || role == 10) {
		var count int64
		if err := db.Table("course_mentors").Where("course_id = ? AND mentor_id = ?", id, userID).Count(&count).Error; err != nil || count == 0 {
			sendError(c, http.StatusForbidden, "Forbidden: You are not authorized to edit this course", nil)
			return
		}
	}

	// Update field dasar (Omit view_count demi keamanan)
	updates := map[string]interface{}{
		"title":                 payload.Title,
		"slug":                  payload.Slug,
		"description":           payload.Description,
		"short_description":     payload.ShortDescription,
		"cover_image_url":       payload.CoverImageURL,
		"course_category_id":    payload.CourseCategoryID,
		"level":                 payload.Level,
		"age_range":             payload.AgeRange,
		"status":                payload.Status,
		"minimum_passing_grade": payload.MinimumPassingGrade,
		"allow_skip":            payload.AllowSkip,
		"owner_type":            payload.OwnerType,
		"sell_individual":       payload.SellIndividual,
		"price":                 payload.Price,
		"discount_percent":      payload.DiscountPercent,
	}
	updates["slug"] = uniqueCourseSlug(ctrl.DB, payload.Slug, payload.Title, id)
	if payload.OrganizationID != nil && *payload.OrganizationID != "" {
		orgID, parseErr := uuid.Parse(*payload.OrganizationID)
		if parseErr == nil {
			updates["organization_id"] = orgID
		}
	} else {
		updates["organization_id"] = nil
	}

	if (role == model.RoleParent || role == model.RoleGuruExternal) && payload.SellIndividual && payload.Status == string(model.CourseStatusPublished) {
		if status, message := validateSellerCourseRequirements(db, userID, role, id); status != 0 {
			sendError(c, status, message, nil)
			return
		}
	}

	if valid, errMsg := validateCourseTargetRolesAgainstCategory(db, payload.CourseCategoryID, payload.TargetRoles); !valid {
		sendError(c, http.StatusUnprocessableEntity, errMsg, map[string]string{"target_roles": errMsg})
		return
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&course).Updates(updates).Error; err != nil {
			return err
		}

		var mentors []model.User
		if len(payload.MentorIDs) > 0 {
			if err := tx.Where("id IN ?", payload.MentorIDs).Find(&mentors).Error; err == nil {
				if err := tx.Model(&course).Association("Mentors").Replace(mentors); err != nil {
					return err
				}
			}
		} else {
			if err := tx.Model(&course).Association("Mentors").Clear(); err != nil {
				return err
			}
		}

		if err := setCourseTargetRoles(tx, course.ID, course.TenantID, payload.TargetRoles); err != nil {
			return err
		}
		return nil
	})

	if err != nil {
		sendInternalError(c, err)
		return
	}

	_ = db.Preload("CourseCategory").First(&course, "id = ?", id).Error
	sendSuccess(c, course, "Course updated successfully")
}

func (ctrl *LMSController) DeleteCourse(c *gin.Context) {
	id, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	db := lmsDB(c, ctrl.DB)
	userID, role, ok := currentLMSUser(c)
	if ok && (role == 30 || role == 40 || role == 10) {
		var count int64
		if err := db.Table("course_mentors").Where("course_id = ? AND mentor_id = ?", id, userID).Count(&count).Error; err != nil || count == 0 {
			sendError(c, http.StatusForbidden, "Forbidden: You are not authorized to delete this course", nil)
			return
		}
	}
	if err := db.Delete(&model.Course{}, "id = ?", id).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccessNoData(c)
}

func isCourseLockedInBundles(db *gorm.DB, userID uuid.UUID, courseID uuid.UUID) (bool, string) {
	var subscriptions []model.Subscription
	now := time.Now()
	err := db.Where("student_id = ? AND status IN ?",
		userID,
		[]model.SubscriptionStatus{model.SubscriptionStatusActive, model.SubscriptionStatusTrialing},
	).Where("(current_period_end IS NULL OR current_period_end >= ?)", now).
		Find(&subscriptions).Error
	if err != nil {
		return false, ""
	}

	for _, sub := range subscriptions {
		planID, ok := subscriptionPlanID(sub)
		if !ok {
			continue
		}
		var plan model.SubscriptionPlan
		if err := db.Select("id", "bundle_id").First(&plan, "id = ?", *planID).Error; err != nil {
			continue
		}
		bundleIDs, err := model.SubscriptionPlanBundleIDs(db, plan.ID, plan.BundleID)
		if err != nil || len(bundleIDs) == 0 {
			continue
		}

		for _, bundleID := range bundleIDs {
			var bundle model.CourseBundle
			if err := db.First(&bundle, "id = ?", bundleID).Error; err != nil {
				continue
			}

			if !bundle.RequireSequentialCompletion {
				continue
			}

			var items []model.CourseBundleItem
			if err := db.Where("bundle_id = ?", bundle.ID).Order("sort_order asc, created_at asc").Find(&items).Error; err != nil {
				continue
			}

			courseIdx := -1
			for idx, item := range items {
				if item.CourseID == courseID {
					courseIdx = idx
					break
				}
			}

			if courseIdx > 0 {
				for i := 0; i < courseIdx; i++ {
					precCourseID := items[i].CourseID
					if !isCourseCompleted(db, userID, precCourseID) {
						// Find the prerequisite course title
						var precCourse model.Course
						if err := db.Select("title").First(&precCourse, "id = ?", precCourseID).Error; err == nil {
							return true, precCourse.Title
						}
						return true, "course sebelumnya"
					}
				}
			}
		}
	}

	return false, ""
}

func isCourseCompleted(db *gorm.DB, userID uuid.UUID, courseID uuid.UUID) bool {
	var moduleIDs []uuid.UUID
	if err := db.Model(&model.Module{}).Where("course_id = ?", courseID).Pluck("id", &moduleIDs).Error; err != nil {
		return false
	}
	if len(moduleIDs) == 0 {
		return true
	}
	var lessonIDs []uuid.UUID
	if err := db.Model(&model.Lesson{}).Where("module_id IN ? AND is_published = ?", moduleIDs, true).Pluck("id", &lessonIDs).Error; err != nil {
		return false
	}
	if len(lessonIDs) == 0 {
		return true
	}

	var completedCount int64
	db.Model(&model.StudentProgress{}).
		Where("student_id = ? AND lesson_id IN ? AND is_completed = ?", userID, lessonIDs, true).
		Count(&completedCount)

	return completedCount >= int64(len(lessonIDs))
}

type ReorderCategoryItem struct {
	ID        uuid.UUID `json:"id"`
	SortOrder int       `json:"sort_order"`
}

type ReorderCourseCategoriesRequest struct {
	Categories []ReorderCategoryItem `json:"categories"`
}

func (ctrl *LMSController) ReorderCourseCategories(c *gin.Context) {
	var req ReorderCourseCategoriesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}

	db := lmsDB(c, ctrl.DB).WithContext(c)
	err := db.Transaction(func(tx *gorm.DB) error {
		for _, item := range req.Categories {
			if item.ID != uuid.Nil {
				if err := tx.Model(&model.CourseCategory{}).
					Where("id = ?", item.ID).
					Update("sort_order", item.SortOrder).Error; err != nil {
					return err
				}
			}
		}
		return nil
	})

	if err != nil {
		sendInternalError(c, err)
		return
	}

	sendSuccessNoData(c)
}
