package controller

import (
	"gin-template/model"
	"math"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type LearningScheduleController struct {
	DB     *gorm.DB
	Logger *zap.Logger // Inject Zap Logger
}

// Tambahkan logger ke constructor
func NewLearningScheduleController(db *gorm.DB, logger *zap.Logger) *LearningScheduleController {
	return &LearningScheduleController{
		DB:     db,
		Logger: logger,
	}
}

// GET /api/trainings
func (ctrl *LearningScheduleController) FindAll(c *gin.Context) {
	var events []model.TrainingEvent
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	offset := (page - 1) * limit
	// Ambil Request ID untuk tracing (jika diset oleh middleware)
	reqID := c.GetHeader("X-Tenant-ID")

	db := model.GetDB(c)
	var total int64
	db.Model(&model.TrainingEvent{}).Count(&total)
	if err := db.Limit(limit).Offset(offset).Order("start_time asc").Find(&events).Error; err != nil {
		// Log ERROR: Isu di database
		ctrl.Logger.Error("Gagal mengambil data training",
			zap.String("request_id", reqID),
			zap.Error(err),
		)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Terjadi kesalahan server"})
		return
	}

	c.JSON(200, gin.H{
		"data": events,
		"meta": gin.H{
			"current_page": page,
			"total_pages":  math.Ceil(float64(total) / float64(limit)),
			"total_data":   total,
		},
	})
}

// CreateTrainingInput digunakan khusus untuk validasi request body
type CreateTrainingInput struct {
	Title           string     `json:"title" binding:"required"`
	Description     string     `json:"description"`
	Location        string     `json:"location"`
	StartTime       time.Time  `json:"start_time" binding:"required"`
	EndTime         *time.Time `json:"end_time"` // Tetap pointer agar bisa nil
	RegistrationURL string     `json:"registration_url"`
}

// POST /api/trainings
func (ctrl *LearningScheduleController) Create(c *gin.Context) {
	var input CreateTrainingInput // Gunakan struct input, bukan model DB

	if err := c.ShouldBindJSON(&input); err != nil {
		ctrl.Logger.Warn("Gagal binding input training", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Map dari Input ke Model
	training := model.TrainingEvent{
		Title:           input.Title,
		Description:     input.Description,
		Location:        input.Location,
		StartTime:       input.StartTime,
		EndTime:         input.EndTime, // Jika JSON tidak ada end_time, ini akan tetap nil
		RegistrationURL: input.RegistrationURL,
	}

	db := model.GetDB(c)
	// GORM akan otomatis mengabaikan field nil dan menyimpannya sebagai NULL
	if err := db.WithContext(c).Create(&training).Error; err != nil {
		ctrl.Logger.Error("Gagal menyimpan jadwal training", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan jadwal"})
		return
	}

	c.JSON(http.StatusCreated, training)
}

// DELETE /api/trainings/:id
func (ctrl *LearningScheduleController) Delete(c *gin.Context) {
	id := c.Param("id")
	reqID := c.GetHeader("X-Request-ID")
	db := model.GetDB(c)

	// Parse UUID to ensure it's valid
	eventID, err := uuid.Parse(id)
	if err != nil {
		ctrl.Logger.Warn("Invalid UUID format",
			zap.String("request_id", reqID),
			zap.String("id", id),
			zap.Error(err),
		)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	// Use the correct syntax: specify the column name explicitly
	result := db.WithContext(c).Where("id = ?", eventID).Delete(&model.TrainingEvent{})

	if result.Error != nil {
		ctrl.Logger.Error("Gagal menghapus jadwal",
			zap.String("request_id", reqID),
			zap.String("target_id", id),
			zap.Error(result.Error),
		)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus data"})
		return
	}

	if result.RowsAffected == 0 {
		ctrl.Logger.Warn("Mencoba menghapus data yang tidak ada",
			zap.String("request_id", reqID),
			zap.String("target_id", id),
		)
		c.JSON(http.StatusNotFound, gin.H{"message": "Data tidak ditemukan"})
		return
	}

	ctrl.Logger.Info("Jadwal berhasil dihapus",
		zap.String("request_id", reqID),
		zap.String("deleted_id", id),
	)

	c.JSON(http.StatusOK, gin.H{"message": "Jadwal dihapus"})
}
