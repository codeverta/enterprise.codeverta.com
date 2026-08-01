package controller

import (
	"gin-template/model"
	"gin-template/repository"
	"net/http"
	"sort"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type DashboardController struct {
	OrderRepository       repository.DashboardRepository
	ParticipantRepository repository.ParticipantStatRepository
}

func NewDashboardController(repo repository.DashboardRepository, participantRepo repository.ParticipantStatRepository) *DashboardController {
	return &DashboardController{OrderRepository: repo, ParticipantRepository: participantRepo}
}

func (ctrl *DashboardController) GetOverview(c *gin.Context) {
	db := model.GetDB(c)
	// 1. Parse Date Range
	endDate := c.DefaultQuery("end_date", time.Now().UTC().Format("2006-01-02"))
	startDate := c.DefaultQuery("start_date", time.Now().UTC().AddDate(0, 0, -30).Format("2006-01-02"))

	partStats, err := ctrl.ParticipantRepository.GetStats(c, startDate, endDate)
	if err != nil {
		zap.L().Error("Failed to fetch participant stats", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch participants: " + err.Error()})
		return
	}

	var totalRev float64
	var totalTx int64

	// 4. Agregasi Participant Stats
	var totalParticipants int64
	summaryGender := make(map[string]int64)
	summaryCategory := make(map[string]int64)
	summarySize := make(map[string]int64)
	summaryAge := make(map[string]int64)
	summaryProvinceID := make(map[string]int64)
	summaryCountry := make(map[string]int64)
	summaryProvinceName := make(map[string]int64)

	for _, s := range partStats {
		totalParticipants += s.TotalParticipants
		mergeMap(summaryGender, s.GenderBreakdown)
		mergeMap(summaryCategory, s.CategoryBreakdown)
		mergeMap(summarySize, s.JerseySizeBreakdown)
		mergeMap(summaryAge, s.AgeGroupBreakdown)
		mergeMap(summaryProvinceID, s.ProvinceBreakdown)
		mergeMap(summaryCountry, s.CountryBreakdown)
	}

	// Ambil list ID unik dari hasil loop di atas
	var provIDs []string
	for id := range summaryProvinceID {
		provIDs = append(provIDs, id)
	}

	if len(provIDs) > 0 {
		type Province struct {
			ID   string `gorm:"column:id"`
			Name string `gorm:"column:name"`
		}
		var provinces []Province

		// 1. Ganti pencarian menjadi "id IN ?"
		db.Set("skip_tenant_scope", true).Table("reg_provinces").Where("id IN ?", provIDs).Find(&provinces)

		// 2. Buat lookup map dengan KEY = ID
		provNameMap := make(map[string]string)
		for _, p := range provinces {
			provNameMap[p.ID] = p.Name
		}

		// 3. Cari nama menggunakan ID
		for id, count := range summaryProvinceID {
			name, exists := provNameMap[id]
			if !exists {
				name = "Unknown (" + id + ")"
			}
			summaryProvinceName[name] += count
		}
	}

	// 5. Return Combined JSON
	lmsOverview := ctrl.buildLMSOverview(c, db, startDate, endDate)
	c.JSON(http.StatusOK, gin.H{

		// LEGACY
		"summary": gin.H{
			"revenue":      totalRev,
			"transactions": totalTx,
		},
		"chart_data": []interface{}{},
		"meta": gin.H{
			"start_date": startDate,
			"end_date":   endDate,
		},
		// NEW
		"orders": gin.H{
			"summary": gin.H{
				"total_revenue":      totalRev,
				"total_transactions": totalTx,
			},
			"daily_stats": []interface{}{},
		},
		"participants": gin.H{
			"summary": gin.H{
				"total_participants": totalParticipants,
				"by_gender":          summaryGender,
				"by_category":        summaryCategory,
				"by_jersey_size":     summarySize,
				"by_age_group":       summaryAge,
				"by_province":        summaryProvinceName,
				"by_country":         summaryCountry,
			},
			"daily_stats": partStats,
		},
		"lms": lmsOverview,
	})
}

// Helper kecil untuk merge map di controller (biar rapi)
func mergeMap(dest, src map[string]int64) {
	for k, v := range src {
		dest[k] += v
	}
}

func (ctrl *DashboardController) buildLMSOverview(c *gin.Context, db *gorm.DB, startDate, endDate string) gin.H {
	userID, _ := uuid.Parse(c.GetString("id"))
	roleValue := 0
	if role, ok := c.Get("role"); ok {
		if parsed, ok := role.(int); ok {
			roleValue = parsed
		}
	}
	payload := gin.H{
		"student":    ctrl.buildStudentLMSDashboard(db, userID),
		"instructor": ctrl.buildInstructorLMSDashboard(db),
		"admin":      ctrl.buildAdminLMSDashboard(db, startDate, endDate),
		"role":       roleValue,
	}
	return payload
}

func (ctrl *DashboardController) buildStudentLMSDashboard(db *gorm.DB, userID uuid.UUID) gin.H {
	now := time.Now()
	var subscriptions []model.Subscription
	db.Where("student_id = ? AND status IN ?", userID, []model.SubscriptionStatus{model.SubscriptionStatusActive, model.SubscriptionStatusTrialing}).
		Where("(current_period_end IS NULL OR current_period_end >= ?)", now).
		Find(&subscriptions)

	courseIDs := map[uuid.UUID]bool{}
	for _, sub := range subscriptions {
		if sub.CourseID != nil {
			courseIDs[*sub.CourseID] = true
		}
	}
	var courses []model.Course
	if len(subscriptions) > 0 {
		query := db.Where("status = ?", model.CourseStatusPublished)
		if len(courseIDs) > 0 {
			ids := make([]uuid.UUID, 0, len(courseIDs))
			for id := range courseIDs {
				ids = append(ids, id)
			}
			query = query.Where("id IN ?", ids)
		}
		query.Order("sort_order asc, created_at desc").Limit(20).Find(&courses)
	}

	progressItems := make([]gin.H, 0, len(courses))
	totalLessonsAll, completedLessonsAll := int64(0), int64(0)
	completedModules, remainingModules := int64(0), int64(0)
	var resume gin.H

	for _, course := range courses {
		var modules []model.Module
		db.Where("course_id = ?", course.ID).Order("sort_order asc").Find(&modules)
		courseTotal, courseCompleted := int64(0), int64(0)
		for _, module := range modules {
			var lessonIDs []uuid.UUID
			db.Model(&model.Lesson{}).Where("module_id = ?", module.ID).Pluck("id", &lessonIDs)
			lessonCount := int64(len(lessonIDs))
			completedCount := int64(0)
			if lessonCount > 0 {
				db.Model(&model.StudentProgress{}).Where("student_id = ? AND lesson_id IN ? AND is_completed = ?", userID, lessonIDs, true).Count(&completedCount)
			}
			courseTotal += lessonCount
			courseCompleted += completedCount
			if lessonCount > 0 && completedCount >= lessonCount {
				completedModules++
			} else {
				remainingModules++
			}
		}
		totalLessonsAll += courseTotal
		completedLessonsAll += courseCompleted
		percent := 0.0
		if courseTotal > 0 {
			percent = float64(courseCompleted) / float64(courseTotal) * 100
		}
		progressItems = append(progressItems, gin.H{"course_id": course.ID, "course_title": course.Title, "progress_percent": percent, "completed_lessons": courseCompleted, "total_lessons": courseTotal})
	}

	var lastProgress model.StudentProgress
	if err := db.Where("student_id = ?", userID).Order("updated_at desc").First(&lastProgress).Error; err == nil {
		var lesson model.Lesson
		var module model.Module
		var course model.Course
		if db.First(&lesson, "id = ?", lastProgress.LessonID).Error == nil && db.First(&module, "id = ?", lastProgress.ModuleID).Error == nil && db.First(&course, "id = ?", lastProgress.CourseID).Error == nil {
			resume = gin.H{"lesson_id": lesson.ID, "lesson_title": lesson.Title, "module_title": module.Title, "course_title": course.Title, "last_seen_at": lastProgress.UpdatedAt}
		}
	}

	overall := 0.0
	if totalLessonsAll > 0 {
		overall = float64(completedLessonsAll) / float64(totalLessonsAll) * 100
	}
	var totalStudySec int64
	db.Model(&model.StudentProgress{}).Where("student_id = ?", userID).Select("COALESCE(SUM(last_position_sec), 0)").Scan(&totalStudySec)
	activeCourses := int64(len(courses))
	var quizCompleted int64
	db.Model(&model.QuizAttempt{}).Where("student_id = ? AND status IN ?", userID, []model.QuizAttemptStatus{model.QuizAttemptPassed, model.QuizAttemptFailed, model.QuizAttemptExpired}).Count(&quizCompleted)

	accessibleCourseIDs := make([]uuid.UUID, 0, len(courses))
	for _, course := range courses {
		accessibleCourseIDs = append(accessibleCourseIDs, course.ID)
	}
	deadlines := []gin.H{}
	if len(courses) > 0 {
		deadlines = ctrl.quizDeadlines(db, accessibleCourseIDs, now)
	}
	latestGrades := ctrl.latestGrades(db, userID)
	achievements := []gin.H{}
	if completedLessonsAll > 0 {
		achievements = append(achievements, gin.H{"title": "First Lesson Completed", "description": "Mulai konsisten belajar"})
	}
	if quizCompleted >= 5 {
		achievements = append(achievements, gin.H{"title": "Quiz Master", "description": "Menyelesaikan 5+ quiz"})
	}
	if overall >= 100 {
		achievements = append(achievements, gin.H{"title": "First Course Completed", "description": "Course pertama selesai"})
	}

	return gin.H{
		"learning_progress": gin.H{"overall_percent": overall, "completed_modules": completedModules, "remaining_modules": remainingModules, "courses": progressItems},
		"continue_learning": resume,
		"deadlines":         deadlines,
		"upcoming_classes":  ctrl.upcomingClasses(db, userID, now),
		"certificates":      gin.H{"earned": completedModules, "completed_courses": countCompletedCourses(progressItems)},
		"study_stats":       gin.H{"total_study_hours": totalStudySec / 3600, "streak_days": calculateStudyStreak(db, userID), "active_courses": activeCourses, "quizzes_completed": quizCompleted},
		"latest_grades":     latestGrades,
		"achievements":      achievements,
		"announcements":     []gin.H{},
	}
}

func (ctrl *DashboardController) buildAdminLMSDashboard(db *gorm.DB, startDate, endDate string) gin.H {
	var monthRevenue, todayRevenue float64
	var totalTransactions int64
	monthStart := time.Now().Format("2006-01") + "-01"
	today := time.Now().Format("2006-01-02")
	db.Model(&model.LMSPayment{}).Where("status = ? AND DATE(created_at) >= ?", model.LMSPaymentPaid, monthStart).Select("COALESCE(SUM(amount), 0)").Scan(&monthRevenue)
	db.Model(&model.LMSPayment{}).Where("status = ? AND DATE(created_at) = ?", model.LMSPaymentPaid, today).Select("COALESCE(SUM(amount), 0)").Scan(&todayRevenue)
	db.Model(&model.LMSPayment{}).Where("status = ?", model.LMSPaymentPaid).Select("COUNT(*)").Scan(&totalTransactions)

	var totalStudents, activeToday, newRegistrations int64
	db.Model(&model.User{}).Where("role IN ?", []int{10, 20}).Count(&totalStudents)
	db.Model(&model.StudentProgress{}).Where("DATE(updated_at) = ?", today).Distinct("student_id").Count(&activeToday)
	db.Model(&model.User{}).Where("role IN ? AND DATE(created_at) BETWEEN ? AND ?", []int{10, 20}, startDate, endDate).Count(&newRegistrations)

	return gin.H{
		"revenue":          gin.H{"month": monthRevenue, "today": todayRevenue, "total_transactions": totalTransactions},
		"users":            gin.H{"total_students": totalStudents, "active_today": activeToday, "new_registrations": newRegistrations},
		"course_analytics": gin.H{"top_selling_courses": topSellingCourses(db), "top_completion_courses": topCompletionCourses(db), "top_rated_courses": topRatedCourses(db)},
	}
}

func (ctrl *DashboardController) buildInstructorLMSDashboard(db *gorm.DB) gin.H {
	var totalStudents, activeCourses, pendingReview int64
	db.Model(&model.User{}).Where("role IN ?", []int{10, 20}).Count(&totalStudents)
	db.Model(&model.Course{}).Where("status = ?", model.CourseStatusPublished).Count(&activeCourses)
	db.Model(&model.QuizAnswer{}).Where("points_awarded = 0").Count(&pendingReview)
	return gin.H{
		"summary":         gin.H{"total_students": totalStudents, "active_courses": activeCourses, "assignment_pending_review": pendingReview, "average_completion_rate": 0},
		"recent_activity": []gin.H{},
		"analytics":       gin.H{"course_completion_rate": topCompletionCourses(db), "average_score": averageQuizScore(db), "most_active_students": mostActiveStudents(db), "most_viewed_courses": []gin.H{}},
	}
}

func (ctrl *DashboardController) quizDeadlines(db *gorm.DB, courseIDs []uuid.UUID, now time.Time) []gin.H {
	if len(courseIDs) == 0 {
		return []gin.H{}
	}
	var quizzes []model.Quiz
	db.Where("course_id IN ? AND is_published = ? AND available_until IS NOT NULL AND available_until >= ?", courseIDs, true, now).Order("available_until asc").Limit(5).Find(&quizzes)
	items := []gin.H{}
	for _, quiz := range quizzes {
		items = append(items, gin.H{"title": quiz.Title, "deadline": quiz.AvailableUntil, "type": "Quiz"})
	}
	return items
}

func (ctrl *DashboardController) latestGrades(db *gorm.DB, userID uuid.UUID) []gin.H {
	var attempts []model.QuizAttempt
	db.Preload("Quiz").Where("student_id = ? AND status != ?", userID, model.QuizAttemptInProgress).Order("submitted_at desc").Limit(5).Find(&attempts)
	items := []gin.H{}
	for _, attempt := range attempts {
		items = append(items, gin.H{"title": attempt.Quiz.Title, "score": attempt.Score, "submitted_at": attempt.SubmittedAt})
	}
	return items
}

func (ctrl *DashboardController) upcomingClasses(db *gorm.DB, userID uuid.UUID, now time.Time) []gin.H {
	var classIDs []uuid.UUID
	db.Model(&model.ClassStudent{}).Where("student_id = ?", userID).Pluck("class_id", &classIDs)
	if len(classIDs) == 0 {
		return []gin.H{}
	}

	var classes []model.Class
	db.Preload("Course").Where("id IN ? AND is_active = ? AND start_date >= ?", classIDs, true, now).
		Order("start_date asc").Limit(5).Find(&classes)
	items := []gin.H{}
	for _, class := range classes {
		items = append(items, gin.H{"class_id": class.ID, "title": class.Name, "course_title": class.Course.Title, "start_date": class.StartDate})
	}
	return items
}

func countCompletedCourses(items []gin.H) int {
	total := 0
	for _, item := range items {
		if percent, ok := item["progress_percent"].(float64); ok && percent >= 100 {
			total++
		}
	}
	return total
}

func calculateStudyStreak(db *gorm.DB, userID uuid.UUID) int {
	var dates []string
	db.Model(&model.StudentProgress{}).Where("student_id = ?", userID).Order("DATE(updated_at) desc").Distinct("DATE(updated_at)").Limit(30).Pluck("DATE(updated_at)", &dates)
	streak := 0
	expected := time.Now()
	for _, date := range dates {
		if date == expected.Format("2006-01-02") {
			streak++
			expected = expected.AddDate(0, 0, -1)
		}
	}
	return streak
}

func topSellingCourses(db *gorm.DB) []gin.H {
	type row struct {
		CourseID string
		Total    int64
	}
	rows := []row{}
	db.Model(&model.Subscription{}).Select("course_id, COUNT(*) as total").Where("course_id IS NOT NULL").Group("course_id").Order("total desc").Limit(5).Scan(&rows)
	items := []gin.H{}
	for _, row := range rows {
		var course model.Course
		if db.First(&course, "id = ?", row.CourseID).Error == nil {
			items = append(items, gin.H{"course_id": row.CourseID, "title": course.Title, "total": row.Total})
		}
	}
	return items
}

func topCompletionCourses(db *gorm.DB) []gin.H {
	var courses []model.Course
	db.Where("status = ?", model.CourseStatusPublished).Limit(10).Find(&courses)
	items := []gin.H{}
	for _, course := range courses {
		var total, completed int64
		db.Model(&model.StudentProgress{}).Where("course_id = ?", course.ID).Count(&total)
		db.Model(&model.StudentProgress{}).Where("course_id = ? AND is_completed = ?", course.ID, true).Count(&completed)
		rate := 0.0
		if total > 0 {
			rate = float64(completed) / float64(total) * 100
		}
		items = append(items, gin.H{"course_id": course.ID, "title": course.Title, "completion_rate": rate})
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i]["completion_rate"].(float64) > items[j]["completion_rate"].(float64)
	})
	if len(items) > 5 {
		return items[:5]
	}
	return items
}

func averageQuizScore(db *gorm.DB) float64 {
	var avg float64
	db.Model(&model.QuizAttempt{}).Where("status != ?", model.QuizAttemptInProgress).Select("COALESCE(AVG(score), 0)").Scan(&avg)
	return avg
}

func mostActiveStudents(db *gorm.DB) []gin.H {
	type row struct {
		StudentID string
		Total     int64
	}
	rows := []row{}
	db.Model(&model.StudentProgress{}).Select("student_id, COUNT(*) as total").Group("student_id").Order("total desc").Limit(5).Scan(&rows)
	items := []gin.H{}
	for _, row := range rows {
		var user model.User
		name := row.StudentID
		if db.First(&user, "id = ?", row.StudentID).Error == nil {
			name = user.DisplayName
			if name == "" {
				name = user.FirstName + " " + user.LastName
			}
		}
		items = append(items, gin.H{"student_id": row.StudentID, "name": name, "activity_count": row.Total})
	}
	return items
}

func topRatedCourses(_ *gorm.DB) []gin.H {
	return []gin.H{}
}
