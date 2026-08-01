package controller

import (
	"encoding/json"
	"errors"
	"fmt"
	"gin-template/common"
	"gin-template/model"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type UserController struct {
	DB *gorm.DB
}

func NewUserController(db *gorm.DB) *UserController {
	return &UserController{DB: db}
}

type UserResponse struct {
	ID                 uuid.UUID `json:"id"`
	Username           string    `json:"username"`
	Email              string    `json:"email"`
	Role               int       `json:"role"`
	Status             int       `json:"status"`
	DisplayName        string    `json:"display_name"`
	MentorType         string    `json:"mentor_type,omitempty"`
	CreatedAt          string    `json:"created_at,omitempty"`
	UpdatedAt          string    `json:"updated_at,omitempty"`
	LastLogin          string    `json:"last_login,omitempty"`
	ActiveSubscription string    `json:"active_subscription,omitempty"`
	SubscriptionExpiry string    `json:"subscription_expiry,omitempty"`
}

type userDetailPayment struct {
	model.LMSPayment
	PlanName          string `json:"plan_name"`
	TargetStudentName string `json:"target_student_name"`
	PayerName         string `json:"payer_name"`
}

func loadActiveSubscriptionSummaries(db *gorm.DB, userIDs []uuid.UUID, now time.Time) (map[uuid.UUID]string, map[uuid.UUID]string, error) {
	planNames := make(map[uuid.UUID]string)
	expiries := make(map[uuid.UUID]string)
	if len(userIDs) == 0 {
		return planNames, expiries, nil
	}

	statuses := []string{string(model.SubscriptionStatusActive), string(model.SubscriptionStatusTrialing)}
	loadByUserColumn := func(column string) ([]model.Subscription, error) {
		var subscriptions []model.Subscription
		err := db.Model(&model.Subscription{}).
			Select("id", "student_id", "parent_id", "plan_id", "provider_plan_id", "current_period_end").
			Where(column+" IN ?", userIDs).
			Where("status IN ?", statuses).
			Where("current_period_end IS NULL OR current_period_end > ?", now).
			Find(&subscriptions).Error
		return subscriptions, err
	}

	studentSubscriptions, err := loadByUserColumn("student_id")
	if err != nil {
		return nil, nil, err
	}
	parentSubscriptions, err := loadByUserColumn("parent_id")
	if err != nil {
		return nil, nil, err
	}

	// A subscription can match both lookups. Keep it once before resolving plans.
	subscriptionsByID := make(map[uuid.UUID]model.Subscription, len(studentSubscriptions)+len(parentSubscriptions))
	for _, subscription := range append(studentSubscriptions, parentSubscriptions...) {
		subscriptionsByID[subscription.ID] = subscription
	}

	planIDs := make([]uuid.UUID, 0, len(subscriptionsByID))
	seenPlanIDs := make(map[uuid.UUID]struct{}, len(subscriptionsByID))
	resolvedPlanID := make(map[uuid.UUID]uuid.UUID, len(subscriptionsByID))
	for subscriptionID, subscription := range subscriptionsByID {
		planID := uuid.Nil
		if subscription.PlanID != nil {
			planID = *subscription.PlanID
		} else if parsedID, parseErr := uuid.Parse(strings.TrimSpace(subscription.ProviderPlanID)); parseErr == nil {
			planID = parsedID
		}
		if planID == uuid.Nil {
			continue
		}
		resolvedPlanID[subscriptionID] = planID
		if _, exists := seenPlanIDs[planID]; !exists {
			seenPlanIDs[planID] = struct{}{}
			planIDs = append(planIDs, planID)
		}
	}

	planNamesByID := make(map[uuid.UUID]string, len(planIDs))
	if len(planIDs) > 0 {
		var plans []model.SubscriptionPlan
		if err := db.Model(&model.SubscriptionPlan{}).
			Select("id", "name").
			Where("id IN ?", planIDs).
			Find(&plans).Error; err != nil {
			return nil, nil, err
		}
		for _, plan := range plans {
			planNamesByID[plan.ID] = plan.Name
		}
	}

	for subscriptionID, subscription := range subscriptionsByID {
		planName := planNamesByID[resolvedPlanID[subscriptionID]]
		if planName == "" {
			planName = "Active Plan"
		}
		expiry := "-"
		if subscription.CurrentPeriodEnd != nil {
			expiry = subscription.CurrentPeriodEnd.Format("2006-01-02 15:04:05")
		}
		if subscription.StudentID != uuid.Nil {
			planNames[subscription.StudentID] = planName
			expiries[subscription.StudentID] = expiry
		}
		if subscription.ParentID != uuid.Nil {
			planNames[subscription.ParentID] = planName
			expiries[subscription.ParentID] = expiry
		}
	}

	return planNames, expiries, nil
}

// --- Controller Functions ---

// GetAllUsers retrieves paginated user list
func (ctrl *UserController) GetAllUsers(c *gin.Context) {
	log := zap.L().With(zap.String("controller", "UserController"), zap.String("function", "GetAllUsers"))
	if c.GetInt("role") < 99 {
		log.Warn("Access denied for non-admin role", zap.Int("role", c.GetInt("role")))
		sendError(c, http.StatusForbidden, "Admin access is required", nil)
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	log.Debug("Fetching paginated users", zap.Int("page", page), zap.Int("limit", limit))

	db := model.GetDB(c)
	query := db.Model(&model.User{})

	search := strings.TrimSpace(c.Query("search"))
	if search != "" {
		keyword := "%" + search + "%"
		query = query.Where("username LIKE ? OR email LIKE ? OR display_name LIKE ?", keyword, keyword, keyword)
	}

	if roleParam := strings.TrimSpace(c.Query("role")); roleParam != "" {
		role, err := strconv.Atoi(roleParam)
		if err != nil {
			sendBadRequest(c, ErrInvalidParameters, nil)
			return
		}
		query = query.Where("role = ?", role)
	}

	// Online filter
	if c.Query("online") == "true" {
		tenantID := c.GetString("tenant_id")
		tracker := GetOnlineTracker(db)
		onlineUserIDs := tracker.GetOnlineUserIDs(tenantID)
		if len(onlineUserIDs) == 0 {
			// No online users, return empty list immediately
			c.JSON(200, gin.H{
				"data": []UserResponse{},
				"pagination": gin.H{
					"page":        page,
					"limit":       limit,
					"total":       0,
					"total_pages": 0,
				},
				"message": "Users retrieved successfully",
			})
			return
		}
		query = query.Where("id IN ?", onlineUserIDs)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		sendBadRequest(c, err.Error(), nil)
		return
	}

	// Sorting
	sortParam := c.Query("sort")
	orderClause := "created_at desc, id desc"
	if sortParam == "active" {
		orderClause = "updated_at desc, id desc"
	}

	var users []*model.User
	offset := (page - 1) * limit
	err := query.
		Order(orderClause).
		Limit(limit).
		Offset(offset).
		Select([]string{"id", "username", "display_name", "role", "status", "email", "created_at", "updated_at", "mentor_type"}).
		Find(&users).Error
	if err != nil {
		sendBadRequest(c, err.Error(), nil)
		return
	}

	var userIDs []uuid.UUID
	for _, u := range users {
		userIDs = append(userIDs, u.ID)
	}

	activeSubscriptions := make(map[uuid.UUID]string)
	subscriptionExpiries := make(map[uuid.UUID]string)
	if len(userIDs) > 0 {
		var subscriptionErr error
		activeSubscriptions, subscriptionExpiries, subscriptionErr = loadActiveSubscriptionSummaries(db, userIDs, time.Now())
		if subscriptionErr != nil {
			log.Warn("Failed to load active subscription summaries", zap.Error(subscriptionErr))
			activeSubscriptions = make(map[uuid.UUID]string)
			subscriptionExpiries = make(map[uuid.UUID]string)
		}
	}

	var safeUsers []UserResponse
	for _, u := range users {
		// Inisialisasi string waktu kosong
		createdAtStr := ""
		updatedAtStr := ""
		lastLoginStr := "-"

		// 1. Cek apakah u.CreatedAt TIDAK nil sebelum memanggil Format()
		if u.CreatedAt != nil {
			createdAtStr = u.CreatedAt.Format("2006-01-02 15:04:05")
		}

		// 2. Cek apakah u.UpdatedAt TIDAK nil sebelum memanggil Format()
		if u.UpdatedAt != nil {
			updatedAtStr = u.UpdatedAt.Format("2006-01-02 15:04:05")
			lastLoginStr = u.UpdatedAt.Format("2006-01-02 15:04:05")
		}

		activeSub := "-"
		if subName, ok := activeSubscriptions[u.ID]; ok {
			activeSub = subName
		}

		subExpiry := "-"
		if exp, ok := subscriptionExpiries[u.ID]; ok {
			subExpiry = exp
		}

		safeUsers = append(safeUsers, UserResponse{
			ID:                 u.ID,
			Username:           u.Username,
			Email:              u.Email,
			MentorType:         u.MentorType,
			Role:               u.Role,
			Status:             u.Status,
			DisplayName:        u.DisplayName,
			CreatedAt:          createdAtStr,
			UpdatedAt:          updatedAtStr,
			LastLogin:          lastLoginStr,
			ActiveSubscription: activeSub,
			SubscriptionExpiry: subExpiry,
		})
	}

	c.JSON(200, gin.H{
		"data": safeUsers,
		"pagination": gin.H{
			"page":        page,
			"limit":       limit,
			"total":       total,
			"total_pages": (total + int64(limit) - 1) / int64(limit),
		},
		"message": "Users retrieved successfully",
	})
}

// SearchUsers searches users by keyword
func (ctrl *UserController) SearchUsers(c *gin.Context) {
	keyword := strings.TrimSpace(c.Query("keyword"))
	if keyword == "" {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}

	users, err := model.SearchUsers(keyword)
	if err != nil {
		sendBadRequest(c, err.Error(), nil)
		return
	}

	sendSuccess(c, users, "Users retrieved successfully")
}

// GetUser retrieves a specific user by ID
func (ctrl *UserController) GetUser(c *gin.Context) {
	if c.GetInt("role") < 99 {
		sendError(c, http.StatusForbidden, "Admin access is required", nil)
		return
	}
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr) // Mengubah dari string ke UUID
	if err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}

	user, err := model.GetUserById(id, false) // Menggunakan ID bertipe UUID
	if err != nil {
		sendBadRequest(c, err.Error(), nil)
		return
	}

	myRole := c.GetInt("role")
	if myRole <= user.Role {
		sendBadRequest(c, ErrCannotModifyHigherRole, nil)
		return
	}

	sendSuccess(c, user, "User retrieved successfully")
}

