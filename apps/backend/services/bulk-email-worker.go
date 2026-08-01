package services

import (
	"context"
	"encoding/json"
	"fmt"
	"gin-template/common"
	"gin-template/model"
	"time"

	"golang.org/x/time/rate"
	"gorm.io/gorm"
)

// StartBulkEmailWorker KHUSUS untuk antrian "bulk_email_queue"
// Worker ini berjalan lambat (1 email tiap ~3 menit) untuk mematuhi 500 email/24jam
func StartBulkEmailWorker() {
	if !common.RedisEnabled {
		return
	}

	common.SysLog("Bulk Email Worker started (Mode: Santai 500/day)...")
	ctx := context.Background()

	// Hitung limit: 1 hari / 500 email = 1 email setiap 172.8 detik (~3 menit)
	limitInterval := 24 * time.Hour / 500
	limiter := rate.NewLimiter(rate.Every(limitInterval), 1)

	for {
		// 1. Rate Limiting (Tahan dulu biar gak cepet-cepet)
		// Worker akan 'tidur' disini selama +/- 3 menit sebelum lanjut
		if err := limiter.Wait(ctx); err != nil {
			time.Sleep(10 * time.Second)
			continue
		}

		// 2. Cek Kuota Harian (Hard Limit)
		todayKey := fmt.Sprintf("bulk_quota:%s", time.Now().Format("2006-01-02"))
		currentCount, err := common.RDB.Get(ctx, common.RDB.GetKey(todayKey)).Int()
		if err == nil && currentCount >= 500 {
			common.SysLog("BULK QUOTA HABIS HARI INI. Worker tidur 1 jam.")
			time.Sleep(1 * time.Hour)
			continue
		}

		// 3. Ambil Job dari antrian KHUSUS "bulk_email_queue"
		result, err := common.RDB.BLPop(ctx, 5*time.Second, common.RDB.GetKey("bulk_email_queue")).Result()
		if err != nil {
			continue // Timeout/Kosong, loop lagi
		}

		// --- Proses Parsing & Sending sama seperti worker biasa ---
		var job struct {
			From       string          `json:"from"`
			To         string          `json:"to"`
			Subject    string          `json:"subject"`
			TemplateID uint64          `json:"template_id"`
			Data       json.RawMessage `json:"data"`
		}

		if err := json.Unmarshal([]byte(result[1]), &job); err != nil {
			common.SysError("Failed to unmarshal bulk job")
			continue
		}

		// Gunakan function kirim yang sama
		err = common.SendGenericEmail(job.From, job.To, job.Subject, job.TemplateID, job.Data, nil) // Bulk biasanya tanpa attachment PDF invoice

		if err != nil {
			common.SysError(fmt.Sprintf("Bulk Worker failed to send to %s: %v", job.To, err))
			// Opsional: Push balik ke Redis jika error
		} else {
			// Update Kuota Harian
			common.RDB.Incr(ctx, common.RDB.GetKey(todayKey))
			if err := model.DB.Model(&model.SystemSetting{}).
				UpdateColumn("email_used", gorm.Expr("email_used + ?", 1)).
				Error; err != nil {
				common.SysError("Failed to update DB email_used count")
			}
			common.RDB.Expire(ctx, common.RDB.GetKey(todayKey), 48*time.Hour)
			common.SysLog(fmt.Sprintf("[BULK] Sent to %s. Daily: %d/500", job.To, currentCount+1))
		}
	}
}
