package controller

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"gin-template/model"
	"math"
	"math/rand"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type quizQuestionPayload struct {
	model.QuizQuestion
	Options []model.QuizOption `json:"options"`
}

type saveQuizAnswerRequest struct {
	QuestionID        string   `json:"question_id" binding:"required"`
	SelectedOptionIDs []string `json:"selected_option_ids"`
	AnswerText        string   `json:"answer_text"`
}

func isQuizStaff(role int) bool {
	return role == model.RoleMentor || role >= 99
}

type quizRequiredPlanInfo struct {
	ID       string  `json:"id"`
	Name     string  `json:"name"`
	Slug     string  `json:"slug"`
	Amount   float64 `json:"amount"`
	Currency string  `json:"currency"`
	Interval string  `json:"interval"`
}

func quizCourseAccessMeta(db *gorm.DB, c *gin.Context, ctrl *LMSController, course model.Course) gin.H {
	hasAccess := ctrl.hasCourseAccess(c, course.ID)
	meta := gin.H{
		"has_access":       hasAccess,
		"lock_reason":      "",
		"required_course":  course,
		"required_plans":   []quizRequiredPlanInfo{},
		"can_buy_course":   course.SellIndividual,
		"course_price":     course.Price,
		"course_checkout":  fmt.Sprintf("/dashboard/courses/%s/checkout", course.ID.String()),
		"course_detail":    fmt.Sprintf("/dashboard/courses/%s", course.ID.String()),
		"subscription_url": "/dashboard/subscriptions",
	}
	if hasAccess {
		return meta
	}

	var bundleIDs []uuid.UUID
	_ = db.Model(&model.CourseBundleItem{}).
		Where("course_id = ?", course.ID).
		Distinct("bundle_id").
		Pluck("bundle_id", &bundleIDs).Error

	var planIDs []uuid.UUID
	if len(bundleIDs) > 0 {
		_ = db.Model(&model.SubscriptionPlan{}).
			Where("bundle_id IN ? AND is_active = ?", bundleIDs, true).
			Pluck("id", &planIDs).Error

		var multiPlanIDs []uuid.UUID
		_ = db.Model(&model.SubscriptionPlanBundle{}).
			Where("bundle_id IN ?", bundleIDs).
			Distinct("plan_id").
			Pluck("plan_id", &multiPlanIDs).Error
		planIDs = append(planIDs, multiPlanIDs...)
	}

	if len(planIDs) > 0 {
		var plans []model.SubscriptionPlan
		_ = db.Model(&model.SubscriptionPlan{}).
			Where("id IN ? AND is_active = ?", planIDs, true).
			Order("amount ASC, name ASC").
			Find(&plans).Error

		seen := map[uuid.UUID]bool{}
		requiredPlans := make([]quizRequiredPlanInfo, 0, len(plans))
		for _, plan := range plans {
			if seen[plan.ID] {
				continue
			}
			seen[plan.ID] = true
			requiredPlans = append(requiredPlans, quizRequiredPlanInfo{
				ID:       plan.ID.String(),
				Name:     plan.Name,
				Slug:     plan.Slug,
				Amount:   plan.Amount,
				Currency: plan.Currency,
				Interval: plan.Interval,
			})
		}
		meta["required_plans"] = requiredPlans
		meta["lock_reason"] = "subscription_required"
		return meta
	}

	if course.SellIndividual {
		meta["lock_reason"] = "course_purchase_required"
		return meta
	}

	meta["lock_reason"] = "course_access_required"
	return meta
}

