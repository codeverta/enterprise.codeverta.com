package controller

import (
	"errors"
	"gin-template/model"
	"math"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type CourseCategoryProgress struct {
	CourseID        uuid.UUID `json:"course_id"`
	CourseTitle     string    `json:"course_title"`
	CategoryID      uuid.UUID `json:"category_id"`
	CategoryName    string    `json:"category_name"`
	ProgressPercent float64   `json:"progress_percent"`
	AverageScore    *float64  `json:"average_score"`
}

type parentStudentStats struct {
	StudentID             uuid.UUID                `json:"student_id"`
	ID                    uuid.UUID                `json:"id"`
	Name                  string                   `json:"name"`
	FullName              string                   `json:"full_name"`
	FirstName             string                   `json:"first_name"`
	LastName              string                   `json:"last_name"`
	Email                 string                   `json:"email"`
	PhoneNumber           string                   `json:"phone_number"`
	AvatarURL             string                   `json:"avatar_url"`
	SubscriptionStatus    string                   `json:"subscription_status"`
	SubscriptionPlan      string                   `json:"subscription_plan"`
	SubscriptionStart     *time.Time               `json:"subscription_start"`
	SubscriptionExpiry    *time.Time               `json:"subscription_expiry"`
	RemainingDays         *int                     `json:"remaining_days"`
	CoursesStarted        int64                    `json:"courses_started"`
	CoursesCompleted      int64                    `json:"courses_completed"`
	LessonsCompleted      int64                    `json:"lessons_completed"`
	LessonsInProgress     int64                    `json:"lessons_in_progress"`
	AverageProgress       float64                  `json:"average_progress_percentage"`
	AssignmentsSubmitted  int64                    `json:"assignments_submitted"`
	AssignmentsGraded     int64                    `json:"assignments_graded"`
	AssignmentsReturned   int64                    `json:"assignments_returned"`
	AverageScore          *float64                 `json:"average_score"`
	LatestSubmissionAt    *time.Time               `json:"latest_assignment_submission"`
	LatestGradeAt         *time.Time               `json:"latest_assignment_grade"`
	LastActivityAt        *time.Time               `json:"last_activity_at"`
	LastOnlineAt          *time.Time               `json:"last_online_at"`
	IsOnline              bool                     `json:"is_online"`
	CourseProgressDetails []CourseCategoryProgress `json:"course_progress_details"`
}

type parentActivityItem struct {
	Type        string     `json:"type"`
	Title       string     `json:"title"`
	Description string     `json:"description"`
	CourseID    string     `json:"course_id,omitempty"`
	CourseName  string     `json:"course_name,omitempty"`
	OccurredAt  *time.Time `json:"occurred_at"`
}

func requireParentUser(c *gin.Context) (uuid.UUID, bool) {
	userID, role, ok := currentLMSUser(c)
	if !ok {
		return uuid.Nil, false
	}
	if role != 10 {
		sendError(c, http.StatusForbidden, "Parent access is required", nil)
		return uuid.Nil, false
	}
	return userID, true
}

func (ctrl *LMSController) validateParentStudent(c *gin.Context, parentID uuid.UUID, studentID uuid.UUID) bool {
	var count int64
	err := lmsDB(c, ctrl.DB).Model(&model.Membership{}).
		Where("parent_id = ? AND student_id = ? AND status = ?", parentID, studentID, "active").
		Count(&count).Error
	if err != nil {
		sendInternalError(c, err)
		return false
	}
	if count == 0 {
		sendError(c, http.StatusForbidden, "Student does not belong to this parent", nil)
		return false
	}
	return true
}

func (ctrl *LMSController) listParentStudentIDs(c *gin.Context, parentID uuid.UUID) ([]uuid.UUID, error) {
	var memberships []model.Membership
	if err := lmsDB(c, ctrl.DB).Where("parent_id = ? AND status = ?", parentID, "active").Find(&memberships).Error; err != nil {
		return nil, err
	}
	ids := make([]uuid.UUID, 0, len(memberships))
	for _, membership := range memberships {
		ids = append(ids, membership.StudentID)
	}
	return ids, nil
}

func studentDisplayName(user model.User) string {
	name := strings.TrimSpace(user.DisplayName)
	if name == "" {
		name = strings.TrimSpace(user.FirstName + " " + user.LastName)
	}
	if name == "" {
		name = user.Username
	}
	if name == "" {
		name = user.Email
	}
	return name
}

func scoreAverageFromAssignments(assignments []model.Assignment) *float64 {
	total := 0.0
	count := 0.0
	for _, assignment := range assignments {
		if assignment.Score == nil || assignment.MaxScore <= 0 {
			continue
		}
		total += (*assignment.Score / assignment.MaxScore) * 100
		count++
	}
	if count == 0 {
		return nil
	}
	avg := math.Round((total/count)*10) / 10
	return &avg
}

func latestTime(times ...*time.Time) *time.Time {
	var latest *time.Time
	for _, value := range times {
		if value == nil {
			continue
		}
		if latest == nil || value.After(*latest) {
			copyValue := *value
			latest = &copyValue
		}
	}
	return latest
}

func latestProgressActivity(progress []model.StudentProgress) *time.Time {
	var latest *time.Time
	for _, item := range progress {
		latest = latestTime(latest, &item.UpdatedAt, item.CompletedAt)
	}
	return latest
}

func latestAssignmentActivity(assignments []model.Assignment) *time.Time {
	var latest *time.Time
	for _, item := range assignments {
		latest = latestTime(latest, &item.CreatedAt, item.GradedAt)
	}
	return latest
}

func activeSubscriptionInfo(now time.Time, subscriptions []model.Subscription, plans map[string]model.SubscriptionPlan) (string, string, *time.Time, *time.Time, *int) {
	if len(subscriptions) == 0 {
		return "none", "", nil, nil, nil
	}
	sort.SliceStable(subscriptions, func(i, j int) bool {
		left := subscriptions[i].CurrentPeriodEnd
		right := subscriptions[j].CurrentPeriodEnd
		if left == nil {
			return true
		}
		if right == nil {
			return false
		}
		return left.After(*right)
	})
	selected := subscriptions[0]
	status := string(selected.Status)
	if (selected.Status == model.SubscriptionStatusActive || selected.Status == model.SubscriptionStatusTrialing) &&
		(selected.CurrentPeriodEnd == nil || selected.CurrentPeriodEnd.After(now)) {
		status = "active"
	} else if selected.Status == model.SubscriptionStatusPastDue {
		status = "pending_renewal"
	} else {
		status = "expired"
	}
	var days *int
	if selected.CurrentPeriodEnd != nil && selected.CurrentPeriodEnd.After(now) {
		value := int(math.Ceil(selected.CurrentPeriodEnd.Sub(now).Hours() / 24))
		days = &value
	}
	planKey := selected.ProviderPlanID
	if selected.PlanID != nil && *selected.PlanID != uuid.Nil {
		planKey = selected.PlanID.String()
	}
	planName := ""
	if plan, ok := plans[planKey]; ok {
		planName = plan.Name
	}
	return status, planName, selected.CurrentPeriodStart, selected.CurrentPeriodEnd, days
}

func (ctrl *LMSController) parentStudentStats(c *gin.Context, studentIDs []uuid.UUID) ([]parentStudentStats, error) {
	if len(studentIDs) == 0 {
		return []parentStudentStats{}, nil
	}
	db := lmsDB(c, ctrl.DB)
	now := time.Now()

	var users []model.User
	if err := db.Find(&users, "id IN ?", studentIDs).Error; err != nil {
		return nil, err
	}
	usersByID := map[uuid.UUID]model.User{}
	for _, user := range users {
		usersByID[user.ID] = user
	}
	onlineIDs := map[string]bool{}
	if tenant, ok := currentTenant(c); ok {
		for _, id := range GetOnlineTracker(ctrl.DB).GetOnlineUserIDs(tenant.ID.String()) {
			onlineIDs[id] = true
		}
	}

	var profiles []model.Profile
	_ = db.Where("user_id IN ?", studentIDs).Find(&profiles).Error
	avatarsByUserID := map[uuid.UUID]string{}
	for _, profile := range profiles {
		avatarsByUserID[profile.UserID] = profile.AvatarURL
	}

	var subscriptions []model.Subscription
	if err := db.Where("student_id IN ?", studentIDs).Find(&subscriptions).Error; err != nil {
		return nil, err
	}
	planIDs := make([]uuid.UUID, 0)
	seenPlans := map[uuid.UUID]bool{}
	for _, subscription := range subscriptions {
		planID, err := uuid.Parse(subscription.ProviderPlanID)
		if err == nil && planID != uuid.Nil && !seenPlans[planID] {
			seenPlans[planID] = true
			planIDs = append(planIDs, planID)
		}
		if subscription.PlanID != nil && *subscription.PlanID != uuid.Nil && !seenPlans[*subscription.PlanID] {
			seenPlans[*subscription.PlanID] = true
			planIDs = append(planIDs, *subscription.PlanID)
		}
	}
	plansByID := map[string]model.SubscriptionPlan{}
	if len(planIDs) > 0 {
		var plans []model.SubscriptionPlan
		if err := db.Find(&plans, "id IN ?", planIDs).Error; err != nil {
			return nil, err
		}
		for _, plan := range plans {
			plansByID[plan.ID.String()] = plan
		}
	}
	subscriptionsByStudent := map[uuid.UUID][]model.Subscription{}
	for _, subscription := range subscriptions {
		subscriptionsByStudent[subscription.StudentID] = append(subscriptionsByStudent[subscription.StudentID], subscription)
	}

	var progress []model.StudentProgress
	if err := db.Where("student_id IN ?", studentIDs).Find(&progress).Error; err != nil {
		return nil, err
	}
	progressByStudent := map[uuid.UUID][]model.StudentProgress{}
	for _, item := range progress {
		progressByStudent[item.StudentID] = append(progressByStudent[item.StudentID], item)
	}

	var assignments []model.Assignment
	if err := db.Where("student_id IN ?", studentIDs).Find(&assignments).Error; err != nil {
		return nil, err
	}
	assignmentsByStudent := map[uuid.UUID][]model.Assignment{}
	for _, item := range assignments {
		assignmentsByStudent[item.StudentID] = append(assignmentsByStudent[item.StudentID], item)
	}

	var categories []model.CourseCategory
	_ = db.Find(&categories).Error
	categoryMap := map[uuid.UUID]model.CourseCategory{}
	for _, cat := range categories {
		categoryMap[cat.ID] = cat
	}

	var courses []model.Course
	_ = db.Preload("CourseCategory").Find(&courses).Error
	courseMap := map[uuid.UUID]model.Course{}
	for _, c := range courses {
		courseMap[c.ID] = c
	}

	var modules []model.Module
	_ = db.Find(&modules).Error
	moduleToCourse := map[uuid.UUID]uuid.UUID{}
	for _, m := range modules {
		moduleToCourse[m.ID] = m.CourseID
	}

	var lessons []model.Lesson
	_ = db.Find(&lessons).Error
	lessonToCourse := map[uuid.UUID]uuid.UUID{}
	lessonsByCourse := map[uuid.UUID]int{}
	for _, l := range lessons {
		if courseID, ok := moduleToCourse[l.ModuleID]; ok {
			lessonToCourse[l.ID] = courseID
			lessonsByCourse[courseID]++
		}
	}

	var quizProgress []model.QuizProgress
	_ = db.Where("student_id IN ?", studentIDs).Find(&quizProgress).Error

	completedByStudentCourse := map[uuid.UUID]map[uuid.UUID]int{}
	for _, sp := range progress {
		if sp.IsCompleted {
			if _, ok := completedByStudentCourse[sp.StudentID]; !ok {
				completedByStudentCourse[sp.StudentID] = map[uuid.UUID]int{}
			}
			completedByStudentCourse[sp.StudentID][sp.CourseID]++
		}
	}

	quizScoresByStudentCourse := map[uuid.UUID]map[uuid.UUID][]float64{}
	for _, qp := range quizProgress {
		if _, ok := quizScoresByStudentCourse[qp.StudentID]; !ok {
			quizScoresByStudentCourse[qp.StudentID] = map[uuid.UUID][]float64{}
		}
		if qp.BestAttemptID != nil {
			quizScoresByStudentCourse[qp.StudentID][qp.CourseID] = append(quizScoresByStudentCourse[qp.StudentID][qp.CourseID], qp.BestScore)
		}
	}

	assignmentScoresByStudentCourse := map[uuid.UUID]map[uuid.UUID][]float64{}
	for _, asg := range assignments {
		if asg.Score != nil && asg.MaxScore > 0 {
			if courseID, ok := lessonToCourse[asg.LessonID]; ok {
				if _, ok := assignmentScoresByStudentCourse[asg.StudentID]; !ok {
					assignmentScoresByStudentCourse[asg.StudentID] = map[uuid.UUID][]float64{}
				}
				pct := (*asg.Score / asg.MaxScore) * 100
				assignmentScoresByStudentCourse[asg.StudentID][courseID] = append(assignmentScoresByStudentCourse[asg.StudentID][courseID], pct)
			}
		}
	}

	stats := make([]parentStudentStats, 0, len(studentIDs))
	for _, studentID := range studentIDs {
		user, ok := usersByID[studentID]
		if !ok {
			continue
		}
		studentProgress := progressByStudent[studentID]
		studentAssignments := assignmentsByStudent[studentID]
		coursesStarted := map[uuid.UUID]bool{}
		coursesCompleted := map[uuid.UUID]bool{}
		lessonsCompleted := int64(0)
		lessonsInProgress := int64(0)
		progressTotal := 0.0
		for _, item := range studentProgress {
			coursesStarted[item.CourseID] = true
			if item.IsCompleted {
				lessonsCompleted++
			} else {
				lessonsInProgress++
			}
			progressTotal += item.ProgressPercent
		}
		for courseID := range coursesStarted {
			total := 0
			completed := 0
			for _, item := range studentProgress {
				if item.CourseID != courseID {
					continue
				}
				total++
				if item.IsCompleted {
					completed++
				}
			}
			if total > 0 && completed == total {
				coursesCompleted[courseID] = true
			}
		}

		assignmentsGraded := int64(0)
		assignmentsReturned := int64(0)
		var latestSubmission *time.Time
		var latestGrade *time.Time
		for _, assignment := range studentAssignments {
			if assignment.Status == model.AssignmentStatusGraded || assignment.GradedAt != nil {
				assignmentsGraded++
			}
			if assignment.Status == model.AssignmentStatusReturned {
				assignmentsReturned++
			}
			latestSubmission = latestTime(latestSubmission, &assignment.CreatedAt)
			latestGrade = latestTime(latestGrade, assignment.GradedAt)
		}
		averageProgress := 0.0
		if len(studentProgress) > 0 {
			averageProgress = math.Round((progressTotal/float64(len(studentProgress)))*10) / 10
		}
		subscriptionStatus, subscriptionPlan, subscriptionStart, subscriptionExpiry, remainingDays := activeSubscriptionInfo(now, subscriptionsByStudent[studentID], plansByID)
		name := studentDisplayName(user)
		// Collect all course IDs with progress, quiz, or assignments
		activeCourseIDs := map[uuid.UUID]bool{}
		for _, sp := range studentProgress {
			activeCourseIDs[sp.CourseID] = true
		}
		for _, qp := range quizProgress {
			if qp.StudentID == studentID && qp.BestAttemptID != nil {
				activeCourseIDs[qp.CourseID] = true
			}
		}
		for _, asg := range studentAssignments {
			if courseID, ok := lessonToCourse[asg.LessonID]; ok {
				activeCourseIDs[courseID] = true
			}
		}

		var details []CourseCategoryProgress
		for courseID := range activeCourseIDs {
			course, ok := courseMap[courseID]
			if !ok {
				continue
			}

			// Calculate progress percent
			totalLessons := lessonsByCourse[courseID]
			completedLessons := 0
			if completedMap, ok := completedByStudentCourse[studentID]; ok {
				completedLessons = completedMap[courseID]
			}
			progressPercent := 0.0
			if totalLessons > 0 {
				progressPercent = (float64(completedLessons) / float64(totalLessons)) * 100
			}

			// Calculate average score
			var scores []float64
			if qScoresMap, ok := quizScoresByStudentCourse[studentID]; ok {
				scores = append(scores, qScoresMap[courseID]...)
			}
			if aScoresMap, ok := assignmentScoresByStudentCourse[studentID]; ok {
				scores = append(scores, aScoresMap[courseID]...)
			}

			var avgScore *float64
			if len(scores) > 0 {
				sum := 0.0
				for _, s := range scores {
					sum += s
				}
				avg := math.Round((sum/float64(len(scores)))*10) / 10
				avgScore = &avg
			}

			details = append(details, CourseCategoryProgress{
				CourseID:        courseID,
				CourseTitle:     course.Title,
				CategoryID:      course.CourseCategoryID,
				CategoryName:    course.CourseCategory.Name,
				ProgressPercent: progressPercent,
				AverageScore:    avgScore,
			})
		}

		stats = append(stats, parentStudentStats{
			StudentID:             studentID,
			ID:                    studentID,
			Name:                  name,
			FullName:              name,
			FirstName:             user.FirstName,
			LastName:              user.LastName,
			Email:                 user.Email,
			PhoneNumber:           user.PhoneNumber,
			AvatarURL:             avatarsByUserID[studentID],
			SubscriptionStatus:    subscriptionStatus,
			SubscriptionPlan:      subscriptionPlan,
			SubscriptionStart:     subscriptionStart,
			SubscriptionExpiry:    subscriptionExpiry,
			RemainingDays:         remainingDays,
			CoursesStarted:        int64(len(coursesStarted)),
			CoursesCompleted:      int64(len(coursesCompleted)),
			LessonsCompleted:      lessonsCompleted,
			LessonsInProgress:     lessonsInProgress,
			AverageProgress:       averageProgress,
			AssignmentsSubmitted:  int64(len(studentAssignments)),
			AssignmentsGraded:     assignmentsGraded,
			AssignmentsReturned:   assignmentsReturned,
			AverageScore:          scoreAverageFromAssignments(studentAssignments),
			LatestSubmissionAt:    latestSubmission,
			LatestGradeAt:         latestGrade,
			LastActivityAt:        latestTime(latestProgressActivity(studentProgress), latestAssignmentActivity(studentAssignments)),
			LastOnlineAt:          user.LastActiveAt,
			IsOnline:              onlineIDs[studentID.String()],
			CourseProgressDetails: details,
		})
	}
	return stats, nil
}

func (ctrl *LMSController) ParentDashboardSummary(c *gin.Context) {
	parentID, ok := requireParentUser(c)
	if !ok {
		return
	}
	studentIDs, err := ctrl.listParentStudentIDs(c, parentID)
	if err != nil {
		sendInternalError(c, err)
		return
	}
	stats, err := ctrl.parentStudentStats(c, studentIDs)
	if err != nil {
		sendInternalError(c, err)
		return
	}
	summary := gin.H{
		"total_children":        len(stats),
		"active_subscriptions":  0,
		"expired_subscriptions": 0,
		"courses_started":       int64(0),
		"courses_completed":     int64(0),
		"lessons_completed":     int64(0),
		"assignments_submitted": int64(0),
		"assignments_graded":    int64(0),
		"average_score":         nil,
		"last_activity_at":      nil,
	}
	scoreTotal := 0.0
	scoreCount := 0.0
	var lastActivity *time.Time
	for _, item := range stats {
		if item.SubscriptionStatus == "active" {
			summary["active_subscriptions"] = summary["active_subscriptions"].(int) + 1
		}
		if item.SubscriptionStatus == "expired" || item.SubscriptionStatus == "none" {
			summary["expired_subscriptions"] = summary["expired_subscriptions"].(int) + 1
		}
		summary["courses_started"] = summary["courses_started"].(int64) + item.CoursesStarted
		summary["courses_completed"] = summary["courses_completed"].(int64) + item.CoursesCompleted
		summary["lessons_completed"] = summary["lessons_completed"].(int64) + item.LessonsCompleted
		summary["assignments_submitted"] = summary["assignments_submitted"].(int64) + item.AssignmentsSubmitted
		summary["assignments_graded"] = summary["assignments_graded"].(int64) + item.AssignmentsGraded
		if item.AverageScore != nil {
			scoreTotal += *item.AverageScore
			scoreCount++
		}
		lastActivity = latestTime(lastActivity, item.LastActivityAt)
	}
	if scoreCount > 0 {
		summary["average_score"] = math.Round((scoreTotal/scoreCount)*10) / 10
	}
	summary["last_activity_at"] = lastActivity
	sendSuccess(c, summary, "Parent dashboard summary retrieved successfully")
}

func (ctrl *LMSController) ListLinkedStudents(c *gin.Context) {
	parentID, ok := requireParentUser(c)
	if !ok {
		return
	}
	studentIDs, err := ctrl.listParentStudentIDs(c, parentID)
	if err != nil {
		sendInternalError(c, err)
		return
	}
	stats, err := ctrl.parentStudentStats(c, studentIDs)
	if err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccess(c, gin.H{"students": stats}, "Linked students retrieved successfully")
}

func (ctrl *LMSController) ParentStudentDetail(c *gin.Context) {
	userID, role, ok := currentLMSUser(c)
	if !ok {
		return
	}
	if role != 10 && role < 30 {
		sendError(c, http.StatusForbidden, "Hanya orang tua, mentor, atau admin yang dapat mengakses detail siswa", nil)
		return
	}
	studentID, err := uuid.Parse(c.Param("student_id"))
	if err != nil {
		sendBadRequest(c, "student_id is invalid", nil)
		return
	}
	if role == 10 {
		if !ctrl.validateParentStudent(c, userID, studentID) {
			return
		}
	}
	stats, err := ctrl.parentStudentStats(c, []uuid.UUID{studentID})
	if err != nil {
		sendInternalError(c, err)
		return
	}
	if len(stats) == 0 {
		sendError(c, http.StatusNotFound, "Student not found", nil)
		return
	}
	activity, err := ctrl.parentStudentActivity(c, studentID)
	if err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccess(c, gin.H{
		"student":            stats[0],
		"learning_summary":   stats[0],
		"assignment_summary": stats[0],
		"recent_activity":    activity,
	}, "Parent student detail retrieved successfully")
}

func (ctrl *LMSController) parentStudentActivity(c *gin.Context, studentID uuid.UUID) ([]parentActivityItem, error) {
	db := lmsDB(c, ctrl.DB)
	activity := make([]parentActivityItem, 0)
	var progress []model.StudentProgress
	if err := db.Where("student_id = ?", studentID).Order("updated_at desc").Limit(20).Find(&progress).Error; err != nil {
		return nil, err
	}
	courseIDs := make([]uuid.UUID, 0, len(progress))
	seenCourseIDs := make(map[uuid.UUID]struct{}, len(progress))
	for _, item := range progress {
		if item.CourseID == uuid.Nil {
			continue
		}
		if _, exists := seenCourseIDs[item.CourseID]; exists {
			continue
		}
		seenCourseIDs[item.CourseID] = struct{}{}
		courseIDs = append(courseIDs, item.CourseID)
	}
	courseNames := make(map[uuid.UUID]string, len(courseIDs))
	if len(courseIDs) > 0 {
		var courses []model.Course
		// Keep historical activity readable even if the course was archived later.
		if err := db.Unscoped().Model(&model.Course{}).
			Select("id", "title").
			Where("id IN ?", courseIDs).
			Find(&courses).Error; err != nil {
			return nil, err
		}
		for _, course := range courses {
			courseNames[course.ID] = course.Title
		}
	}
	for _, item := range progress {
		title := "Started lesson"
		when := item.UpdatedAt
		if item.IsCompleted && item.CompletedAt != nil {
			title = "Completed lesson"
			when = *item.CompletedAt
		}
		courseName := courseNames[item.CourseID]
		description := courseName
		if description == "" {
			description = item.LessonID.String()
		}
		activity = append(activity, parentActivityItem{
			Type:        "progress",
			Title:       title,
			Description: description,
			CourseID:    item.CourseID.String(),
			CourseName:  courseName,
			OccurredAt:  &when,
		})
	}
	var assignments []model.Assignment
	if err := db.Where("student_id = ?", studentID).Order("updated_at desc").Limit(20).Find(&assignments).Error; err != nil {
		return nil, err
	}
	for _, item := range assignments {
		submittedAt := item.CreatedAt
		activity = append(activity, parentActivityItem{Type: "assignment_submitted", Title: "Submitted assignment", Description: item.FileName, OccurredAt: &submittedAt})
		if item.GradedAt != nil {
			activity = append(activity, parentActivityItem{Type: "assignment_graded", Title: "Assignment graded", Description: item.FileName, OccurredAt: item.GradedAt})
		}
	}
	var subscriptions []model.Subscription
	if err := db.Where("student_id = ?", studentID).Order("updated_at desc").Limit(10).Find(&subscriptions).Error; err != nil {
		return nil, err
	}
	for _, item := range subscriptions {
		when := item.UpdatedAt
		activity = append(activity, parentActivityItem{Type: "subscription", Title: "Subscription updated", Description: string(item.Status), OccurredAt: &when})
	}
	sort.SliceStable(activity, func(i, j int) bool {
		if activity[i].OccurredAt == nil {
			return false
		}
		if activity[j].OccurredAt == nil {
			return true
		}
		return activity[i].OccurredAt.After(*activity[j].OccurredAt)
	})
	if len(activity) > 20 {
		activity = activity[:20]
	}
	return activity, nil
}

func (ctrl *LMSController) ParentStudentProgress(c *gin.Context) {
	userID, role, ok := currentLMSUser(c)
	if !ok {
		return
	}
	if role != 10 && role < 30 {
		sendError(c, http.StatusForbidden, "Hanya orang tua, mentor, atau admin yang dapat mengakses progress siswa", nil)
		return
	}
	studentID, err := uuid.Parse(c.Param("student_id"))
	if err != nil {
		sendBadRequest(c, "student_id is invalid", nil)
		return
	}
	if role == 10 {
		if !ctrl.validateParentStudent(c, userID, studentID) {
			return
		}
	}
	payload, err := ctrl.buildStudentProgressHierarchy(c, studentID)
	if err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccess(c, payload, "Parent student progress retrieved successfully")
}

func (ctrl *LMSController) buildStudentProgressHierarchy(c *gin.Context, studentID uuid.UUID) (gin.H, error) {
	db := lmsDB(c, ctrl.DB)
	var progress []model.StudentProgress
	if err := db.Where("student_id = ?", studentID).Order("updated_at desc").Find(&progress).Error; err != nil {
		return nil, err
	}
	if len(progress) == 0 {
		return gin.H{"courses": []gin.H{}}, nil
	}
	courseIDs := map[uuid.UUID]bool{}
	moduleIDs := map[uuid.UUID]bool{}
	lessonIDs := map[uuid.UUID]bool{}
	for _, item := range progress {
		courseIDs[item.CourseID] = true
		moduleIDs[item.ModuleID] = true
		lessonIDs[item.LessonID] = true
	}
	courses, modules, lessons, err := loadLearningMaps(db, courseIDs, moduleIDs, lessonIDs)
	if err != nil {
		return nil, err
	}
	progressByCourseModule := map[uuid.UUID]map[uuid.UUID][]model.StudentProgress{}
	for _, item := range progress {
		if _, ok := progressByCourseModule[item.CourseID]; !ok {
			progressByCourseModule[item.CourseID] = map[uuid.UUID][]model.StudentProgress{}
		}
		progressByCourseModule[item.CourseID][item.ModuleID] = append(progressByCourseModule[item.CourseID][item.ModuleID], item)
	}
	out := make([]gin.H, 0, len(progressByCourseModule))
	for courseID, modulesMap := range progressByCourseModule {
		courseProgress := flattenProgressModules(modulesMap)
		courseLessonsCompleted, courseAverage := progressStats(courseProgress)
		course := courses[courseID]
		moduleItems := make([]gin.H, 0, len(modulesMap))
		for moduleID, moduleProgress := range modulesMap {
			completed, average := progressStats(moduleProgress)
			lessonItems := make([]gin.H, 0, len(moduleProgress))
			for _, item := range moduleProgress {
				lesson := lessons[item.LessonID]
				lessonItems = append(lessonItems, gin.H{
					"lesson_id":         item.LessonID,
					"lesson_name":       lesson.Title,
					"status":            item.Status,
					"progress_percent":  item.ProgressPercent,
					"is_completed":      item.IsCompleted,
					"last_position_sec": item.LastPositionSec,
					"completed_at":      item.CompletedAt,
					"last_activity_at":  item.UpdatedAt,
				})
			}
			sort.SliceStable(lessonItems, func(i, j int) bool {
				return lessons[moduleProgress[i].LessonID].SortOrder < lessons[moduleProgress[j].LessonID].SortOrder
			})
			module := modules[moduleID]
			moduleItems = append(moduleItems, gin.H{
				"module_id":         moduleID,
				"module_name":       module.Title,
				"progress_percent":  average,
				"completed_lessons": completed,
				"total_lessons":     len(moduleProgress),
				"completion_rate":   average,
				"lessons":           lessonItems,
			})
		}
		sort.SliceStable(moduleItems, func(i, j int) bool {
			left, _ := moduleItems[i]["module_id"].(uuid.UUID)
			right, _ := moduleItems[j]["module_id"].(uuid.UUID)
			return modules[left].SortOrder < modules[right].SortOrder
		})
		out = append(out, gin.H{
			"course_id":         courseID,
			"course_name":       course.Title,
			"progress_percent":  courseAverage,
			"completed_lessons": courseLessonsCompleted,
			"total_lessons":     len(courseProgress),
			"completion_rate":   courseAverage,
			"modules":           moduleItems,
		})
	}
	sort.SliceStable(out, func(i, j int) bool {
		return strings.Compare(out[i]["course_name"].(string), out[j]["course_name"].(string)) < 0
	})
	return gin.H{"courses": out}, nil
}

func flattenProgressModules(modules map[uuid.UUID][]model.StudentProgress) []model.StudentProgress {
	out := make([]model.StudentProgress, 0)
	for _, items := range modules {
		out = append(out, items...)
	}
	return out
}

func progressStats(progress []model.StudentProgress) (int, float64) {
	if len(progress) == 0 {
		return 0, 0
	}
	completed := 0
	total := 0.0
	for _, item := range progress {
		if item.IsCompleted {
			completed++
		}
		total += item.ProgressPercent
	}
	return completed, math.Round((total/float64(len(progress)))*10) / 10
}

func loadLearningMaps(db *gorm.DB, courseIDs map[uuid.UUID]bool, moduleIDs map[uuid.UUID]bool, lessonIDs map[uuid.UUID]bool) (map[uuid.UUID]model.Course, map[uuid.UUID]model.Module, map[uuid.UUID]model.Lesson, error) {
	courseList := make([]uuid.UUID, 0, len(courseIDs))
	moduleList := make([]uuid.UUID, 0, len(moduleIDs))
	lessonList := make([]uuid.UUID, 0, len(lessonIDs))
	for id := range courseIDs {
		courseList = append(courseList, id)
	}
	for id := range moduleIDs {
		moduleList = append(moduleList, id)
	}
	for id := range lessonIDs {
		lessonList = append(lessonList, id)
	}
	var courses []model.Course
	var modules []model.Module
	var lessons []model.Lesson
	if len(courseList) > 0 {
		if err := db.Find(&courses, "id IN ?", courseList).Error; err != nil {
			return nil, nil, nil, err
		}
	}
	if len(moduleList) > 0 {
		if err := db.Find(&modules, "id IN ?", moduleList).Error; err != nil {
			return nil, nil, nil, err
		}
	}
	if len(lessonList) > 0 {
		if err := db.Find(&lessons, "id IN ?", lessonList).Error; err != nil {
			return nil, nil, nil, err
		}
	}
	courseMap := map[uuid.UUID]model.Course{}
	moduleMap := map[uuid.UUID]model.Module{}
	lessonMap := map[uuid.UUID]model.Lesson{}
	for _, item := range courses {
		courseMap[item.ID] = item
	}
	for _, item := range modules {
		moduleMap[item.ID] = item
	}
	for _, item := range lessons {
		lessonMap[item.ID] = item
	}
	return courseMap, moduleMap, lessonMap, nil
}

func (ctrl *LMSController) ParentStudentAssignments(c *gin.Context) {
	userID, role, ok := currentLMSUser(c)
	if !ok {
		return
	}
	if role != 10 && role < 30 {
		sendError(c, http.StatusForbidden, "Hanya orang tua, mentor, atau admin yang dapat mengakses tugas siswa", nil)
		return
	}
	studentID, err := uuid.Parse(c.Param("student_id"))
	if err != nil {
		sendBadRequest(c, "student_id is invalid", nil)
		return
	}
	if role == 10 {
		if !ctrl.validateParentStudent(c, userID, studentID) {
			return
		}
	}
	payload, err := ctrl.buildStudentAssignmentsHierarchy(c, studentID)
	if err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccess(c, payload, "Parent student assignments retrieved successfully")
}

func (ctrl *LMSController) buildStudentAssignmentsHierarchy(c *gin.Context, studentID uuid.UUID) (gin.H, error) {
	db := lmsDB(c, ctrl.DB)
	var assignments []model.Assignment
	if err := db.Where("student_id = ?", studentID).Order("created_at desc").Find(&assignments).Error; err != nil {
		return nil, err
	}
	if len(assignments) == 0 {
		return gin.H{"courses": []gin.H{}}, nil
	}
	lessonIDs := map[uuid.UUID]bool{}
	for _, assignment := range assignments {
		lessonIDs[assignment.LessonID] = true
	}
	lessonList := make([]uuid.UUID, 0, len(lessonIDs))
	for id := range lessonIDs {
		lessonList = append(lessonList, id)
	}
	var lessons []model.Lesson
	if err := db.Find(&lessons, "id IN ?", lessonList).Error; err != nil {
		return nil, err
	}
	lessonMap := map[uuid.UUID]model.Lesson{}
	moduleIDs := map[uuid.UUID]bool{}
	for _, lesson := range lessons {
		lessonMap[lesson.ID] = lesson
		moduleIDs[lesson.ModuleID] = true
	}
	moduleList := make([]uuid.UUID, 0, len(moduleIDs))
	for id := range moduleIDs {
		moduleList = append(moduleList, id)
	}
	var modules []model.Module
	if err := db.Find(&modules, "id IN ?", moduleList).Error; err != nil {
		return nil, err
	}
	moduleMap := map[uuid.UUID]model.Module{}
	courseIDs := map[uuid.UUID]bool{}
	for _, module := range modules {
		moduleMap[module.ID] = module
		courseIDs[module.CourseID] = true
	}
	courseList := make([]uuid.UUID, 0, len(courseIDs))
	for id := range courseIDs {
		courseList = append(courseList, id)
	}
	var courses []model.Course
	if err := db.Find(&courses, "id IN ?", courseList).Error; err != nil {
		return nil, err
	}
	courseMap := map[uuid.UUID]model.Course{}
	for _, course := range courses {
		courseMap[course.ID] = course
	}
	grouped := map[uuid.UUID]map[uuid.UUID]map[uuid.UUID][]gin.H{}
	for _, assignment := range assignments {
		lesson := lessonMap[assignment.LessonID]
		module := moduleMap[lesson.ModuleID]
		course := courseMap[module.CourseID]
		if _, ok := grouped[course.ID]; !ok {
			grouped[course.ID] = map[uuid.UUID]map[uuid.UUID][]gin.H{}
		}
		if _, ok := grouped[course.ID][module.ID]; !ok {
			grouped[course.ID][module.ID] = map[uuid.UUID][]gin.H{}
		}
		percentage := (*float64)(nil)
		if assignment.Score != nil && assignment.MaxScore > 0 {
			value := math.Round(((*assignment.Score/assignment.MaxScore)*100)*10) / 10
			percentage = &value
		}
		grouped[course.ID][module.ID][lesson.ID] = append(grouped[course.ID][module.ID][lesson.ID], gin.H{
			"id":               assignment.ID,
			"course_id":        course.ID,
			"course_name":      course.Title,
			"module_id":        module.ID,
			"module_name":      module.Title,
			"lesson_id":        lesson.ID,
			"lesson_name":      lesson.Title,
			"file_url":         assignment.FileURL,
			"file_name":        assignment.FileName,
			"note":             assignment.Note,
			"status":           assignment.Status,
			"score":            assignment.Score,
			"max_score":        assignment.MaxScore,
			"percentage_score": percentage,
			"feedback":         assignment.Feedback,
			"submitted_at":     assignment.CreatedAt,
			"graded_at":        assignment.GradedAt,
		})
	}
	courseItems := make([]gin.H, 0, len(grouped))
	for courseID, modulesMap := range grouped {
		moduleItems := make([]gin.H, 0, len(modulesMap))
		for moduleID, lessonsMap := range modulesMap {
			lessonItems := make([]gin.H, 0, len(lessonsMap))
			for lessonID, items := range lessonsMap {
				lessonItems = append(lessonItems, gin.H{
					"lesson_id":   lessonID,
					"lesson_name": lessonMap[lessonID].Title,
					"assignments": items,
				})
			}
			moduleItems = append(moduleItems, gin.H{
				"module_id":   moduleID,
				"module_name": moduleMap[moduleID].Title,
				"lessons":     lessonItems,
			})
		}
		courseItems = append(courseItems, gin.H{
			"course_id":   courseID,
			"course_name": courseMap[courseID].Title,
			"modules":     moduleItems,
		})
	}
	return gin.H{"courses": courseItems}, nil
}

func findActiveMembership(db *gorm.DB, parentID uuid.UUID, studentID uuid.UUID) error {
	var membership model.Membership
	err := db.Where("parent_id = ? AND student_id = ? AND status = ?", parentID, studentID, "active").First(&membership).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return gorm.ErrRecordNotFound
	}
	return err
}