func (ctrl *UserController) GetUserDetail(c *gin.Context) {
	if c.GetInt("role") < 99 {
		sendError(c, http.StatusForbidden, "Admin access is required", nil)
		return
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}
	db := model.GetDB(c)
	var user model.User
	if err := db.First(&user, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			sendError(c, http.StatusNotFound, "User not found", nil)
			return
		}
		sendInternalError(c, err)
		return
	}

	profile := model.Profile{}
	_ = db.First(&profile, "user_id = ?", id).Error
	metadata := jsonMetadata(profile.Metadata)
	teacherVerification := map[string]interface{}{}
	if existing, ok := metadata["teacher_verification"].(map[string]interface{}); ok {
		teacherVerification = existing
	}

	subscriptions, plansByID, err := loadUserSubscriptions(db, user)
	if err != nil {
		sendInternalError(c, err)
		return
	}
	subscriptionPayload := buildUserSubscriptionPayload(time.Now(), subscriptions, plansByID)

	payments, err := loadUserDetailPayments(db, user, plansByID)
	if err != nil {
		sendInternalError(c, err)
		return
	}

	children, err := loadUserChildren(db, user.ID)
	if err != nil {
		sendInternalError(c, err)
		return
	}
	parents, err := loadUserParents(db, user.ID)
	if err != nil {
		sendInternalError(c, err)
		return
	}

	sendSuccess(c, gin.H{
		"account": gin.H{
			"id":              user.ID,
			"username":        user.Username,
			"full_name":       displayUserName(user),
			"display_name":    user.DisplayName,
			"email":           user.Email,
			"phone_number":    user.PhoneNumber,
			"role":            user.Role,
			"role_name":       userRoleLabel(user.Role),
			"tenant_id":       user.TenantID,
			"status":          user.Status,
			"is_active":       user.Status != common.UserStatusDisabled,
			"created_at":      user.CreatedAt,
			"updated_at":      user.UpdatedAt,
			"last_login":      user.UpdatedAt,
			"mentor_type":     user.MentorType,
			"organization_id": user.OrganizationID,
		},
		"organization": func() *gin.H {
			if user.OrganizationID == nil {
				return nil
			}
			var org model.Organization
			if err := db.First(&org, "id = ?", *user.OrganizationID).Error; err == nil {
				return &gin.H{"id": org.ID, "name": org.Name}
			}
			return nil
		}(),
		"profile": gin.H{
			"full_name":     firstNonEmpty(profile.FullName, displayUserName(user)),
			"mother_name":   metadataString(metadata, "mother_name", "motherName", "mother"),
			"nisn":          metadataString(metadata, "nisn", "NISN"),
			"student_email": user.Email,
			"whatsapp":      firstNonEmpty(user.PhoneNumber, profile.PhoneNumber, metadataString(metadata, "whatsapp", "whatsapp_number")),
			"date_of_birth": user.DateOfBirth,
			"gender":        user.Gender,
			"address":       user.Address,
			"avatar_url":    profile.AvatarURL,
			"city": firstNonEmpty(
				metadataString(teacherVerification, "city"),
				metadataString(metadata, "city"),
				user.City,
			),
			"institution": firstNonEmpty(
				metadataString(teacherVerification, "institution"),
				metadataString(metadata, "institution"),
			),
			"teaching_status": firstNonEmpty(
				metadataString(teacherVerification, "teaching_status"),
				metadataString(metadata, "teaching_status"),
			),
			"simpkb": firstNonEmpty(
				metadataString(teacherVerification, "simpkb"),
				metadataString(metadata, "simpkb"),
			),
			"nuptk": firstNonEmpty(
				metadataString(teacherVerification, "nuptk"),
				metadataString(metadata, "nuptk"),
			),
			"gtk": firstNonEmpty(
				metadataString(teacherVerification, "gtk"),
				metadataString(metadata, "gtk"),
			),
			"declaration": firstNonEmpty(
				metadataString(teacherVerification, "declaration"),
				metadataString(metadata, "declaration"),
			) == "true",
			"metadata": metadata,
		},
		"subscription":  subscriptionPayload,
		"subscriptions": subscriptions,
		"payments":      payments,
		"children":      children,
		"parents":       parents,
	}, "User detail retrieved successfully")
}

