package model

import (
	"fmt"
	"gin-template/common"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Table statistik demografi & kategori (Logistik Friendly)
type ParticipantDailyStat struct {
	Date              string `gorm:"type:date;primaryKey;not null" json:"date"` // YYYY-MM-DD
	TotalParticipants int64  `gorm:"default:0" json:"total_participants"`

	// Breakdown Gender (Male/Female)
	// Contoh: {"Male": 150, "Female": 120}
	GenderBreakdown map[string]int64 `gorm:"serializer:json" json:"gender_breakdown"`

	// Breakdown Kategori Lari (7K/15K/25K/etc)
	// Contoh: {"7K": 100, "15K": 80, "25K": 40}
	CategoryBreakdown map[string]int64 `gorm:"serializer:json" json:"category_breakdown"`

	// Breakdown Rentang Usia (Calculated from DateOfBirth)
	// Contoh: {"<18": 10, "18-29": 50, "30-39": 80, "40+": 20}
	AgeGroupBreakdown map[string]int64 `gorm:"serializer:json" json:"age_group_breakdown"`

	// Breakdown Ukuran Baju (Logistik)
	// Contoh: {"S": 20, "M": 50, "L": 40, "XL": 10}
	JerseySizeBreakdown map[string]int64 `gorm:"serializer:json" json:"jersey_size_breakdown"`

	// Breakdown Asal Provinsi (Opsional - Demografi Wilayah)
	// Contoh: {"Jawa Barat": 200, "DKI Jakarta": 50}
	ProvinceBreakdown map[string]int64 `gorm:"serializer:json" json:"province_breakdown"`
	CountryBreakdown  map[string]int64 `gorm:"serializer:json" json:"country_breakdown"`

	UpdatedAt time.Time `json:"updated_at"`

	TenantID uuid.UUID `json:"tenant_id" gorm:"type:char(36);primaryKey"`
	Tenant   Tenant    `gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
}

func (et *ParticipantDailyStat) BeforeCreate(tx *gorm.DB) (err error) {
	// 1. Cek apakah TenantID sudah diset manual dari Logic (PENTING untuk backfill/report)
	// if et.TenantID != nil {
	// 	return nil
	// }

	// 2. Jika kosong, coba ambil dari Context (Logic HTTP Request biasa)
	if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
		et.TenantID = tenant.ID
		return nil
	}

	// 3. Jika keduanya gagal, baru return error
	return fmt.Errorf("tenant_id is required for security isolation")
}
