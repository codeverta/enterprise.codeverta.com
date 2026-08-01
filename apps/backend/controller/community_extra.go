package controller

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"gin-template/common"
	"gin-template/model"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	_ "golang.org/x/image/webp"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	communityCommentMaxLength = 20000
	communityUploadMaxSize    = 25 * 1024 * 1024
	communityMaxReplyDepth    = 3
)

type communityCommentRequest struct {
	Content         string  `json:"content"`
	ParentCommentID *string `json:"parent_comment_id"`
	IsAnswer        bool    `json:"is_answer"`
}

type communityReactionRequest struct {
	ReactionType string `json:"reaction_type"`
}

type communityReportRequest struct {
	Reason      string `json:"reason"`
	Description string `json:"description"`
}

type communityReportReviewRequest struct {
	Status     string `json:"status"`
	Resolution string `json:"resolution"`
	Action     string `json:"action"`
}

type communityCategoryRequest struct {
	Name         string  `json:"name"`
	Slug         string  `json:"slug"`
	Description  string  `json:"description"`
	Icon         string  `json:"icon"`
	Color        string  `json:"color"`
	SortOrder    int     `json:"sort_order"`
	IsVisible    *bool   `json:"is_visible"`
	CourseID     *string `json:"course_id"`
	ClassID      *string `json:"class_id"`
	AllowedRoles string  `json:"allowed_roles"`
}

var communityDangerousFileExts = map[string]bool{
	".exe": true, ".sh": true, ".bat": true, ".cmd": true, ".com": true,
	".js": true, ".php": true, ".jar": true, ".msi": true, ".dmg": true,
	".app": true, ".scr": true, ".ps1": true, ".vbs": true,
}

var communityAllowedMimes = map[string]bool{
	"image/jpeg":      true,
	"image/png":       true,
	"image/webp":      true,
	"image/gif":       true,
	"application/pdf": true,
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document":   true,
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":         true,
	"application/vnd.openxmlformats-officedocument.presentationml.presentation": true,
}

var communityMentionPattern = regexp.MustCompile(`@([a-zA-Z0-9_.-]{3,40})`)

func communityCommentAuthorPayload(comment model.CommunityComment) gin.H {
	name := strings.TrimSpace(comment.Author.DisplayName)
	if name == "" {
		name = strings.TrimSpace(comment.Author.FirstName + " " + comment.Author.LastName)
	}
	if name == "" {
		name = comment.Author.Username
	}
	if name == "" {
		name = comment.Author.Email
	}
	avatar := ""
	if comment.Author.Profile != nil {
		avatar = comment.Author.Profile.AvatarURL
	}
	return gin.H{
		"id":           comment.Author.ID,
		"username":     comment.Author.Username,
		"display_name": name,
		"email":        comment.Author.Email,
		"role":         comment.Author.Role,
		"avatar_url":   avatar,
	}
}

func communityCommentPayload(comment model.CommunityComment) gin.H {
	return gin.H{
		"id":                 comment.ID,
		"post_id":            comment.PostID,
		"parent_comment_id":  comment.ParentCommentID,
		"author_id":          comment.AuthorID,
		"author":             communityCommentAuthorPayload(comment),
		"content":            comment.Content,
		"depth":              comment.Depth,
		"is_answer":          comment.IsAnswer,
		"is_accepted_answer": comment.IsAcceptedAnswer,
		"is_edited":          comment.IsEdited,
		"reaction_count":     comment.ReactionCount,
		"reply_count":        comment.ReplyCount,
		"created_at":         comment.CreatedAt,
		"updated_at":         comment.UpdatedAt,
	}
}

func communityCommentPayloadForViewer(db *gorm.DB, comment model.CommunityComment, viewerID uuid.UUID) gin.H {
	out := communityCommentPayload(comment)
	if viewerID == uuid.Nil {
		out["user_reaction"] = nil
		return out
	}
	var reaction model.CommunityReaction
	if err := db.Select("reaction_type").Where("user_id = ? AND target_type = ? AND target_id = ?", viewerID, "comment", comment.ID).First(&reaction).Error; err == nil {
		out["user_reaction"] = reaction.ReactionType
	} else {
		out["user_reaction"] = nil
	}
	return out
}

func communityNormalizeReaction(raw string) model.CommunityReactionType {
	switch model.CommunityReactionType(strings.TrimSpace(raw)) {
	case model.CommunityReactionHelpful, model.CommunityReactionInsightful, model.CommunityReactionThanks:
		return model.CommunityReactionType(strings.TrimSpace(raw))
	default:
		return model.CommunityReactionLike
	}
}

func communityReportStatus(raw string) model.CommunityReportStatus {
	switch model.CommunityReportStatus(strings.TrimSpace(raw)) {
	case model.CommunityReportStatusRejected, model.CommunityReportStatusApproved, model.CommunityReportStatusResolved, model.CommunityReportStatusDuplicate:
		return model.CommunityReportStatus(strings.TrimSpace(raw))
	default:
		return model.CommunityReportStatusPending
	}
}

func (ctrl *LMSController) loadReadableCommunityPost(c *gin.Context, db *gorm.DB, postID uuid.UUID, userID uuid.UUID, role int) (model.CommunityPost, bool) {
	var post model.CommunityPost
	err := ctrl.communityReadableQuery(c, db, userID, role).First(&post, "community_posts.id = ?", postID).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			sendError(c, http.StatusNotFound, "Posting komunitas tidak ditemukan", nil)
			return post, false
		}
		sendInternalError(c, err)
		return post, false
	}
	return post, true
}

func communityValidateComment(content string) *communityValidationError {
	errs := map[string]string{}
	if strings.TrimSpace(content) == "" {
		errs["content"] = "Komentar tidak boleh kosong"
	}
	if len(content) > communityCommentMaxLength {
		errs["content"] = "Komentar terlalu panjang"
	}
	if len(errs) > 0 {
		return &communityValidationError{Message: "Validasi komentar gagal", FieldErrors: errs}
	}
	return nil
}

