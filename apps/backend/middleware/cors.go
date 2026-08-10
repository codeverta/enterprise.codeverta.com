package middleware

import (
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func CORS() gin.HandlerFunc {
	return cors.New(cors.Config{
		AllowOrigins: []string{
			"http://localhost:5173",
			"http://localhost:5174",
			"http://localhost:5175",
			"http://localhost:8080",
			"http://tauri.localhost",
			"https://tauri.localhost",
			"https://app.kitafuture.com",
			"https://kitafuture.com",
			"https://guru2digit.id",
			"https://app.guru2digit.id",
		},

		// FUNGSI DINAMIS: Izinkan vercel.app dan codeverta.com beserta subdomainnya
		AllowOriginFunc: func(origin string) bool {
			// macOS/Linux Tauri builds use this custom-protocol origin.
			if origin == "tauri://localhost" {
				return true
			}

			// 1. Izinkan domain vercel.app
			if strings.HasSuffix(origin, ".vercel.app") {
				return true
			}

			// 2. Izinkan tepat "https://codeverta.com" atau "http://codeverta.com"
			if origin == "https://codeverta.com" || origin == "http://codeverta.com" {
				return true
			}

			// 3. Izinkan semua subdomain dari codeverta.com (e.g., https://app.codeverta.com)
			if strings.HasSuffix(origin, ".codeverta.com") {
				return true
			}

			return false
		},

		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Length", "Content-Type", "Authorization", "Accept", "User-Agent", "Referer", "X-Tenant-ID"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	})
}
