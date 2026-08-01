package controller

import (
	"context"
	"encoding/json"
	"fmt"
	"gin-template/common"
	"gin-template/middleware"
	"gin-template/model"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for dynamic tenant subdomains
	},
}

// Global Online Tracker
type AdminConnectionInfo struct {
	UserID   string
	TenantID string
}

// Global Online Tracker
type OnlineTracker struct {
	mu           sync.RWMutex
	conns        map[string]map[*websocket.Conn]bool     // userID -> active WS connections
	adminConns   map[*websocket.Conn]AdminConnectionInfo // admin connection -> info
	localUsers   map[string]int64                        // userID -> last active Unix timestamp (fallback when Redis disabled)
	persistedAt  map[string]int64                        // userID -> last DB heartbeat write timestamp
	db           *gorm.DB
	pubsubCtx    context.Context
	pubsubCancel context.CancelFunc
}

var tracker *OnlineTracker
var trackerOnce sync.Once

func GetOnlineTracker(db *gorm.DB) *OnlineTracker {
	trackerOnce.Do(func() {
		ctx, cancel := context.WithCancel(context.Background())
		tracker = &OnlineTracker{
			conns:        make(map[string]map[*websocket.Conn]bool),
			adminConns:   make(map[*websocket.Conn]AdminConnectionInfo),
			localUsers:   make(map[string]int64),
			persistedAt:  make(map[string]int64),
			db:           db,
			pubsubCtx:    ctx,
			pubsubCancel: cancel,
		}
		// Start local pruning loop
		go tracker.startLocalPruningLoop()
		// Start Redis PubSub subscriber if enabled
		if common.RedisEnabled && common.RDB != nil {
			go tracker.startRedisPubSubListener()
		}
	})
	if db != nil && tracker.db == nil {
		tracker.db = db
	}
	return tracker
}

type WebSocketController struct {
	DB      *gorm.DB
	Tracker *OnlineTracker
}

func NewWebSocketController(db *gorm.DB) *WebSocketController {
	return &WebSocketController{
		DB:      db,
		Tracker: GetOnlineTracker(db),
	}
}

// HandleActivity handles client WebSocket connection to mark online and keep-alive
func (ctrl *WebSocketController) HandleActivity(c *gin.Context) {
	log := zap.L().With(zap.String("controller", "WebSocketController"), zap.String("function", "HandleActivity"))

	tokenStr := c.Query("token")
	if tokenStr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Unauthorized: Token parameter required"})
		return
	}

	claims := &middleware.Claims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
		return []byte(common.JWTSecret), nil
	})
	if err != nil || !token.Valid {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Unauthorized: Invalid token"})
		return
	}

	userID, err := uuid.Parse(claims.UserId)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Unauthorized: Invalid userID subject"})
		return
	}

	// Upgrade HTTP connection to WebSocket
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Error("Failed to upgrade websocket", zap.Error(err))
		return
	}

	tenantObj, _ := c.Get(common.CtxTenantKey)
	tenant, _ := tenantObj.(model.Tenant)

	ctrl.Tracker.RegisterConnection(userID.String(), claims.Role, conn, tenant)

	// Keep alive & read loop
	go func() {
		defer func() {
			ctrl.Tracker.UnregisterConnection(userID.String(), claims.Role, conn, tenant)
			_ = conn.Close()
		}()

		// Set connection limits and pong handler
		conn.SetReadLimit(512)
		_ = conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		conn.SetPongHandler(func(string) error {
			_ = conn.SetReadDeadline(time.Now().Add(60 * time.Second))
			return nil
		})

		// Send initial ping
		go func() {
			ticker := time.NewTicker(20 * time.Second)
			defer ticker.Stop()
			for range ticker.C {
				ctrl.Tracker.UpdateHeartbeat(userID.String(), tenant)
				if err := conn.WriteControl(websocket.PingMessage, []byte{}, time.Now().Add(5*time.Second)); err != nil {
					return
				}
			}
		}()

		// Loop to read incoming messages (to keep connection alive or parse heartbeats)
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				break
			}
		}
	}()
}