func (ctrl *LMSController) ListCommunityComments(c *gin.Context) {
	userID, role, ok := currentLMSUser(c)
	if !ok {
		return
	}
	postID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	db := lmsDB(c, ctrl.DB)
	if _, ok := ctrl.loadReadableCommunityPost(c, db, postID, userID, role); !ok {
		return
	}
	page, limit := communityPageLimit(c)
	query := db.Model(&model.CommunityComment{}).Where("post_id = ?", postID)
	if parent := strings.TrimSpace(c.Query("parent_comment_id")); parent != "" {
		query = query.Where("parent_comment_id = ?", parent)
	} else if c.Query("include_replies") != "true" {
		query = query.Where("parent_comment_id IS NULL")
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	sort := strings.TrimSpace(c.DefaultQuery("sort", "oldest"))
	order := "created_at ASC"
	if sort == "latest" {
		order = "created_at DESC"
	} else if sort == "liked" {
		order = "is_accepted_answer DESC, reaction_count DESC, created_at ASC"
	} else {
		order = "is_accepted_answer DESC, created_at ASC"
	}
	var comments []model.CommunityComment
	if err := query.Preload("Author.Profile").Order(order).Limit(limit).Offset((page - 1) * limit).Find(&comments).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	data := make([]gin.H, 0, len(comments))
	for _, comment := range comments {
		data = append(data, communityCommentPayloadForViewer(db, comment, userID))
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Community comments retrieved successfully",
		"data":    data,
		"pagination": gin.H{
			"page": page, "limit": limit, "total": total,
			"total_pages": int((total + int64(limit) - 1) / int64(limit)),
		},
	})
}

func (ctrl *LMSController) CreateCommunityComment(c *gin.Context) {
	userID, role, ok := currentLMSUser(c)
	if !ok {
		return
	}
	postID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	var req communityCommentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}
	ctrl.createCommunityComment(c, postID, userID, role, req)
}

func (ctrl *LMSController) CreateCommunityReply(c *gin.Context) {
	userID, role, ok := currentLMSUser(c)
	if !ok {
		return
	}
	parentID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	var parent model.CommunityComment
	db := lmsDB(c, ctrl.DB).WithContext(c)
	if err := db.First(&parent, "id = ?", parentID).Error; err != nil {
		sendError(c, http.StatusNotFound, "Komentar induk tidak ditemukan", nil)
		return
	}
	var req communityCommentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}
	parentIDString := parent.ID.String()
	req.ParentCommentID = &parentIDString
	ctrl.createCommunityComment(c, parent.PostID, userID, role, req)
}

func (ctrl *LMSController) createCommunityComment(c *gin.Context, postID uuid.UUID, userID uuid.UUID, role int, req communityCommentRequest) {
	content := sanitizeCommunityContent(req.Content)
	if verr := communityValidateComment(content); verr != nil {
		sendError(c, http.StatusUnprocessableEntity, verr.Message, verr.FieldErrors)
		return
	}
	db := lmsDB(c, ctrl.DB).WithContext(c)
	post, ok := ctrl.loadReadableCommunityPost(c, db, postID, userID, role)
	if !ok {
		return
	}
	if post.IsLocked && role < 99 {
		sendError(c, http.StatusForbidden, "Diskusi terkunci dan tidak menerima komentar baru", nil)
		return
	}
	var parentID *uuid.UUID
	depth := 0
	if req.ParentCommentID != nil && strings.TrimSpace(*req.ParentCommentID) != "" {
		parsed, err := uuid.Parse(strings.TrimSpace(*req.ParentCommentID))
		if err != nil {
			sendBadRequest(c, "parent_comment_id tidak valid", nil)
			return
		}
		var parent model.CommunityComment
		if err := db.First(&parent, "id = ? AND post_id = ?", parsed, postID).Error; err != nil {
			sendError(c, http.StatusNotFound, "Komentar induk tidak ditemukan", nil)
			return
		}
		if parent.Depth+1 >= communityMaxReplyDepth {
			sendBadRequest(c, "Kedalaman reply maksimal tiga level", nil)
			return
		}
		parentID = &parsed
		depth = parent.Depth + 1
	}
	comment := model.CommunityComment{
		PostID:          postID,
		ParentCommentID: parentID,
		AuthorID:        userID,
		Content:         content,
		Depth:           depth,
		IsAnswer:        req.IsAnswer || post.Type == model.CommunityPostTypeQuestion,
	}
	if err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&comment).Error; err != nil {
			return err
		}
		if err := tx.Model(&model.CommunityPost{}).Where("id = ?", postID).UpdateColumn("comment_count", gorm.Expr("comment_count + ?", 1)).Error; err != nil {
			return err
		}
		if parentID != nil {
			if err := tx.Model(&model.CommunityComment{}).Where("id = ?", *parentID).UpdateColumn("reply_count", gorm.Expr("reply_count + ?", 1)).Error; err != nil {
				return err
			}
		}
		follower := model.CommunityPostFollower{PostID: postID, UserID: userID}
		result := tx.Where("post_id = ? AND user_id = ?", postID, userID).FirstOrCreate(&follower)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected > 0 {
			if err := tx.Model(&model.CommunityPost{}).Where("id = ?", postID).UpdateColumn("follow_count", gorm.Expr("follow_count + ?", 1)).Error; err != nil {
				return err
			}
		}
		return nil
	}); err != nil {
		sendInternalError(c, err)
		return
	}
	ctrl.storeCommunityMentions(db, &postID, &comment.ID, userID, content)
	ctrl.notifyCommunityFollowers(db, post, userID, "Aktivitas baru di komunitas", "Ada komentar baru pada posting yang Anda ikuti.")
	if err := db.Preload("Author.Profile").First(&comment, "id = ?", comment.ID).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccess(c, communityCommentPayload(comment), "Community comment created successfully")
}

