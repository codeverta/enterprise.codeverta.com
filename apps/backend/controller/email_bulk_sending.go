package controller

import (
	"encoding/json"
	"fmt"
	"gin-template/common"
	"gin-template/model"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// Struct Controller
type BulkEmailController struct {
	DB *gorm.DB
}

// Constructor (Dependency Injection)
func NewBulkEmailController(db *gorm.DB) *BulkEmailController {
	return &BulkEmailController{DB: db}
}

// Request Payload
type BulkEmailRequest struct {
	TemplateUUID string `json:"template_id" binding:"required"` // ID dari tabel local email_templates
}

// Handler
func (ctrl *BulkEmailController) SendBulkEmail(c *gin.Context) {
	// 1. Validasi Input
	var req BulkEmailRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 2. Cek Apakah Template Ada di DB Local
	var template model.EmailTemplate
	if err := ctrl.DB.Where("id = ?", req.TemplateUUID).First(&template).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Email template not found"})
		return
	}

	// 3. Ambil Data Peserta (UPDATED: Dari tabel participants)
	// Struct temporary untuk menampung hasil query
	type TargetParticipant struct {
		Name       string
		Email      string
		UniqueCode string
	}

	var participants []TargetParticipant

	// Query optimize: Select dari participants where is_paid = true
	// Kita ambil 'unique_code' agar di email bisa ditampilkan kode pesertanya (misal: 07-XXXX)
	result := ctrl.DB.Model(&model.User{}).
		Select("display_name as name, email").
		Where("email != ?", ""). // Safety: Email tidak kosong
		Scan(&participants)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch participants"})
		return
	}

	if len(participants) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No paid participants found to email"})
		return
	}

	// 4. Proses Antrian ke Redis (Background Process)
	go func(users []TargetParticipant, tpl model.EmailTemplate) {
		ctx := common.RDB.Context()

		successCount := 0
		for _, u := range users {
			// Siapkan Data untuk Template Tencent
			// Kita mapping UniqueCode ke field OrderID di struct EmailData
			// (agar template yang pakai variable {{.OrderID}} tetap jalan menampilkan UniqueCode)
			rpcLocationName := "Taman Kopi Guntang"
			rpcAddress := "Bandung, Jawa Barat"
			rpcDate := "17-18 April 2026"
			rpcTime := "To Be Announce"

			emailData := common.EmailData{
				Name:    u.Name,
				Email:   u.Email,
				OrderID: u.UniqueCode,

				LocationName:    rpcLocationName,
				LocationAddress: rpcAddress,
				RPCDate:         rpcDate,
				RPCTime:         rpcTime,
			}

			// Bungkus Job
			job := map[string]interface{}{
				"to":          u.Email,
				"subject":     tpl.Subject,
				"template_id": tpl.TencentTemplateID,
				"data":        emailData,
			}

			payload, _ := json.Marshal(job)

			// PENTING: Push ke "bulk_email_queue" (Queue Prioritas Rendah/Santai)
			err := common.RDB.LPush(ctx, common.RDB.GetKey("bulk_email_queue"), payload).Err()
			if err != nil {
				common.SysError(fmt.Sprintf("Failed to queue bulk email for %s: %v", u.Email, err))
			} else {
				successCount++
			}
		}

		common.SysLog(fmt.Sprintf("Bulk Email Job: Queued %d/%d emails using template '%s'", successCount, len(users), tpl.Name))
	}(participants, template)

	// 5. Response Sukses
	c.JSON(http.StatusOK, gin.H{
		"message":      "Bulk email process started in background",
		"target_count": len(participants),
		"note":         "Emails are queued in 'bulk_email_queue' for participants with is_paid=true",
	})
}
