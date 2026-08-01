package controller

import (
	"gin-template/model"
	"gin-template/services"
	"log"
	"math"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type TemplateController struct {
	DB  *gorm.DB
	SES *services.SESService
}

func NewTemplateController(db *gorm.DB, ses *services.SESService) *TemplateController {
	return &TemplateController{DB: db, SES: ses}
}

type TemplateInput struct {
	Name        string             `json:"name" binding:"required,min=3,max=100"`
	FromAddress string             `json:"from_email" binding:"omitempty,email"`
	Subject     string             `json:"subject" binding:"required,min=5,max=200"`
	Body        string             `json:"body" binding:"required,min=10"`
	Type        model.TemplateType `json:"type" binding:"required"`
	LogoPath    string             `json:"logo_path" binding:"omitempty,max=255"`
}

// GET /api/templates
func (ctrl *TemplateController) FindAllTemplates(c *gin.Context) {
	// 1. Pagination Params
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	search := c.Query("search")
	status := c.Query("status")

	var templates []model.EmailTemplate
	var total int64

	db := model.GetDB(c)

	// 2. Build Query
	query := db.Model(&model.EmailTemplate{})

	// Filter Search (Name atau Subject) - Menggunakan Parameter Binding (?) untuk mencegah SQL Injection
	if search != "" {
		searchPattern := "%" + search + "%"
		query = query.Where("name LIKE ? OR subject LIKE ?", searchPattern, searchPattern)
	}

	// Filter Status
	if status != "" && status != "ALL" {
		query = query.Where("status = ?", status)
	}

	// 3. Count Total Data (untuk pagination)
	query.Count(&total)

	// 4. Fetch Data dengan Offset
	offset := (page - 1) * limit
	err := query.Limit(limit).Offset(offset).Order("updated_at desc").Find(&templates).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data"})
		return
	}

	hasPending := false
	for _, t := range templates {
		if t.TemplateStatus == "PENDING" {
			hasPending = true
			break
		}
	}

	// 2. Jika ada PENDING, lakukan Batch Request ke Tencent
	if hasPending {
		// Ambil 50 template terbaru dari Tencent (biasanya yg PENDING itu data baru)
		// Ini mengubah N request menjadi HANYA 1 request
		statusMap, err := ctrl.SES.GetTemplateStatusMap(50, 0)

		if err == nil {
			// 3. Loop data lokal dan update dari Map (Memory Lookup = Cepat)
			for i, t := range templates {
				if t.TemplateStatus == "PENDING" {
					// Cek apakah ID Tencent ada di Map yang baru kita ambil?
					if remoteStatus, exists := statusMap[t.TencentTemplateID]; exists {

						// Jika status berubah (misal jadi APPROVED/REJECTED)
						if remoteStatus != "" && remoteStatus != t.TemplateStatus {
							// Update response JSON (agar user langsung lihat yg terbaru)
							templates[i].TemplateStatus = remoteStatus

							// Update Database (Async/Background agar tidak block response)
							go func(id uuid.UUID, newStatus string) {
								ctrl.DB.Model(&model.EmailTemplate{}).
									Where("id = ?", id).
									Update("template_status", newStatus)
							}(t.ID, remoteStatus)
						}
					}
				}
			}
		} else {
			// Log error tapi jangan gagalkan response ke user
			zap.L().Warn("Gagal sync status batch Tencent", zap.Error(err))
		}
	}

	// 5. Return Response Standar
	c.JSON(http.StatusOK, gin.H{
		"data": templates,
		"meta": gin.H{
			"current_page": page,
			"per_page":     limit,
			"total":        total,
			"last_page":    int(math.Ceil(float64(total) / float64(limit))),
		},
	})
}