func (ctrl *LMSController) UpdateCommunityComment(c *gin.Context) {
	userID, role, ok := currentLMSUser(c)
	if !ok {
		return
	}
	commentID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	var req communityCommentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}
	content := sanitizeCommunityContent(req.Content)
	if verr := communityValidateComment(content); verr != nil {
		sendError(c, http.StatusUnprocessableEntity, verr.Message, verr.FieldErrors)
		return
	}
	db := lmsDB(c, ctrl.DB).WithContext(c)
	var comment model.CommunityComment
	if err := db.Preload("Post").First(&comment, "id = ?", commentID).Error; err != nil {
		sendError(c, http.StatusNotFound, "Komentar tidak ditemukan", nil)
		return
	}
	if comment.AuthorID != userID && role < 99 {
		sendError(c, http.StatusForbidden, "Anda tidak memiliki izin mengubah komentar ini", nil)
		return
	}
	if comment.Post.IsLocked && role < 99 {
		sendError(c, http.StatusForbidden, "Diskusi terkunci", nil)
		return
	}
	if err := db.Model(&comment).Updates(map[string]interface{}{"content": content, "is_edited": true}).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	comment.Content = content
	ctrl.storeCommunityMentions(db, &comment.PostID, &comment.ID, userID, content)
	if err := db.Preload("Author.Profile").First(&comment, "id = ?", comment.ID).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccess(c, communityCommentPayload(comment), "Community comment updated successfully")
}

func (ctrl *LMSController) DeleteCommunityComment(c *gin.Context) {
	userID, role, ok := currentLMSUser(c)
	if !ok {
		return
	}
	commentID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	db := lmsDB(c, ctrl.DB).WithContext(c)
	var comment model.CommunityComment
	if err := db.First(&comment, "id = ?", commentID).Error; err != nil {
		sendError(c, http.StatusNotFound, "Komentar tidak ditemukan", nil)
		return
	}
	if comment.AuthorID != userID && !communityRoleCanModerate(role) {
		sendError(c, http.StatusForbidden, "Anda tidak memiliki izin menghapus komentar ini", nil)
		return
	}
	if err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Delete(&comment).Error; err != nil {
			return err
		}
		if err := tx.Model(&model.CommunityPost{}).Where("id = ? AND comment_count > 0", comment.PostID).UpdateColumn("comment_count", gorm.Expr("comment_count - ?", 1)).Error; err != nil {
			return err
		}
		if comment.ParentCommentID != nil {
			if err := tx.Model(&model.CommunityComment{}).Where("id = ? AND reply_count > 0", *comment.ParentCommentID).UpdateColumn("reply_count", gorm.Expr("reply_count - ?", 1)).Error; err != nil {
				return err
			}
		}
		return nil
	}); err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccessNoData(c)
}

func (ctrl *LMSController) AcceptCommunityComment(c *gin.Context) {
	userID, role, ok := currentLMSUser(c)
	if !ok {
		return
	}
	commentID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	db := lmsDB(c, ctrl.DB).WithContext(c)
	var comment model.CommunityComment
	if err := db.Preload("Post").First(&comment, "id = ?", commentID).Error; err != nil {
		sendError(c, http.StatusNotFound, "Komentar tidak ditemukan", nil)
		return
	}
	if comment.Post.Type != model.CommunityPostTypeQuestion {
		sendBadRequest(c, "Accepted answer hanya tersedia untuk posting pertanyaan", nil)
		return
	}
	if comment.Post.AuthorID != userID && !communityRoleCanModerate(role) {
		sendError(c, http.StatusForbidden, "Anda tidak memiliki izin memilih accepted answer", nil)
		return
	}
	if err := db.Transaction(func(tx *gorm.DB) error {
		var post model.CommunityPost
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&post, "id = ?", comment.PostID).Error; err != nil {
			return err
		}
		if err := tx.Model(&model.CommunityComment{}).Where("post_id = ?", comment.PostID).Update("is_accepted_answer", false).Error; err != nil {
			return err
		}
		if err := tx.Model(&model.CommunityComment{}).Where("id = ?", comment.ID).Updates(map[string]interface{}{"is_accepted_answer": true, "is_answer": true}).Error; err != nil {
			return err
		}
		return tx.Model(&post).Updates(map[string]interface{}{
			"accepted_comment_id": comment.ID,
			"status":              model.CommunityPostStatusSolved,
		}).Error
	}); err != nil {
		sendInternalError(c, err)
		return
	}
	_ = model.PushNotification(db, comment.AuthorID, comment.TenantID, "Jawaban diterima", "Jawaban Anda ditandai sebagai accepted answer.", "success")
	sendSuccess(c, gin.H{"comment_id": comment.ID, "post_id": comment.PostID}, "Accepted answer updated successfully")
}

func (ctrl *LMSController) UnacceptCommunityComment(c *gin.Context) {
	userID, role, ok := currentLMSUser(c)
	if !ok {
		return
	}
	commentID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	db := lmsDB(c, ctrl.DB).WithContext(c)
	var comment model.CommunityComment
	if err := db.Preload("Post").First(&comment, "id = ?", commentID).Error; err != nil {
		sendError(c, http.StatusNotFound, "Komentar tidak ditemukan", nil)
		return
	}
	if comment.Post.AuthorID != userID && !communityRoleCanModerate(role) {
		sendError(c, http.StatusForbidden, "Anda tidak memiliki izin membatalkan accepted answer", nil)
		return
	}
	if err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&model.CommunityComment{}).Where("id = ?", comment.ID).Update("is_accepted_answer", false).Error; err != nil {
			return err
		}
		return tx.Model(&model.CommunityPost{}).Where("id = ?", comment.PostID).Updates(map[string]interface{}{
			"accepted_comment_id": nil,
			"status":              model.CommunityPostStatusPublished,
		}).Error
	}); err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccess(c, gin.H{"comment_id": comment.ID, "post_id": comment.PostID}, "Accepted answer removed successfully")
}

