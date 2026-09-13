package controller

import (
	"encoding/json"
	"gin-template/model"
	"math"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AuditController struct{ DB *gorm.DB }

func NewAuditController(db *gorm.DB) *AuditController { return &AuditController{DB: db} }

type auditActorResponse struct {
	ID          uuid.UUID `json:"id"`
	Email       string    `json:"email"`
	DisplayName string    `json:"display_name"`
	Role        int       `json:"role"`
}

type AuditLogResponse struct {
	ID        uuid.UUID           `json:"id"`
	CreatedAt string              `json:"created_at"`
	Action    string              `json:"action"`
	TableName string              `json:"table_name"`
	RecordID  string              `json:"record_id"`
	Changes   json.RawMessage     `json:"changes"`
	IPAddress string              `json:"ip_address"`
	UserAgent string              `json:"user_agent"`
	User      *auditActorResponse `json:"user"`
}

func (ac *AuditController) GetLogs(c *gin.Context) {
	ac.getLogs(c, false)
}

// GetSystemLogs returns cross-tenant history and is mounted behind RootAuth.
func (ac *AuditController) GetSystemLogs(c *gin.Context) {
	ac.getLogs(c, true)
}

func (ac *AuditController) getLogs(c *gin.Context, systemWide bool) {
	page := positiveInt(c.DefaultQuery("page", "1"), 1)
	limit := positiveInt(c.DefaultQuery("limit", "10"), 10)
	if limit > 100 {
		limit = 100
	}

	db := model.GetDB(c).WithContext(c)
	if systemWide {
		db = ac.DB.WithContext(c).Session(&gorm.Session{NewDB: true}).Set("skip_tenant_scope", true)
	}
	query := db.Model(&model.AuditLog{})
	if action := strings.ToUpper(strings.TrimSpace(c.Query("action"))); action != "" && action != "ALL" {
		query = query.Where("action = ?", action)
	}
	if tableName := strings.TrimSpace(c.Query("table_name")); tableName != "" {
		query = query.Where("table_name = ?", tableName)
	}
	if recordID := strings.TrimSpace(c.Query("record_id")); recordID != "" {
		query = query.Where("record_id = ?", recordID)
	}
	if search := strings.TrimSpace(c.Query("search")); search != "" {
		pattern := "%" + search + "%"
		query = query.Where("table_name LIKE ? OR action LIKE ? OR record_id LIKE ? OR ip_address LIKE ?", pattern, pattern, pattern, pattern)
	}

	var total int64
	if err := query.Session(&gorm.Session{}).Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	var logs []model.AuditLog
	if err := query.Limit(limit).Offset((page - 1) * limit).Order("created_at DESC").Find(&logs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ids := make([]uuid.UUID, 0)
	seen := make(map[uuid.UUID]struct{})
	for _, log := range logs {
		if log.UserID != uuid.Nil {
			if _, exists := seen[log.UserID]; !exists {
				seen[log.UserID] = struct{}{}
				ids = append(ids, log.UserID)
			}
		}
	}
	actors := make(map[uuid.UUID]auditActorResponse)
	if len(ids) > 0 {
		cleanDB := db.Session(&gorm.Session{NewDB: true})
		if systemWide {
			cleanDB = cleanDB.Set("skip_tenant_scope", true)
		} else {
			// If not system-wide, inherit tenant scope from original query
			if tID, exists := db.Get("tenant_id"); exists {
				cleanDB = cleanDB.Set("tenant_id", tID)
			}
		}
		var users []model.User
		if err := cleanDB.Model(&model.User{}).Select("id", "email", "display_name", "role").Where("id IN ?", ids).Find(&users).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		for _, user := range users {
			actors[user.ID] = auditActorResponse{ID: user.ID, Email: user.Email, DisplayName: user.DisplayName, Role: user.Role}
		}
	}

	response := make([]AuditLogResponse, 0, len(logs))
	for _, log := range logs {
		var actor *auditActorResponse
		if value, exists := actors[log.UserID]; exists {
			copyValue := value
			actor = &copyValue
		}
		changes := json.RawMessage(log.Changes)
		if !json.Valid(changes) {
			changes = json.RawMessage(`{}`)
		}
		response = append(response, AuditLogResponse{
			ID: log.ID, CreatedAt: log.CreatedAt.Format("2006-01-02 15:04:05"), Action: log.Action,
			TableName: log.TableName, RecordID: log.RecordID, Changes: changes,
			IPAddress: log.IPAddress, UserAgent: log.UserAgent, User: actor,
		})
	}

	c.JSON(http.StatusOK, gin.H{"data": response, "meta": gin.H{
		"page": page, "current_page": page, "limit": limit, "total_data": total, "total": total,
		"total_page": int(math.Ceil(float64(total) / float64(limit))), "last_page": int(math.Ceil(float64(total) / float64(limit))),
	}})
}

type loginAttemptResponse struct {
	model.LoginAttempt
	User *auditActorResponse `json:"user"`
}

// GetLoginAttempts exposes successful and failed authentication attempts across tenants.
func (ac *AuditController) GetLoginAttempts(c *gin.Context) {
	page := positiveInt(c.DefaultQuery("page", "1"), 1)
	limit := positiveInt(c.DefaultQuery("limit", "10"), 10)
	if limit > 100 {
		limit = 100
	}
	db := ac.DB.WithContext(c).Session(&gorm.Session{NewDB: true}).Set("skip_tenant_scope", true)
	query := db.Model(&model.LoginAttempt{})
	if method := strings.TrimSpace(c.Query("auth_method")); method != "" && method != "ALL" {
		query = query.Where("auth_method = ?", method)
	}
	if outcome := strings.ToLower(strings.TrimSpace(c.Query("outcome"))); outcome == "success" || outcome == "failed" {
		query = query.Where("success = ?", outcome == "success")
	}
	if search := strings.TrimSpace(c.Query("search")); search != "" {
		pattern := "%" + search + "%"
		query = query.Where("attempted_identifier LIKE ? OR ip_address LIKE ? OR auth_method LIKE ?", pattern, pattern, pattern)
	}
	var total int64
	if err := query.Session(&gorm.Session{}).Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	var attempts []model.LoginAttempt
	if err := query.Order("created_at DESC").Limit(limit).Offset((page - 1) * limit).Find(&attempts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ids := make([]uuid.UUID, 0)
	for _, attempt := range attempts {
		if attempt.UserID != nil {
			ids = append(ids, *attempt.UserID)
		}
	}
	actors := make(map[uuid.UUID]auditActorResponse)
	if len(ids) > 0 {
		var users []model.User
		if err := db.Select("id", "email", "display_name", "role").Where("id IN ?", ids).Find(&users).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		for _, user := range users {
			actors[user.ID] = auditActorResponse{ID: user.ID, Email: user.Email, DisplayName: user.DisplayName, Role: user.Role}
		}
	}
	response := make([]loginAttemptResponse, 0, len(attempts))
	for _, attempt := range attempts {
		var actor *auditActorResponse
		if attempt.UserID != nil {
			if value, ok := actors[*attempt.UserID]; ok {
				copyValue := value
				actor = &copyValue
			}
		}
		response = append(response, loginAttemptResponse{LoginAttempt: attempt, User: actor})
	}
	c.JSON(http.StatusOK, gin.H{"data": response, "meta": gin.H{
		"page": page, "current_page": page, "limit": limit, "total_data": total, "total": total,
		"total_page": int(math.Ceil(float64(total) / float64(limit))), "last_page": int(math.Ceil(float64(total) / float64(limit))),
	}})
}

func positiveInt(raw string, fallback int) int {
	value, err := strconv.Atoi(raw)
	if err != nil || value < 1 {
		return fallback
	}
	return value
}