func (ctrl *LMSController) ListQuizzes(c *gin.Context) {
	userID, role, ok := currentLMSUser(c)
	if !ok {
		return
	}
	db := lmsDB(c, ctrl.DB).WithContext(c)

	query := db.Preload("Course").Preload("Module").Preload("Lesson")
	if isQuizStaff(role) {
		query = query.Preload("Questions", func(db *gorm.DB) *gorm.DB {
			return db.Order("sort_order asc, created_at asc")
		}).Preload("Questions.Options", func(db *gorm.DB) *gorm.DB {
			return db.Order("sort_order asc, created_at asc")
		})
	}
	query = query.Order("sort_order asc, created_at asc").Limit(parseLimit(c))

	if lessonID := c.Query("lesson_id"); lessonID != "" && lessonID != "none" {
		query = query.Where("lesson_id = ?", lessonID)
	}
	if moduleID := c.Query("module_id"); moduleID != "" && moduleID != "none" {
		query = query.Where("module_id = ?", moduleID)
	}
	if courseID := c.Query("course_id"); courseID != "" && courseID != "ALL" {
		query = query.Where("course_id = ?", courseID)
	}

	// JIKA USER ADALAH SISWA: Batasi kuis harus berstatus Published dan dalam rentang waktu yang sesuai
	if !isQuizStaff(role) {
		now := time.Now()
		query = query.Where("is_published = ?", true).
			Where("(available_from IS NULL OR available_from <= ?)", now).
			Where("(available_until IS NULL OR available_until >= ?)", now)

		// Jika query param ?my_courses=true, filter hanya quiz dari course yang dimiliki student
		if c.Query("my_courses") == "true" {
			query = query.Where(`course_id IN (
				SELECT course_id FROM course_purchases
				WHERE student_id = ? AND status = 'paid'
				UNION
				SELECT course_id FROM subscriptions
				WHERE student_id = ? AND status IN ('active','trialing')
			)`, userID, userID)
		}
	}

	var quizzes []model.Quiz
	if err := query.Find(&quizzes).Error; err != nil {
		sendInternalError(c, err)
		return
	}

	// Strip questions if user does not have course access
	for i := range quizzes {
		if !ctrl.hasCourseAccess(c, quizzes[i].CourseID) {
			quizzes[i].Questions = nil
		}
	}

	// Ambil data progres pengerjaan kuis partner
	progressByQuiz := map[string]model.QuizProgress{}
	attemptsCountMap := map[string]int64{}
	questionCountMap := map[uuid.UUID]int64{}
	if len(quizzes) > 0 {
		ids := make([]uuid.UUID, 0, len(quizzes))
		for _, quiz := range quizzes {
			ids = append(ids, quiz.ID)
		}
		var progress []model.QuizProgress
		_ = db.Where("student_id = ? AND quiz_id IN ?", userID, ids).Find(&progress).Error
		for _, item := range progress {
			progressByQuiz[item.QuizID.String()] = item
		}

		type AttemptCount struct {
			QuizID uuid.UUID `gorm:"column:quiz_id"`
			Count  int64     `gorm:"column:cnt"`
		}
		var counts []AttemptCount
		_ = db.Model(&model.QuizAttempt{}).
			Select("quiz_id, count(*) as cnt").
			Where("student_id = ? AND quiz_id IN ? AND status != ?", userID, ids, model.QuizAttemptInProgress).
			Group("quiz_id").
			Scan(&counts).Error
		for _, item := range counts {
			attemptsCountMap[item.QuizID.String()] = item.Count
		}

		type QCount struct {
			QuizID uuid.UUID `gorm:"column:quiz_id"`
			Count  int64     `gorm:"column:cnt"`
		}
		var qCounts []QCount
		_ = db.Model(&model.QuizQuestion{}).
			Select("quiz_id, count(*) as cnt").
			Where("quiz_id IN ?", ids).
			Group("quiz_id").
			Scan(&qCounts).Error
		for _, item := range qCounts {
			questionCountMap[item.QuizID] = item.Count
		}
	}

	items := make([]gin.H, 0, len(quizzes))
	for _, quiz := range quizzes {
		if !isQuizStaff(role) {
			hideQuizCorrectAnswers(&quiz)
		}
		accessMeta := gin.H{
			"has_access":      true,
			"lock_reason":     "",
			"required_course": quiz.Course,
			"required_plans":  []quizRequiredPlanInfo{},
		}
		if !isQuizStaff(role) {
			accessMeta = quizCourseAccessMeta(db, c, ctrl, quiz.Course)
		}
		qCount := int64(len(quiz.Questions))
		if !isQuizStaff(role) {
			qCount = questionCountMap[quiz.ID]
		}
		items = append(items, gin.H{
			"quiz":           quiz,
			"question_count": qCount,
			"progress":       progressByQuiz[quiz.ID.String()],
			"attempts_used":  attemptsCountMap[quiz.ID.String()],
			"access":         accessMeta,
			"has_access":     accessMeta["has_access"],
		})
	}
	sendSuccess(c, items, "Quizzes retrieved successfully")
}

func (ctrl *LMSController) GetQuiz(c *gin.Context) {
	id, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	userID, role, ok := currentLMSUser(c)
	if !ok {
		return
	}
	db := lmsDB(c, ctrl.DB).WithContext(c)
	var quiz model.Quiz
	query := db.Preload("Course").Preload("Module").Preload("Lesson")
	if isQuizStaff(role) {
		query = query.Preload("Questions", func(db *gorm.DB) *gorm.DB {
			return db.Order("sort_order asc, created_at asc")
		}).Preload("Questions.Options", func(db *gorm.DB) *gorm.DB {
			return db.Order("sort_order asc, created_at asc")
		})
	}
	if err := query.First(&quiz, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			sendError(c, http.StatusNotFound, "Quiz not found", nil)
			return
		}
		sendInternalError(c, err)
		return
	}
	if !isQuizStaff(role) {
		if !quizAvailable(quiz, time.Now()) || !ctrl.requireLearningAccess(c, &quiz.CourseID) {
			return
		}
		hideQuizCorrectAnswers(&quiz)
	}

	attemptsUsed := int64(0)
	var best model.QuizProgress
	_ = db.Model(&model.QuizAttempt{}).Where("quiz_id = ? AND student_id = ? AND status != ?", quiz.ID, userID, model.QuizAttemptInProgress).Count(&attemptsUsed).Error
	_ = db.First(&best, "quiz_id = ? AND student_id = ?", quiz.ID, userID).Error

	questionCount := int64(len(quiz.Questions))
	if !isQuizStaff(role) {
		_ = db.Model(&model.QuizQuestion{}).Where("quiz_id = ?", quiz.ID).Count(&questionCount).Error
	}

	sendSuccess(c, gin.H{
		"quiz":             quiz,
		"question_count":   questionCount,
		"attempts_used":    attemptsUsed,
		"attempts_left":    math.Max(0, float64(quiz.MaxAttempts)-float64(attemptsUsed)),
		"best_progress":    best,
		"available":        quizAvailable(quiz, time.Now()),
		"can_show_correct": isQuizStaff(role) || quiz.ShowCorrectAnswers,
		"can_show_result":  isQuizStaff(role) || quiz.ShowResultAfterSubmit,
	}, "Quiz retrieved successfully")
}

func (ctrl *LMSController) CreateQuiz(c *gin.Context) {
	var quiz model.Quiz
	if err := c.ShouldBindJSON(&quiz); err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}
	db := lmsDB(c, ctrl.DB).WithContext(c)
	if quiz.LessonID != nil {
		var lesson model.Lesson
		if err := db.Select("id", "module_id").First(&lesson, "id = ?", *quiz.LessonID).Error; err != nil {
			sendInternalError(c, err)
			return
		}
		var module model.Module
		if err := db.Select("id", "course_id").First(&module, "id = ?", lesson.ModuleID).Error; err != nil {
			sendInternalError(c, err)
			return
		}
		quiz.ModuleID = &lesson.ModuleID
		quiz.CourseID = module.CourseID
	} else if quiz.ModuleID != nil {
		var module model.Module
		if err := db.Select("id", "course_id").First(&module, "id = ?", *quiz.ModuleID).Error; err != nil {
			sendInternalError(c, err)
			return
		}
		quiz.CourseID = module.CourseID
	}
	if err := db.Create(&quiz).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccess(c, quiz, "Quiz created successfully")
}