func (ctrl *LMSController) ReactCommunityPost(c *gin.Context) {
	ctrl.reactCommunityTarget(c, "post")
}

func (ctrl *LMSController) DeleteCommunityPostReaction(c *gin.Context) {
	ctrl.deleteCommunityReaction(c, "post")
}

func (ctrl *LMSController) ReactCommunityComment(c *gin.Context) {
	ctrl.reactCommunityTarget(c, "comment")
}

func (ctrl *LMSController) DeleteCommunityCommentReaction(c *gin.Context) {
	ctrl.deleteCommunityReaction(c, "comment")
}

func (ctrl *LMSController) reactCommunityTarget(c *gin.Context, targetType string) {
	userID, role, ok := currentLMSUser(c)
	if !ok {
		return
	}
	targetID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	var req communityReactionRequest
	_ = c.ShouldBindJSON(&req)
	reactionType := communityNormalizeReaction(req.ReactionType)
	db := lmsDB(c, ctrl.DB).WithContext(c)
	if !ctrl.ensureCommunityTargetReadable(c, db, targetType, targetID, userID, role) {
		return
	}
	created := false
	if err := db.Transaction(func(tx *gorm.DB) error {
		var existing model.CommunityReaction
		err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("user_id = ? AND target_type = ? AND target_id = ?", userID, targetType, targetID).First(&existing).Error
		if err == nil {
			return tx.Model(&existing).Update("reaction_type", reactionType).Error
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		if err := tx.Create(&model.CommunityReaction{UserID: userID, TargetType: targetType, TargetID: targetID, ReactionType: reactionType}).Error; err != nil {
			return err
		}
		created = true
		return communityAdjustReactionCounter(tx, targetType, targetID, 1)
	}); err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccess(c, gin.H{"target_type": targetType, "target_id": targetID, "reaction_type": reactionType, "created": created}, "Community reaction saved successfully")
}

func (ctrl *LMSController) deleteCommunityReaction(c *gin.Context, targetType string) {
	userID, _, ok := currentLMSUser(c)
	if !ok {
		return
	}
	targetID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	db := lmsDB(c, ctrl.DB).WithContext(c)
	if err := db.Transaction(func(tx *gorm.DB) error {
		var reaction model.CommunityReaction
		err := tx.Where("user_id = ? AND target_type = ? AND target_id = ?", userID, targetType, targetID).First(&reaction).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		if err != nil {
			return err
		}
		if err := tx.Delete(&reaction).Error; err != nil {
			return err
		}
		return communityAdjustReactionCounter(tx, targetType, targetID, -1)
	}); err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccessNoData(c)
}

func communityAdjustReactionCounter(tx *gorm.DB, targetType string, targetID uuid.UUID, delta int) error {
	expr := gorm.Expr("reaction_count + ?", delta)
	where := "id = ?"
	if delta < 0 {
		where = "id = ? AND reaction_count > 0"
	}
	if targetType == "comment" {
		return tx.Model(&model.CommunityComment{}).Where(where, targetID).UpdateColumn("reaction_count", expr).Error
	}
	return tx.Model(&model.CommunityPost{}).Where(where, targetID).UpdateColumn("reaction_count", expr).Error
}

func (ctrl *LMSController) ensureCommunityTargetReadable(c *gin.Context, db *gorm.DB, targetType string, targetID uuid.UUID, userID uuid.UUID, role int) bool {
	if targetType == "comment" {
		var comment model.CommunityComment
		if err := db.First(&comment, "id = ?", targetID).Error; err != nil {
			sendError(c, http.StatusNotFound, "Komentar tidak ditemukan", nil)
			return false
		}
		_, ok := ctrl.loadReadableCommunityPost(c, db, comment.PostID, userID, role)
		return ok
	}
	_, ok := ctrl.loadReadableCommunityPost(c, db, targetID, userID, role)
	return ok
}

func (ctrl *LMSController) BookmarkCommunityPost(c *gin.Context) {
	ctrl.toggleCommunityPostRelation(c, "bookmark", true)
}

func (ctrl *LMSController) DeleteCommunityPostBookmark(c *gin.Context) {
	ctrl.toggleCommunityPostRelation(c, "bookmark", false)
}

func (ctrl *LMSController) FollowCommunityPost(c *gin.Context) {
	ctrl.toggleCommunityPostRelation(c, "follow", true)
}

func (ctrl *LMSController) DeleteCommunityPostFollow(c *gin.Context) {
	ctrl.toggleCommunityPostRelation(c, "follow", false)
}

func (ctrl *LMSController) toggleCommunityPostRelation(c *gin.Context, relation string, enabled bool) {
	userID, role, ok := currentLMSUser(c)
	if !ok {
		return
	}
	postID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	db := lmsDB(c, ctrl.DB).WithContext(c)
	if _, ok := ctrl.loadReadableCommunityPost(c, db, postID, userID, role); !ok {
		return
	}
	counter := "bookmark_count"
	if relation == "follow" {
		counter = "follow_count"
	}
	changed := false
	if err := db.Transaction(func(tx *gorm.DB) error {
		if enabled {
			var err error
			if relation == "follow" {
				err = tx.Create(&model.CommunityPostFollower{PostID: postID, UserID: userID}).Error
			} else {
				err = tx.Create(&model.CommunityBookmark{PostID: postID, UserID: userID}).Error
			}
			if err != nil {
				if strings.Contains(strings.ToLower(err.Error()), "duplicate") || strings.Contains(strings.ToLower(err.Error()), "unique") {
					return nil
				}
				return err
			}
			changed = true
			return tx.Model(&model.CommunityPost{}).Where("id = ?", postID).UpdateColumn(counter, gorm.Expr(counter+" + ?", 1)).Error
		}
		var res *gorm.DB
		if relation == "follow" {
			res = tx.Where("post_id = ? AND user_id = ?", postID, userID).Delete(&model.CommunityPostFollower{})
		} else {
			res = tx.Where("post_id = ? AND user_id = ?", postID, userID).Delete(&model.CommunityBookmark{})
		}
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected > 0 {
			changed = true
			return tx.Model(&model.CommunityPost{}).Where("id = ? AND "+counter+" > 0", postID).UpdateColumn(counter, gorm.Expr(counter+" - ?", 1)).Error
		}
		return nil
	}); err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccess(c, gin.H{"post_id": postID, relation: enabled, "changed": changed}, "Community relation updated successfully")
}

func (ctrl *LMSController) ReportCommunityPost(c *gin.Context) {
	ctrl.reportCommunityTarget(c, "post")
}

func (ctrl *LMSController) ReportCommunityComment(c *gin.Context) {
	ctrl.reportCommunityTarget(c, "comment")
}

func (ctrl *LMSController) reportCommunityTarget(c *gin.Context, targetType string) {
	userID, role, ok := currentLMSUser(c)
	if !ok {
		return
	}
	targetID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	var req communityReportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}
	reason := strings.ToLower(strings.TrimSpace(req.Reason))
	if reason == "" {
		sendBadRequest(c, "Alasan laporan wajib diisi", nil)
		return
	}
	if len(reason) > 80 || len(req.Description) > 2000 {
		sendBadRequest(c, "Laporan terlalu panjang", nil)
		return
	}
	db := lmsDB(c, ctrl.DB).WithContext(c)
	if !ctrl.ensureCommunityTargetReadable(c, db, targetType, targetID, userID, role) {
		return
	}
	report := model.CommunityReport{
		ReporterID:  userID,
		TargetType:  targetType,
		TargetID:    targetID,
		Reason:      reason,
		Description: strings.TrimSpace(req.Description),
		Status:      model.CommunityReportStatusPending,
	}
	if err := db.Create(&report).Error; err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "duplicate") || strings.Contains(strings.ToLower(err.Error()), "unique") {
			sendError(c, http.StatusConflict, "Anda sudah melaporkan konten ini", nil)
			return
		}
		sendInternalError(c, err)
		return
	}
	sendSuccess(c, report, "Community report created successfully")
}