func (ctrl *UserController) AssignUserSubscription(c *gin.Context) {
	if c.GetInt("role") < 99 {
		sendError(c, http.StatusForbidden, "Admin access is required", nil)
		return
	}
	targetID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}

	var req struct {
		PlanID       string `json:"plan_id"`
		DurationDays int    `json:"duration_days"`
	}
	_ = c.ShouldBindJSON(&req)

	db := model.GetDB(c)
	var targetUser model.User
	if err := db.First(&targetUser, "id = ?", targetID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			sendError(c, http.StatusNotFound, "User not found", nil)
			return
		}
		sendInternalError(c, err)
		return
	}

	var plan model.SubscriptionPlan
	if req.PlanID != "" {
		planUUID, err := uuid.Parse(req.PlanID)
		if err == nil {
			_ = db.First(&plan, "id = ?", planUUID).Error
		}
	}
	if plan.ID == uuid.Nil {
		if err := db.First(&plan, "is_active = ?", true).Error; err != nil {
			_ = db.First(&plan).Error
		}
	}

	days := req.DurationDays
	if days <= 0 {
		days = 30
	}
	now := time.Now()
	periodEnd := now.AddDate(0, 0, days)

	var sub model.Subscription
	err = db.Where("(parent_id = ? OR student_id = ?)", targetUser.ID, targetUser.ID).
		Order("created_at DESC").
		First(&sub).Error

	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		sendInternalError(c, err)
		return
	}

	if sub.ID != uuid.Nil {
		sub.Status = model.SubscriptionStatusActive
		if plan.ID != uuid.Nil {
			sub.PlanID = &plan.ID
			sub.ProviderPlanID = plan.ID.String()
		}
		sub.CurrentPeriodStart = &now
		sub.CurrentPeriodEnd = &periodEnd
		sub.CanceledAt = nil
		sub.CancelAtPeriodEnd = false
		if err := db.Save(&sub).Error; err != nil {
			sendInternalError(c, err)
			return
		}
	} else {
		var planIDPtr *uuid.UUID
		providerPlanID := "manual"
		if plan.ID != uuid.Nil {
			planIDPtr = &plan.ID
			providerPlanID = plan.ID.String()
		}
		sub = model.Subscription{
			ParentID:               targetUser.ID,
			StudentID:              targetUser.ID,
			PlanID:                 planIDPtr,
			ProviderPlanID:         providerPlanID,
			Status:                 model.SubscriptionStatusActive,
			Provider:               "manual_admin",
			ProviderSubscriptionID: "admin_sub_" + uuid.New().String(),
			Amount:                 plan.Amount,
			Currency:               "IDR",
			Interval:               "month",
			CurrentPeriodStart:     &now,
			CurrentPeriodEnd:       &periodEnd,
			TenantID:               targetUser.TenantID,
		}
		if err := db.Create(&sub).Error; err != nil {
			sendInternalError(c, err)
			return
		}
	}

	sendSuccess(c, sub, "Subscription successfully assigned to user")
}

func (ctrl *UserController) RemoveUserSubscription(c *gin.Context) {
	if c.GetInt("role") < 99 {
		sendError(c, http.StatusForbidden, "Admin access is required", nil)
		return
	}
	targetID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}

	db := model.GetDB(c)
	now := time.Now()

	err = db.Model(&model.Subscription{}).
		Where("(parent_id = ? OR student_id = ?) AND status != ?", targetID, targetID, model.SubscriptionStatusCanceled).
		Updates(map[string]interface{}{
			"status":      model.SubscriptionStatusCanceled,
			"canceled_at": &now,
		}).Error

	if err != nil {
		sendInternalError(c, err)
		return
	}

	sendSuccess(c, nil, "Subscription successfully removed")
}