func (ctrl *LMSController) UpdateQuiz(c *gin.Context) {
	id, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	var quiz model.Quiz
	if err := c.ShouldBindJSON(&quiz); err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}
	quiz.ID = id
	db := lmsDB(c, ctrl.DB).WithContext(c)
	if quiz.LessonID != nil {
		var lesson model.Lesson
		if err := db.Select("id", "module_id").First(&lesson, "id = ?", *quiz.LessonID).Error; err == nil {
			var module model.Module
			if err := db.Select("id", "course_id").First(&module, "id = ?", lesson.ModuleID).Error; err == nil {
				quiz.ModuleID = &lesson.ModuleID
				quiz.CourseID = module.CourseID
			}
		}
	} else if quiz.ModuleID != nil {
		var module model.Module
		if err := db.Select("id", "course_id").First(&module, "id = ?", *quiz.ModuleID).Error; err == nil {
			quiz.CourseID = module.CourseID
		}
	}
	updates := map[string]interface{}{
		"course_id":                             quiz.CourseID,
		"module_id":                             quiz.ModuleID,
		"lesson_id":                             quiz.LessonID,
		"title":                                 quiz.Title,
		"description":                           quiz.Description,
		"instructions":                          quiz.Instructions,
		"passing_score":                         quiz.PassingScore,
		"time_limit_min":                        quiz.TimeLimitMin,
		"max_attempts":                          quiz.MaxAttempts,
		"randomize_questions":                   quiz.RandomizeQuestions,
		"randomize_answers":                     quiz.RandomizeAnswers,
		"show_result_after_submit":              quiz.ShowResultAfterSubmit,
		"show_correct_answers":                  quiz.ShowCorrectAnswers,
		"require_passing_score_before_continue": quiz.RequirePassingScoreBeforeContinue,
		"is_published":                          quiz.IsPublished,
		"available_from":                        quiz.AvailableFrom,
		"available_until":                       quiz.AvailableUntil,
		"sort_order":                            quiz.SortOrder,
	}
	if err := db.Model(&model.Quiz{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	ctrl.GetQuiz(c)
}

func (ctrl *LMSController) DeleteQuiz(c *gin.Context) {
	id, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	if err := lmsDB(c, ctrl.DB).WithContext(c).Delete(&model.Quiz{}, "id = ?", id).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccessNoData(c)
}

func (ctrl *LMSController) PublishQuiz(c *gin.Context) {
	id, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	var req struct {
		IsPublished bool `json:"is_published"`
	}
	_ = c.ShouldBindJSON(&req)
	if err := lmsDB(c, ctrl.DB).WithContext(c).Model(&model.Quiz{}).Where("id = ?", id).Update("is_published", req.IsPublished).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccessNoData(c)
}

func (ctrl *LMSController) CreateQuizQuestion(c *gin.Context) {
	quizID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	var payload quizQuestionPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}
	payload.QuizQuestion.QuizID = quizID
	if err := saveQuestionWithOptions(lmsDB(c, ctrl.DB).WithContext(c), &payload.QuizQuestion, payload.Options, true); err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccess(c, payload.QuizQuestion, "Question created successfully")
}

func (ctrl *LMSController) UpdateQuizQuestion(c *gin.Context) {
	questionID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	var payload quizQuestionPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}
	payload.QuizQuestion.ID = questionID
	if err := saveQuestionWithOptions(lmsDB(c, ctrl.DB).WithContext(c), &payload.QuizQuestion, payload.Options, false); err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccess(c, payload.QuizQuestion, "Question updated successfully")
}

func (ctrl *LMSController) DeleteQuizQuestion(c *gin.Context) {
	id, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	if err := lmsDB(c, ctrl.DB).WithContext(c).Delete(&model.QuizQuestion{}, "id = ?", id).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccessNoData(c)
}

func (ctrl *LMSController) DuplicateQuizQuestion(c *gin.Context) {
	id, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	db := lmsDB(c, ctrl.DB).WithContext(c)
	var question model.QuizQuestion
	if err := db.Preload("Options").First(&question, "id = ?", id).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	question.ID = uuid.Nil
	question.QuestionText = question.QuestionText + " (Copy)"
	question.SortOrder += 1
	options := question.Options
	question.Options = nil
	if err := saveQuestionWithOptions(db, &question, options, true); err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccess(c, question, "Question duplicated successfully")
}

func (ctrl *LMSController) StartQuizAttempt(c *gin.Context) {
	quizID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	userID, _, ok := currentLMSUser(c)
	if !ok {
		return
	}
	db := lmsDB(c, ctrl.DB).WithContext(c)
	var quiz model.Quiz
	if err := db.Preload("Questions", func(db *gorm.DB) *gorm.DB {
		return db.Order("sort_order asc, created_at asc")
	}).Preload("Questions.Options", func(db *gorm.DB) *gorm.DB {
		return db.Order("sort_order asc, created_at asc")
	}).First(&quiz, "id = ?", quizID).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	if !quizAvailable(quiz, time.Now()) || !ctrl.requireLearningAccess(c, &quiz.CourseID) {
		return
	}
	var existing model.QuizAttempt
	if err := db.Preload("Answers").First(&existing, "quiz_id = ? AND student_id = ? AND status = ?", quizID, userID, model.QuizAttemptInProgress).Error; err == nil {
		hideQuizCorrectAnswers(&quiz)
		randomizeQuiz(&quiz)
		sendSuccess(c, gin.H{"attempt": existing, "quiz": quiz}, "Existing attempt retrieved")
		return
	}
	var used int64
	_ = db.Model(&model.QuizAttempt{}).Where("quiz_id = ? AND student_id = ? AND status != ?", quizID, userID, model.QuizAttemptInProgress).Count(&used).Error
	if quiz.MaxAttempts > 0 && used >= int64(quiz.MaxAttempts) {
		sendError(c, http.StatusForbidden, "Maximum attempts reached", nil)
		return
	}
	attempt := model.QuizAttempt{
		QuizID:        quizID,
		StudentID:     userID,
		AttemptNumber: int(used) + 1,
		Status:        model.QuizAttemptInProgress,
		StartedAt:     time.Now(),
	}
	if err := db.Create(&attempt).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	hideQuizCorrectAnswers(&quiz)
	randomizeQuiz(&quiz)
	sendSuccess(c, gin.H{"attempt": attempt, "quiz": quiz}, "Quiz attempt started")
}