// RegisterConnection adds a connection to the tracker
func (t *OnlineTracker) RegisterConnection(userID string, role int, conn *websocket.Conn, tenant model.Tenant) {
	t.mu.Lock()
	if t.conns[userID] == nil {
		t.conns[userID] = make(map[*websocket.Conn]bool)
	}
	t.conns[userID][conn] = true

	// If admin role, track as active admin connection to send pushes to
	if role >= 99 {
		t.adminConns[conn] = AdminConnectionInfo{
			UserID:   userID,
			TenantID: tenant.ID.String(),
		}
	}
	t.mu.Unlock()

	t.UpdateHeartbeat(userID, tenant)
	t.triggerUpdateBroadcast(tenant)
}

// UnregisterConnection removes a connection from the tracker
func (t *OnlineTracker) UnregisterConnection(userID string, role int, conn *websocket.Conn, tenant model.Tenant) {
	t.mu.Lock()
	if t.conns[userID] != nil {
		delete(t.conns[userID], conn)
		if len(t.conns[userID]) == 0 {
			delete(t.conns, userID)
		}
	}
	if role >= 99 {
		delete(t.adminConns, conn)
	}
	t.mu.Unlock()

	// If no connections left for this user, remove them from active online status
	t.mu.RLock()
	connsLeft := len(t.conns[userID])
	t.mu.RUnlock()

	zap.L().Debug("Unregistering connection", zap.String("userID", userID), zap.Int("role", role), zap.Int("connsLeft", connsLeft))

	if connsLeft == 0 {
		if common.RedisEnabled && common.RDB != nil {
			ctx := context.Background()
			rKey := common.RDB.GetKey(fmt.Sprintf("online_users:%s", tenant.ID.String()))
			_ = common.RDB.ZRem(ctx, rKey, userID).Err()
		} else {
			t.mu.Lock()
			delete(t.localUsers, userID)
			t.mu.Unlock()
		}
		t.triggerUpdateBroadcast(tenant)
	}
}

// UpdateHeartbeat marks/renews user activity timestamp
func (t *OnlineTracker) UpdateHeartbeat(userID string, tenant model.Tenant) {
	now := time.Now().Unix()
	if common.RedisEnabled && common.RDB != nil {
		ctx := context.Background()
		rKey := common.RDB.GetKey(fmt.Sprintf("online_users:%s", tenant.ID.String()))
		err := common.RDB.ZAdd(ctx, rKey, &redis.Z{
			Score:  float64(now),
			Member: userID,
		}).Err()
		if err != nil {
			zap.L().Error("Redis ZAdd error", zap.Error(err))
		}
	} else {
		t.mu.Lock()
		t.localUsers[userID] = now
		t.mu.Unlock()
	}
	t.persistLastActive(userID, tenant, now)
}

func (t *OnlineTracker) persistLastActive(userID string, tenant model.Tenant, unixSeconds int64) {
	if t.db == nil || userID == "" {
		return
	}
	t.mu.Lock()
	if unixSeconds-t.persistedAt[userID] < 60 {
		t.mu.Unlock()
		return
	}
	t.persistedAt[userID] = unixSeconds
	t.mu.Unlock()

	parsedUserID, err := uuid.Parse(userID)
	if err != nil {
		return
	}
	lastActiveAt := time.Unix(unixSeconds, 0)
	query := t.db.Session(&gorm.Session{}).Set("skip_tenant_scope", true).Model(&model.User{}).Where("id = ?", parsedUserID)
	if tenant.ID != uuid.Nil {
		query = query.Where("tenant_id = ?", tenant.ID)
	}
	if err := query.Update("last_active_at", lastActiveAt).Error; err != nil {
		zap.L().Warn("Failed to persist user last_active_at", zap.Error(err), zap.String("user_id", userID))
	}
}

// startLocalPruningLoop prunes offline users periodically when Redis is disabled
func (t *OnlineTracker) startLocalPruningLoop() {
	ticker := time.NewTicker(15 * time.Second)
	for range ticker.C {
		if !common.RedisEnabled {
			now := time.Now().Unix()
			t.mu.Lock()
			changed := false
			for userID, lastActive := range t.localUsers {
				// Offline if no heartbeat in 45 seconds and no active WS connections locally
				if now-lastActive > 45 && len(t.conns[userID]) == 0 {
					delete(t.localUsers, userID)
					changed = true
				}
			}
			t.mu.Unlock()

			if changed {
				// For local-only fallback, we trigger local broadcast across all active tenants
				t.broadcastOnlineUsersLocal()
			}
		}
	}
}

