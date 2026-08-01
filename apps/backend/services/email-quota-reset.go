package services

import (
	"fmt"
	"gin-template/common"
	"gin-template/model"
	"time"

	"github.com/robfig/cron/v3"
	"gorm.io/gorm"
)

func StartDailyResetWorker() {
	// 1. Load Timezone Jakarta
	// Pastikan di server/docker sudah terinstall tzdata
	loc, err := time.LoadLocation("Asia/Jakarta")
	if err != nil {
		// Fallback ke Local jika gagal, tapi sebaiknya panic agar sadar config salah
		common.SysError(fmt.Sprintf("Gagal load timezone Jakarta: %v", err))
		return
	}

	// 2. Inisialisasi Cron dengan Timezone spesifik
	// Ini PENTING agar "0 0" dibaca sebagai jam 00:00 WIB, bukan UTC
	c := cron.New(cron.WithLocation(loc))

	_, err = c.AddFunc("0 0 * * *", func() {
		common.SysLog("Running Daily Quota Reset Job (WIB)...")
		ResetEmailQuota(loc) // Pass lokasi ke fungsi logic
	})

	if err != nil {
		common.SysError(fmt.Sprintf("Failed to schedule cron: %v", err))
		return
	}

	c.Start()
	common.SysLog("Daily Reset Scheduler started (Next run at 00:00 WIB)")
}

// Terima parameter *time.Location agar konsisten
func ResetEmailQuota(loc *time.Location) {
	// --- Bagian 1: Reset DB (Sama seperti sebelumnya) ---
	err := model.DB.Set("skip_tenant_scope", true).Session(&gorm.Session{AllowGlobalUpdate: true}).
		Model(&model.SystemSetting{}).
		Select("email_used").
		Update("email_used", 0).Error

	if err != nil {
		common.SysError(fmt.Sprintf("Failed to reset DB email_used: %v", err))
		return
	}
	common.SysLog("Database email_used reset to 0.")
}
