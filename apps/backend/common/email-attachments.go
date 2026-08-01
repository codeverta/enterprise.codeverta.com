package common

import (
	"bytes" // 1. Wajib import embed
	"encoding/base64"
	"fmt"
	"gin-template/assets"
	"html/template"
	"net/http"
	"os"
	"time"

	"github.com/SebastiaanKlippert/go-wkhtmltopdf"
	"go.uber.org/zap"
)

// ---------------------------------------------------------
// BAGIAN 1: Embed File (Harus di luar function)
// Sesuaikan path "../assets/..." dengan struktur folder Anda
// ---------------------------------------------------------

// Helper untuk baca embed file & convert ke Base64
func getLogoBase64(path string) (string, error) {
	// Path di sini harus SAMA PERSIS dengan yg di //go:embed
	fileData, err := assets.Files.ReadFile(path)
	if err != nil {
		return "", err
	}

	mimeType := http.DetectContentType(fileData)
	base64Str := base64.StdEncoding.EncodeToString(fileData)

	return fmt.Sprintf("data:%s;base64,%s", mimeType, base64Str), nil
}

// ---------------------------------------------------------
// BAGIAN 2: Update Function Utama
// ---------------------------------------------------------
func GenerateInvoiceFromHTML(data PaymentSuccessEmailData, logoPath string) ([]byte, error) {
	log := zap.L().With(
		zap.String("order_id", data.OrderID),
		zap.String("func", "GenerateInvoiceFromHTML"),
		zap.String("logo_path", logoPath),
	)

	log.Info("Starting generate invoice")

	// Format input dari database (biasanya standar SQL YYYY-MM-DD HH:MM:SS)
	layoutInput := "2006-01-02 15:04:05"

	// 1. Definisikan lokasi tujuan (WIB)
	locJakarta, _ := time.LoadLocation("Asia/Jakarta")

	// 2. Parse waktu. Karena DB sekarang UTC, kita parse sebagai time.UTC
	// Asumsi: data.PaidAt adalah string mentah dari DB ("2026-02-08 03:41:00")
	t, err := time.ParseInLocation(layoutInput, data.PaidAt, time.UTC)
	if err == nil {
		// 3. Konversi ke Jakarta dan Format ulang agar cantik di Invoice
		// Hasil: "08 Feb 2026 10:41 WIB"
		data.PaidAt = t.In(locJakarta).Format("02 Jan 2006 15:04") + " WIB"
	} else {
		// Jika gagal parse (misal format beda), log warning tapi jangan crash
		// Biarkan data aslinya (fallback)
		SysLog(fmt.Sprintf("Warning: Gagal parse waktu PaidAt (%s): %v", data.PaidAt, err))
	}

	// [BARU] Load Logo dari Embed ke string Base64
	logoStr, err := getLogoBase64(logoPath)
	if err != nil {
		SysLog(fmt.Sprintf("Warning: Gagal load logo embed: %v", err))
		data.LogoImageBase64 = ""
	} else {
		data.LogoImageBase64 = logoStr
	}

	// Tambahkan FuncMap
	funcMap := template.FuncMap{
		"add": func(a, b int) int {
			return a + b
		},
		"trustURL": func(s string) template.URL {
			return template.URL(s)
		},
	}

	// Render Template
	tmpl, err := template.New("invoice.html").Funcs(funcMap).ParseFiles("html/templates/invoice.html")
	if err != nil {
		SysLog(fmt.Sprintf("Template parse error: %v", err))
		return nil, err
	}

	var body bytes.Buffer
	if err := tmpl.Execute(&body, data); err != nil {
		SysLog(fmt.Sprintf("Template execute error: %v", err))
		return nil, err
	}

	// Saya perbaiki bagian ini karena di kode aslimu ada double write setelah close
	fileName := fmt.Sprintf("/tmp/debug_invoice_%v.html", data.OrderID)
	debugFile, err := os.Create(fileName)
	if err != nil {
		SysLog(fmt.Sprintf("Gagal buat debug file: %v", err))
	} else {
		// Tulis sekali saja
		debugFile.Write(body.Bytes())
		debugFile.Close()
		SysLog("DEBUG: File saved to " + fileName)
	}

	SysLog(fmt.Sprintf("HTML rendered, size: %d bytes", body.Len()))

	// Convert HTML ke PDF
	pdfg, err := wkhtmltopdf.NewPDFGenerator()
	if err != nil {
		SysLog(fmt.Sprintf("PDF generator init error: %v", err))
		return nil, err
	}
	pdfg.Cover.EnableLocalFileAccess.Set(true)
	pdfg.AddPage(wkhtmltopdf.NewPageReader(&body))

	pdfg.PageSize.Set(wkhtmltopdf.PageSizeA4)
	pdfg.Dpi.Set(300)

	if err := pdfg.Create(); err != nil {
		SysLog(fmt.Sprintf("PDF create error: %v", err))
		return nil, err
	}

	return pdfg.Bytes(), nil
}
