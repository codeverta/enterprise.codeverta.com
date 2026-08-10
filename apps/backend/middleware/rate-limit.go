package middleware

import (
	"fmt"
	"gin-template/common"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
)

var inMemoryRateLimiter common.InMemoryRateLimiter

// Lua Script untuk Atomicity
// Logika:
// 1. Hapus request yang sudah kadaluarsa (di luar window duration)
// 2. Hitung jumlah request yang valid saat ini
// 3. Jika count < limit, tambahkan request baru (timestamp)
// 4. Return count dan allowed (1 atau 0)
var slidingWindowScript = redis.NewScript(`
	local key = KEYS[1]
	local now = tonumber(ARGV[1])
	local window = tonumber(ARGV[2])
	local limit = tonumber(ARGV[3])
	local expiration = tonumber(ARGV[4])

	local clearBefore = now - window
	redis.call('ZREMRANGEBYSCORE', key, 0, clearBefore)

	local count = redis.call('ZCARD', key)

	if count < limit then
		redis.call('ZADD', key, now, now)
		redis.call('EXPIRE', key, expiration)
		return {1, count + 1}
	end

	return {0, count}
`)

func redisRateLimiter(c *gin.Context, maxRequestNum int, durationSeconds int64, mark string) {
	ctx := c.Request.Context()
	rdb := common.RDB // Pastikan common.RDB tipenya adalah *redis.Client dari v8

	key := fmt.Sprintf("rate_limit:%s:%s", mark, c.ClientIP())
	now := time.Now().UTC().UnixMicro()
	windowMicro := durationSeconds * 1_000_000
	keyExpirationSeconds := durationSeconds + 60

	keys := []string{key}
	args := []interface{}{
		now,
		windowMicro,
		maxRequestNum,
		keyExpirationSeconds,
	}

	// Menjalankan script di v8
	rawResult, err := slidingWindowScript.Run(ctx, rdb, keys, args...).Result()
	if err != nil {
		fmt.Printf("SECURITY ALERT: Redis Rate Limiter Error (%v), falling back to memory rate limiter\n", err)
		inMemoryRateLimiter.Init(common.RateLimitKeyExpirationDuration)
		memoryRateLimiter(c, maxRequestNum, durationSeconds, mark)
		return
	}

	// Konversi hasil di v8
	result := rawResult.([]interface{})
	allowed := result[0].(int64) == 1
	currentCount := result[1].(int64)

	c.Header("X-RateLimit-Limit", strconv.Itoa(maxRequestNum))
	c.Header("X-RateLimit-Remaining", strconv.FormatInt(int64(maxRequestNum)-currentCount, 10))

	if !allowed {
		c.Header("Retry-After", strconv.FormatInt(durationSeconds, 10))
		c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
			"code":    429,
			"message": "Too Many Requests. Security threshold reached.",
		})
		return
	}
}

func memoryRateLimiter(c *gin.Context, maxRequestNum int, duration int64, mark string) {
	// Pastikan key memory juga unik
	key := mark + ":" + c.ClientIP()

	// Asumsi: inMemoryRateLimiter kamu sudah thread-safe (pakai sync.Mutex/RWMutex di dalamnya)
	if !inMemoryRateLimiter.Request(key, maxRequestNum, duration) {
		c.Header("Retry-After", strconv.FormatInt(duration, 10))
		c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
			"code":    429,
			"message": "Too Many Requests (Memory).",
		})
		return
	}
}

func rateLimitFactory(maxRequestNum int, duration int64, mark string) func(c *gin.Context) {
	// Pre-init jika diperlukan, tapi sebaiknya logic init ada di main.go
	if !common.RedisEnabled {
		inMemoryRateLimiter.Init(common.RateLimitKeyExpirationDuration)
	}

	return func(c *gin.Context) {
		if common.RedisEnabled {
			redisRateLimiter(c, maxRequestNum, duration, mark)
		} else {
			memoryRateLimiter(c, maxRequestNum, duration, mark)
		}
	}
}

func GlobalWebRateLimit() func(c *gin.Context) {
	return rateLimitFactory(common.GlobalWebRateLimitNum, common.GlobalWebRateLimitDuration, "GW")
}

func GlobalAPIRateLimit() func(c *gin.Context) {
	return rateLimitFactory(common.GlobalApiRateLimitNum, common.GlobalApiRateLimitDuration, "GA")
}

func CriticalRateLimit() func(c *gin.Context) {
	return rateLimitFactory(common.CriticalRateLimitNum, common.CriticalRateLimitDuration, "CT")
}

func DownloadRateLimit() func(c *gin.Context) {
	return rateLimitFactory(common.DownloadRateLimitNum, common.DownloadRateLimitDuration, "DW")
}

func UploadRateLimit() func(c *gin.Context) {
	return rateLimitFactory(common.UploadRateLimitNum, common.UploadRateLimitDuration, "UP")
}
