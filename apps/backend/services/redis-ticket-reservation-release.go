package services

import (
	"context"
	"fmt"
	"gin-template/common"
	"log"
	"time"

	"github.com/go-redis/redis/v8"
	"gorm.io/gorm"
)

// Struct ringkas untuk unmarshal snapshot
type snapshotItem struct {
	PriceID string `json:"price_id"`
	Count   int    `json:"count"`
}

// UPDATE: Tambahkan field promo agar bisa dibaca dari JSON snapshot
type snapshotData struct {
	Items        []snapshotItem `json:"items"`
	PromoApplied bool           `json:"promo_applied"`
	PromoCode    string         `json:"promo_code"`
}

// ==========================================
// 1. WORKER: DB POLLING (Fallback / Main)
// ==========================================

func StartCleanupWorker(db *gorm.DB) {
	systemDB := db.Session(&gorm.Session{}).Set("skip_tenant_scope", true)
	ticker := time.NewTicker(2 * time.Minute)
	go func() {
		for range ticker.C {
			processExpiredBatch(systemDB)
		}
	}()
	log.Println("✅ [Worker] Batch Reservation Cleanup Started (Interval: 2m)")
}

func processExpiredBatch(db *gorm.DB) {
	log.Println("[Worker] Ticket reservation cleanup skipped; subscriptions do not reserve ticket quota")
}

// ==========================================
// 2. WORKER: REDIS (Real-time ish)
// ==========================================

func StartOrderReservationCleanupWorker(db *gorm.DB) {
	if !common.RedisEnabled {
		log.Println("⚠️ Redis disabled, falling back to DB polling only...")
		StartCleanupWorker(db)
		return
	}

	ticker := time.NewTicker(5 * time.Second)
	go func() {
		for range ticker.C {
			processRedisExpired(db)
		}
	}()
	log.Println("✅ [Redis Worker] Started reservation expiration monitor...")
}

func processRedisExpired(db *gorm.DB) {
	ctx := context.Background()
	key := "reservation:expiry"
	now := float64(time.Now().UTC().Unix())

	// Ambil ID yang score-nya <= waktu sekarang
	opt := &redis.ZRangeBy{
		Min: "-inf",
		Max: fmt.Sprintf("%f", now),
	}

	expiredIDs, err := common.RDB.ZRangeByScore(ctx, common.RDB.GetKey(key), opt).Result()
	if err != nil {
		log.Printf("❌ [Redis Worker] Failed to fetch ZRANGE: %v", err)
		return
	}

	if len(expiredIDs) == 0 {
		return
	}

	log.Printf("🧹 [Redis Worker] Processing %d expired items from Redis", len(expiredIDs))

	// Panggil logic terpusat
	restoreQuotaFromIDs(db, expiredIDs)

	// Hapus dari Redis setelah diproses DB
	if len(expiredIDs) > 0 {
		members := make([]interface{}, len(expiredIDs))
		for i, v := range expiredIDs {
			members[i] = v
		}
		common.RDB.ZRem(ctx, common.RDB.GetKey(key), members...).Err()
	}
}

// ==========================================
// 3. CORE LOGIC: RESTORE QUOTA (Tiket & Promo)
// ==========================================

func restoreQuotaFromIDs(db *gorm.DB, ids []string) {
	log.Printf("[Worker] Skipped restoring %d legacy ticket reservations", len(ids))
}