func (ctrl *LMSController) ListCommunityReports(c *gin.Context) {
	_, role, ok := currentLMSUser(c)
	if !ok {
		return
	}
	if !communityRoleCanModerate(role) {
		sendError(c, http.StatusForbidden, "Anda tidak memiliki izin moderasi komunitas", nil)
		return
	}
	db := lmsDB(c, ctrl.DB)
	page, limit := communityPageLimit(c)
	query := db.Model(&model.CommunityReport{})
	if status := strings.TrimSpace(c.Query("status")); status != "" && status != "all" {
		query = query.Where("status = ?", status)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	var reports []model.CommunityReport
	if err := query.Preload("Reporter").Preload("Reviewer").Order("created_at DESC").Limit(limit).Offset((page - 1) * limit).Find(&reports).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Community reports retrieved successfully",
		"data":    reports,
		"pagination": gin.H{
			"page": page, "limit": limit, "total": total,
			"total_pages": int((total + int64(limit) - 1) / int64(limit)),
		},
	})
}

func (ctrl *LMSController) ReviewCommunityReport(c *gin.Context) {
	moderatorID, role, ok := currentLMSUser(c)
	if !ok {
		return
	}
	if !communityRoleCanModerate(role) {
		sendError(c, http.StatusForbidden, "Anda tidak memiliki izin moderasi komunitas", nil)
		return
	}
	reportID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	var req communityReportReviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}
	status := communityReportStatus(req.Status)
	if status == model.CommunityReportStatusPending {
		sendBadRequest(c, "Status review tidak valid", nil)
		return
	}
	db := lmsDB(c, ctrl.DB).WithContext(c)
	now := time.Now()
	var report model.CommunityReport
	if err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&report, "id = ?", reportID).Error; err != nil {
			return err
		}
		if report.Status != model.CommunityReportStatusPending {
			return fmt.Errorf("laporan sudah diproses")
		}
		if err := tx.Model(&report).Updates(map[string]interface{}{
			"status":      status,
			"reviewed_by": moderatorID,
			"reviewed_at": &now,
			"resolution":  strings.TrimSpace(req.Resolution),
		}).Error; err != nil {
			return err
		}
		action := strings.TrimSpace(req.Action)
		if action == "" {
			action = "review_report"
		}
		if status == model.CommunityReportStatusApproved {
			if action == "hide" && report.TargetType == "post" {
				if err := tx.Model(&model.CommunityPost{}).Where("id = ?", report.TargetID).Update("status", model.CommunityPostStatusHidden).Error; err != nil {
					return err
				}
			}
			if action == "lock" && report.TargetType == "post" {
				if err := tx.Model(&model.CommunityPost{}).Where("id = ?", report.TargetID).Update("is_locked", true).Error; err != nil {
					return err
				}
			}
		}
		meta, _ := json.Marshal(gin.H{"report_id": report.ID, "status": status, "action": action})
		return tx.Create(&model.CommunityModerationLog{
			ModeratorID: moderatorID,
			TargetType:  report.TargetType,
			TargetID:    report.TargetID,
			Action:      action,
			Reason:      strings.TrimSpace(req.Resolution),
			Metadata:    meta,
		}).Error
	}); err != nil {
		if strings.Contains(err.Error(), "laporan sudah") {
			sendError(c, http.StatusConflict, err.Error(), nil)
			return
		}
		sendInternalError(c, err)
		return
	}
	sendSuccess(c, report, "Community report reviewed successfully")
}

