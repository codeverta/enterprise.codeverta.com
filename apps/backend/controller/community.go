package controller

import (
	"crypto/sha256"
	"encoding/hex"
	"gin-template/model"
	"math"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

const (
	communityTitleMaxLength   = 220
	communityContentMaxLength = 50000
)

type communityValidationError struct {
	Message     string            `json:"message"`
	FieldErrors map[string]string `json:"field_errors"`
}

var communityAllowedSorts = map[string]string{
	"latest":    "created_at DESC",
	"oldest":    "created_at ASC",
	"popular":   "reaction_count DESC, view_count DESC, created_at DESC",
	"discussed": "comment_count DESC, created_at DESC",
	"views":     "view_count DESC, created_at DESC",
	"pinned":    "is_pinned DESC, created_at DESC",
	"title":     "title ASC, created_at DESC",
	"updated":   "updated_at DESC",
}

var communitySafeHTMLPattern = regexp.MustCompile(`(?is)<\s*/?\s*(script|iframe|object|embed|style|link|meta)[^>]*>|on[a-z]+\s*=|javascript:`)

type communityPostRequest struct {
	Title      string   `json:"title"`
	Content    string   `json:"content"`
	Type       string   `json:"type"`
	Status     string   `json:"status"`
	Visibility string   `json:"visibility"`
	CategoryID *string  `json:"category_id"`
	CourseID   *string  `json:"course_id"`
	ClassID    *string  `json:"class_id"`
	TagSlugs   []string `json:"tag_slugs"`
}

func communityPageLimit(c *gin.Context) (int, int) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if limit < 1 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	return page, limit
}

func normalizeCommunityPostType(value string) model.CommunityPostType {
	switch model.CommunityPostType(strings.TrimSpace(value)) {
	case model.CommunityPostTypeQuestion,
		model.CommunityPostTypeMaterial,
		model.CommunityPostTypeAnnouncement,
		model.CommunityPostTypeStudyTips,
		model.CommunityPostTypePoll,
		model.CommunityPostTypeShowcase:
		return model.CommunityPostType(strings.TrimSpace(value))
	default:
		return model.CommunityPostTypeDiscussion
	}
}

func normalizeCommunityStatus(value string) model.CommunityPostStatus {
	switch model.CommunityPostStatus(strings.TrimSpace(value)) {
	case model.CommunityPostStatusDraft:
		return model.CommunityPostStatusDraft
	case model.CommunityPostStatusHidden, model.CommunityPostStatusArchived, model.CommunityPostStatusSolved:
		return model.CommunityPostStatusPublished
	default:
		return model.CommunityPostStatusPublished
	}
}

func normalizeCommunityVisibility(value string) model.CommunityVisibility {
	switch model.CommunityVisibility(strings.TrimSpace(value)) {
	case model.CommunityVisibilityPublic,
		model.CommunityVisibilityCourse,
		model.CommunityVisibilityClass,
		model.CommunityVisibilityTeachersOnly,
		model.CommunityVisibilityAdminsOnly,
		model.CommunityVisibilityPrivate:
		return model.CommunityVisibility(strings.TrimSpace(value))
	default:
		return model.CommunityVisibilityTenant
	}
}

func sanitizeCommunityContent(value string) string {
	return strings.TrimSpace(communitySafeHTMLPattern.ReplaceAllString(value, ""))
}

func communityRoleAllowedToCreate(role int) bool {
	return role == 10 || role == 20 || role == 30 || role == 40 || role >= 99
}

func communityRoleCanModerate(role int) bool {
	return role == 30 || role == 40 || role >= 99
}

func communityRoleCanSeeTeachersOnly(role int) bool {
	return role == 30 || role == 40 || role >= 99
}

func communityRoleCanSeeAdminsOnly(role int) bool {
	return role >= 99
}

func communityCanMutatePost(post model.CommunityPost, userID uuid.UUID, role int) bool {
	return role >= 99 || post.AuthorID == userID
}

func (ctrl *LMSController) communityHasCourseAccess(c *gin.Context, db *gorm.DB, userID uuid.UUID, role int, courseID uuid.UUID) bool {
	if role >= 99 || ctrl.hasCourseAccess(c, courseID) {
		return true
	}
	if role == 30 || role == 40 {
		var count int64
		if err := db.Table("course_mentors").Where("course_id = ? AND mentor_id = ?", courseID, userID).Count(&count).Error; err == nil && count > 0 {
			return true
		}
	}
	return false
}

