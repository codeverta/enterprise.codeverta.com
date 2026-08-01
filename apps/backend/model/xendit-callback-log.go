package model

import (
	"time"

	"gorm.io/gorm"
)

// XenditCallbackLog menyimpan catatan dari setiap notifikasi webhook Xendit
type XenditCallbackLog struct {
	gorm.Model
	ExternalID string `gorm:"index"`
	InvoiceID  string `gorm:"index"`
	Status     string
	RawPayload string         `gorm:"type:text" json:"raw_payload"`
	CreatedAt  time.Time      `json:"created_at"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
}

func (l *XenditCallbackLog) Create() error {
	return DB.Create(l).Error
}