// GET /lms/mentor/students-progress
func (ctrl *LMSController) MentorStudentsProgress(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Unauthorized"})
		return
	}
	role := c.GetInt("role")
	if role < 99 && role != 30 && role != 40 {
		sendError(c, http.StatusForbidden, "Hanya mentor dan admin yang dapat melihat progress siswa", nil)
		return
	}

	db := lmsDB(c, ctrl.DB)

	// Query params
	search := strings.TrimSpace(c.Query("search"))
	statusFilter := strings.TrimSpace(c.Query("status"))
	planIDFilter := strings.TrimSpace(c.Query("plan_id"))
	onlineFilter := strings.TrimSpace(c.Query("online"))
	lastActiveFrom := strings.TrimSpace(c.Query("last_active_from"))
	lastActiveTo := strings.TrimSpace(c.Query("last_active_to"))
	sortBy := strings.TrimSpace(c.DefaultQuery("sort_by", "name"))
	sortOrder := strings.ToLower(strings.TrimSpace(c.DefaultQuery("sort_order", "asc")))
	if sortOrder != "desc" {
		sortOrder = "asc"
	}

	limit := 10
	if lStr := c.Query("limit"); lStr != "" {
		if parsedLimit, err := strconv.Atoi(lStr); err == nil && parsedLimit > 0 {
			limit = parsedLimit
		}
	}
	if limit > 100 {
		limit = 100
	}
	offset := 0
	if oStr := c.Query("offset"); oStr != "" {
		if parsedOffset, err := strconv.Atoi(oStr); err == nil && parsedOffset > 0 {
			offset = parsedOffset
		}
	}

	query := db.Model(&model.User{}).Where("role = ?", 20)

	if role == 30 || role == 40 {
		query = query.Where("id IN ("+
			"SELECT DISTINCT student_id FROM student_progresses WHERE course_id IN (SELECT course_id FROM course_mentors WHERE mentor_id = ?) UNION "+
			"SELECT DISTINCT student_id FROM course_purchases WHERE status = ? AND course_id IN (SELECT course_id FROM course_mentors WHERE mentor_id = ?) UNION "+
			"SELECT DISTINCT student_id FROM lms_payments WHERE status = ? AND course_id IN (SELECT course_id FROM course_mentors WHERE mentor_id = ?)"+
			")", userID, model.PurchasePaid, userID, model.LMSPaymentPaid, userID)
	}

	if search != "" {
		query = query.Where("first_name LIKE ? OR last_name LIKE ? OR display_name LIKE ? OR email LIKE ?", "%"+search+"%", "%"+search+"%", "%"+search+"%", "%"+search+"%")
	}

	if statusFilter == "active" || statusFilter == "inactive" {
		subQuery := "id IN (SELECT student_id FROM subscriptions WHERE status IN ('active', 'trialing') AND (current_period_end IS NULL OR current_period_end > ?))"
		if statusFilter == "inactive" {
			subQuery = "id NOT IN (SELECT student_id FROM subscriptions WHERE status IN ('active', 'trialing') AND (current_period_end IS NULL OR current_period_end > ?))"
		}
		query = query.Where(subQuery, time.Now())
	}

	if planIDFilter != "" && planIDFilter != "all" {
		if parsedPlanID, err := uuid.Parse(planIDFilter); err == nil {
			query = query.Where(`id IN (
				SELECT student_id FROM subscriptions
				WHERE (plan_id = ? OR provider_plan_id = ?)
				AND status IN ('active', 'trialing')
				AND (current_period_end IS NULL OR current_period_end > ?)
			)`, parsedPlanID, parsedPlanID.String(), time.Now())
		}
	}

	if onlineFilter == "online" || onlineFilter == "offline" {
		onlineUserIDs := []string{}
		if tenant, ok := currentTenant(c); ok {
			onlineUserIDs = GetOnlineTracker(ctrl.DB).GetOnlineUserIDs(tenant.ID.String())
		}
		if onlineFilter == "online" {
			if len(onlineUserIDs) == 0 {
				query = query.Where("1 = 0")
			} else {
				query = query.Where("id IN ?", onlineUserIDs)
			}
		} else if len(onlineUserIDs) > 0 {
			query = query.Where("id NOT IN ?", onlineUserIDs)
		}
	}

	if parsedFrom, ok := parseDateTimeQuery(lastActiveFrom, false); ok {
		query = query.Where("last_active_at >= ?", parsedFrom)
	}
	if parsedTo, ok := parseDateTimeQuery(lastActiveTo, true); ok {
		query = query.Where("last_active_at <= ?", parsedTo)
	}

	progressMin, hasProgressMin := parseFloatQuery(c.Query("progress_min"))
	progressMax, hasProgressMax := parseFloatQuery(c.Query("progress_max"))
	needsStatsPagination := hasProgressMin || hasProgressMax || sortBy == "progress" || sortBy == "subscription_plan" || sortBy == "subscription_status"

	var total int64
	var stats []parentStudentStats
	if needsStatsPagination {
		var allUsers []model.User
		if err := query.Order("COALESCE(first_name, ''), COALESCE(last_name, ''), id").Limit(5000).Find(&allUsers).Error; err != nil {
			sendInternalError(c, err)
			return
		}
		studentIDs := make([]uuid.UUID, 0, len(allUsers))
		for _, u := range allUsers {
			studentIDs = append(studentIDs, u.ID)
		}
		allStats, err := ctrl.parentStudentStats(c, studentIDs)
		if err != nil {
			sendInternalError(c, err)
			return
		}
		filtered := make([]parentStudentStats, 0, len(allStats))
		for _, item := range allStats {
			if hasProgressMin && item.AverageProgress < progressMin {
				continue
			}
			if hasProgressMax && item.AverageProgress > progressMax {
				continue
			}
			filtered = append(filtered, item)
		}
		sortMentorStudentStats(filtered, sortBy, sortOrder)
		total = int64(len(filtered))
		end := offset + limit
		if end > len(filtered) {
			end = len(filtered)
		}
		if offset < len(filtered) {
			stats = filtered[offset:end]
		} else {
			stats = []parentStudentStats{}
		}
	} else {
		countQuery := query.Session(&gorm.Session{})
		if err := countQuery.Count(&total).Error; err != nil {
			sendInternalError(c, err)
			return
		}
		var users []model.User
		if err := query.Order(mentorStudentProgressOrder(sortBy, sortOrder)).Offset(offset).Limit(limit).Find(&users).Error; err != nil {
			sendInternalError(c, err)
			return
		}
		studentIDs := make([]uuid.UUID, 0, len(users))
		for _, u := range users {
			studentIDs = append(studentIDs, u.ID)
		}
		var err error
		stats, err = ctrl.parentStudentStats(c, studentIDs)
		if err != nil {
			sendInternalError(c, err)
			return
		}
		statsByID := make(map[uuid.UUID]parentStudentStats, len(stats))
		for _, item := range stats {
			statsByID[item.StudentID] = item
		}
		ordered := make([]parentStudentStats, 0, len(users))
		for _, user := range users {
			if item, ok := statsByID[user.ID]; ok {
				ordered = append(ordered, item)
			}
		}
		stats = ordered
	}

	hasMore := int64(offset+len(stats)) < total
	nextOffset := offset + len(stats)

	var plans []model.SubscriptionPlan
	planQuery := db.Model(&model.SubscriptionPlan{}).
		Select("DISTINCT subscription_plans.id, subscription_plans.name").
		Joins("JOIN subscriptions ON (subscriptions.plan_id = subscription_plans.id OR subscriptions.provider_plan_id = subscription_plans.id)").
		Where("subscription_plans.is_active = ?", true).
		Where("subscriptions.status IN ?", []string{"active", "trialing"}).
		Where("(subscriptions.current_period_end IS NULL OR subscriptions.current_period_end > ?)", time.Now())
	if role == 30 || role == 40 {
		planQuery = planQuery.Where("subscriptions.student_id IN ("+
			"SELECT DISTINCT student_id FROM student_progresses WHERE course_id IN (SELECT course_id FROM course_mentors WHERE mentor_id = ?) UNION "+
			"SELECT DISTINCT student_id FROM course_purchases WHERE status = ? AND course_id IN (SELECT course_id FROM course_mentors WHERE mentor_id = ?) UNION "+
			"SELECT DISTINCT student_id FROM lms_payments WHERE status = ? AND course_id IN (SELECT course_id FROM course_mentors WHERE mentor_id = ?)"+
			")", userID, model.PurchasePaid, userID, model.LMSPaymentPaid, userID)
	}
	_ = planQuery.Order("subscription_plans.name asc").Find(&plans).Error

	var categories []model.CourseCategory
	_ = db.Order("sort_order asc, name asc").Find(&categories, "is_active = ?", true).Error

	var nextCursorFirstName string
	var nextCursorLastName string
	var nextCursorID string
	if hasMore && len(stats) > 0 {
		lastStudent := stats[len(stats)-1]
		nextCursorFirstName = lastStudent.FirstName
		nextCursorLastName = lastStudent.LastName
		nextCursorID = lastStudent.StudentID.String()
	}

	sendSuccess(c, gin.H{
		"students":               stats,
		"categories":             categories,
		"plans":                  plans,
		"total":                  total,
		"has_more":               hasMore,
		"next_offset":            nextOffset,
		"next_cursor_first_name": nextCursorFirstName,
		"next_cursor_last_name":  nextCursorLastName,
		"next_cursor_id":         nextCursorID,
	}, "Student progress stats retrieved successfully")
}