func communityUUIDPointer(value *string) (*uuid.UUID, error) {
	if value == nil || strings.TrimSpace(*value) == "" {
		return nil, nil
	}
	parsed, err := uuid.Parse(strings.TrimSpace(*value))
	if err != nil {
		return nil, err
	}
	return &parsed, nil
}

func communityPostAuthorPayload(post model.CommunityPost) gin.H {
	name := strings.TrimSpace(post.Author.DisplayName)
	if name == "" {
		name = strings.TrimSpace(post.Author.FirstName + " " + post.Author.LastName)
	}
	if name == "" {
		name = post.Author.Username
	}
	if name == "" {
		name = post.Author.Email
	}
	avatar := ""
	if post.Author.Profile != nil {
		avatar = post.Author.Profile.AvatarURL
	}
	return gin.H{
		"id":           post.Author.ID,
		"username":     post.Author.Username,
		"display_name": name,
		"email":        post.Author.Email,
		"role":         post.Author.Role,
		"avatar_url":   avatar,
	}
}

func communityPostPayload(post model.CommunityPost, includeContent bool) gin.H {
	content := post.Content
	if content == "" {
		content = post.Body
	}
	out := gin.H{
		"id":                  post.ID,
		"author_id":           post.AuthorID,
		"author":              communityPostAuthorPayload(post),
		"organization_id":     post.OrganizationID,
		"course_id":           post.CourseID,
		"class_id":            post.ClassID,
		"category_id":         post.CategoryID,
		"type":                post.Type,
		"title":               post.Title,
		"status":              post.Status,
		"visibility":          post.Visibility,
		"is_published":        post.IsPublished,
		"is_pinned":           post.IsPinned,
		"is_locked":           post.IsLocked,
		"is_edited":           post.IsEdited,
		"accepted_comment_id": post.AcceptedCommentID,
		"view_count":          post.ViewCount,
		"reaction_count":      post.ReactionCount,
		"comment_count":       post.CommentCount,
		"bookmark_count":      post.BookmarkCount,
		"follow_count":        post.FollowCount,
		"published_at":        post.PublishedAt,
		"created_at":          post.CreatedAt,
		"updated_at":          post.UpdatedAt,
	}
	if includeContent {
		out["content"] = content
	} else {
		plain := strings.Join(strings.Fields(content), " ")
		if len(plain) > 260 {
			plain = plain[:260] + "..."
		}
		out["excerpt"] = plain
	}
	if post.Category != nil {
		out["category"] = post.Category
	}
	if post.Course != nil {
		out["course"] = gin.H{"id": post.Course.ID, "title": post.Course.Title, "slug": post.Course.Slug}
	}
	if post.Class != nil {
		out["class"] = gin.H{"id": post.Class.ID, "name": post.Class.Name, "course_id": post.Class.CourseID}
	}
	return out
}

func communityPostPayloadForViewer(db *gorm.DB, post model.CommunityPost, includeContent bool, viewerID uuid.UUID) gin.H {
	out := communityPostPayload(post, includeContent)
	if viewerID == uuid.Nil {
		out["user_reaction"] = nil
		out["is_bookmarked"] = false
		out["is_following"] = false
		return out
	}
	var reaction model.CommunityReaction
	if err := db.Select("reaction_type").Where("user_id = ? AND target_type = ? AND target_id = ?", viewerID, "post", post.ID).First(&reaction).Error; err == nil {
		out["user_reaction"] = reaction.ReactionType
	} else {
		out["user_reaction"] = nil
	}
	var bookmarkCount int64
	db.Model(&model.CommunityBookmark{}).Where("user_id = ? AND post_id = ?", viewerID, post.ID).Count(&bookmarkCount)
	out["is_bookmarked"] = bookmarkCount > 0
	var followCount int64
	db.Model(&model.CommunityPostFollower{}).Where("user_id = ? AND post_id = ?", viewerID, post.ID).Count(&followCount)
	out["is_following"] = followCount > 0
	return out
}

