package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type PaymentMethod struct {
	ID           uuid.UUID      `json:"id" gorm:"type:char(36);primaryKey"`
	Code         string         `gorm:"type:varchar(50);uniqueIndex;not null" json:"code"` // cth: "QRIS", "BNI"
	Name         string         `gorm:"type:varchar(100);not null" json:"name"`            // cth: "QRIS (GoPay, OVO)"
	Type         string         `gorm:"type:varchar(20);not null" json:"type"`             // cth: "QR", "VA"
	Logo         string         `gorm:"type:text" json:"logo"`                             // URL/Path logo
	AdminFee     float64        `gorm:"type:numeric(15,4);default:0" json:"admin_fee"`
	IsPercentage bool           `gorm:"default:false" json:"is_percentage"`               // true jika fee berupa % (cth: QRIS 0.0072)
	HandlingFee  float64        `gorm:"type:numeric(15,2);default:0" json:"handling_fee"` // Biaya layanan aplikasi
	IsActive     bool           `gorm:"default:true" json:"is_active"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

// Hook BeforeCreate untuk memastikan UUID ter-generate otomatis via code (jika DB tidak support default uuid)
func (pm *PaymentMethod) BeforeCreate(tx *gorm.DB) (err error) {
	if pm.ID == uuid.Nil {
		pm.ID = uuid.New()
	}
	return
}
