package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type SESCallbackLog struct {
	ID        uuid.UUID `json:"id" gorm:"type:char(36);primaryKey"`
	Event     string    `gorm:"type:varchar(50);not null;index" json:"event"`
	Email     string    `gorm:"type:varchar(255);not null;index" json:"email"`
	Subject   string    `gorm:"type:text" json:"subject"`
	Reason    string    `gorm:"type:text" json:"reason"`
	ClickURL  string    `gorm:"type:text" json:"click_url"`
	MessageID string    `gorm:"type:varchar(255);index" json:"message_id"`
	Timestamp int64     `gorm:"not null" json:"timestamp"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

// TableName overrides the table name
func (SESCallbackLog) TableName() string {
	return "ses_callback_logs"
}

// BeforeCreate hook to generate UUID before creating
func (log *SESCallbackLog) BeforeCreate(tx *gorm.DB) error {
	if log.ID == uuid.Nil {
		log.ID = uuid.New()
	}
	return nil
}
