package repository

import (
	"gin-template/model"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type ParticipantStatRepository interface {
	GetStats(c *gin.Context, startDate, endDate string) ([]model.ParticipantDailyStat, error)
}

type participantStatRepository struct {
	db *gorm.DB
}

func NewParticipantStatRepository(db *gorm.DB) ParticipantStatRepository {
	return &participantStatRepository{db: db}
}

// --- Helpers ---

// Helper untuk increment map agar code rapi
func incrementMap(m map[string]int64, key string) {
	if key == "" {
		key = "UNKNOWN"
	}
	m[key]++
}

// Logic pengelompokan umur
func calculateAgeGroup(dob time.Time) string {
	if dob.IsZero() {
		return "UNKNOWN"
	}

	// Hitung umur berdasarkan tahun
	now := time.Now()
	age := now.Year() - dob.Year()

	// Koreksi jika belum ulang tahun tahun ini (opsional, biasanya lari pakai tahun saja)
	if now.YearDay() < dob.YearDay() {
		age--
	}

	switch {
	case age < 18:
		return "< 18"
	case age >= 18 && age <= 29:
		return "18-29"
	case age >= 30 && age <= 39:
		return "30-39"
	case age >= 40 && age <= 49:
		return "40-49"
	case age >= 50:
		return "50+"
	default:
		return "UNKNOWN"
	}
}

func (r *participantStatRepository) GetStats(c *gin.Context, startDate, endDate string) ([]model.ParticipantDailyStat, error) {
	var stats []model.ParticipantDailyStat

	// Gunakan .Model() atau .Session() untuk memisahkan scope query
	err := model.GetDB(c).Model(&model.ParticipantDailyStat{}).
		Where("date BETWEEN ? AND ?", startDate, endDate).
		Order("date ASC").
		Find(&stats).Error

	return stats, err
}