// startRedisPubSubListener listens to Redis PubSub updates and broadcasts to local admins
func (t *OnlineTracker) startRedisPubSubListener() {
	channel := common.RDB.GetKey("online_users_pubsub")
	zap.L().Info("Starting Redis PubSub Listener", zap.String("channel", channel))
	pubsub := common.RDB.Subscribe(t.pubsubCtx, channel)
	defer pubsub.Close()

	ch := pubsub.Channel()
	for msg := range ch {
		// Payload holds the tenant ID
		tenantID := msg.Payload
		zap.L().Debug("Received PubSub message", zap.String("tenantID", tenantID))
		if tenantID != "" {
			t.broadcastOnlineUsersForTenant(tenantID)
		}
	}
}

// triggerUpdateBroadcast signals to publish update
func (t *OnlineTracker) triggerUpdateBroadcast(tenant model.Tenant) {
	zap.L().Debug("Triggering update broadcast", zap.String("tenantID", tenant.ID.String()))
	if common.RedisEnabled && common.RDB != nil {
		ctx := context.Background()
		channel := common.RDB.GetKey("online_users_pubsub")
		err := common.RDB.Publish(ctx, channel, tenant.ID.String()).Err()
		if err != nil {
			zap.L().Error("Redis Publish error", zap.Error(err))
		} else {
			zap.L().Debug("Redis Publish success", zap.String("channel", channel), zap.String("tenantID", tenant.ID.String()))
		}
	} else {
		t.broadcastOnlineUsersLocal()
	}
}

