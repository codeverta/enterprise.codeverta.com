package middleware

import (
	"bytes"
	"encoding/json"
	"fmt"
	"gin-template/model"
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// RecordLoginAttempt persists both successful and failed final authentication requests.
// It never changes the login response if observability storage itself fails.
func RecordLoginAttempt(db *gorm.DB, authMethod string) gin.HandlerFunc {
	return func(c *gin.Context) {
		identifier := loginIdentifier(c)
		c.Next()

		status := c.Writer.Status()
		attempt := model.LoginAttempt{
			UserID: parseContextUserID(c), TenantID: parseTenantHeader(c),
			AttemptedIdentifier: identifier, AuthMethod: authMethod,
			Success:    status >= http.StatusOK && status < http.StatusMultipleChoices,
			HTTPStatus: status, IPAddress: c.ClientIP(), UserAgent: c.Request.UserAgent(),
		}
		if !attempt.Success {
			attempt.FailureReason = fmt.Sprintf("authentication request returned HTTP %d", status)
		}
		_ = db.Session(&gorm.Session{NewDB: true}).
			Set("skip_tenant_scope", true).Set("skip_audit", true).
			Create(&attempt).Error
	}
}

func loginIdentifier(c *gin.Context) string {
	if value := strings.TrimSpace(c.Query("user_id")); value != "" {
		return value
	}
	if c.Request == nil || c.Request.Body == nil {
		return ""
	}
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		return ""
	}
	c.Request.Body = io.NopCloser(bytes.NewReader(body))
	var payload struct {
		Email string `json:"email"`
	}
	if json.Unmarshal(body, &payload) != nil {
		return ""
	}
	return strings.ToLower(strings.TrimSpace(payload.Email))
}

func parseContextUserID(c *gin.Context) *uuid.UUID {
	for _, key := range []string{"userID", "id", "login_attempt_user_id"} {
		value, exists := c.Get(key)
		if !exists {
			continue
		}
		var id uuid.UUID
		switch typed := value.(type) {
		case uuid.UUID:
			id = typed
		case string:
			id, _ = uuid.Parse(typed)
		}
		if id != uuid.Nil {
			return &id
		}
	}
	return nil
}

func parseTenantHeader(c *gin.Context) *uuid.UUID {
	id, err := uuid.Parse(strings.TrimSpace(c.GetHeader("X-Tenant-ID")))
	if err != nil {
		return nil
	}
	return &id
}
