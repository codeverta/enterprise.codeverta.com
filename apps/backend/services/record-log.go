package services

import (
	"encoding/json"
	"gin-template/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func RecordLog(db *gorm.DB, c *gin.Context, action string, tableName string, recordID string, data interface{}) {
	// 1. Default to Nil (Guest/System)
	var actorID uuid.UUID = uuid.Nil

	// 2. Try to get UserID, but DON'T panic if missing
	if val, exists := c.Get("userID"); exists {
		switch v := val.(type) {
		case uuid.UUID:
			actorID = v
		case string:
			if parsed, err := uuid.Parse(v); err == nil {
				actorID = parsed
			}
		}
	}

	// 3. Convert Data to JSON String for "Changes" column
	var changes string = "{}"
	if data != nil {
		if jsonData, err := json.Marshal(data); err == nil {
			changes = string(jsonData)
		}
	}

	// 4. Create Log
	audit := model.AuditLog{
		UserID:    actorID,
		Action:    action,
		TableName: tableName,
		RecordID:  recordID,
		Changes:   changes,
		IPAddress: c.ClientIP(),
		UserAgent: c.Request.UserAgent(),
	}

	// 5. Save (Run in background or blocking, depending on preference)
	db.WithContext(c).Create(&audit)
}