func parseFloatQuery(value string) (float64, bool) {
	if strings.TrimSpace(value) == "" {
		return 0, false
	}
	parsed, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return 0, false
	}
	return parsed, true
}

func parseDateTimeQuery(value string, endOfDay bool) (time.Time, bool) {
	value = strings.TrimSpace(value)
	if value == "" {
		return time.Time{}, false
	}
	if parsed, err := time.Parse(time.RFC3339, value); err == nil {
		return parsed, true
	}
	if parsed, err := time.Parse("2006-01-02", value); err == nil {
		if endOfDay {
			parsed = parsed.Add(24*time.Hour - time.Nanosecond)
		}
		return parsed, true
	}
	return time.Time{}, false
}

func mentorStudentProgressOrder(sortBy, sortOrder string) string {
	direction := "ASC"
	if sortOrder == "desc" {
		direction = "DESC"
	}
	switch sortBy {
	case "email":
		return "email " + direction + ", id " + direction
	case "last_active_at":
		if direction == "DESC" {
			return "last_active_at DESC, id DESC"
		}
		return "last_active_at ASC, id ASC"
	case "created_at":
		return "created_at " + direction + ", id " + direction
	default:
		return "COALESCE(first_name, '') " + direction + ", COALESCE(last_name, '') " + direction + ", id " + direction
	}
}