func (ctrl *LMSController) SaveQuizAnswer(c *gin.Context) {
	attemptID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	userID, _, ok := currentLMSUser(c)
	if !ok {
		return
	}
	var req saveQuizAnswerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}
	questionID, err := uuid.Parse(req.QuestionID)
	if err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}
	db := lmsDB(c, ctrl.DB).WithContext(c)
	attempt, quiz, valid := ctrl.loadWritableAttempt(c, db, attemptID, userID)
	if !valid {
		return
	}
	if quiz.TimeLimitMin > 0 && time.Since(attempt.StartedAt) > time.Duration(quiz.TimeLimitMin)*time.Minute {
		sendError(c, http.StatusForbidden, "Time limit exceeded", nil)
		return
	}
	selectedJSON, _ := json.Marshal(req.SelectedOptionIDs)
	answer := model.QuizAnswer{
		AttemptID:         attemptID,
		QuestionID:        questionID,
		SelectedOptionIDs: datatypes.JSON(selectedJSON),
		AnswerText:        req.AnswerText,
	}
	var question *model.QuizQuestion
	for i := range quiz.Questions {
		if quiz.Questions[i].ID == questionID {
			question = &quiz.Questions[i]
			break
		}
	}
	if question == nil {
		sendError(c, http.StatusBadRequest, "Question does not belong to this quiz", nil)
		return
	}
	var existing model.QuizAnswer
	err = db.First(&existing, "attempt_id = ? AND question_id = ?", attemptID, questionID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		if answer.ID == uuid.Nil {
			answer.ID = uuid.New()
		}
		points, correct := gradeQuestion(*question, answer)
		answer.PointsAwarded = points
		answer.IsCorrect = correct
		if err := db.Create(&answer).Error; err != nil {
			sendInternalError(c, err)
			return
		}
		sendSuccess(c, quizAnswerFeedback(*question, answer, quiz.ShowCorrectAnswers), "Answer saved")
		return
	}
	if err != nil {
		sendInternalError(c, err)
		return
	}
	existing.SelectedOptionIDs = answer.SelectedOptionIDs
	existing.AnswerText = answer.AnswerText
	points, correct := gradeQuestion(*question, existing)
	existing.PointsAwarded = points
	existing.IsCorrect = correct
	if err := db.Model(&existing).Updates(map[string]interface{}{
		"selected_option_ids": answer.SelectedOptionIDs,
		"answer_text":         answer.AnswerText,
		"is_correct":          correct,
		"points_awarded":      points,
	}).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccess(c, quizAnswerFeedback(*question, existing, quiz.ShowCorrectAnswers), "Answer updated")
}

func (ctrl *LMSController) SubmitQuizAttempt(c *gin.Context) {
	attemptID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	userID, _, ok := currentLMSUser(c)
	if !ok {
		return
	}
	db := lmsDB(c, ctrl.DB).WithContext(c)
	attempt, quiz, valid := ctrl.loadWritableAttempt(c, db, attemptID, userID)
	if !valid {
		return
	}
	submittedAt := time.Now()
	status, score, correctPoints, totalPoints, err := scoreAttempt(db, attempt, quiz, submittedAt)
	if err != nil {
		sendInternalError(c, err)
		return
	}
	if err := db.Transaction(func(tx *gorm.DB) error {
		duration := int(submittedAt.Sub(attempt.StartedAt).Seconds())
		if err := tx.Model(&attempt).Updates(map[string]interface{}{
			"status":         status,
			"score":          score,
			"correct_points": correctPoints,
			"total_points":   totalPoints,
			"submitted_at":   &submittedAt,
			"duration_sec":   duration,
		}).Error; err != nil {
			return err
		}
		return upsertQuizProgress(tx, quiz, attempt, status, score, submittedAt)
	}); err != nil {
		sendInternalError(c, err)
		return
	}
	ctrl.GetQuizAttempt(c)
}

func (ctrl *LMSController) GetQuizAttempt(c *gin.Context) {
	id, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	userID, role, ok := currentLMSUser(c)
	if !ok {
		return
	}
	db := lmsDB(c, ctrl.DB).WithContext(c)
	var attempt model.QuizAttempt
	query := db.Preload("Quiz.Questions.Options").Preload("Quiz").Preload("Answers.Question.Options").Where("id = ?", id)
	if role < 99 {
		query = query.Where("student_id = ?", userID)
	}
	if err := query.First(&attempt).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	if role < 99 && !attempt.Quiz.ShowCorrectAnswers {
		for i := range attempt.Answers {
			hideQuestionCorrectAnswers(&attempt.Answers[i].Question)
		}
	}
	sendSuccess(c, attempt, "Quiz attempt retrieved")
}

