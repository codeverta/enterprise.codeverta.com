package controller

import (
	"context"
	"gin-template/common"
	"gin-template/model"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestWebSocketRealtimeOnlineStatus(t *testing.T) {
	// Initialize memory DB
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	models := []interface{}{&model.Tenant{}, &model.User{}, &model.Profile{}}
	if err := db.AutoMigrate(models...); err != nil {
		t.Fatalf("migrate models: %v", err)
	}

	tenant := model.Tenant{ID: uuid.New(), Name: "WS Tenant", Domain: "ws.test", IsActive: true}
	_ = db.Create(&tenant).Error

	admin := model.User{ID: uuid.New(), Username: "admin-user", DisplayName: "Admin User", Email: "admin@test.com", Role: 99, Status: common.UserStatusEnabled, TenantID: &tenant.ID}
	_ = db.Create(&admin).Error
	_ = db.Create(&model.Profile{ID: uuid.New(), UserID: admin.ID, FullName: "Admin User", DisplayName: "Admin User", AvatarURL: "https://avatar.url/admin", TenantID: &tenant.ID}).Error

	// Enable/Mock local fallback for tracker (disable Redis temporarily for test stability)
	oldRedisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	defer func() {
		common.RedisEnabled = oldRedisEnabled
	}()

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("db", db)
		c.Set(common.CtxTenantKey, tenant)
		c.Request = c.Request.WithContext(context.WithValue(c.Request.Context(), common.CtxTenantKey, tenant))
		c.Next()
	})

	ctrl := NewWebSocketController(db)
	router.GET("/ws/activity", ctrl.HandleActivity)

	// Create test server to accept WS connections
	server := httptest.NewServer(router)
	defer server.Close()

	// Generate tokens
	token, _, err := generateTokens(&admin)
	if err != nil {
		t.Fatalf("failed to generate token: %v", err)
	}

	// Dial WS server
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws/activity?token=" + token + "&tenant_id=" + tenant.ID.String()
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("dial ws error: %v", err)
	}
	defer conn.Close()

	// Read initial online users broadcast
	var msg struct {
		Type  string          `json:"type"`
		Users []OnlineUserOut `json:"users"`
	}

	err = conn.ReadJSON(&msg)
	if err != nil {
		t.Fatalf("read json error: %v", err)
	}

	if msg.Type != "online_users" {
		t.Errorf("expected type 'online_users', got %s", msg.Type)
	}

	// Since we connected the admin, they should appear in the online list
	found := false
	for _, u := range msg.Users {
		if u.ID == admin.ID.String() {
			found = true
			if u.DisplayName != "Admin User" {
				t.Errorf("expected DisplayName 'Admin User', got %s", u.DisplayName)
			}
			if u.AvatarURL != "https://avatar.url/admin" {
				t.Errorf("expected AvatarURL, got %s", u.AvatarURL)
			}
		}
	}

	if !found {
		t.Errorf("expected admin to be in online list, users list: %v", msg.Users)
	}
}