func sortMentorStudentStats(stats []parentStudentStats, sortBy, sortOrder string) {
	desc := sortOrder == "desc"
	sort.SliceStable(stats, func(i, j int) bool {
		cmp := 0
		switch sortBy {
		case "progress":
			if stats[i].AverageProgress < stats[j].AverageProgress {
				cmp = -1
			} else if stats[i].AverageProgress > stats[j].AverageProgress {
				cmp = 1
			}
		case "subscription_plan":
			cmp = strings.Compare(stats[i].SubscriptionPlan, stats[j].SubscriptionPlan)
		case "subscription_status":
			cmp = strings.Compare(stats[i].SubscriptionStatus, stats[j].SubscriptionStatus)
		case "last_active_at":
			cmp = timePtrCompare(stats[i].LastOnlineAt, stats[j].LastOnlineAt)
		case "email":
			cmp = strings.Compare(stats[i].Email, stats[j].Email)
		default:
			cmp = strings.Compare(stats[i].Name, stats[j].Name)
		}
		if cmp == 0 {
			cmp = strings.Compare(stats[i].StudentID.String(), stats[j].StudentID.String())
		}
		if desc {
			return cmp > 0
		}
		return cmp < 0
	})
}

func timePtrCompare(a, b *time.Time) int {
	if a == nil && b == nil {
		return 0
	}
	if a == nil {
		return -1
	}
	if b == nil {
		return 1
	}
	if a.Before(*b) {
		return -1
	}
	if a.After(*b) {
		return 1
	}
	return 0
}

