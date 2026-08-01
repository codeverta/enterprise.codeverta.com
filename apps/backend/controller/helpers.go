package controller

import (
	"fmt"
	"gin-template/common"
	"net/http"

	"github.com/gin-gonic/gin"
)

// --- 1. Struktur Error yang Ditingkatkan (Better Error Structure) ---

// APIErrorResponse mendefinisikan struktur standar untuk respons error.
type APIErrorResponse struct {
	Success bool        `json:"success"`         // Selalu false
	Message string      `json:"message"`         // Pesan yang dapat dibaca pengguna
	Error   interface{} `json:"error,omitempty"` // Data error teknis/validasi (opsional)
}

// --- 2. Fungsi Utama Pengiriman Error yang Robust ---

// sendError mengirimkan respons error menggunakan kode status HTTP yang benar.
// Gunakan fungsi spesifik (sendBadRequest, sendInternalError, dsb.) jika memungkinkan.
func sendError(c *gin.Context, httpStatus int, message string, errData interface{}) {
	c.AbortWithStatusJSON(httpStatus, APIErrorResponse{
		Success: false,
		Message: message,
		Error:   errData,
	})
}

// --- 3. Fungsi Spesifik untuk Error Umum ---

// sendInternalError digunakan untuk error server yang tidak terduga (500).
func sendInternalError(c *gin.Context, err error) {
	// Log error lengkap di server untuk debugging
	fmt.Printf("Internal Server Error: %v\n", err)

	// Kirim pesan umum ke client
	sendError(c, http.StatusInternalServerError, "Terjadi kesalahan pada server. Silakan coba lagi.", nil)
}

// sendBadRequest digunakan untuk error validasi atau input tidak valid dari pengguna (400).
func sendBadRequest(c *gin.Context, message string, validationErrors interface{}) {
	common.SysLog(message)
	// Jika ada error validasi, sertakan dalam field 'error'
	if validationErrors != nil {
		sendError(c, http.StatusBadRequest, message, validationErrors)
		return
	}
	sendError(c, http.StatusBadRequest, message, nil)
}

// sendUnauthorized digunakan untuk error autentikasi (401).
func sendUnauthorized(c *gin.Context, message string) {
	sendError(c, http.StatusUnauthorized, message, nil)
}

// --- Response helpers (Tidak Berubah Signifikan) ---

// sendSuccess menggunakan kode 200 OK untuk respons berhasil.
func sendSuccess(c *gin.Context, data interface{}, message string) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": message,
		"data":    data,
	})
}

func sendSuccessNoData(c *gin.Context) {
	sendSuccess(c, nil, "Berhasil berhasil.")
}