func (ctrl *LMSController) validateCommunityScope(c *gin.Context, db *gorm.DB, role int, courseID, classID, categoryID *uuid.UUID, visibility model.CommunityVisibility) bool {
	if categoryID != nil {
		var category model.CommunityCategory
		if err := db.First(&category, "id = ? AND is_visible = ?", *categoryID, true).Error; err != nil {
			sendError(c, http.StatusBadRequest, "Kategori komunitas tidak valid", nil)
			return false
		}
		if category.CourseID != nil {
			if courseID == nil || *courseID != *category.CourseID {
				sendError(c, http.StatusBadRequest, "Kategori ini hanya dapat digunakan untuk course terkait", nil)
				return false
			}
		}
		if category.ClassID != nil {
			if classID == nil || *classID != *category.ClassID {
				sendError(c, http.StatusBadRequest, "Kategori ini hanya dapat digunakan untuk kelas terkait", nil)
				return false
			}
		}
		if category.AllowedRoles != "" && !communityRoleListed(category.AllowedRoles, role) {
			sendError(c, http.StatusForbidden, "Role Anda tidak dapat membuat posting pada kategori ini", nil)
			return false
		}
	}
	if courseID != nil {
		var course model.Course
		if err := db.Select("id").First(&course, "id = ?", *courseID).Error; err != nil {
			sendError(c, http.StatusBadRequest, "Course tidak valid", nil)
			return false
		}
		userID, _, _ := currentLMSUser(c)
		if !ctrl.communityHasCourseAccess(c, db, userID, role, *courseID) {
			sendError(c, http.StatusForbidden, "Anda tidak memiliki akses ke course ini", nil)
			return false
		}
	}
	if classID != nil {
		var class model.Class
		if err := db.Select("id", "course_id", "mentor_id").First(&class, "id = ?", *classID).Error; err != nil {
			sendError(c, http.StatusBadRequest, "Kelas tidak valid", nil)
			return false
		}
		if courseID != nil && class.CourseID != *courseID {
			sendError(c, http.StatusBadRequest, "Kelas tidak sesuai dengan course", nil)
			return false
		}
		userID, _, _ := currentLMSUser(c)
		if role < 99 && role != 30 && role != 40 {
			var count int64
			if err := db.Model(&model.ClassStudent{}).Where("class_id = ? AND student_id = ?", *classID, userID).Count(&count).Error; err != nil || count == 0 {
				sendError(c, http.StatusForbidden, "Anda tidak memiliki akses ke kelas ini", nil)
				return false
			}
		}
		if (role == 30 || role == 40) && class.MentorID != userID && !ctrl.hasCourseAccess(c, class.CourseID) {
			sendError(c, http.StatusForbidden, "Anda tidak memiliki akses ke kelas ini", nil)
			return false
		}
	}
	if visibility == model.CommunityVisibilityCourse && courseID == nil {
		sendBadRequest(c, "course_id wajib untuk visibility course", nil)
		return false
	}
	if visibility == model.CommunityVisibilityClass && classID == nil {
		sendBadRequest(c, "class_id wajib untuk visibility class", nil)
		return false
	}
	if visibility == model.CommunityVisibilityTeachersOnly && !communityRoleCanSeeTeachersOnly(role) {
		sendError(c, http.StatusForbidden, "Visibility ini hanya untuk guru, mentor, dan admin", nil)
		return false
	}
	if visibility == model.CommunityVisibilityAdminsOnly && !communityRoleCanSeeAdminsOnly(role) {
		sendError(c, http.StatusForbidden, "Visibility ini hanya untuk admin", nil)
		return false
	}
	return true
}

func communityRoleListed(allowedRoles string, role int) bool {
	for _, part := range strings.Split(allowedRoles, ",") {
		if strings.TrimSpace(part) == strconv.Itoa(role) {
			return true
		}
	}
	return false
}

