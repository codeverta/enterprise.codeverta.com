package controller

import (
	"gin-template/model"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// GetCourseStudents returns list of enrolled students for a specific course
func (ctrl *LMSController) GetCourseStudents(c *gin.Context) {
	courseID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}

	db := lmsDB(c, ctrl.DB).WithContext(c)

	// 1. Find bundles containing this course
	var bundleIDs []uuid.UUID
	if err := db.Model(&model.CourseBundleItem{}).Where("course_id = ?", courseID).Pluck("bundle_id", &bundleIDs).Error; err != nil {
		sendInternalError(c, err)
		return
	}

	// 2. Find plans matching these bundles
	var planIDs []uuid.UUID
	if len(bundleIDs) > 0 {
		if err := db.Model(&model.SubscriptionPlan{}).Where("bundle_id IN ?", bundleIDs).Pluck("id", &planIDs).Error; err != nil {
			sendInternalError(c, err)
			return
		}
		var multiPlanIDs []uuid.UUID
		if err := db.Model(&model.SubscriptionPlanBundle{}).Where("bundle_id IN ?", bundleIDs).Pluck("plan_id", &multiPlanIDs).Error; err != nil {
			sendInternalError(c, err)
			return
		}
		planIDs = append(planIDs, multiPlanIDs...)
	}

	// 3. Find active/trialing subscriptions
	now := time.Now()
	subQuery := db.Model(&model.Subscription{}).
		Select("student_id").
		Where("status IN ?", []model.SubscriptionStatus{
			model.SubscriptionStatusActive,
			model.SubscriptionStatusTrialing,
		}).
		Where("(current_period_end IS NULL OR current_period_end >= ?)", now)

	if len(planIDs) > 0 {
		subQuery = subQuery.Where("(course_id = ? OR plan_id IN ?)", courseID, planIDs)
	} else {
		subQuery = subQuery.Where("course_id = ?", courseID)
	}

	var studentIDs []uuid.UUID
	if err := subQuery.Pluck("student_id", &studentIDs).Error; err != nil {
		sendInternalError(c, err)
		return
	}

	// Return empty slice if no students enrolled
	if len(studentIDs) == 0 {
		sendSuccess(c, []model.User{}, "No students enrolled")
		return
	}

	// 4. Query student User details with optional search filtering
	userQuery := db.Model(&model.User{}).Where("id IN ?", studentIDs)
	if search := c.Query("search"); search != "" {
		userQuery = userQuery.Where("first_name LIKE ? OR last_name LIKE ? OR display_name LIKE ? OR email LIKE ?", "%"+search+"%", "%"+search+"%", "%"+search+"%", "%"+search+"%")
	}

	var students []model.User
	if err := userQuery.Find(&students).Error; err != nil {
		sendInternalError(c, err)
		return
	}

	sendSuccess(c, students, "Enrolled students retrieved successfully")
}

// GetCourseAssignments returns all assignment submissions for a specific course, sorted by latest
func (ctrl *LMSController) GetCourseAssignments(c *gin.Context) {
	courseID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}

	db := lmsDB(c, ctrl.DB).WithContext(c)

	// 1. Get all module IDs in the course
	var moduleIDs []uuid.UUID
	if err := db.Model(&model.Module{}).Where("course_id = ?", courseID).Pluck("id", &moduleIDs).Error; err != nil {
		sendInternalError(c, err)
		return
	}

	if len(moduleIDs) == 0 {
		sendSuccess(c, []model.Assignment{}, "No modules/lessons in this course")
		return
	}

	// 2. Get all lesson IDs in the modules
	var lessonIDs []uuid.UUID
	if err := db.Model(&model.Lesson{}).Where("module_id IN ?", moduleIDs).Pluck("id", &lessonIDs).Error; err != nil {
		sendInternalError(c, err)
		return
	}

	if len(lessonIDs) == 0 {
		sendSuccess(c, []model.Assignment{}, "No lessons in this course")
		return
	}

	// 3. Query assignments preloading Student and Lesson details
	var assignments []model.Assignment
	err := db.Preload("Student").Preload("Lesson").
		Where("lesson_id IN ?", lessonIDs).
		Order("created_at desc").
		Find(&assignments).Error
	if err != nil {
		sendInternalError(c, err)
		return
	}

	sendSuccess(c, assignments, "Course assignments retrieved successfully")
}

// StudentQuizInfo payload representing aggregated student stats for a quiz
type StudentQuizInfo struct {
	Student     model.User          `json:"student"`
	BestScore   float64             `json:"best_score"`
	IsPassed    bool                `json:"is_passed"`
	IsCompleted bool                `json:"is_completed"`
	Attempts    []model.QuizAttempt `json:"attempts"`
}

// GetQuizAttempts returns attempts list grouped by student with details
func (ctrl *LMSController) GetQuizAttempts(c *gin.Context) {
	quizID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}

	db := lmsDB(c, ctrl.DB).WithContext(c)

	// 1. Query attempts preloading Student details, ordered by attempt_number desc
	var attempts []model.QuizAttempt
	err := db.Preload("Student").
		Where("quiz_id = ?", quizID).
		Order("student_id asc, attempt_number desc").
		Find(&attempts).Error
	if err != nil {
		sendInternalError(c, err)
		return
	}

	// 2. Query progresses
	var progresses []model.QuizProgress
	err = db.Where("quiz_id = ?", quizID).
		Find(&progresses).Error
	if err != nil {
		sendInternalError(c, err)
		return
	}

	progressMap := make(map[uuid.UUID]model.QuizProgress)
	for _, p := range progresses {
		progressMap[p.StudentID] = p
	}

	// 3. Group attempts by student
	attemptsByStudent := make(map[uuid.UUID][]model.QuizAttempt)
	studentMap := make(map[uuid.UUID]model.User)

	for _, a := range attempts {
		attemptsByStudent[a.StudentID] = append(attemptsByStudent[a.StudentID], a)
		studentMap[a.StudentID] = a.Student
	}

	// 4. Construct payload
	var result []StudentQuizInfo
	for studentID, stdAttempts := range attemptsByStudent {
		prog, hasProg := progressMap[studentID]
		bestScore := 0.0
		isPassed := false
		isCompleted := false
		if hasProg {
			bestScore = prog.BestScore
			isPassed = prog.IsPassed
			isCompleted = prog.IsCompleted
		}

		result = append(result, StudentQuizInfo{
			Student:     studentMap[studentID],
			BestScore:   bestScore,
			IsPassed:    isPassed,
			IsCompleted: isCompleted,
			Attempts:    stdAttempts,
		})
	}

	sendSuccess(c, result, "Quiz attempts retrieved successfully")
}
