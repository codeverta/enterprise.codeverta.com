package controller

import (
	"context"
	"encoding/json"
	"gin-template/common"
	"gin-template/model"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupCommunityControllerTest(t *testing.T) (*gin.Engine, *gorm.DB, model.Tenant, model.User, model.User) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	models := []interface{}{&model.Tenant{}, &model.User{}, &model.CoursePurchase{}, &model.Notification{}, &model.Wallet{}, &model.WalletLedger{}}
	models = append(models, model.LMSModels()...)
	if err := db.AutoMigrate(models...); err != nil {
		t.Fatalf("migrate models: %v", err)
	}
	tenant := model.Tenant{ID: uuid.New(), Name: "Community Tenant", Domain: "community.test", IsActive: true}
	if err := db.Create(&tenant).Error; err != nil {
		t.Fatalf("create tenant: %v", err)
	}
	ctx := context.WithValue(context.Background(), common.CtxTenantKey, tenant)
	author := model.User{ID: uuid.New(), Username: "student-author", Email: "author@test.com", Role: model.RoleStudent, Status: common.UserStatusEnabled}
	other := model.User{ID: uuid.New(), Username: "student-other", Email: "other@test.com", Role: model.RoleStudent, Status: common.UserStatusEnabled}
	admin := model.User{ID: uuid.New(), Username: "admin-user", Email: "admin@test.com", Role: 100, Status: common.UserStatusEnabled}
	if err := db.WithContext(ctx).Create(&author).Error; err != nil {
		t.Fatalf("create author: %v", err)
	}
	if err := db.WithContext(ctx).Create(&other).Error; err != nil {
		t.Fatalf("create other: %v", err)
	}
	if err := db.WithContext(ctx).Create(&admin).Error; err != nil {
		t.Fatalf("create admin: %v", err)
	}

	ctrl := NewLMSController(db)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		user := author
		if c.GetHeader("X-Test-User") == "other" {
			user = other
		} else if c.GetHeader("X-Test-User") == "admin" {
			user = admin
		}
		c.Set("db", db.WithContext(ctx))
		c.Set(common.CtxTenantKey, tenant)
		c.Set("id", user.ID.String())
		c.Set("userID", user.ID)
		c.Set("username", user.Username)
		c.Set("role", user.Role)
		c.Request = c.Request.WithContext(ctx)
		c.Next()
	})
	router.GET("/community/categories", ctrl.ListCommunityCategories)
	router.GET("/community/posts", ctrl.ListCommunityPosts)
	router.POST("/community/posts", ctrl.CreateCommunityPost)
	router.GET("/community/posts/:id", ctrl.GetCommunityPost)
	router.PUT("/community/posts/:id", ctrl.UpdateCommunityPost)
	router.DELETE("/community/posts/:id", ctrl.DeleteCommunityPost)
	router.POST("/community/posts/:id/publish", ctrl.PublishCommunityPost)
	router.GET("/community/posts/:id/comments", ctrl.ListCommunityComments)
	router.POST("/community/posts/:id/comments", ctrl.CreateCommunityComment)
	router.POST("/community/posts/:id/like", ctrl.ReactCommunityPost)
	router.DELETE("/community/posts/:id/like", ctrl.DeleteCommunityPostReaction)
	router.POST("/community/posts/:id/bookmark", ctrl.BookmarkCommunityPost)
	router.POST("/community/posts/:id/follow", ctrl.FollowCommunityPost)
	router.POST("/community/posts/:id/report", ctrl.ReportCommunityPost)
	router.POST("/community/comments/:id/accept", ctrl.AcceptCommunityComment)
	router.GET("/admin/community/reports", ctrl.ListCommunityReports)
	router.PUT("/admin/community/reports/:id/review", ctrl.ReviewCommunityReport)
	return router, db, tenant, author, other
}

