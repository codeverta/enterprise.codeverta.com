package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Notification struct {
	ID        uuid.UUID      `gorm:"type:char(36);primaryKey" json:"id"`
	UserID    uuid.UUID      `gorm:"type:char(36);index;not null" json:"user_id"`
	Title     string         `gorm:"type:varchar(255);not null" json:"title"`
	Content   string         `gorm:"type:text;not null" json:"content"`
	Type      string         `gorm:"type:varchar(50);default:'info'" json:"type"` // e.g. "info", "success", "warning", "error"
	IsRead    bool           `gorm:"default:false;index" json:"is_read"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
	TenantID  *uuid.UUID     `gorm:"type:char(36);index" json:"tenant_id,omitempty"`
}

func (n *Notification) BeforeCreate(tx *gorm.DB) (err error) {
	if n.ID == uuid.Nil {
		n.ID = uuid.New()
	}
	return nil
}

var OnNotificationCreated func(notif *Notification)

func PushNotification(db *gorm.DB, userID uuid.UUID, tenantID *uuid.UUID, title, content, notifType string) error {
	notif := Notification{
		UserID:   userID,
		TenantID: tenantID,
		Title:    title,
		Content:  content,
		Type:     notifType,
		IsRead:   false,
	}
	err := db.Create(&notif).Error
	if err == nil && OnNotificationCreated != nil {
		OnNotificationCreated(&notif)
	}
	return err
}