func (ctrl *LMSController) communityReadableQuery(c *gin.Context, db *gorm.DB, userID uuid.UUID, role int) *gorm.DB {
	query := db.Model(&model.CommunityPost{}).Where("status <> ?", model.CommunityPostStatusArchived)
	if role >= 99 {
		return query
	}
	tenantWideVisibility := []model.CommunityVisibility{
		model.CommunityVisibilityPublic,
		model.CommunityVisibilityTenant,
	}
	if communityRoleCanSeeTeachersOnly(role) {
		tenantWideVisibility = append(tenantWideVisibility, model.CommunityVisibilityTeachersOnly)
	}
	if communityRoleCanSeeAdminsOnly(role) {
		tenantWideVisibility = append(tenantWideVisibility, model.CommunityVisibilityAdminsOnly)
	}
	query = query.Where(`(
		author_id = ?
		OR (status IN ? AND visibility IN ?)
		OR (status IN ? AND visibility = ? AND course_id IS NOT NULL AND course_id IN (
			SELECT course_id FROM student_progresses WHERE student_id = ?
			UNION SELECT course_id FROM lms_payments WHERE student_id = ? AND status = ?
			UNION SELECT course_id FROM course_purchases WHERE student_id = ? AND status = ?
			UNION SELECT course_id FROM course_mentors WHERE mentor_id = ?
		))
		OR (status IN ? AND visibility = ? AND class_id IS NOT NULL AND class_id IN (
			SELECT class_id FROM class_students WHERE student_id = ?
			UNION SELECT id FROM classes WHERE mentor_id = ?
		))
	)`,
		userID,
		[]model.CommunityPostStatus{model.CommunityPostStatusPublished, model.CommunityPostStatusSolved},
		tenantWideVisibility,
		[]model.CommunityPostStatus{model.CommunityPostStatusPublished, model.CommunityPostStatusSolved},
		model.CommunityVisibilityCourse, userID, userID, model.LMSPaymentPaid, userID, model.PurchasePaid, userID,
		[]model.CommunityPostStatus{model.CommunityPostStatusPublished, model.CommunityPostStatusSolved},
		model.CommunityVisibilityClass, userID, userID,
	)
	return query
}

func (ctrl *LMSController) ListCommunityCategories(c *gin.Context) {
	db := lmsDB(c, ctrl.DB)
	query := db.Model(&model.CommunityCategory{}).Where("is_visible = ?", true)
	if courseID := strings.TrimSpace(c.Query("course_id")); courseID != "" {
		query = query.Where("course_id IS NULL OR course_id = ?", courseID)
	}
	if classID := strings.TrimSpace(c.Query("class_id")); classID != "" {
		query = query.Where("class_id IS NULL OR class_id = ?", classID)
	}
	var categories []model.CommunityCategory
	if err := query.Order("sort_order ASC, name ASC").Find(&categories).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccess(c, categories, "Community categories retrieved successfully")
}

func (ctrl *LMSController) ListCommunityPosts(c *gin.Context) {
	userID, role, ok := currentLMSUser(c)
	if !ok {
		return
	}
	db := lmsDB(c, ctrl.DB)
	page, limit := communityPageLimit(c)
	query := ctrl.communityReadableQuery(c, db, userID, role)

	if search := strings.TrimSpace(c.Query("search")); search != "" {
		like := "%" + search + "%"
		query = query.Where("(title LIKE ? OR content LIKE ? OR body LIKE ?)", like, like, like)
	}
	if categoryID := strings.TrimSpace(c.Query("category_id")); categoryID != "" && categoryID != "all" {
		query = query.Where("category_id = ?", categoryID)
	}
	if postType := strings.TrimSpace(c.Query("type")); postType != "" && postType != "all" {
		query = query.Where("type = ?", postType)
	}
	if status := strings.TrimSpace(c.Query("status")); status != "" && status != "all" {
		if status == "unanswered" {
			query = query.Where("type = ? AND status = ?", model.CommunityPostTypeQuestion, model.CommunityPostStatusPublished)
		} else if status == "answered" || status == "solved" {
			query = query.Where("type = ? AND status = ?", model.CommunityPostTypeQuestion, model.CommunityPostStatusSolved)
		} else if role >= 99 || status == string(model.CommunityPostStatusPublished) {
			query = query.Where("status = ?", status)
		}
	}
	if courseID := strings.TrimSpace(c.Query("course_id")); courseID != "" && courseID != "all" {
		query = query.Where("course_id = ?", courseID)
	}
	if classID := strings.TrimSpace(c.Query("class_id")); classID != "" && classID != "all" {
		query = query.Where("class_id = ?", classID)
	}
	if authorID := strings.TrimSpace(c.Query("author_id")); authorID != "" && authorID != "all" {
		query = query.Where("author_id = ?", authorID)
	}
	if dateFrom := strings.TrimSpace(c.Query("date_from")); dateFrom != "" {
		if parsed, err := time.Parse("2006-01-02", dateFrom); err == nil {
			query = query.Where("created_at >= ?", parsed)
		}
	}
	if dateTo := strings.TrimSpace(c.Query("date_to")); dateTo != "" {
		if parsed, err := time.Parse("2006-01-02", dateTo); err == nil {
			query = query.Where("created_at <= ?", parsed.Add(24*time.Hour-time.Nanosecond))
		}
	}
	if tag := strings.TrimSpace(c.Query("tag")); tag != "" && tag != "all" {
		query = query.Joins("JOIN community_post_tags cpt ON cpt.post_id = community_posts.id").
			Joins("JOIN community_tags ct ON ct.id = cpt.tag_id").
			Where("ct.slug = ? AND ct.deleted_at IS NULL", strings.ToLower(tag))
	}
	if c.Query("followed") == "true" {
		query = query.Joins("JOIN community_post_followers cpf ON cpf.post_id = community_posts.id AND cpf.user_id = ?", userID)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		sendInternalError(c, err)
		return
	}

	sortKey := strings.TrimSpace(c.DefaultQuery("sort", "latest"))
	orderExpr, ok := communityAllowedSorts[sortKey]
	if !ok {
		orderExpr = communityAllowedSorts["latest"]
	}
	if strings.ToLower(c.Query("order")) == "asc" && sortKey != "title" {
		orderExpr = strings.ReplaceAll(orderExpr, "DESC", "ASC")
	}

	var posts []model.CommunityPost
	if err := query.
		Preload("Author.Profile").
		Preload("Category").
		Preload("Course").
		Preload("Class").
		Order("is_pinned DESC").
		Order(orderExpr).
		Limit(limit).
		Offset((page - 1) * limit).
		Find(&posts).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	items := make([]gin.H, 0, len(posts))
	for _, post := range posts {
		items = append(items, communityPostPayloadForViewer(db, post, false, userID))
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Community posts retrieved successfully",
		"data":    items,
		"pagination": gin.H{
			"page": page, "limit": limit, "total": total,
			"total_pages": int(math.Ceil(float64(total) / float64(limit))),
		},
	})
}