func (ctrl *LMSController) ListQuizAttempts(c *gin.Context) {
	quizID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	userID, role, ok := currentLMSUser(c)
	if !ok {
		return
	}
	db := lmsDB(c, ctrl.DB).WithContext(c)
	query := db.Preload("Quiz").Where("quiz_id = ?", quizID).Order("attempt_number desc")
	if role < 99 {
		query = query.Where("student_id = ?", userID)
	}
	var attempts []model.QuizAttempt
	if err := query.Find(&attempts).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccess(c, attempts, "Quiz attempts retrieved")
}

func (ctrl *LMSController) GetQuizResult(c *gin.Context) {
	id, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	userID, role, ok := currentLMSUser(c)
	if !ok {
		return
	}
	db := lmsDB(c, ctrl.DB).WithContext(c)

	var attempt model.QuizAttempt
	query := db.Preload("Quiz").Preload("Quiz.Course").
		Preload("Answers.Question.Options", func(db *gorm.DB) *gorm.DB {
			return db.Order("sort_order asc, created_at asc")
		}).
		Where("id = ?", id)

	// Jika partner biasa, pastikan hanya bisa melihat hasil miliknya sendiri
	if role < 99 {
		query = query.Where("student_id = ?", userID)
	}

	if err := query.First(&attempt).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			sendError(c, http.StatusNotFound, "Hasil attempt tidak ditemukan", nil)
			return
		}
		sendInternalError(c, err)
		return
	}

	// Keamanan tambahan: Cek apakah kuis melarang menampilkan hasil untuk partner
	if role < 99 && !attempt.Quiz.ShowResultAfterSubmit {
		sendError(c, http.StatusForbidden, "Kuis ini dikonfigurasi untuk tidak menampilkan hasil evaluasi", nil)
		return
	}

	sendSuccess(c, attempt, "Quiz result retrieved successfully")
}

func (ctrl *LMSController) GetQuizAnalytics(c *gin.Context) {
	quizID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	db := lmsDB(c, ctrl.DB).WithContext(c)
	var attempts []model.QuizAttempt
	if err := db.Where("quiz_id = ? AND status IN ?", quizID, []model.QuizAttemptStatus{model.QuizAttemptPassed, model.QuizAttemptFailed, model.QuizAttemptSubmitted}).Find(&attempts).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	total := float64(len(attempts))
	sum, passed := 0.0, 0.0
	for _, attempt := range attempts {
		sum += attempt.Score
		if attempt.Status == model.QuizAttemptPassed {
			passed++
		}
	}
	avg, passRate := 0.0, 0.0
	if total > 0 {
		avg = sum / total
		passRate = passed / total * 100
	}

	var missed []gin.H
	rows, err := db.Table("quiz_answers").
		Select("question_id, COUNT(*) as missed_count").
		Where("points_awarded = 0 AND deleted_at IS NULL").
		Group("question_id").
		Order("missed_count desc").
		Limit(10).Rows()
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var questionID string
			var missedCount int64
			if rows.Scan(&questionID, &missedCount) == nil {
				missed = append(missed, gin.H{"question_id": questionID, "missed_count": missedCount})
			}
		}
	}

	var top []model.QuizAttempt
	_ = db.Where("quiz_id = ?", quizID).Order("score desc").Limit(10).Find(&top).Error
	sendSuccess(c, gin.H{
		"total_attempts":        len(attempts),
		"average_score":         avg,
		"pass_rate":             passRate,
		"fail_rate":             100 - passRate,
		"most_missed_questions": missed,
		"top_scoring_students":  top,
	}, "Quiz analytics retrieved")
}

func (ctrl *LMSController) ExportQuizResultsCSV(c *gin.Context) {
	quizID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	var attempts []model.QuizAttempt
	if err := lmsDB(c, ctrl.DB).Where("quiz_id = ?", quizID).Order("student_id asc, attempt_number asc").Find(&attempts).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)
	_ = writer.Write([]string{"attempt_id", "student_id", "attempt_number", "status", "score", "started_at", "submitted_at", "duration_sec"})
	for _, attempt := range attempts {
		submitted := ""
		if attempt.SubmittedAt != nil {
			submitted = attempt.SubmittedAt.Format(time.RFC3339)
		}
		_ = writer.Write([]string{attempt.ID.String(), attempt.StudentID.String(), strconv.Itoa(attempt.AttemptNumber), string(attempt.Status), fmt.Sprintf("%.2f", attempt.Score), attempt.StartedAt.Format(time.RFC3339), submitted, strconv.Itoa(attempt.DurationSec)})
	}
	writer.Flush()
	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", "attachment; filename=quiz-results.csv")
	c.String(http.StatusOK, buf.String())
}

func (ctrl *LMSController) ImportQuizQuestionsCSV(c *gin.Context) {
	quizID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	file, err := c.FormFile("file")
	if err != nil {
		sendBadRequest(c, "CSV file is required", nil)
		return
	}
	src, err := file.Open()
	if err != nil {
		sendInternalError(c, err)
		return
	}
	defer src.Close()
	reader := csv.NewReader(src)
	rows, err := reader.ReadAll()
	if err != nil {
		sendBadRequest(c, "Invalid CSV", nil)
		return
	}
	created := 0
	for i, row := range rows {
		if i == 0 || len(row) < 2 {
			continue
		}
		points, _ := strconv.ParseFloat(valueAt(row, 2), 64)
		sortOrder, _ := strconv.Atoi(valueAt(row, 4))
		required := strings.ToLower(valueAt(row, 5)) != "false"
		question := model.QuizQuestion{
			QuizID:       quizID,
			QuestionText: valueAt(row, 0),
			QuestionType: model.QuizQuestionType(valueAt(row, 1)),
			Points:       points,
			Explanation:  valueAt(row, 3),
			SortOrder:    sortOrder,
			IsRequired:   required,
		}
		options := parseCSVOptions(row)
		if err := saveQuestionWithOptions(lmsDB(c, ctrl.DB).WithContext(c), &question, options, true); err != nil {
			sendInternalError(c, err)
			return
		}
		created++
	}
	sendSuccess(c, gin.H{"created": created}, "Questions imported successfully")
}

