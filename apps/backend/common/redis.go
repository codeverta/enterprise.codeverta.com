package common

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/go-redis/redis/v8"
)

var RDB *RedisClient
var RedisEnabled = true

type RedisClient struct {
	*redis.Client
	prefix string
}

type RedisConfig struct {
	DB     int
	Prefix string
}

func getRedisConfig() RedisConfig {
	env := os.Getenv("APP_ENV") // staging atau production

	configs := map[string]RedisConfig{
		"development": {
			DB:     0,
			Prefix: "dev:lms:",
		},
		"staging": {
			DB:     0,
			Prefix: "stg:lms:",
		},
		"production": {
			DB:     1,
			Prefix: "prd:lms:",
		},
	}

	config, exists := configs[env]

	fmt.Println(config.Prefix)
	if !exists {
		// Default ke staging kalau APP_ENV tidak diset
		SysLog("APP_ENV not set, defaulting to staging config")
		return configs["staging"]
	}

	return config
}

// InitRedisClient This function is called after init()
func InitRedisClient() (err error) {
	if os.Getenv("REDIS_CONN_STRING") == "" {
		RedisEnabled = false
		SysLog("REDIS_CONN_STRING not set, Redis is not enabled")
		return nil
	}

	opt, err := redis.ParseURL(os.Getenv("REDIS_CONN_STRING"))
	if err != nil {
		panic(err)
	}

	// Apply config berdasarkan environment
	config := getRedisConfig()
	opt.DB = config.DB

	client := redis.NewClient(opt)

	RDB = &RedisClient{
		Client: client,
		prefix: config.Prefix,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = RDB.Ping(ctx).Result()
	if err == nil {
		RedisEnabled = true
		_ = RDB.ConfigSet(ctx, "stop-writes-on-bgsave-error", "no").Err()
		SysLog(fmt.Sprintf("Redis connected with DB: %d, Prefix: %s", config.DB, config.Prefix))
	} else {
		RedisEnabled = false
		SysLog(fmt.Sprintf("Redis ping failed (%v), fallback to memory cache", err))
	}
	return nil
}

func ParseRedisOption() *redis.Options {
	opt, err := redis.ParseURL(os.Getenv("REDIS_CONN_STRING"))
	if err != nil {
		panic(err)
	}

	// Apply config
	config := getRedisConfig()
	opt.DB = config.DB

	return opt
}

// Helper method untuk mendapatkan key dengan prefix
func (r *RedisClient) GetKey(key string) string {
	return r.prefix + key
}

func GetCache(ctx context.Context, key string, target interface{}) bool {
	if !RedisEnabled {
		return false
	}
	val, err := RDB.Get(ctx, RDB.GetKey(key)).Result()
	if err != nil {
		return false
	}
	json.Unmarshal([]byte(val), target)
	return true
}

func SetPermanentCache(ctx context.Context, key string, data interface{}) {
	if !RedisEnabled {
		return
	}
	val, _ := json.Marshal(data)
	// 0 berarti tidak ada expiration (permanent)
	RDB.Set(ctx, RDB.GetKey(key), val, 0)
}

// Bonus: method tambahan untuk set cache dengan expiration
func SetCache(ctx context.Context, key string, data interface{}, expiration time.Duration) error {
	if !RedisEnabled {
		return nil
	}
	val, err := json.Marshal(data)
	if err != nil {
		return err
	}
	return RDB.Set(ctx, RDB.GetKey(key), val, expiration).Err()
}

// Bonus: method untuk delete cache
func DeleteCache(ctx context.Context, keys ...string) error {
	if !RedisEnabled {
		return nil
	}
	prefixedKeys := make([]string, len(keys))
	for i, key := range keys {
		prefixedKeys[i] = RDB.GetKey(key)
	}
	return RDB.Del(ctx, prefixedKeys...).Err()
}