func (ctrl *LMSController) GetSellerSellingStatus(c *gin.Context) {
	userID, role, ok := currentLMSUser(c)
	if !ok {
		return
	}
	if role != model.RoleParent && role != model.RoleGuruExternal {
		sendError(c, http.StatusForbidden, "Status penjualan hanya tersedia untuk parent dan mentor eksternal", nil)
		return
	}

	db := lmsDB(c, ctrl.DB)
	rules, plan, err := model.GetCourseSellerActiveRules(db, userID, role)
	if err != nil {
		sendInternalError(c, err)
		return
	}

	if rules == nil || plan == nil {
		sendSuccess(c, gin.H{
			"has_active_plan":    false,
			"is_parent_external": false,
		}, "No active parent plan found")
		return
	}

	// 1. Find course owned by this parent
	var course model.Course
	var hasCourse bool
	lessonCount := int64(0)
	var courseMentors []uuid.UUID
	err = db.Table("course_mentors").Where("mentor_id = ?", userID).Pluck("course_id", &courseMentors).Error
	if err == nil && len(courseMentors) > 0 {
		for _, courseID := range courseMentors {
			var candidate model.Course
			if err := db.Preload("CourseCategory").First(&candidate, "id = ?", courseID).Error; err != nil {
				continue
			}
			var candidateLessonCount int64
			if err := db.Model(&model.Lesson{}).
				Joins("JOIN modules ON modules.id = lessons.module_id AND modules.deleted_at IS NULL").
				Where("modules.course_id = ?", candidate.ID).
				Count(&candidateLessonCount).Error; err != nil {
				continue
			}
			if !hasCourse || candidateLessonCount > lessonCount {
				course = candidate
				lessonCount = candidateLessonCount
				hasCourse = true
			}
		}
	}

	// 2. Check modules completion of the plan bundle
	var bundleTotalLessons int64
	var bundleCompletedLessons int64
	bundleCompleted := false
	bundleIDs, err := model.SubscriptionPlanBundleIDs(db, plan.ID, plan.BundleID)
	if err == nil && len(bundleIDs) > 0 {
		courseIDs, _ := model.BundleCourseIDs(db, bundleIDs)

		if len(courseIDs) > 0 {
			var moduleIDs []uuid.UUID
			db.Model(&model.Module{}).Where("course_id IN ?", courseIDs).Pluck("id", &moduleIDs)

			if len(moduleIDs) > 0 {
				db.Model(&model.Lesson{}).Where("module_id IN ? AND is_published = ?", moduleIDs, true).Count(&bundleTotalLessons)

				var lessonIDs []uuid.UUID
				db.Model(&model.Lesson{}).Where("module_id IN ? AND is_published = ?", moduleIDs, true).Pluck("id", &lessonIDs)
				if len(lessonIDs) > 0 {
					db.Model(&model.StudentProgress{}).
						Where("student_id = ? AND lesson_id IN ? AND is_completed = ?", userID, lessonIDs, true).
						Count(&bundleCompletedLessons)
				}
			}
		}
		if bundleTotalLessons > 0 && bundleCompletedLessons == bundleTotalLessons {
			bundleCompleted = true
		}
	}

	// 3. Resolve explicitly configured prerequisites for both stages.
	resolveRequiredCourses := func(courseIDs []uuid.UUID) ([]gin.H, bool) {
		courses := make([]gin.H, 0, len(courseIDs))
		allCompleted := true
		for _, requiredCourseID := range courseIDs {
			var requiredCourse model.Course
			if err := db.Select("id", "title", "slug").First(&requiredCourse, "id = ?", requiredCourseID).Error; err != nil {
				allCompleted = false
				continue
			}
			completed := model.CheckCourseCompleted(db, userID, requiredCourseID)
			if !completed {
				allCompleted = false
			}
			courses = append(courses, gin.H{
				"id": requiredCourse.ID, "title": requiredCourse.Title, "slug": requiredCourse.Slug, "completed": completed,
			})
		}
		return courses, allCompleted
	}
	requiredCourses, requiredCoursesCompleted := resolveRequiredCourses(rules.SellRequiredCourseIDs)
	createRequiredCourses, createRequiredCoursesCompleted := resolveRequiredCourses(rules.CreateRequiredCourseIDs)

	planCourseIDs := make([]uuid.UUID, 0)
	if len(bundleIDs) > 0 {
		planCourseIDs, _ = model.BundleCourseIDs(db, bundleIDs)
	}
	completedPlanCourses := 0
	for _, courseID := range planCourseIDs {
		if model.CheckCourseCompleted(db, userID, courseID) {
			completedPlanCourses++
		}
	}

	creationUnlocked, creationReason, err := model.CheckCourseCreationRequirements(db, userID, rules, plan)
	if err != nil {
		sendInternalError(c, err)
		return
	}

	// Use the same rule evaluator as finance authorization so the menu state and
	// direct API access can never disagree.
	unlocked, reason, err := model.CheckCourseSellerRequirements(db, userID, rules, plan)
	if err != nil {
		sendInternalError(c, err)
		return
	}
	checkoutType := ""
	if plan.PricingCategory != nil {
		checkoutType = model.NormalizeSellerCheckoutType(plan.PricingCategory.CheckoutType)
	}

	sendSuccess(c, gin.H{
		"has_active_plan":               true,
		"checkout_type":                 checkoutType,
		"is_parent_external":            role == model.RoleParent && checkoutType == "parent-external",
		"plan_name":                     plan.Name,
		"plan_slug":                     plan.Slug,
		"course_creation_enabled":       rules.CanCreateCourse,
		"can_create_course":             creationUnlocked,
		"creation_unlocked":             creationUnlocked,
		"creation_unlock_reason":        creationReason,
		"create_requirement":            rules.CreateRequirement,
		"min_completed_to_create":       rules.MinCompletedCoursesToCreate,
		"create_required_courses":       createRequiredCourses,
		"create_requirements_completed": createRequiredCoursesCompleted,
		"can_sell_course":               rules.AllowsSelling(),
		"min_courses_to_sell":           rules.MinCoursesToSell,
		"min_lessons_required":          rules.MinLessonsToSell,
		"current_lessons_count":         lessonCount,
		"sell_requirement":              rules.SellRequirement,
		"min_completed_to_sell":         rules.MinCompletedCoursesToSell,
		"require_modules_completion":    rules.SellRequirement == model.CourseRequirementAll,
		"required_courses":              requiredCourses,
		"required_courses_completed":    requiredCoursesCompleted,
		"plan_courses_total":            len(planCourseIDs),
		"plan_courses_completed":        completedPlanCourses,
		"bundle_total_lessons":          bundleTotalLessons,
		"bundle_completed_lessons":      bundleCompletedLessons,
		"bundle_completed":              bundleCompleted,
		"unlocked_selling":              unlocked,
		"unlock_reason":                 reason,
		"course_created":                hasCourse,
		"course":                        course,
	}, "Seller status retrieved successfully")
}

// GetParentSellingStatus keeps the previous endpoint compatible.
func (ctrl *LMSController) GetParentSellingStatus(c *gin.Context) {
	ctrl.GetSellerSellingStatus(c)
}