func (ctrl *LMSController) CreateCommunityPost(c *gin.Context) {
	userID, role, ok := currentLMSUser(c)
	if !ok {
		return
	}
	if !communityRoleAllowedToCreate(role) {
		sendError(c, http.StatusForbidden, "Anda tidak memiliki izin membuat posting komunitas", nil)
		return
	}
	var req communityPostRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}
	postType := normalizeCommunityPostType(req.Type)
	status := normalizeCommunityStatus(req.Status)
	visibility := normalizeCommunityVisibility(req.Visibility)
	title := strings.TrimSpace(req.Title)
	content := sanitizeCommunityContent(req.Content)
	if verr := validateCommunityPostInput(postType, title, content); verr != nil {
		sendError(c, http.StatusUnprocessableEntity, verr.Message, verr.FieldErrors)
		return
	}
	courseID, err := communityUUIDPointer(req.CourseID)
	if err != nil {
		sendBadRequest(c, "course_id tidak valid", nil)
		return
	}
	classID, err := communityUUIDPointer(req.ClassID)
	if err != nil {
		sendBadRequest(c, "class_id tidak valid", nil)
		return
	}
	categoryID, err := communityUUIDPointer(req.CategoryID)
	if err != nil {
		sendBadRequest(c, "category_id tidak valid", nil)
		return
	}
	db := lmsDB(c, ctrl.DB).WithContext(c)
	if !ctrl.validateCommunityScope(c, db, role, courseID, classID, categoryID, visibility) {
		return
	}
	now := time.Now()
	post := model.CommunityPost{
		AuthorID:    userID,
		CourseID:    courseID,
		ClassID:     classID,
		CategoryID:  categoryID,
		Type:        postType,
		Title:       title,
		Content:     content,
		Body:        content,
		Status:      status,
		Visibility:  visibility,
		IsPublished: status != model.CommunityPostStatusDraft,
	}
	if post.IsPublished {
		post.PublishedAt = &now
	}
	if err := db.Create(&post).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	if err := ctrl.syncCommunityPostTags(db, post.ID, req.TagSlugs); err != nil {
		sendInternalError(c, err)
		return
	}
	if err := db.Preload("Author.Profile").Preload("Category").Preload("Course").Preload("Class").First(&post, "id = ?", post.ID).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccess(c, communityPostPayload(post, true), "Community post created successfully")
}