// POST /api/templates
func (ctrl *TemplateController) CreateTemplate(c *gin.Context) {
	var input TemplateInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validasi gagal: " + err.Error()})
		return
	}

	switch input.Type {
	case model.TypePaymentSuccess, model.TypeRacepackReminder, model.TypeEmailRejection, model.TypePaymentLink:
		// Valid
	default:
		log.Println("Invalid Template Type:", input.Type)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Template Type"})
		return
	}

	// 1. Integrasi: Create di Tencent Cloud dulu
	tencentID, err := ctrl.SES.CreateTemplate(input.Name, input.Body)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal create di Tencent: " + err.Error()})
		return
	}

	// 2. Simpan ke DB Lokal
	template := model.EmailTemplate{
		Type:              input.Type,
		Name:              input.Name,
		Subject:           input.Subject,
		Body:              input.Body,
		FromAddress:       input.FromAddress,
		LogoPath:          input.LogoPath,
		TencentTemplateID: tencentID, // ID dari response Tencent
		TemplateStatus:    "PENDING", // Default status Tencent setelah create/update
	}

	if err := ctrl.DB.WithContext(c).Create(&template).Error; err != nil {
		zap.L().Error("Gagal simpan template ke DB", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal simpan DB"})
		return
	}

	c.JSON(http.StatusCreated, template)
}

// ... import dan struct lainnya ...

// GET /api/templates/:id
func (ctrl *TemplateController) FindOneTemplate(c *gin.Context) {
	id := c.Param("id")
	var template model.EmailTemplate

	// FIX: Gunakan "id = ?" agar GORM tahu kita mencari berdasarkan kolom ID
	if err := ctrl.DB.Where("id = ?", id).First(&template).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Template tidak ditemukan"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Terjadi kesalahan database"})
		}
		return
	}

	c.JSON(http.StatusOK, template)
}

// PUT /api/templates/:id
func (ctrl *TemplateController) UpdateTemplate(c *gin.Context) {
	id := c.Param("id")
	var input TemplateInput
	db := model.GetDB(c)

	if err := c.ShouldBindJSON(&input); err != nil {
		zap.L().Error("Validasi input gagal", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var template model.EmailTemplate
	if err := db.Where("id = ?", id).First(&template).Error; err != nil {
		zap.L().Error("Template tidak ditemukan", zap.String("template_id", id), zap.Error(err))
		c.JSON(http.StatusNotFound, gin.H{"error": "Template tidak ditemukan"})
		return
	}

	// 1. Integrasi: Update di Tencent Cloud
	// Gunakan ID Tencent yang tersimpan di DB
	err := ctrl.SES.UpdateTemplate(template.TencentTemplateID, input.Name, input.Body)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal update Tencent: " + err.Error()})
		return
	}

	// 2. Update DB Lokal
	template.Name = input.Name
	template.Subject = input.Subject
	template.Body = input.Body
	template.FromAddress = input.FromAddress
	template.LogoPath = input.LogoPath
	template.TemplateStatus = "PENDING" // Reset status karena Tencent butuh approval ulang

	if err := db.WithContext(c).Save(&template).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update DB"})
		return
	}

	c.JSON(http.StatusOK, template)
}

// DELETE /api/templates/:id
func (ctrl *TemplateController) DeleteTemplate(c *gin.Context) {
	id := c.Param("id")
	var template model.EmailTemplate
	db := model.GetDB(c)

	// Ambil data dulu untuk dapat Tencent ID
	if err := db.Where("id = ?", id).First(&template).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data tidak ditemukan"})
		return
	}

	// 1. Integrasi: Hapus di Tencent
	if err := ctrl.SES.DeleteTemplate(template.TencentTemplateID); err != nil {
		// Opsional: Lanjut hapus lokal meski Tencent gagal, atau return error
		c.JSON(http.StatusBadGateway, gin.H{"error": "Gagal hapus di Tencent: " + err.Error()})
		return
	}

	// 2. Hapus DB Lokal (Soft Delete)
	db.Delete(&template)
	c.JSON(http.StatusOK, gin.H{"message": "Berhasil dihapus"})
}