type OnlineUserOut struct {
	ID          string `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	Email       string `json:"email"`
	Role        int    `json:"role"`
	AvatarURL   string `json:"avatar_url"`
	LastActive  int64  `json:"last_active"`
}

// broadcastOnlineUsersLocal broadcasts update locally (fallback mode)
func (t *OnlineTracker) broadcastOnlineUsersLocal() {
	// Group admins by tenant ID
	t.mu.RLock()
	adminsByTenant := make(map[string][]*websocket.Conn)
	for conn, info := range t.adminConns {
		adminsByTenant[info.TenantID] = append(adminsByTenant[info.TenantID], conn)
	}
	t.mu.RUnlock()

	zap.L().Debug("Broadcasting online users locally", zap.Int("activeAdmins", len(adminsByTenant)))

	if len(adminsByTenant) == 0 {
		return
	}

	// Fetch all local active users
	t.mu.RLock()
	var userIDs []string
	now := time.Now().Unix()
	userScores := make(map[string]int64)
	for userID, lastActive := range t.localUsers {
		if now-lastActive <= 45 || len(t.conns[userID]) > 0 {
			userIDs = append(userIDs, userID)
			userScores[userID] = lastActive
		}
	}
	t.mu.RUnlock()

	if len(userIDs) == 0 {
		for _, conns := range adminsByTenant {
			t.broadcastToConns(conns, []OnlineUserOut{})
		}
		return
	}

	for tenantID, conns := range adminsByTenant {
		if len(conns) == 0 {
			continue
		}

		var users []model.User
		// Query users, GORM scopes by tenant ID automatically if it's set in Session
		if err := t.db.Session(&gorm.Session{}).Set("tenant_id", tenantID).Preload("Profile").Where("id IN ?", userIDs).Find(&users).Error; err != nil {
			continue
		}

		out := make([]OnlineUserOut, len(users))
		for i, u := range users {
			avatar := ""
			if u.Profile != nil {
				avatar = u.Profile.AvatarURL
			}
			out[i] = OnlineUserOut{
				ID:          u.ID.String(),
				Username:    u.Username,
				DisplayName: u.DisplayName,
				Email:       u.Email,
				Role:        u.Role,
				AvatarURL:   avatar,
				LastActive:  userScores[u.ID.String()],
			}
		}

		t.broadcastToConns(conns, out)
	}
}

// broadcastOnlineUsersForTenant fetches online list for a specific tenant from Redis and pushes to local admins
func (t *OnlineTracker) broadcastOnlineUsersForTenant(tenantID string) {
	t.mu.RLock()
	// Filter local admin connections belonging to this tenant
	var targetConns []*websocket.Conn
	for conn, info := range t.adminConns {
		if info.TenantID == tenantID {
			targetConns = append(targetConns, conn)
		}
	}
	t.mu.RUnlock()

	zap.L().Debug("Broadcasting online users for tenant", zap.String("tenantID", tenantID), zap.Int("targetAdmins", len(targetConns)))

	if len(targetConns) == 0 {
		return
	}

	ctx := context.Background()
	rKey := common.RDB.GetKey(fmt.Sprintf("online_users:%s", tenantID))

	// Prune users inactive for more than 45 seconds
	now := time.Now().Unix()
	_ = common.RDB.ZRemRangeByScore(ctx, rKey, "-inf", fmt.Sprintf("%d", now-45)).Err()

	// Get active users with scores
	zRange, err := common.RDB.ZRangeWithScores(ctx, rKey, 0, -1).Result()
	if err != nil {
		zap.L().Error("Redis ZRange error", zap.Error(err))
		return
	}

	if len(zRange) == 0 {
		t.broadcastToConns(targetConns, []OnlineUserOut{})
		return
	}

	userIDs := make([]string, len(zRange))
	userScores := make(map[string]int64)
	for i, z := range zRange {
		uID := z.Member.(string)
		userIDs[i] = uID
		userScores[uID] = int64(z.Score)
	}

	// Fetch user details from DB
	var users []model.User
	if err := t.db.Session(&gorm.Session{}).Set("tenant_id", tenantID).Preload("Profile").Where("id IN ?", userIDs).Find(&users).Error; err != nil {
		zap.L().Error("GORM Fetch users error", zap.Error(err))
		return
	}

	out := make([]OnlineUserOut, len(users))
	for i, u := range users {
		avatar := ""
		if u.Profile != nil {
			avatar = u.Profile.AvatarURL
		}
		out[i] = OnlineUserOut{
			ID:          u.ID.String(),
			Username:    u.Username,
			DisplayName: u.DisplayName,
			Email:       u.Email,
			Role:        u.Role,
			AvatarURL:   avatar,
			LastActive:  userScores[u.ID.String()],
		}
	}

	t.broadcastToConns(targetConns, out)
}

func (t *OnlineTracker) broadcastToConns(conns []*websocket.Conn, users []OnlineUserOut) {
	payload, err := json.Marshal(gin.H{
		"type":  "online_users",
		"users": users,
	})
	if err != nil {
		return
	}

	for _, conn := range conns {
		_ = conn.WriteMessage(websocket.TextMessage, payload)
	}
}

func (t *OnlineTracker) GetOnlineUserIDs(tenantID string) []string {
	if common.RedisEnabled && common.RDB != nil {
		ctx := context.Background()
		rKey := common.RDB.GetKey(fmt.Sprintf("online_users:%s", tenantID))

		// Prune users inactive for more than 45 seconds
		now := time.Now().Unix()
		_ = common.RDB.ZRemRangeByScore(ctx, rKey, "-inf", fmt.Sprintf("%d", now-45)).Err()

		// Get all active users
		zRange, err := common.RDB.ZRange(ctx, rKey, 0, -1).Result()
		if err != nil {
			return []string{}
		}
		return zRange
	}

	// Fallback local memory
	t.mu.RLock()
	defer t.mu.RUnlock()
	var userIDs []string
	now := time.Now().Unix()
	for userID, lastActive := range t.localUsers {
		if now-lastActive <= 45 || len(t.conns[userID]) > 0 {
			userIDs = append(userIDs, userID)
		}
	}
	return userIDs
}

func (t *OnlineTracker) SendNotification(notif *model.Notification) {
	t.mu.RLock()
	defer t.mu.RUnlock()

	userConns := t.conns[notif.UserID.String()]
	if len(userConns) == 0 {
		return
	}

	payload, err := json.Marshal(gin.H{
		"type":         "notification",
		"notification": notif,
	})
	if err != nil {
		return
	}

	for conn := range userConns {
		_ = conn.WriteMessage(websocket.TextMessage, payload)
	}
}

func init() {
	model.OnNotificationCreated = func(notif *model.Notification) {
		tracker := GetOnlineTracker(nil)
		tracker.SendNotification(notif)
	}
}