func (ctrl *LMSController) PinCommunityPost(c *gin.Context) {
	ctrl.moderateCommunityPostFlag(c, "is_pinned", true, "pin_post")
}

func (ctrl *LMSController) UnpinCommunityPost(c *gin.Context) {
	ctrl.moderateCommunityPostFlag(c, "is_pinned", false, "unpin_post")
}

func (ctrl *LMSController) LockCommunityPost(c *gin.Context) {
	ctrl.moderateCommunityPostFlag(c, "is_locked", true, "lock_post")
}

func (ctrl *LMSController) UnlockCommunityPost(c *gin.Context) {
	ctrl.moderateCommunityPostFlag(c, "is_locked", false, "unlock_post")
}

func (ctrl *LMSController) moderateCommunityPostFlag(c *gin.Context, column string, value bool, action string) {
	moderatorID, role, ok := currentLMSUser(c)
	if !ok {
		return
	}
	if !communityRoleCanModerate(role) {
		sendError(c, http.StatusForbidden, "Anda tidak memiliki izin moderasi komunitas", nil)
		return
	}
	postID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	db := lmsDB(c, ctrl.DB).WithContext(c)
	if err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&model.CommunityPost{}).Where("id = ?", postID).Update(column, value).Error; err != nil {
			return err
		}
		return tx.Create(&model.CommunityModerationLog{ModeratorID: moderatorID, TargetType: "post", TargetID: postID, Action: action}).Error
	}); err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccess(c, gin.H{"post_id": postID, column: value}, "Community moderation updated successfully")
}

func (ctrl *LMSController) GetCommunityStatistics(c *gin.Context) {
	_, role, ok := currentLMSUser(c)
	if !ok {
		return
	}
	if !communityRoleCanModerate(role) {
		sendError(c, http.StatusForbidden, "Anda tidak memiliki izin melihat statistik komunitas", nil)
		return
	}
	db := lmsDB(c, ctrl.DB)
	var posts, questions, unanswered, comments, pendingReports int64
	db.Model(&model.CommunityPost{}).Count(&posts)
	db.Model(&model.CommunityPost{}).Where("type = ?", model.CommunityPostTypeQuestion).Count(&questions)
	db.Model(&model.CommunityPost{}).Where("type = ? AND status = ?", model.CommunityPostTypeQuestion, model.CommunityPostStatusPublished).Count(&unanswered)
	db.Model(&model.CommunityComment{}).Count(&comments)
	db.Model(&model.CommunityReport{}).Where("status = ?", model.CommunityReportStatusPending).Count(&pendingReports)
	var popular []model.CommunityPost
	_ = db.Preload("Author.Profile").Order("view_count DESC, reaction_count DESC").Limit(5).Find(&popular).Error
	outPopular := make([]gin.H, 0, len(popular))
	for _, post := range popular {
		outPopular = append(outPopular, communityPostPayload(post, false))
	}
	sendSuccess(c, gin.H{
		"total_posts":     posts,
		"questions":       questions,
		"unanswered":      unanswered,
		"comments":        comments,
		"pending_reports": pendingReports,
		"popular_posts":   outPopular,
	}, "Community statistics retrieved successfully")
}

func (ctrl *LMSController) CreateCommunityCategory(c *gin.Context) {
	ctrl.upsertCommunityCategory(c, nil)
}

func (ctrl *LMSController) UpdateCommunityCategory(c *gin.Context) {
	id, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	ctrl.upsertCommunityCategory(c, &id)
}

func (ctrl *LMSController) upsertCommunityCategory(c *gin.Context, id *uuid.UUID) {
	_, role, ok := currentLMSUser(c)
	if !ok {
		return
	}
	if !communityRoleCanModerate(role) {
		sendError(c, http.StatusForbidden, "Anda tidak memiliki izin mengelola kategori komunitas", nil)
		return
	}
	var req communityCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" || len(name) > 120 {
		sendBadRequest(c, "Nama kategori wajib diisi dan maksimal 120 karakter", nil)
		return
	}
	slug := normalizeCommunitySlug(req.Slug)
	if slug == "" {
		slug = normalizeCommunitySlug(name)
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
	visible := true
	if req.IsVisible != nil {
		visible = *req.IsVisible
	}
	db := lmsDB(c, ctrl.DB).WithContext(c)
	category := model.CommunityCategory{}
	if id != nil {
		if err := db.First(&category, "id = ?", *id).Error; err != nil {
			sendError(c, http.StatusNotFound, "Kategori komunitas tidak ditemukan", nil)
			return
		}
	}
	category.Name = name
	category.Slug = slug
	category.Description = strings.TrimSpace(req.Description)
	category.Icon = strings.TrimSpace(req.Icon)
	category.Color = strings.TrimSpace(req.Color)
	category.SortOrder = req.SortOrder
	category.IsVisible = visible
	category.CourseID = courseID
	category.ClassID = classID
	category.AllowedRoles = strings.TrimSpace(req.AllowedRoles)
	if err := db.Save(&category).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccess(c, category, "Community category saved successfully")
}

func (ctrl *LMSController) DeleteCommunityCategory(c *gin.Context) {
	_, role, ok := currentLMSUser(c)
	if !ok {
		return
	}
	if !communityRoleCanModerate(role) {
		sendError(c, http.StatusForbidden, "Anda tidak memiliki izin menghapus kategori komunitas", nil)
		return
	}
	id, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	db := lmsDB(c, ctrl.DB).WithContext(c)
	if err := db.Delete(&model.CommunityCategory{}, "id = ?", id).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	sendSuccessNoData(c)
}