func (ctrl *UserController) UpdateUserStatus(c *gin.Context) {
	if c.GetInt("role") < 99 {
		sendError(c, http.StatusForbidden, "Admin access is required", nil)
		return
	}
	targetID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}
	currentID, _ := uuid.Parse(c.GetString("id"))
	if currentID == targetID {
		sendError(c, http.StatusForbidden, "Admin cannot deactivate their own account", nil)
		return
	}
	var payload struct {
		Status int `json:"status"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}
	if payload.Status != common.UserStatusEnabled && payload.Status != common.UserStatusDisabled {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}
	db := model.GetDB(c)
	var target model.User
	if err := db.First(&target, "id = ?", targetID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			sendError(c, http.StatusNotFound, "User not found", nil)
			return
		}
		sendInternalError(c, err)
		return
	}
	adminRole := c.GetInt("role")
	if target.Role >= adminRole {
		sendError(c, http.StatusForbidden, "Cannot update status for equal or higher role user", nil)
		return
	}
	if target.Role >= 100 && adminRole < 100 {
		sendError(c, http.StatusForbidden, "Only super admin can deactivate super admin", nil)
		return
	}
	if err := db.Model(&target).Update("status", payload.Status).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	target.Status = payload.Status
	sendSuccess(c, gin.H{
		"id":        target.ID,
		"status":    target.Status,
		"is_active": target.Status != common.UserStatusDisabled,
	}, "User status updated successfully")
}

func (ctrl *UserController) ApproveUser(c *gin.Context) {
	if c.GetInt("role") < 99 {
		sendError(c, http.StatusForbidden, "Admin access is required", nil)
		return
	}
	targetID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}

	db := model.GetDB(c)
	var target model.User
	if err := db.First(&target, "id = ?", targetID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			sendError(c, http.StatusNotFound, "User not found", nil)
			return
		}
		sendInternalError(c, err)
		return
	}

	if target.Status != 4 {
		sendBadRequest(c, "User status is not pending approval", nil)
		return
	}

	var sub model.Subscription
	err = db.Where("parent_id = ? AND status = ?", target.ID, "pending_approval").First(&sub).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		sendInternalError(c, err)
		return
	}

	tx := db.Begin()

	if err := tx.Model(&target).Update("status", 1).Error; err != nil {
		tx.Rollback()
		sendInternalError(c, err)
		return
	}

	var memberships []model.Membership
	if err := tx.Where("parent_id = ?", target.ID).Find(&memberships).Error; err == nil {
		for _, m := range memberships {
			tx.Model(&model.User{}).Where("id = ? AND status = ?", m.StudentID, 4).Update("status", 1)
		}
	}

	var payment model.LMSPayment
	if sub.ID != uuid.Nil {
		now := time.Now()
		var plan model.SubscriptionPlan
		if err := tx.First(&plan, "id = ?", sub.PlanID).Error; err == nil {
			var periodEnd *time.Time
			if plan.DurationDays > 0 {
				end := now.Add(time.Duration(plan.DurationDays) * 24 * time.Hour)
				periodEnd = &end
			}
			tx.Model(&sub).Updates(map[string]interface{}{
				"status":               model.SubscriptionStatusActive,
				"current_period_start": &now,
				"current_period_end":   periodEnd,
			})
		} else {
			tx.Model(&sub).Update("status", model.SubscriptionStatusActive)
		}

		if err := tx.Where("subscription_id = ? AND status = ?", sub.ID, model.LMSPaymentPending).First(&payment).Error; err == nil {
			tx.Model(&payment).Update("status", model.LMSPaymentPaid)
		}
	}

	if err := tx.Commit().Error; err != nil {
		sendInternalError(c, err)
		return
	}

	if payment.ID != uuid.Nil {
		_ = ensureLMSActivationEmail(db, &payment)
	} else {
		dummyPayment := model.LMSPayment{
			ID:       uuid.New(),
			ParentID: target.ID,
			TenantID: target.TenantID,
		}
		_ = ensureLMSActivationEmail(db, &dummyPayment)
	}

	sendSuccess(c, nil, "User approved and activation email sent successfully")
}

func (ctrl *UserController) ResendUserActivation(c *gin.Context) {
	if c.GetInt("role") < 99 {
		sendError(c, http.StatusForbidden, "Admin access is required", nil)
		return
	}
	targetID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}

	db := model.GetDB(c)
	var target model.User
	if err := db.First(&target, "id = ?", targetID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			sendError(c, http.StatusNotFound, "User not found", nil)
			return
		}
		sendInternalError(c, err)
		return
	}
	if target.Status == common.UserStatusEnabled {
		sendBadRequest(c, "User sudah aktif, link aktivasi tidak diperlukan", nil)
		return
	}
	if strings.TrimSpace(target.Email) == "" {
		sendBadRequest(c, "User tidak memiliki email untuk dikirim aktivasi", nil)
		return
	}

	token := common.GenerateVerificationCode(32)
	expiresAt := time.Now().Add(24 * time.Hour)
	activation := model.UserActivation{
		ID:        uuid.New(),
		UserID:    target.ID,
		Token:     token,
		ExpiresAt: expiresAt,
		Used:      false,
		TenantID:  target.TenantID,
	}

	if err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Set("skip_tenant_scope", true).
			Model(&model.UserActivation{}).
			Where("user_id = ? AND used = ?", target.ID, false).
			Update("used", true).Error; err != nil {
			return err
		}
		return tx.Set("skip_tenant_scope", true).Create(&activation).Error
	}); err != nil {
		sendInternalError(c, err)
		return
	}

	if err := queueUserActivationEmail(db, target, token); err != nil {
		sendInternalError(c, err)
		return
	}

	sendSuccess(c, gin.H{
		"user_id":    target.ID,
		"expires_at": expiresAt,
	}, "Email aktivasi berhasil dikirim ulang")
}

func queueUserActivationEmail(db *gorm.DB, target model.User, activationToken string) error {
	var activationTemplate model.EmailTemplate
	if err := db.Session(&gorm.Session{}).Model(&model.EmailTemplate{}).Where("type = ?", model.TypeActivation).First(&activationTemplate).Error; err != nil {
		return err
	}

	siteURL := getTenantURL(db, target.TenantID)
	activationLink := fmt.Sprintf("%s/aktivasi?token=%s", siteURL, activationToken)
	common.SysLog(fmt.Sprintf("RESENT ACTIVATION LINK FOR %s: %s", target.Email, activationLink))

	activationData := common.LMSActivationEmailData{
		Name:           displayUserName(target),
		ActivationLink: activationLink,
	}

	return common.QueueLMSActivationEmail(
		activationTemplate.FromAddress,
		target.Email,
		activationTemplate.Subject,
		activationData,
		activationTemplate.TencentTemplateID,
	)
}

func jsonMetadata(raw datatypes.JSON) map[string]interface{} {
	out := map[string]interface{}{}
	if len(raw) == 0 {
		return out
	}
	_ = json.Unmarshal(raw, &out)
	return out
}

func metadataString(metadata map[string]interface{}, keys ...string) string {
	for _, key := range keys {
		if value, ok := metadata[key]; ok && value != nil {
			return strings.TrimSpace(fmt.Sprint(value))
		}
	}
	return ""
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func displayUserName(user model.User) string {
	return firstNonEmpty(user.DisplayName, strings.TrimSpace(user.FirstName+" "+user.LastName), user.Username, user.Email)
}

func userRoleLabel(role int) string {
	switch role {
	case 10:
		return "Parent"
	case 20:
		return "Student"
	case 30:
		return "Mentor"
	case 99:
		return "Admin"
	case 100:
		return "Super Admin"
	default:
		return "User"
	}
}

func loadUserSubscriptions(db *gorm.DB, user model.User) ([]model.Subscription, map[string]model.SubscriptionPlan, error) {
	var subscriptions []model.Subscription
	query := db.Order("current_period_end IS NULL ASC, current_period_end DESC, created_at DESC")
	if user.Role == 10 {
		query = query.Where("parent_id = ?", user.ID)
	} else {
		query = query.Where("student_id = ?", user.ID)
	}
	if err := query.Find(&subscriptions).Error; err != nil {
		return nil, nil, err
	}
	planIDs := make([]uuid.UUID, 0)
	seen := map[uuid.UUID]bool{}
	for _, subscription := range subscriptions {
		planID, err := uuid.Parse(subscription.ProviderPlanID)
		if err == nil && planID != uuid.Nil && !seen[planID] {
			seen[planID] = true
			planIDs = append(planIDs, planID)
		}
	}
	plansByID := map[string]model.SubscriptionPlan{}
	if len(planIDs) > 0 {
		var plans []model.SubscriptionPlan
		if err := db.Find(&plans, "id IN ?", planIDs).Error; err != nil {
			return nil, nil, err
		}
		for _, plan := range plans {
			plansByID[plan.ID.String()] = plan
		}
	}
	return subscriptions, plansByID, nil
}

func buildUserSubscriptionPayload(now time.Time, subscriptions []model.Subscription, plansByID map[string]model.SubscriptionPlan) gin.H {
	if len(subscriptions) == 0 {
		return gin.H{"is_active": false, "is_expired": true, "status": "none"}
	}
	sub := subscriptions[0]
	isActive := (sub.Status == model.SubscriptionStatusActive || sub.Status == model.SubscriptionStatusTrialing) &&
		(sub.CurrentPeriodEnd == nil || sub.CurrentPeriodEnd.After(now))
	isExpired := !isActive && sub.CurrentPeriodEnd != nil && sub.CurrentPeriodEnd.Before(now)
	var remainingDays *int
	if sub.CurrentPeriodEnd != nil && sub.CurrentPeriodEnd.After(now) {
		value := int(sub.CurrentPeriodEnd.Sub(now).Hours() / 24)
		remainingDays = &value
	}
	planName := ""
	if plan, ok := plansByID[sub.ProviderPlanID]; ok {
		planName = plan.Name
	}
	return gin.H{
		"id":             sub.ID,
		"current_plan":   planName,
		"status":         sub.Status,
		"start_date":     sub.CurrentPeriodStart,
		"expiry_date":    sub.CurrentPeriodEnd,
		"remaining_days": remainingDays,
		"is_active":      isActive,
		"is_expired":     isExpired,
		"last_renewal":   sub.UpdatedAt,
	}
}

func loadUserDetailPayments(db *gorm.DB, user model.User, plansByID map[string]model.SubscriptionPlan) ([]userDetailPayment, error) {
	var payments []model.LMSPayment
	query := db.Order("created_at DESC")
	if user.Role == 10 {
		query = query.Where("parent_id = ?", user.ID)
	} else {
		query = query.Where("student_id = ?", user.ID)
	}
	if err := query.Find(&payments).Error; err != nil {
		return nil, err
	}
	userIDs := make([]uuid.UUID, 0)
	subscriptionIDs := make([]uuid.UUID, 0)
	seenUsers := map[uuid.UUID]bool{}
	for _, payment := range payments {
		if !seenUsers[payment.ParentID] {
			seenUsers[payment.ParentID] = true
			userIDs = append(userIDs, payment.ParentID)
		}
		if !seenUsers[payment.StudentID] {
			seenUsers[payment.StudentID] = true
			userIDs = append(userIDs, payment.StudentID)
		}
		if payment.SubscriptionID != nil {
			subscriptionIDs = append(subscriptionIDs, *payment.SubscriptionID)
		}
	}
	names := loadUserNames(db, userIDs)
	subscriptionsByID := map[uuid.UUID]model.Subscription{}
	if len(subscriptionIDs) > 0 {
		var subscriptions []model.Subscription
		if err := db.Find(&subscriptions, "id IN ?", subscriptionIDs).Error; err != nil {
			return nil, err
		}
		for _, subscription := range subscriptions {
			subscriptionsByID[subscription.ID] = subscription
		}
	}
	out := make([]userDetailPayment, 0, len(payments))
	for _, payment := range payments {
		planName := ""
		if payment.SubscriptionID != nil {
			if subscription, ok := subscriptionsByID[*payment.SubscriptionID]; ok {
				if plan, ok := plansByID[subscription.ProviderPlanID]; ok {
					planName = plan.Name
				}
			}
		}
		out = append(out, userDetailPayment{
			LMSPayment:        payment,
			PlanName:          planName,
			TargetStudentName: names[payment.StudentID],
			PayerName:         names[payment.ParentID],
		})
	}
	return out, nil
}

func loadUserChildren(db *gorm.DB, parentID uuid.UUID) ([]gin.H, error) {
	var memberships []model.Membership
	if err := db.Where("parent_id = ? AND status = ?", parentID, "active").Find(&memberships).Error; err != nil {
		return nil, err
	}
	if len(memberships) == 0 {
		return []gin.H{}, nil
	}
	studentIDs := make([]uuid.UUID, 0, len(memberships))
	for _, membership := range memberships {
		studentIDs = append(studentIDs, membership.StudentID)
	}
	var users []model.User
	if err := db.Find(&users, "id IN ?", studentIDs).Error; err != nil {
		return nil, err
	}
	var subscriptions []model.Subscription
	_ = db.Where("student_id IN ?", studentIDs).Order("current_period_end DESC").Find(&subscriptions).Error
	subByStudent := map[uuid.UUID]model.Subscription{}
	for _, subscription := range subscriptions {
		if _, exists := subByStudent[subscription.StudentID]; !exists {
			subByStudent[subscription.StudentID] = subscription
		}
	}
	var progress []model.StudentProgress
	_ = db.Where("student_id IN ?", studentIDs).Order("updated_at DESC").Find(&progress).Error
	lastByStudent := map[uuid.UUID]time.Time{}
	for _, item := range progress {
		if _, exists := lastByStudent[item.StudentID]; !exists {
			lastByStudent[item.StudentID] = item.UpdatedAt
		}
	}
	out := make([]gin.H, 0, len(users))
	for _, child := range users {
		sub := subByStudent[child.ID]
		out = append(out, gin.H{
			"student_id":          child.ID,
			"full_name":           displayUserName(child),
			"email":               child.Email,
			"phone_number":        child.PhoneNumber,
			"nisn":                "",
			"subscription_status": sub.Status,
			"subscription_expiry": sub.CurrentPeriodEnd,
			"last_activity":       lastByStudent[child.ID],
		})
	}
	return out, nil
}

func loadUserParents(db *gorm.DB, studentID uuid.UUID) ([]gin.H, error) {
	var memberships []model.Membership
	if err := db.Where("student_id = ? AND status = ?", studentID, "active").Find(&memberships).Error; err != nil {
		return nil, err
	}
	if len(memberships) == 0 {
		return []gin.H{}, nil
	}
	parentIDs := make([]uuid.UUID, 0, len(memberships))
	for _, membership := range memberships {
		parentIDs = append(parentIDs, membership.ParentID)
	}
	var users []model.User
	if err := db.Find(&users, "id IN ?", parentIDs).Error; err != nil {
		return nil, err
	}
	out := make([]gin.H, 0, len(users))
	for _, parent := range users {
		out = append(out, gin.H{
			"parent_id":         parent.ID,
			"parent_name":       displayUserName(parent),
			"parent_email":      parent.Email,
			"parent_whatsapp":   parent.PhoneNumber,
			"relationship_type": "parent",
		})
	}
	return out, nil
}

func loadUserNames(db *gorm.DB, ids []uuid.UUID) map[uuid.UUID]string {
	if len(ids) == 0 {
		return map[uuid.UUID]string{}
	}
	var users []model.User
	_ = db.Find(&users, "id IN ?", ids).Error
	out := map[uuid.UUID]string{}
	for _, user := range users {
		out[user.ID] = displayUserName(user)
	}
	return out
}

// GetSelf retrieves current user's information
func (ctrl *UserController) GetSelf(c *gin.Context) {
	// NOTE: Middleware JWT harus sudah melakukan set "id" (berupa string UUID) ke context
	idStr := c.GetString("id") // Mendapatkan ID sebagai string UUID
	if idStr == "" {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}

	id, err := uuid.Parse(idStr)
	if err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}

	user, err := model.GetUserById(id, false)
	if err != nil {
		sendBadRequest(c, err.Error(), nil)
		return
	}

	sendSuccess(c, user, "User retrieved successfully")
}

type adminUserMutationInput struct {
	Username       string  `json:"username" validate:"required,min=3"`
	DisplayName    string  `json:"display_name" validate:"required"`
	Email          string  `json:"email" validate:"required,email"`
	Password       string  `json:"password" validate:"omitempty,min=6"`
	Role           int     `json:"role" validate:"required"`
	Status         *int    `json:"status" validate:"required"`
	MentorType     string  `json:"mentor_type"`
	OrganizationID *string `json:"organization_id"`
	City           string  `json:"city"`
	Institution    string  `json:"institution"`
	TeachingStatus string  `json:"teaching_status"`
	Simpkb         string  `json:"simpkb"`
	Nuptk          string  `json:"nuptk"`
	Gtk            string  `json:"gtk"`
	Declaration    *bool   `json:"declaration"`
}

func saveExternalTeacherProfile(db *gorm.DB, user *model.User, input adminUserMutationInput) error {
	if user.Role != model.RoleGuruExternal {
		return nil
	}

	var profile model.Profile
	err := db.Where("user_id = ?", user.ID).First(&profile).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		profile = model.Profile{
			ID:          uuid.New(),
			UserID:      user.ID,
			FullName:    user.DisplayName,
			DisplayName: user.DisplayName,
			TenantID:    user.TenantID,
		}
	}

	profile.FullName = firstNonEmpty(user.DisplayName, profile.FullName, user.Username)
	profile.DisplayName = user.DisplayName
	metadata := jsonMetadata(profile.Metadata)
	verification := map[string]interface{}{}
	if existing, ok := metadata["teacher_verification"].(map[string]interface{}); ok {
		verification = existing
	}
	verification["status"] = firstNonEmpty(metadataString(verification, "status"), "submitted")
	verification["checkout_type"] = "teacher"
	verification["teacher_name"] = user.DisplayName
	verification["teacher_email"] = user.Email
	verification["city"] = strings.TrimSpace(input.City)
	verification["institution"] = strings.TrimSpace(input.Institution)
	verification["teaching_status"] = strings.TrimSpace(input.TeachingStatus)
	verification["simpkb"] = strings.TrimSpace(input.Simpkb)
	verification["nuptk"] = strings.TrimSpace(input.Nuptk)
	verification["gtk"] = strings.TrimSpace(input.Gtk)
	if input.Declaration != nil {
		verification["declaration"] = *input.Declaration
	}
	verification["updated_at"] = time.Now().UTC().Format(time.RFC3339)

	metadata["teacher_verification"] = verification
	metadata["checkout_type"] = "teacher"
	metadata["city"] = strings.TrimSpace(input.City)
	metadata["institution"] = strings.TrimSpace(input.Institution)
	metadata["teaching_status"] = strings.TrimSpace(input.TeachingStatus)
	metadata["simpkb"] = strings.TrimSpace(input.Simpkb)
	metadata["nuptk"] = strings.TrimSpace(input.Nuptk)
	metadata["gtk"] = strings.TrimSpace(input.Gtk)
	if input.Declaration != nil {
		metadata["declaration"] = *input.Declaration
	}

	raw, err := json.Marshal(metadata)
	if err != nil {
		return err
	}
	profile.Metadata = datatypes.JSON(raw)
	return db.Save(&profile).Error
}

// UpdateUser updates another user's information (admin only)
func (ctrl *UserController) UpdateUser(c *gin.Context) {
	if c.GetInt("role") < 99 {
		sendError(c, http.StatusForbidden, "Admin access is required", nil)
		return
	}
	idStr := c.Param("id")
	targetID, err := uuid.Parse(idStr)
	if err != nil {
		sendBadRequest(c, "Invalid UUID format", nil)
		return
	}

	var input adminUserMutationInput

	if err := c.ShouldBindJSON(&input); err != nil {
		sendBadRequest(c, "Invalid JSON format", nil)
		return
	}

	// Jalankan validator manual pada DTO
	if err := common.Validate.Struct(input); err != nil {
		sendBadRequest(c, fmt.Sprintf("Validation failed: %v", err), nil)
		return
	}

	db := model.GetDB(c)

	// Check duplicate username within the same tenant/globally
	var existUsername int64
	if err := db.Model(&model.User{}).
		Where("LOWER(username) = ? AND id != ?", strings.ToLower(input.Username), targetID).
		Count(&existUsername).Error; err == nil && existUsername > 0 {
		sendBadRequest(c, "Username is already taken", nil)
		return
	}

	// Check duplicate email
	var existEmail int64
	if err := db.Model(&model.User{}).
		Where("LOWER(email) = ? AND id != ?", strings.ToLower(input.Email), targetID).
		Count(&existEmail).Error; err == nil && existEmail > 0 {
		sendBadRequest(c, "Email is already taken", nil)
		return
	}

	originUser, err := model.GetUserById(targetID, false)
	if err != nil {
		sendBadRequest(c, "User not found", nil)
		return
	}

	// Security Check: Role Hierarchy
	myRole := c.GetInt("role")
	if myRole <= originUser.Role {
		sendBadRequest(c, "You cannot modify a user with a higher/equal role", nil)
		return
	}
	if myRole <= input.Role {
		sendBadRequest(c, "You cannot promote a user to a higher/equal role than yours", nil)
		return
	}

	// Update fields
	originUser.Username = input.Username
	originUser.DisplayName = input.DisplayName
	originUser.Email = input.Email
	originUser.Role = input.Role
	originUser.City = strings.TrimSpace(input.City)
	if input.Status != nil {
		originUser.Status = *input.Status
	}
	if input.MentorType != "" {
		originUser.MentorType = input.MentorType
	}
	if input.OrganizationID != nil {
		if *input.OrganizationID == "" {
			originUser.OrganizationID = nil
		} else {
			orgID, parseErr := uuid.Parse(*input.OrganizationID)
			if parseErr == nil {
				originUser.OrganizationID = &orgID
			}
		}
	}

	updatePassword := input.Password != ""
	if updatePassword {
		originUser.Password = input.Password
	}

	if err := originUser.Update(c, updatePassword); err != nil {
		sendInternalError(c, err)
		return
	}
	if err := saveExternalTeacherProfile(db, originUser, input); err != nil {
		sendInternalError(c, err)
		return
	}

	sendSuccessNoData(c)
}

// UpdateSelf updates current user's own information
func (ctrl *UserController) UpdateSelf(c *gin.Context) {
	var user model.User
	if err := c.ShouldBindJSON(&user); err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}

	user.Username = strings.TrimSpace(user.Username)
	user.DisplayName = strings.TrimSpace(user.DisplayName)

	updatePassword := user.Password != ""
	if !updatePassword {
		user.Password = "$I_LOVE_U"
	}

	if err := common.Validate.Struct(&user); err != nil {
		sendBadRequest(c, fmt.Sprintf("Invalid input: %v", err), nil)
		return
	}

	// Ambil ID dari context (string UUID), lalu konversi ke UUID
	idStr := c.GetString("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}

	// Perbaikan: cleanUser.ID harus bertipe uuid.UUID
	cleanUser := model.User{
		ID:          id,
		Username:    user.Username,
		DisplayName: user.DisplayName,
	}

	if updatePassword {
		cleanUser.Password = user.Password
	}

	if err := cleanUser.Update(c, updatePassword); err != nil {
		sendBadRequest(c, err.Error(), nil)
		return
	}

	sendSuccessNoData(c)
}

// DeleteUser deletes a user by ID (admin only)
func (ctrl *UserController) DeleteUser(c *gin.Context) {
	if c.GetInt("role") < 99 {
		sendError(c, http.StatusForbidden, "Admin access is required", nil)
		return
	}
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr) // Mengubah string param ke UUID
	if err != nil || id == uuid.Nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}

	// Perbaikan: GetUserById menggunakan UUID
	originUser, err := model.GetUserById(id, false)
	if err != nil {
		sendBadRequest(c, err.Error(), nil)
		return
	}

	myRole := c.GetInt("role")
	if myRole <= originUser.Role {
		sendBadRequest(c, ErrCannotModifyHigherRole, nil)
		return
	}

	// Perbaikan: DeleteUserById menggunakan UUID
	if err := model.DeleteUserById(c, id); err != nil {
		sendBadRequest(c, err.Error(), nil)
		return
	}

	sendSuccessNoData(c)
}

// DeleteSelf allows user to delete their own account
func (ctrl *UserController) DeleteSelf(c *gin.Context) {
	// Ambil ID dari context (string UUID), lalu konversi ke UUID
	idStr := c.GetString("id")
	id, err := uuid.Parse(idStr)
	if err != nil || id == uuid.Nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}

	// Perbaikan: DeleteUserById menggunakan UUID
	if err := model.DeleteUserById(c, id); err != nil {
		sendBadRequest(c, err.Error(), nil)
		return
	}

	// JWT Logout: Client-side action
	sendSuccessNoData(c)
}

// CreateUser creates a new user (admin only)
func (ctrl *UserController) CreateUser(c *gin.Context) {
	if c.GetInt("role") < 99 {
		sendError(c, http.StatusForbidden, "Admin access is required", nil)
		return
	}
	var input adminUserMutationInput
	if err := c.ShouldBindJSON(&input); err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}

	input.Email = strings.TrimSpace(input.Email)
	input.Username = strings.TrimSpace(input.Username)
	input.Password = strings.TrimSpace(input.Password)

	if input.Email == "" || input.Username == "" || input.Password == "" {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}

	if input.DisplayName == "" {
		input.DisplayName = input.Email
	}

	myRole := c.GetInt("role")
	if input.Role > myRole || (input.Role == myRole && myRole != common.RoleSuperAdminUser) {
		sendBadRequest(c, ErrCannotCreateHigherRole, nil)
		return
	}

	tenantVal, _ := c.Get(common.CtxTenantKey)
	tenant := tenantVal.(model.Tenant)

	cleanUser := model.User{
		Email:       input.Email,
		Username:    input.Username,
		Password:    input.Password,
		DisplayName: input.DisplayName,
		Role:        input.Role,
		MentorType:  input.MentorType,
		City:        strings.TrimSpace(input.City),
		TenantID:    &tenant.ID,
	}
	if input.Status != nil {
		cleanUser.Status = *input.Status
	} else {
		cleanUser.Status = common.UserStatusEnabled
	}

	if err := cleanUser.Insert(c); err != nil {
		sendBadRequest(c, err.Error(), nil)
		return
	}
	if err := saveExternalTeacherProfile(model.GetDB(c), &cleanUser, input); err != nil {
		sendInternalError(c, err)
		return
	}

	sendSuccessNoData(c)
}

// ManageUser handles user management actions (admin only)
func (ctrl *UserController) ManageUser(c *gin.Context) {
	if c.GetInt("role") < 99 {
		sendError(c, http.StatusForbidden, "Admin access is required", nil)
		return
	}
	var req ManageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}

	// Perbaikan: Menggunakan req.UserID yang baru didefinisikan
	userIDStr := strings.TrimSpace(req.UserID)
	req.Action = strings.ToLower(strings.TrimSpace(req.Action))

	if userIDStr == "" || req.Action == "" {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}

	// Perbaikan: Mengubah ID string ke UUID
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}

	// Ambil user berdasarkan ID
	user, err := model.GetUserById(userID, false)
	if err != nil {
		sendBadRequest(c, ErrUserNotFound, nil)
		return
	}

	myRole := c.GetInt("role")
	if myRole <= user.Role && myRole != common.RoleRootUser {
		sendBadRequest(c, ErrCannotModifyHigherRole, nil)
		return
	}

	switch req.Action {
	case "disable":
		if err := handleDisableUser(user); err != nil {
			sendBadRequest(c, err.Error(), nil)
			return
		}
	case "enable":
		user.Status = common.UserStatusEnabled
	case "delete":
		if err := handleDeleteUser(user); err != nil {
			sendBadRequest(c, err.Error(), nil)
			return
		}
		sendSuccessNoData(c)
		return
	case "promote":
		if err := handlePromoteUser(user, myRole); err != nil {
			sendBadRequest(c, err.Error(), nil)
			return
		}
	case "demote":
		if err := handleDemoteUser(user); err != nil {
			sendBadRequest(c, err.Error(), nil)
			return
		}
	default:
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}

	if err := user.Update(c, false); err != nil {
		sendBadRequest(c, err.Error(), nil)
		return
	}

	// Tidak perlu clearUser, kembalikan data yang relevan dari user
	sendSuccess(c, gin.H{
		"role":   user.Role,
		"status": user.Status,
	}, "User updated successfully")
}

// Action handlers (tidak ada perubahan besar, hanya tipe parameter yang harusnya *model.User)
func handleDisableUser(user *model.User) error {
	if user.Role == common.RoleRootUser {
		return errors.New(ErrCannotDisableRootUser)
	}
	user.Status = common.UserStatusDisabled
	return nil
}

func handleDeleteUser(user *model.User) error {
	if user.Role == common.RoleRootUser {
		return errors.New(ErrCannotDeleteRootUser)
	}
	return user.Delete()
}

func handlePromoteUser(user *model.User, myRole int) error {
	if myRole != common.RoleRootUser {
		return errors.New(ErrOnlyRootCanPromote)
	}
	if user.Role >= common.RoleAdminUser {
		return errors.New(ErrUserAlreadyAdmin)
	}
	user.Role = common.RoleAdminUser
	return nil
}

func handleDemoteUser(user *model.User) error {
	if user.Role == common.RoleRootUser {
		return errors.New(ErrCannotDemoteRootUser)
	}
	if user.Role == common.RoleCommonUser {
		return errors.New(ErrUserAlreadyCommon)
	}
	user.Role = common.RoleCommonUser
	return nil
}

// EmailBind binds an email to the user's account
func EmailBind(c *gin.Context) {
	email := strings.TrimSpace(strings.ToLower(c.Query("email")))
	code := strings.TrimSpace(c.Query("code"))

	if email == "" || code == "" {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}

	if !common.VerifyCodeWithKey(email, code, common.EmailVerificationPurpose) {
		sendBadRequest(c, ErrInvalidVerificationCode, nil)
		return
	}

	// Ambil ID dari context (string UUID), lalu konversi ke UUID
	idStr := c.GetString("id")
	id, err := uuid.Parse(idStr)
	if err != nil || id == uuid.Nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}

	// Perbaikan: struct literal model.User{ID: id} menggunakan UUID
	user := &model.User{ID: id}
	// Asumsi FillUserById menerima struct dengan ID terisi dan mengisikan data sisanya
	if err := user.FillUserById(); err != nil {
		sendBadRequest(c, err.Error(), nil)
		return
	}

	user.Email = email
	if err := user.Update(c, false); err != nil {
		sendBadRequest(c, err.Error(), nil)
		return
	}

	sendSuccessNoData(c)
}

// GetMyNotifications gets all notifications for the logged-in user
func (ctrl *UserController) GetMyNotifications(c *gin.Context) {
	userIDStr := c.GetString("id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		sendBadRequest(c, "Invalid user ID", nil)
		return
	}

	db := lmsDB(c, ctrl.DB).WithContext(c)

	var notifications []model.Notification
	if err := db.Where("user_id = ?", userID).
		Order("created_at DESC").
		Find(&notifications).Error; err != nil {
		sendInternalError(c, err)
		return
	}

	sendSuccess(c, notifications, "Notifications retrieved successfully")
}

// MarkNotificationRead marks a specific notification as read
func (ctrl *UserController) MarkNotificationRead(c *gin.Context) {
	userIDStr := c.GetString("id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		sendBadRequest(c, "Invalid user ID", nil)
		return
	}

	notifIDStr := c.Param("id")
	notifID, err := uuid.Parse(notifIDStr)
	if err != nil {
		sendBadRequest(c, "Invalid notification ID", nil)
		return
	}

	db := lmsDB(c, ctrl.DB).WithContext(c)

	var notif model.Notification
	if err := db.Where("id = ? AND user_id = ?", notifID, userID).First(&notif).Error; err != nil {
		sendBadRequest(c, "Notification not found", nil)
		return
	}

	notif.IsRead = true
	if err := db.Save(&notif).Error; err != nil {
		sendInternalError(c, err)
		return
	}

	sendSuccessNoData(c)
}

// MarkAllNotificationsRead marks all notifications as read for the user
func (ctrl *UserController) MarkAllNotificationsRead(c *gin.Context) {
	userIDStr := c.GetString("id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		sendBadRequest(c, "Invalid user ID", nil)
		return
	}

	db := lmsDB(c, ctrl.DB).WithContext(c)

	if err := db.Model(&model.Notification{}).
		Where("user_id = ? AND is_read = ?", userID, false).
		Update("is_read", true).Error; err != nil {
		sendInternalError(c, err)
		return
	}

	sendSuccessNoData(c)
}

// DeleteNotification deletes a specific notification
func (ctrl *UserController) DeleteNotification(c *gin.Context) {
	userIDStr := c.GetString("id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		sendBadRequest(c, "Invalid user ID", nil)
		return
	}

	notifIDStr := c.Param("id")
	notifID, err := uuid.Parse(notifIDStr)
	if err != nil {
		sendBadRequest(c, "Invalid notification ID", nil)
		return
	}

	db := lmsDB(c, ctrl.DB).WithContext(c)

	if err := db.Where("id = ? AND user_id = ?", notifID, userID).
		Delete(&model.Notification{}).Error; err != nil {
		sendInternalError(c, err)
		return
	}

	sendSuccessNoData(c)
}
