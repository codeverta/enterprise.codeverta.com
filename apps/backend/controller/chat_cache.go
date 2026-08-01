package controller

import (
	"sync"
	"time"

	"golang.org/x/sync/singleflight"
)

// lessonCacheTTL adalah durasi cache lesson context sebelum di-refresh dari DB.
// Lesson jarang berubah, jadi 15 menit sangat aman. Naikkan jika konten sangat statis.
const lessonCacheTTL = 15 * time.Minute

type lessonCacheEntry struct {
	contextText string
	builtAt     time.Time
}

var (
	// lessonContextCache menyimpan hasil buildLessonAIContext per lessonID.
	// sync.Map dipilih karena pattern-nya read-heavy (banyak baca, jarang tulis).
	lessonContextCache sync.Map

	// lessonSingleflight mencegah "thundering herd":
	// jika 10 goroutine request lesson yang sama bersamaan,
	// hanya 1 yang akan hit DB + DeepSeek — sisanya tunggu hasilnya.
	lessonSingleflight singleflight.Group
)

// getCachedLessonContext mengambil context dari cache jika masih valid (belum expired).
func getCachedLessonContext(lessonID string) (string, bool) {
	val, ok := lessonContextCache.Load(lessonID)
	if !ok {
		return "", false
	}
	entry := val.(lessonCacheEntry)
	if time.Since(entry.builtAt) > lessonCacheTTL {
		// Expired — hapus entry lama agar tidak menumpuk
		lessonContextCache.Delete(lessonID)
		return "", false
	}
	return entry.contextText, true
}

// setCachedLessonContext menyimpan context ke cache dengan timestamp sekarang.
func setCachedLessonContext(lessonID, contextText string) {
	lessonContextCache.Store(lessonID, lessonCacheEntry{
		contextText: contextText,
		builtAt:     time.Now(),
	})
}

// InvalidateLessonCache menghapus cache untuk lesson tertentu.
// Panggil ini di handler update lesson atau update assets.
func InvalidateLessonCache(lessonID string) {
	lessonContextCache.Delete(lessonID)
	// Forget singleflight key juga agar rebuild tidak terblokir
	lessonSingleflight.Forget(lessonID)
}

// InvalidateAllLessonCache menghapus semua cache lesson.
// Berguna saat bulk update atau deployment.
func InvalidateAllLessonCache() {
	lessonContextCache.Range(func(key, _ any) bool {
		lessonContextCache.Delete(key)
		return true
	})
}