func normalizeCommunitySlug(raw string) string {
	slug := strings.ToLower(strings.TrimSpace(raw))
	slug = regexp.MustCompile(`[^a-z0-9\-_]+`).ReplaceAllString(slug, "-")
	return strings.Trim(slug, "-")
}

func (ctrl *LMSController) UploadCommunityMedia(c *gin.Context) {
	userID, role, ok := currentLMSUser(c)
	if !ok {
		return
	}
	file, err := c.FormFile("file")
	if err != nil {
		sendBadRequest(c, "File wajib diupload", nil)
		return
	}
	if file.Size <= 0 || file.Size > communityUploadMaxSize {
		sendBadRequest(c, "Ukuran file tidak valid atau melebihi 25MB", nil)
		return
	}
	db := lmsDB(c, ctrl.DB).WithContext(c)
	var postID *uuid.UUID
	if raw := strings.TrimSpace(c.PostForm("post_id")); raw != "" {
		parsed, err := uuid.Parse(raw)
		if err != nil {
			sendBadRequest(c, "post_id tidak valid", nil)
			return
		}
		if _, ok := ctrl.loadReadableCommunityPost(c, db, parsed, userID, role); !ok {
			return
		}
		postID = &parsed
	}
	var commentID *uuid.UUID
	if raw := strings.TrimSpace(c.PostForm("comment_id")); raw != "" {
		parsed, err := uuid.Parse(raw)
		if err != nil {
			sendBadRequest(c, "comment_id tidak valid", nil)
			return
		}
		var comment model.CommunityComment
		if err := db.First(&comment, "id = ?", parsed).Error; err != nil {
			sendError(c, http.StatusNotFound, "Komentar tidak ditemukan", nil)
			return
		}
		if _, ok := ctrl.loadReadableCommunityPost(c, db, comment.PostID, userID, role); !ok {
			return
		}
		commentID = &parsed
	}
	media, err := ctrl.storeCommunityMediaFile(db, userID, postID, commentID, file)
	if err != nil {
		sendBadRequest(c, err.Error(), nil)
		return
	}
	sendSuccess(c, media, "Community media uploaded successfully")
}

func (ctrl *LMSController) storeCommunityMediaFile(db *gorm.DB, userID uuid.UUID, postID, commentID *uuid.UUID, file *multipart.FileHeader) (model.CommunityPostMedia, error) {
	original := filepath.Base(file.Filename)
	ext := strings.ToLower(filepath.Ext(original))
	if communityDangerousFileExts[ext] {
		return model.CommunityPostMedia{}, fmt.Errorf("tipe file tidak diizinkan")
	}
	src, err := file.Open()
	if err != nil {
		return model.CommunityPostMedia{}, fmt.Errorf("gagal membaca file")
	}
	defer src.Close()
	buffer := make([]byte, 512)
	n, _ := io.ReadFull(src, buffer)
	buffer = buffer[:n]
	detected := http.DetectContentType(buffer)
	if _, err := src.Seek(0, io.SeekStart); err != nil {
		return model.CommunityPostMedia{}, fmt.Errorf("gagal membaca file")
	}
	mime := detected
	if strings.HasPrefix(detected, "application/zip") {
		switch ext {
		case ".docx":
			mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
		case ".xlsx":
			mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
		case ".pptx":
			mime = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
		}
	}
	if !communityAllowedMimes[mime] {
		return model.CommunityPostMedia{}, fmt.Errorf("MIME type file tidak diizinkan")
	}
	storedName := "community_" + uuid.NewString() + ext
	if err := os.MkdirAll(common.UploadPath, 0755); err != nil {
		return model.CommunityPostMedia{}, fmt.Errorf("gagal menyiapkan storage")
	}
	dstPath := filepath.Join(common.UploadPath, storedName)
	dst, err := os.Create(dstPath)
	if err != nil {
		return model.CommunityPostMedia{}, fmt.Errorf("gagal menyimpan file")
	}
	defer dst.Close()
	if _, err := io.Copy(dst, src); err != nil {
		_ = os.Remove(dstPath)
		return model.CommunityPostMedia{}, fmt.Errorf("gagal menyimpan file")
	}
	width, height := 0, 0
	if strings.HasPrefix(mime, "image/") {
		if img, err := os.Open(dstPath); err == nil {
			if cfg, _, err := image.DecodeConfig(img); err == nil {
				width, height = cfg.Width, cfg.Height
			}
			_ = img.Close()
		}
	}
	media := model.CommunityPostMedia{
		PostID:           postID,
		CommentID:        commentID,
		UploaderID:       userID,
		FileName:         storedName,
		OriginalFileName: original,
		FileURL:          "/api/files/download/" + storedName,
		StoragePath:      storedName,
		MimeType:         mime,
		FileSize:         file.Size,
		Width:            width,
		Height:           height,
	}
	if err := db.Create(&media).Error; err != nil {
		_ = os.Remove(dstPath)
		return model.CommunityPostMedia{}, err
	}
	return media, nil
}

func (ctrl *LMSController) DeleteCommunityMedia(c *gin.Context) {
	userID, role, ok := currentLMSUser(c)
	if !ok {
		return
	}
	mediaID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	db := lmsDB(c, ctrl.DB).WithContext(c)
	var media model.CommunityPostMedia
	if err := db.First(&media, "id = ?", mediaID).Error; err != nil {
		sendError(c, http.StatusNotFound, "Media tidak ditemukan", nil)
		return
	}
	if media.UploaderID != userID && !communityRoleCanModerate(role) {
		sendError(c, http.StatusForbidden, "Anda tidak memiliki izin menghapus media ini", nil)
		return
	}
	if err := db.Delete(&media).Error; err != nil {
		sendInternalError(c, err)
		return
	}
	storagePath := filepath.Base(media.StoragePath)
	if storagePath != "" && storagePath == media.StoragePath {
		_ = os.Remove(filepath.Join(common.UploadPath, storagePath))
	}
	sendSuccessNoData(c)
}