func validateCommunityPostInput(postType model.CommunityPostType, title, content string) *communityValidationError {
	errs := map[string]string{}
	if (postType == model.CommunityPostTypeQuestion || postType == model.CommunityPostTypeAnnouncement || postType == model.CommunityPostTypeMaterial) && title == "" {
		errs["title"] = "Judul wajib untuk tipe pertanyaan, pengumuman, atau materi"
	}
	if len(title) > communityTitleMaxLength {
		errs["title"] = "Judul terlalu panjang"
	}
	if content == "" {
		errs["content"] = "Konten tidak boleh kosong"
	}
	if len(content) > communityContentMaxLength {
		errs["content"] = "Konten terlalu panjang"
	}
	if len(errs) > 0 {
		return &communityValidationError{Message: "Validasi posting komunitas gagal", FieldErrors: errs}
	}
	return nil
}

func (ctrl *LMSController) GetCommunityPost(c *gin.Context) {
	userID, role, ok := currentLMSUser(c)
	if !ok {
		return
	}
	id, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	db := lmsDB(c, ctrl.DB)
	var post model.CommunityPost
	if err := ctrl.communityReadableQuery(c, db, userID, role).
		Preload("Author.Profile").
		Preload("Category").
		Preload("Course").
		Preload("Class").
		First(&post, "community_posts.id = ?", id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			sendError(c, http.StatusNotFound, "Posting komunitas tidak ditemukan", nil)
			return
		}
		sendInternalError(c, err)
		return
	}
	ctrl.recordCommunityView(c, db, post.ID, userID)
	sendSuccess(c, communityPostPayloadForViewer(db, post, true, userID), "Community post retrieved successfully")
}

func (ctrl *LMSController) UpdateCommunityPost(c *gin.Context) {
	userID, role, ok := currentLMSUser(c)
	if !ok {
		return
	}
	id, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	var req communityPostRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}
	db := lmsDB(c, ctrl.DB).WithContext(c)
	var post model.CommunityPost
	if err := db.First(&post, "id = ?", id).Error; err != nil {
		sendError(c, http.StatusNotFound, "Posting komunitas tidak ditemukan", nil)
		return
	}
	if !communityCanMutatePost(post, userID, role) {
		sendError(c, http.StatusForbidden, "Anda tidak memiliki izin mengubah posting ini", nil)
		return
	}
	if post.IsLocked && role < 99 {
		sendError(c, http.StatusForbidden, "Diskusi terkunci dan tidak dapat diubah", nil)
		return
	}
	postType := normalizeCommunityPostType(req.Type)
	status := normalizeCommunityStatus(req.Status)
	visibility := normalizeCommunityVisibility(req.Visibility)
	title := strings.TrimSpace(req.Title)
	content := sanitizeCommunityContent(req.Content)
	if verr := validateCommunityPostInput(postType, title, content); verr != nil {
		sendError(c, http.StatusUnprocessableEntity, verr.Message, verr.FieldErrors)
		return
	}
	courseID, err := communityUUIDPointer(req.CourseID)
	if err != nil {
		sendBadRequest(c, "course_id tidak valid", nil)
		return
	}
	classID, err := communityUUIDPointer(req.ClassID)
	if err != nil {
		sendBadRequest(c, "class_id tidak valid", nil)
		return
	}
	categoryID, err := communityUUIDPointer(req.CategoryID)
	if err != nil {
		sendBadRequest(c, "category_id tidak valid", nil)
		return
	}
	if !ctrl.validateCommunityScope(c, db, role, courseID, classID, categoryID, visibility) {
		return
	}
	updates := map[string]interface{}{
		"title":        title,
		"content":      content,
		"body":         content,
		"type":         postType,
		"status":       status,
		"visibility":   visibility,
		"course_id":    courseID,
		"class_id":     classID,
		"category_id":  categoryID,
		"is_edited":    true,
		"is_published": status != model.CommunityPostStatusDraft,
	}
	if status != model.CommunityPostStatusDraft && post.PublishedAt == nil {
		now := time.Now()
		updates["published_at"] = &now
	}
	if err := db.Model(&post).Updates(updates).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	if err := ctrl.syncCommunityPostTags(db, post.ID, req.TagSlugs); err != nil {
		sendInternalError(c, err)
		return
	}
	if err := db.Preload("Author.Profile").Preload("Category").Preload("Course").Preload("Class").First(&post, "id = ?", post.ID).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccess(c, communityPostPayload(post, true), "Community post updated successfully")
}

