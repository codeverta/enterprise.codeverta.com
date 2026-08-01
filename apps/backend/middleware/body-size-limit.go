package middleware

import (
	"fmt"
	"gin-template/common"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// MaxSizeMiddleware membatasi ukuran request body dalam bytes
func MaxSizeMiddleware(maxBytes int64) gin.HandlerFunc {
	return MaxSizeMiddlewareExcept(maxBytes)
}

func MaxSizeMiddlewareExcept(maxBytes int64, exceptPathPrefixes ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		for _, prefix := range exceptPathPrefixes {
			if strings.HasPrefix(c.Request.URL.Path, prefix) {
				c.Next()
				return
			}
		}

		// 1. Cek Content-Length header (opsional, tapi cepat)
		if c.Request.ContentLength > maxBytes {
			common.SysError(fmt.Sprintf("[SECURITY_ALERT] Payload too large: %d bytes from IP: %s",
				c.Request.ContentLength,
				c.ClientIP()),
			)
			c.AbortWithStatusJSON(http.StatusRequestEntityTooLarge, gin.H{
				"error": "Payload too large",
				"limit": maxBytes,
			})
			return
		}

		// 2. Gunakan http.MaxBytesReader untuk proteksi saat pembacaan body
		// Ini mencegah serangan jika client menipu Content-Length header
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBytes)

		c.Next()
	}
}