func (ctrl *LMSController) ImportQuizQuestionsExcel(c *gin.Context) {
	quizID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	file, err := c.FormFile("file")
	if err != nil {
		sendBadRequest(c, "File Excel wajib dipilih", nil)
		return
	}
	if file.Size > 5*1024*1024 {
		sendBadRequest(c, "Ukuran file Excel maksimal 5 MB", nil)
		return
	}
	if !strings.HasSuffix(strings.ToLower(file.Filename), ".xlsx") {
		sendBadRequest(c, "Format file harus .xlsx", nil)
		return
	}

	src, err := file.Open()
	if err != nil {
		sendInternalError(c, err)
		return
	}
	defer src.Close()

	workbook, err := excelize.OpenReader(src)
	if err != nil {
		sendBadRequest(c, "File Excel tidak valid atau rusak", nil)
		return
	}
	defer workbook.Close()

	rows, err := workbook.GetRows("Quiz")
	if err != nil {
		sendBadRequest(c, "Sheet bernama 'Quiz' tidak ditemukan", nil)
		return
	}
	importRows, err := parseQuizExcelRows(rows)
	if err != nil {
		sendBadRequest(c, err.Error(), nil)
		return
	}
	if len(importRows) == 0 {
		sendBadRequest(c, "Sheet Quiz tidak berisi soal", nil)
		return
	}

	db := lmsDB(c, ctrl.DB).WithContext(c)
	var quiz model.Quiz
	if err := db.Select("id").First(&quiz, "id = ?", quizID).Error; err != nil {
		sendError(c, http.StatusNotFound, "Quiz tidak ditemukan", nil)
		return
	}

	var maxSortOrder int
	if err := db.Model(&model.QuizQuestion{}).Where("quiz_id = ?", quizID).
		Select("COALESCE(MAX(sort_order), 0)").Scan(&maxSortOrder).Error; err != nil {
		sendInternalError(c, err)
		return
	}

	type preparedQuestion struct {
		question model.QuizQuestion
		options  []model.QuizOption
	}
	prepared := make([]preparedQuestion, 0, len(importRows))
	for i, row := range importRows {
		question, options, err := row.Build(quizID, maxSortOrder+i+1)
		if err != nil {
			sendBadRequest(c, err.Error(), nil)
			return
		}
		prepared = append(prepared, preparedQuestion{question: question, options: options})
	}

	err = db.Transaction(func(tx *gorm.DB) error {
		for i := range prepared {
			if err := saveQuestionWithOptions(tx, &prepared[i].question, prepared[i].options, true); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		sendInternalError(c, err)
		return
	}

	sendSuccess(c, gin.H{"created": len(prepared)}, fmt.Sprintf("%d soal berhasil diimpor", len(prepared)))
}

var quizExcelHeaders = []string{
	"question_text", "question_type", "points", "explanation", "is_required",
	"option_1", "option_2", "option_3", "option_4", "option_5", "option_6", "correct_answer",
}

func parseQuizExcelRows(rows [][]string) ([]model.QuizQuestionImportRow, error) {
	if len(rows) == 0 {
		return nil, fmt.Errorf("sheet Quiz kosong")
	}
	for i, expected := range quizExcelHeaders {
		if normalizeQuizExcelCell(valueAt(rows[0], i)) != expected {
			return nil, fmt.Errorf("kolom %d harus bernama %s", i+1, expected)
		}
	}

	result := make([]model.QuizQuestionImportRow, 0, len(rows)-1)
	for index, cells := range rows[1:] {
		rowNumber := index + 2
		if strings.TrimSpace(valueAt(cells, 0)) == "" {
			if quizExcelRowEmpty(cells) {
				continue
			}
			return nil, fmt.Errorf("baris %d: question_text wajib diisi", rowNumber)
		}

		points, err := strconv.ParseFloat(strings.ReplaceAll(valueAt(cells, 2), ",", "."), 64)
		if err != nil {
			return nil, fmt.Errorf("baris %d: points harus berupa angka", rowNumber)
		}
		required, err := parseQuizExcelBool(valueAt(cells, 4))
		if err != nil {
			return nil, fmt.Errorf("baris %d: is_required harus TRUE atau FALSE", rowNumber)
		}

		questionType := model.QuizQuestionType(strings.ToLower(valueAt(cells, 1)))
		row := model.QuizQuestionImportRow{
			RowNumber:    rowNumber,
			QuestionText: valueAt(cells, 0),
			QuestionType: questionType,
			Points:       points,
			Explanation:  valueAt(cells, 3),
			IsRequired:   required,
			OptionTexts:  []string{valueAt(cells, 5), valueAt(cells, 6), valueAt(cells, 7), valueAt(cells, 8), valueAt(cells, 9), valueAt(cells, 10)},
		}
		correctAnswer := valueAt(cells, 11)
		if questionType == model.QuizQuestionShortAnswer {
			row.ShortAnswer = correctAnswer
		} else {
			correct, err := parseQuizCorrectAnswer(correctAnswer)
			if err != nil {
				return nil, fmt.Errorf("baris %d: correct_answer harus berupa nomor pilihan, contoh 1 atau 1,3", rowNumber)
			}
			row.Correct = correct
		}
		result = append(result, row)
	}
	return result, nil
}

func parseQuizCorrectAnswer(value string) ([]int, error) {
	parts := strings.FieldsFunc(value, func(r rune) bool { return r == ',' || r == ';' || r == '|' })
	result := make([]int, 0, len(parts))
	for _, part := range parts {
		index, err := strconv.Atoi(strings.TrimSpace(part))
		if err != nil {
			return nil, err
		}
		result = append(result, index)
	}
	return result, nil
}

func parseQuizExcelBool(value string) (bool, error) {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "true", "1", "yes", "ya":
		return true, nil
	case "false", "0", "no", "tidak":
		return false, nil
	default:
		return false, fmt.Errorf("invalid boolean")
	}
}

func quizExcelRowEmpty(row []string) bool {
	for _, cell := range row {
		if strings.TrimSpace(cell) != "" {
			return false
		}
	}
	return true
}

func normalizeQuizExcelCell(value string) string {
	return strings.TrimSpace(strings.TrimPrefix(strings.ToLower(value), "\ufeff"))
}

type reorderQuestionsRequest struct {
	Questions []struct {
		ID        string `json:"id" binding:"required"`
		SortOrder int    `json:"sort_order"`
	} `json:"questions" binding:"required"`
}

func (ctrl *LMSController) ReorderQuizQuestions(c *gin.Context) {
	quizID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}

	var req reorderQuestionsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}

	db := lmsDB(c, ctrl.DB).WithContext(c)

	// Eksekusi pembaruan urutan di dalam blok database transaction
	err := db.Transaction(func(tx *gorm.DB) error {
		for _, item := range req.Questions {
			qID, err := uuid.Parse(item.ID)
			if err != nil {
				return err
			}
			// Update sort_order berdasarkan id soal dan pastikan terkunci pada quiz_id yang valid
			if err := tx.Model(&model.QuizQuestion{}).
				Where("id = ? AND quiz_id = ?", qID, quizID).
				Update("sort_order", item.SortOrder).Error; err != nil {
				return err
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

func saveQuestionWithOptions(db *gorm.DB, question *model.QuizQuestion, options []model.QuizOption, create bool) error {
	return db.Transaction(func(tx *gorm.DB) error {
		if create {
			if err := tx.Create(question).Error; err != nil {
				return err
			}
		} else if err := tx.Model(&model.QuizQuestion{}).Where("id = ?", question.ID).Updates(map[string]interface{}{
			"question_text":  question.QuestionText,
			"question_type":  question.QuestionType,
			"points":         question.Points,
			"explanation":    question.Explanation,
			"sort_order":     question.SortOrder,
			"is_required":    question.IsRequired,
			"always_correct": question.AlwaysCorrect,
		}).Error; err != nil {
			return err
		}
		if !create {
			if err := tx.Delete(&model.QuizOption{}, "question_id = ?", question.ID).Error; err != nil {
				return err
			}
		}
		for i := range options {
			options[i].ID = uuid.Nil
			options[i].QuestionID = question.ID
			if err := tx.Create(&options[i]).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (ctrl *LMSController) loadWritableAttempt(c *gin.Context, db *gorm.DB, attemptID uuid.UUID, userID uuid.UUID) (model.QuizAttempt, model.Quiz, bool) {
	var attempt model.QuizAttempt
	if err := db.First(&attempt, "id = ? AND student_id = ?", attemptID, userID).Error; err != nil {
		sendError(c, http.StatusNotFound, "Attempt not found", nil)
		return attempt, model.Quiz{}, false
	}
	if attempt.Status != model.QuizAttemptInProgress {
		sendError(c, http.StatusBadRequest, "Attempt already submitted", nil)
		return attempt, model.Quiz{}, false
	}
	var quiz model.Quiz
	if err := db.Preload("Questions.Options").First(&quiz, "id = ?", attempt.QuizID).Error; err != nil {
		sendInternalError(c, err)
		return attempt, quiz, false
	}
	return attempt, quiz, true
}

func scoreAttempt(db *gorm.DB, attempt model.QuizAttempt, quiz model.Quiz, submittedAt time.Time) (model.QuizAttemptStatus, float64, float64, float64, error) {
	var answers []model.QuizAnswer
	if err := db.Where("attempt_id = ?", attempt.ID).Find(&answers).Error; err != nil {
		return model.QuizAttemptFailed, 0, 0, 0, err
	}
	answerByQuestion := map[uuid.UUID]model.QuizAnswer{}
	for _, answer := range answers {
		answerByQuestion[answer.QuestionID] = answer
	}
	totalPoints, correctPoints := 0.0, 0.0
	for _, question := range quiz.Questions {
		totalPoints += question.Points
		answer := answerByQuestion[question.ID]
		points, correct := gradeQuestion(question, answer)
		correctPoints += points
		if err := db.Model(&model.QuizAnswer{}).Where("attempt_id = ? AND question_id = ?", attempt.ID, question.ID).Updates(map[string]interface{}{
			"is_correct":     correct,
			"points_awarded": points,
		}).Error; err != nil {
			return model.QuizAttemptFailed, 0, 0, 0, err
		}
	}
	score := 0.0
	if totalPoints > 0 {
		score = correctPoints / totalPoints * 100
	}
	status := model.QuizAttemptFailed
	if quiz.TimeLimitMin > 0 && submittedAt.Sub(attempt.StartedAt) > time.Duration(quiz.TimeLimitMin)*time.Minute {
		status = model.QuizAttemptExpired
	} else if score >= quiz.PassingScore {
		status = model.QuizAttemptPassed
	}
	return status, score, correctPoints, totalPoints, nil
}

func gradeQuestion(question model.QuizQuestion, answer model.QuizAnswer) (float64, bool) {
	if answer.ID == uuid.Nil {
		return 0, false
	}
	if question.AlwaysCorrect {
		return question.Points, true
	}
	switch question.QuestionType {
	case model.QuizQuestionShortAnswer:
		expected := ""
		for _, option := range question.Options {
			if option.IsCorrect {
				expected = option.OptionText
				break
			}
		}
		if expected != "" && strings.EqualFold(strings.TrimSpace(answer.AnswerText), strings.TrimSpace(expected)) {
			return question.Points, true
		}
	case model.QuizQuestionTrueFalse, model.QuizQuestionSingle, model.QuizQuestionMultiple:
		selected := []string{}
		_ = json.Unmarshal(answer.SelectedOptionIDs, &selected)
		correct := []string{}
		for _, option := range question.Options {
			if option.IsCorrect {
				correct = append(correct, option.ID.String())
			}
		}
		sort.Strings(selected)
		sort.Strings(correct)
		if strings.Join(selected, ",") == strings.Join(correct, ",") {
			return question.Points, true
		}
	case model.QuizQuestionArrangeWords:
		selected := []string{}
		_ = json.Unmarshal(answer.SelectedOptionIDs, &selected)

		var correctOptions []model.QuizOption
		for _, option := range question.Options {
			if option.IsCorrect {
				correctOptions = append(correctOptions, option)
			}
		}
		// Sort correct options by SortOrder to get the right sequence
		sort.Slice(correctOptions, func(i, j int) bool {
			return correctOptions[i].SortOrder < correctOptions[j].SortOrder
		})

		if len(selected) != len(correctOptions) || len(correctOptions) == 0 {
			return 0, false
		}

		for i, opt := range correctOptions {
			if selected[i] != opt.ID.String() {
				return 0, false
			}
		}
		return question.Points, true
	}
	return 0, false
}

func quizAnswerFeedback(question model.QuizQuestion, answer model.QuizAnswer, includeCorrect bool) gin.H {
	safeAnswer := answer
	if !includeCorrect {
		safeAnswer.IsCorrect = false
		safeAnswer.PointsAwarded = 0
	}
	payload := gin.H{
		"answer":             safeAnswer,
		"feedback_available": includeCorrect,
	}
	if !includeCorrect {
		return payload
	}

	correctOptions := []gin.H{}
	correctOptionIDs := []string{}
	for _, option := range question.Options {
		if option.IsCorrect {
			correctOptionIDs = append(correctOptionIDs, option.ID.String())
			correctOptions = append(correctOptions, gin.H{
				"id":          option.ID,
				"option_text": option.OptionText,
			})
		}
	}

	payload["is_correct"] = answer.IsCorrect
	payload["points_awarded"] = answer.PointsAwarded
	payload["explanation"] = question.Explanation
	payload["correct_option_ids"] = correctOptionIDs
	payload["correct_options"] = correctOptions
	if question.QuestionType == model.QuizQuestionShortAnswer && len(correctOptions) > 0 {
		payload["correct_answer_text"] = correctOptions[0]["option_text"]
	}
	return payload
}

func upsertQuizProgress(tx *gorm.DB, quiz model.Quiz, attempt model.QuizAttempt, status model.QuizAttemptStatus, score float64, completedAt time.Time) error {
	isPassed := status == model.QuizAttemptPassed
	progress := model.QuizProgress{
		StudentID:       attempt.StudentID,
		CourseID:        quiz.CourseID,
		ModuleID:        quiz.ModuleID,
		LessonID:        quiz.LessonID,
		QuizID:          quiz.ID,
		IsCompleted:     true,
		IsPassed:        isPassed,
		BestScore:       score,
		BestAttemptID:   &attempt.ID,
		CompletedAt:     &completedAt,
		ProgressPercent: 100,
	}
	var existing model.QuizProgress
	err := tx.First(&existing, "student_id = ? AND quiz_id = ?", attempt.StudentID, quiz.ID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return tx.Create(&progress).Error
	}
	if err != nil {
		return err
	}
	if existing.BestScore > score {
		score = existing.BestScore
		progress.BestScore = existing.BestScore
		progress.BestAttemptID = existing.BestAttemptID
	}
	return tx.Model(&existing).Updates(progress).Error
}

func quizAvailable(quiz model.Quiz, now time.Time) bool {
	if !quiz.IsPublished && quiz.LessonID == nil {
		return false
	}
	if quiz.AvailableFrom != nil && quiz.AvailableFrom.After(now) {
		return false
	}
	if quiz.AvailableUntil != nil && quiz.AvailableUntil.Before(now) {
		return false
	}
	return true
}

func hideQuizCorrectAnswers(quiz *model.Quiz) {
	for i := range quiz.Questions {
		hideQuestionCorrectAnswers(&quiz.Questions[i])
	}
}

func hideQuestionCorrectAnswers(question *model.QuizQuestion) {
	question.AlwaysCorrect = false
	for i := range question.Options {
		question.Options[i].IsCorrect = false
	}
	question.Explanation = ""
}

func randomizeQuiz(quiz *model.Quiz) {
	if quiz.RandomizeQuestions {
		rand.Shuffle(len(quiz.Questions), func(i, j int) {
			quiz.Questions[i], quiz.Questions[j] = quiz.Questions[j], quiz.Questions[i]
		})
	}
	if quiz.RandomizeAnswers {
		for i := range quiz.Questions {
			rand.Shuffle(len(quiz.Questions[i].Options), func(a, b int) {
				quiz.Questions[i].Options[a], quiz.Questions[i].Options[b] = quiz.Questions[i].Options[b], quiz.Questions[i].Options[a]
			})
		}
	}
}

func parseCSVOptions(row []string) []model.QuizOption {
	options := []model.QuizOption{}
	raw := valueAt(row, 6)
	if raw == "" {
		return options
	}
	parts := strings.Split(raw, "|")
	correctSet := map[string]bool{}
	for _, idx := range strings.Split(valueAt(row, 7), "|") {
		correctSet[strings.TrimSpace(idx)] = true
	}
	for i, part := range parts {
		options = append(options, model.QuizOption{
			OptionText: strings.TrimSpace(part),
			IsCorrect:  correctSet[strconv.Itoa(i+1)] || correctSet[strings.TrimSpace(part)],
			SortOrder:  i + 1,
		})
	}
	return options
}

func valueAt(row []string, index int) string {
	if len(row) <= index {
		return ""
	}
	return strings.TrimSpace(row[index])
}