func (ctrl *LMSController) DeleteCommunityPost(c *gin.Context) {
	userID, role, ok := currentLMSUser(c)
	if !ok {
		return
	}
	id, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	db := lmsDB(c, ctrl.DB).WithContext(c)
	var post model.CommunityPost
	if err := db.First(&post, "id = ?", id).Error; err != nil {
		sendError(c, http.StatusNotFound, "Posting komunitas tidak ditemukan", nil)
		return
	}
	if !communityCanMutatePost(post, userID, role) {
		sendError(c, http.StatusForbidden, "Anda tidak memiliki izin menghapus posting ini", nil)
		return
	}
	if err := db.Delete(&post).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccessNoData(c)
}

func (ctrl *LMSController) PublishCommunityPost(c *gin.Context) {
	userID, role, ok := currentLMSUser(c)
	if !ok {
		return
	}
	id, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	db := lmsDB(c, ctrl.DB).WithContext(c)
	var post model.CommunityPost
	if err := db.First(&post, "id = ?", id).Error; err != nil {
		sendError(c, http.StatusNotFound, "Posting komunitas tidak ditemukan", nil)
		return
	}
	if !communityCanMutatePost(post, userID, role) {
		sendError(c, http.StatusForbidden, "Anda tidak memiliki izin publish posting ini", nil)
		return
	}
	if strings.TrimSpace(post.Content) == "" && strings.TrimSpace(post.Body) == "" {
		sendBadRequest(c, "Konten tidak boleh kosong", nil)
		return
	}
	now := time.Now()
	if err := db.Model(&post).Updates(map[string]interface{}{
		"status":       model.CommunityPostStatusPublished,
		"is_published": true,
		"published_at": &now,
	}).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccess(c, gin.H{"id": post.ID, "published_at": now}, "Community post published successfully")
}

func (ctrl *LMSController) syncCommunityPostTags(db *gorm.DB, postID uuid.UUID, rawSlugs []string) error {
	normalized := make([]string, 0, len(rawSlugs))
	seen := map[string]bool{}
	for _, raw := range rawSlugs {
		slug := strings.ToLower(strings.Trim(strings.TrimSpace(raw), "#"))
		slug = regexp.MustCompile(`[^a-z0-9\-_]+`).ReplaceAllString(slug, "-")
		slug = strings.Trim(slug, "-")
		if slug == "" || seen[slug] {
			continue
		}
		if len(normalized) >= 10 {
			break
		}
		seen[slug] = true
		normalized = append(normalized, slug)
	}
	if err := db.Where("post_id = ?", postID).Delete(&model.CommunityPostTag{}).Error; err != nil {
		return err
	}
	for _, slug := range normalized {
		tag := model.CommunityTag{Name: slug, Slug: slug}
		if err := db.Where("slug = ?", slug).FirstOrCreate(&tag).Error; err != nil {
			return err
		}
		if err := db.Create(&model.CommunityPostTag{PostID: postID, TagID: tag.ID}).Error; err != nil {
			return err
		}
		db.Model(&tag).UpdateColumn("use_count", gorm.Expr("use_count + ?", 1))
	}
	return nil
}

func (ctrl *LMSController) recordCommunityView(c *gin.Context, db *gorm.DB, postID uuid.UUID, userID uuid.UUID) {
	keyRaw := userID.String()
	if keyRaw == uuid.Nil.String() {
		keyRaw = c.ClientIP() + "|" + c.GetHeader("User-Agent")
	}
	hash := sha256.Sum256([]byte(keyRaw))
	viewerKey := hex.EncodeToString(hash[:])
	var existing model.CommunityPostView
	err := db.Where("post_id = ? AND viewer_key = ?", postID, viewerKey).First(&existing).Error
	if err == nil {
		if time.Since(existing.LastViewedAt) < 30*time.Minute {
			return
		}
		db.Model(&existing).Updates(map[string]interface{}{
			"last_viewed_at": time.Now(),
			"view_count":     gorm.Expr("view_count + ?", 1),
		})
		db.Model(&model.CommunityPost{}).Where("id = ?", postID).UpdateColumn("view_count", gorm.Expr("view_count + ?", 1))
		return
	}
	if err != gorm.ErrRecordNotFound {
		return
	}
	view := model.CommunityPostView{PostID: postID, UserID: &userID, ViewerKey: viewerKey}
	if err := db.Create(&view).Error; err == nil {
		db.Model(&model.CommunityPost{}).Where("id = ?", postID).UpdateColumn("view_count", gorm.Expr("view_count + ?", 1))
	}
}