func (ctrl *LMSController) storeCommunityMentions(db *gorm.DB, postID, commentID *uuid.UUID, by uuid.UUID, content string) {
	matches := communityMentionPattern.FindAllStringSubmatch(content, -1)
	if len(matches) == 0 {
		return
	}
	seen := map[string]bool{}
	for _, match := range matches {
		username := strings.ToLower(match[1])
		if seen[username] || len(seen) >= 10 {
			continue
		}
		seen[username] = true
		var user model.User
		if err := db.Where("LOWER(username) = ?", username).First(&user).Error; err != nil {
			continue
		}
		if user.ID == by {
			continue
		}
		hashRaw := fmt.Sprintf("%v:%v:%s:%s", postID, commentID, user.ID, content)
		hash := sha256.Sum256([]byte(hashRaw))
		mention := model.CommunityMention{
			PostID:          postID,
			CommentID:       commentID,
			MentionedUserID: user.ID,
			MentionedByID:   by,
			SourceHash:      hex.EncodeToString(hash[:]),
		}
		if err := db.Clauses(clause.OnConflict{DoNothing: true}).Create(&mention).Error; err == nil {
			_ = model.PushNotification(db, user.ID, user.TenantID, "Anda disebut di komunitas", "Ada yang menyebut Anda dalam diskusi komunitas.", "info")
		}
	}
}

func (ctrl *LMSController) notifyCommunityFollowers(db *gorm.DB, post model.CommunityPost, actorID uuid.UUID, title, content string) {
	var followers []model.CommunityPostFollower
	if err := db.Where("post_id = ? AND user_id <> ?", post.ID, actorID).Limit(50).Find(&followers).Error; err != nil {
		return
	}
	for _, follower := range followers {
		_ = model.PushNotification(db, follower.UserID, post.TenantID, title, content, "info")
	}
}

func (ctrl *LMSController) VoteCommunityPoll(c *gin.Context) {
	userID, role, ok := currentLMSUser(c)
	if !ok {
		return
	}
	postID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}
	var req struct {
		OptionIDs []string `json:"option_ids"`
		OptionID  string   `json:"option_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		sendBadRequest(c, ErrInvalidParameters, nil)
		return
	}
	db := lmsDB(c, ctrl.DB).WithContext(c)
	if _, ok := ctrl.loadReadableCommunityPost(c, db, postID, userID, role); !ok {
		return
	}
	var poll model.CommunityPoll
	if err := db.First(&poll, "post_id = ?", postID).Error; err != nil {
		sendError(c, http.StatusNotFound, "Polling tidak ditemukan", nil)
		return
	}
	if poll.ClosedAt != nil || (poll.ClosesAt != nil && poll.ClosesAt.Before(time.Now())) {
		sendBadRequest(c, "Polling sudah ditutup", nil)
		return
	}
	rawIDs := req.OptionIDs
	if len(rawIDs) == 0 && req.OptionID != "" {
		rawIDs = []string{req.OptionID}
	}
	if len(rawIDs) == 0 {
		sendBadRequest(c, "Pilihan polling wajib diisi", nil)
		return
	}
	if poll.ChoiceMode == model.CommunityPollChoiceSingle && len(rawIDs) > 1 {
		sendBadRequest(c, "Polling ini hanya mengizinkan satu pilihan", nil)
		return
	}
	optionIDs := make([]uuid.UUID, 0, len(rawIDs))
	for _, raw := range rawIDs {
		parsed, err := uuid.Parse(strings.TrimSpace(raw))
		if err != nil {
			sendBadRequest(c, "option_id tidak valid", nil)
			return
		}
		optionIDs = append(optionIDs, parsed)
	}
	if err := db.Transaction(func(tx *gorm.DB) error {
		var existing int64
		if err := tx.Model(&model.CommunityPollVote{}).Where("poll_id = ? AND voter_id = ?", poll.ID, userID).Count(&existing).Error; err != nil {
			return err
		}
		if existing > 0 && !poll.AllowChangeVote {
			return fmt.Errorf("Anda sudah memilih polling ini")
		}
		if existing > 0 {
			if err := tx.Where("poll_id = ? AND voter_id = ?", poll.ID, userID).Delete(&model.CommunityPollVote{}).Error; err != nil {
				return err
			}
			if err := tx.Model(&model.CommunityPollOption{}).Where("poll_id = ?", poll.ID).UpdateColumn("vote_count", gorm.Expr("(SELECT COUNT(*) FROM community_poll_votes WHERE community_poll_votes.option_id = community_poll_options.id)")).Error; err != nil {
				return err
			}
		}
		for _, optionID := range optionIDs {
			var count int64
			if err := tx.Model(&model.CommunityPollOption{}).Where("id = ? AND poll_id = ?", optionID, poll.ID).Count(&count).Error; err != nil {
				return err
			}
			if count == 0 {
				return fmt.Errorf("pilihan polling tidak valid")
			}
			if err := tx.Create(&model.CommunityPollVote{PollID: poll.ID, OptionID: optionID, VoterID: userID}).Error; err != nil {
				return err
			}
			if err := tx.Model(&model.CommunityPollOption{}).Where("id = ?", optionID).UpdateColumn("vote_count", gorm.Expr("vote_count + ?", 1)).Error; err != nil {
				return err
			}
		}
		return nil
	}); err != nil {
		if strings.Contains(err.Error(), "sudah memilih") || strings.Contains(err.Error(), "tidak valid") {
			sendBadRequest(c, err.Error(), nil)
			return
		}
		sendInternalError(c, err)
		return
	}
	sendSuccess(c, gin.H{"post_id": postID, "poll_id": poll.ID, "option_count": strconv.Itoa(len(optionIDs))}, "Community poll vote saved successfully")
}