func decodeCommunityResponse(t *testing.T, body []byte) map[string]interface{} {
	t.Helper()
	var payload map[string]interface{}
	if err := json.Unmarshal(body, &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	return payload
}

func httptestNewJSONRequest(method, path, body string) *http.Request {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	return req
}

func performRequest(router http.Handler, req *http.Request) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	return rec
}

func TestCommunityCorePostLifecycleAndPermissions(t *testing.T) {
	router, _, _, _, _ := setupCommunityControllerTest(t)

	rec := performJSON(router, http.MethodPost, "/community/posts", `{
		"type":"question",
		"title":"Bagaimana cara belajar efektif?",
		"content":"Saya ingin diskusi tentang strategi belajar.",
		"status":"published",
		"visibility":"tenant",
		"tag_slugs":["Belajar", "#Tips"]
	}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("create post status = %d, body = %s", rec.Code, rec.Body.String())
	}
	payload := decodeCommunityResponse(t, rec.Body.Bytes())
	data := payload["data"].(map[string]interface{})
	postID := data["id"].(string)
	if data["status"] != string(model.CommunityPostStatusPublished) {
		t.Fatalf("expected published status, got %+v", data["status"])
	}

	rec = performJSON(router, http.MethodGet, "/community/posts?search=belajar&type=question", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("list posts status = %d, body = %s", rec.Code, rec.Body.String())
	}
	payload = decodeCommunityResponse(t, rec.Body.Bytes())
	items := payload["data"].([]interface{})
	if len(items) != 1 {
		t.Fatalf("expected one listed post, got %d", len(items))
	}

	updateBody := `{"type":"question","title":"Update strategi belajar","content":"Konten sudah diperbarui","status":"published","visibility":"tenant"}`
	rec = performJSON(router, http.MethodPut, "/community/posts/"+postID, updateBody)
	if rec.Code != http.StatusOK {
		t.Fatalf("update own post status = %d, body = %s", rec.Code, rec.Body.String())
	}
	payload = decodeCommunityResponse(t, rec.Body.Bytes())
	if payload["data"].(map[string]interface{})["title"] != "Update strategi belajar" {
		t.Fatalf("expected updated title, got %+v", payload["data"])
	}

	rec = performJSON(router, http.MethodDelete, "/community/posts/"+postID, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("delete own post status = %d, body = %s", rec.Code, rec.Body.String())
	}
}

func TestCommunityRejectsMutatingOtherUsersPost(t *testing.T) {
	router, _, _, _, _ := setupCommunityControllerTest(t)
	rec := performJSON(router, http.MethodPost, "/community/posts", `{"type":"discussion","title":"Halo","content":"Konten awal","status":"published","visibility":"tenant"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("create post status = %d, body = %s", rec.Code, rec.Body.String())
	}
	payload := decodeCommunityResponse(t, rec.Body.Bytes())
	postID := payload["data"].(map[string]interface{})["id"].(string)

	requestBody := `{"type":"discussion","title":"Ambil alih","content":"Tidak boleh","status":"published","visibility":"tenant"}`
	req := httptestNewJSONRequest(http.MethodPut, "/community/posts/"+postID, requestBody)
	req.Header.Set("X-Test-User", "other")
	rec = performRequest(router, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected forbidden update, got %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestCommunityCommentAcceptedAnswerAndSocialCounters(t *testing.T) {
	router, db, _, _, _ := setupCommunityControllerTest(t)
	rec := performJSON(router, http.MethodPost, "/community/posts", `{
		"type":"question",
		"title":"Kenapa tugas saya belum dinilai?",
		"content":"Mohon bantuan menjelaskan alur penilaian.",
		"status":"published",
		"visibility":"tenant"
	}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("create post status = %d, body = %s", rec.Code, rec.Body.String())
	}
	postID := decodeCommunityResponse(t, rec.Body.Bytes())["data"].(map[string]interface{})["id"].(string)

	req := httptestNewJSONRequest(http.MethodPost, "/community/posts/"+postID+"/comments", `{"content":"Biasanya mentor menilai dari halaman assignment."}`)
	req.Header.Set("X-Test-User", "other")
	rec = performRequest(router, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("create comment status = %d, body = %s", rec.Code, rec.Body.String())
	}
	commentID := decodeCommunityResponse(t, rec.Body.Bytes())["data"].(map[string]interface{})["id"].(string)

	rec = performJSON(router, http.MethodPost, "/community/comments/"+commentID+"/accept", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("accept answer status = %d, body = %s", rec.Code, rec.Body.String())
	}

	for i := 0; i < 2; i++ {
		req = httptestNewJSONRequest(http.MethodPost, "/community/posts/"+postID+"/like", `{"reaction_type":"like"}`)
		req.Header.Set("X-Test-User", "other")
		rec = performRequest(router, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("like post status = %d, body = %s", rec.Code, rec.Body.String())
		}
	}
	req = httptestNewJSONRequest(http.MethodPost, "/community/posts/"+postID+"/bookmark", "")
	req.Header.Set("X-Test-User", "other")
	rec = performRequest(router, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("bookmark status = %d, body = %s", rec.Code, rec.Body.String())
	}
	req = httptestNewJSONRequest(http.MethodPost, "/community/posts/"+postID+"/follow", "")
	req.Header.Set("X-Test-User", "other")
	rec = performRequest(router, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("follow status = %d, body = %s", rec.Code, rec.Body.String())
	}

	var post model.CommunityPost
	if err := db.First(&post, "id = ?", postID).Error; err != nil {
		t.Fatalf("load post: %v", err)
	}
	if post.Status != model.CommunityPostStatusSolved || post.AcceptedCommentID == nil {
		t.Fatalf("expected solved post with accepted answer, got status=%s accepted=%v", post.Status, post.AcceptedCommentID)
	}
	if post.ReactionCount != 1 {
		t.Fatalf("duplicate reaction should not increase counter twice, got %d", post.ReactionCount)
	}
	if post.BookmarkCount != 1 || post.FollowCount != 1 || post.CommentCount != 1 {
		t.Fatalf("unexpected counters bookmark=%d follow=%d comment=%d", post.BookmarkCount, post.FollowCount, post.CommentCount)
	}
}

func TestCommunityReportReviewModeration(t *testing.T) {
	router, db, _, _, _ := setupCommunityControllerTest(t)
	rec := performJSON(router, http.MethodPost, "/community/posts", `{
		"type":"discussion",
		"title":"Spam test",
		"content":"Konten yang akan dilaporkan.",
		"status":"published",
		"visibility":"tenant"
	}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("create post status = %d, body = %s", rec.Code, rec.Body.String())
	}
	postID := decodeCommunityResponse(t, rec.Body.Bytes())["data"].(map[string]interface{})["id"].(string)

	req := httptestNewJSONRequest(http.MethodPost, "/community/posts/"+postID+"/report", `{"reason":"spam","description":"duplikat promosi"}`)
	req.Header.Set("X-Test-User", "other")
	rec = performRequest(router, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("report status = %d, body = %s", rec.Code, rec.Body.String())
	}
	reportID := decodeCommunityResponse(t, rec.Body.Bytes())["data"].(map[string]interface{})["id"].(string)

	req = httptestNewJSONRequest(http.MethodPut, "/admin/community/reports/"+reportID+"/review", `{"status":"approved","action":"hide","resolution":"konten spam"}`)
	req.Header.Set("X-Test-User", "admin")
	rec = performRequest(router, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("review status = %d, body = %s", rec.Code, rec.Body.String())
	}

	var post model.CommunityPost
	if err := db.First(&post, "id = ?", postID).Error; err != nil {
		t.Fatalf("load post: %v", err)
	}
	if post.Status != model.CommunityPostStatusHidden {
		t.Fatalf("expected hidden post after approved report, got %s", post.Status)
	}
	var logs int64
	db.Model(&model.CommunityModerationLog{}).Where("target_id = ?", post.ID).Count(&logs)
	if logs != 1 {
		t.Fatalf("expected one moderation log, got %d", logs)
	}
}
