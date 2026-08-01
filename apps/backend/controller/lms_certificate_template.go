package controller

import (
	"bytes"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/jpeg"
	"io"
	"math"
	"mime/multipart"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"gin-template/model"
	"gin-template/services"

	"github.com/gin-gonic/gin"
	"github.com/golang/freetype"
	"github.com/golang/freetype/truetype"
	"golang.org/x/image/font"
	"golang.org/x/image/math/fixed"
	"gorm.io/gorm"
)

// ─────────────────────────────────────────────────────────────────────
// Request struct
// ─────────────────────────────────────────────────────────────────────

type UpsertCertificateTemplateRequest struct {
	IsEnabled    *bool    `json:"is_enabled"`
	NameX        *float64 `json:"name_x"`
	NameY        *float64 `json:"name_y"`
	NameFontSize *int     `json:"name_font_size"`
	NameColor    *string  `json:"name_color"`
	CourseTitleX *float64 `json:"course_title_x"`
	CourseTitleY *float64 `json:"course_title_y"`
	DateX        *float64 `json:"date_x"`
	DateY        *float64 `json:"date_y"`
}

// ─────────────────────────────────────────────────────────────────────
// GET /lms/admin/courses/:id/certificate-template
// ─────────────────────────────────────────────────────────────────────

func (ctrl *LMSController) GetCertificateTemplate(c *gin.Context) {
	courseID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}

	db := ctrl.DB.WithContext(c).Session(&gorm.Session{NewDB: true}).Set("skip_tenant_scope", true)

	var tpl model.CertificateTemplate
	err := db.Where("course_id = ?", courseID).First(&tpl).Error
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data": model.CertificateTemplate{
				CourseID:     courseID,
				IsEnabled:    false,
				NameX:        50,
				NameY:        40,
				NameFontSize: 48,
				NameColor:    "#0F172A",
				CourseTitleX: 50,
				CourseTitleY: 55,
				DateX:        50,
				DateY:        70,
			},
		})
		return
	}

	sendSuccess(c, tpl, "Certificate template retrieved")
}

// ─────────────────────────────────────────────────────────────────────
// PUT /lms/admin/courses/:id/certificate-template
// ─────────────────────────────────────────────────────────────────────

func (ctrl *LMSController) UpsertCertificateTemplate(c *gin.Context) {
	courseID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}

	db := lmsDB(c, ctrl.DB).WithContext(c)

	var course model.Course
	if err := db.First(&course, "id = ?", courseID).Error; err != nil {
		sendError(c, http.StatusNotFound, "Course not found", nil)
		return
	}

	var req UpsertCertificateTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		sendBadRequest(c, err.Error(), nil)
		return
	}

	var tpl model.CertificateTemplate
	err := ctrl.DB.WithContext(c).Session(&gorm.Session{}).Set("skip_tenant_scope", true).Unscoped().Where("course_id = ?", courseID).First(&tpl).Error
	isNew := err != nil

	if isNew {
		tpl = model.CertificateTemplate{
			CourseID:     courseID,
			IsEnabled:    false,
			NameX:        50,
			NameY:        40,
			NameFontSize: 48,
			NameColor:    "#0F172A",
			CourseTitleX: 50,
			CourseTitleY: 55,
			DateX:        50,
			DateY:        70,
		}
	}

	if req.IsEnabled != nil {
		tpl.IsEnabled = *req.IsEnabled
	}
	if req.NameX != nil {
		tpl.NameX = *req.NameX
	}
	if req.NameY != nil {
		tpl.NameY = *req.NameY
	}
	if req.NameFontSize != nil {
		tpl.NameFontSize = *req.NameFontSize
	}
	if req.NameColor != nil {
		tpl.NameColor = *req.NameColor
	}
	if req.CourseTitleX != nil {
		tpl.CourseTitleX = *req.CourseTitleX
	}
	if req.CourseTitleY != nil {
		tpl.CourseTitleY = *req.CourseTitleY
	}
	if req.DateX != nil {
		tpl.DateX = *req.DateX
	}
	if req.DateY != nil {
		tpl.DateY = *req.DateY
	}

	if isNew {
		if err := db.Create(&tpl).Error; err != nil {
			sendInternalError(c, err)
			return
		}
	} else {
		if err := db.Save(&tpl).Error; err != nil {
			sendInternalError(c, err)
			return
		}
	}

	sendSuccess(c, tpl, "Certificate template saved")
}

// ─────────────────────────────────────────────────────────────────────
// POST /lms/admin/courses/:id/certificate-template/upload
// ─────────────────────────────────────────────────────────────────────

func (ctrl *LMSController) UploadCertificateTemplate(c *gin.Context) {
	courseID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}

	db := lmsDB(c, ctrl.DB).WithContext(c)

	file, header, err := c.Request.FormFile("template")
	if err != nil {
		sendBadRequest(c, "File template wajib diupload", nil)
		return
	}
	defer file.Close()

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".pdf" {
		sendBadRequest(c, "Format file harus JPG, PNG, atau PDF", nil)
		return
	}

	cosKey, err := processCertificateTemplateUpload(file, header)
	if err != nil {
		sendInternalError(c, err)
		return
	}

	var tpl model.CertificateTemplate
	err = db.Unscoped().Where("course_id = ?", courseID).First(&tpl).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		tpl = model.CertificateTemplate{
			CourseID:     courseID,
			IsEnabled:    true,
			NameX:        50,
			NameY:        40,
			NameFontSize: 48,
			NameColor:    "#0F172A",
			CourseTitleX: 50,
			CourseTitleY: 55,
			DateX:        50,
			DateY:        70,
			TemplateURL:  cosKey,
		}
		if err := db.Create(&tpl).Error; err != nil {
			sendInternalError(c, err)
			return
		}
	} else if err != nil {
		sendInternalError(c, err)
		return
	} else {
		if tpl.TemplateURL != "" && strings.HasPrefix(tpl.TemplateURL, "lms/") {
			_ = services.DeleteImageFromCOS(tpl.TemplateURL)
		}
		tpl.TemplateURL = cosKey
		tpl.IsEnabled = true
		if err := db.Save(&tpl).Error; err != nil {
			sendInternalError(c, err)
			return
		}
	}

	sendSuccess(c, gin.H{"template_url": cosKey}, "Template uploaded")
}

func processCertificateTemplateUpload(file multipart.File, header *multipart.FileHeader) (string, error) {
	ext := strings.ToLower(filepath.Ext(header.Filename))
	if ext != ".pdf" {
		return services.ProcessAndUploadImage(file, header)
	}

	pdfBytes, err := io.ReadAll(file)
	if err != nil {
		return "", fmt.Errorf("gagal membaca file PDF: %w", err)
	}
	imageBytes, err := convertPDFToTemplateImage(pdfBytes)
	if err != nil {
		return "", err
	}
	return services.ProcessAndUploadImageBytes(imageBytes)
}

func convertPDFToTemplateImage(pdfBytes []byte) ([]byte, error) {
	tmpDir, err := os.MkdirTemp("", "certificate-template-*")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(tmpDir)

	pdfPath := filepath.Join(tmpDir, "template.pdf")
	outPrefix := filepath.Join(tmpDir, "template")
	outPath := outPrefix + ".jpg"
	if err := os.WriteFile(pdfPath, pdfBytes, 0600); err != nil {
		return nil, err
	}

	if _, err := exec.LookPath("pdftoppm"); err != nil {
		return nil, fmt.Errorf("PDF template membutuhkan pdftoppm untuk konversi halaman pertama: %w", err)
	}
	cmd := exec.Command("pdftoppm", "-jpeg", "-singlefile", "-r", "200", "-f", "1", "-l", "1", pdfPath, outPrefix)
	if output, err := cmd.CombinedOutput(); err != nil {
		return nil, fmt.Errorf("gagal konversi PDF template: %s: %w", strings.TrimSpace(string(output)), err)
	}
	imageBytes, err := os.ReadFile(outPath)
	if err != nil {
		return nil, fmt.Errorf("hasil konversi PDF tidak ditemukan: %w", err)
	}
	return imageBytes, nil
}

// ─────────────────────────────────────────────────────────────────────
// DELETE /lms/admin/courses/:id/certificate-template
// ─────────────────────────────────────────────────────────────────────

func (ctrl *LMSController) DeleteCertificateTemplate(c *gin.Context) {
	courseID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}

	db := lmsDB(c, ctrl.DB).WithContext(c)

	var tpl model.CertificateTemplate
	if err := db.Unscoped().Where("course_id = ?", courseID).First(&tpl).Error; err != nil {
		sendError(c, http.StatusNotFound, "Template tidak ditemukan", nil)
		return
	}

	if tpl.TemplateURL != "" && strings.HasPrefix(tpl.TemplateURL, "lms/") {
		_ = services.DeleteImageFromCOS(tpl.TemplateURL)
	}

	if err := db.Unscoped().Delete(&tpl).Error; err != nil {
		sendInternalError(c, err)
		return
	}

	sendSuccess(c, nil, "Template deleted")
}

// ─────────────────────────────────────────────────────────────────────
// GET /lms/my-certificates (student list)
// ─────────────────────────────────────────────────────────────────────

func (ctrl *LMSController) ListMyCertificates(c *gin.Context) {
	userID, _, ok := currentLMSUser(c)
	if !ok {
		return
	}

	db := lmsDB(c, ctrl.DB)

	var certs []model.StudentCertificate
	err := db.
		Preload("Course").
		Where("student_id = ?", userID).
		Order("created_at DESC").
		Find(&certs).Error
	if err != nil {
		sendInternalError(c, err)
		return
	}

	sendSuccess(c, certs, "Certificates retrieved")
}

// ─────────────────────────────────────────────────────────────────────
// Generate certificate image using custom template
// ─────────────────────────────────────────────────────────────────────

func generateCertificateWithTemplate(
	tpl model.CertificateTemplate,
	studentName string,
	courseTitle string,
) ([]byte, error) {
	templateSrc := tpl.TemplateURL
	if templateSrc == "" {
		return nil, os.ErrNotExist
	}

	if !strings.HasPrefix(templateSrc, "http") && strings.HasPrefix(templateSrc, "lms/") {
		cdnBase := os.Getenv("COS_CDN_BASE_URL")
		if cdnBase == "" {
			cdnBase = "https://cdn.codeverta.com"
		}
		templateSrc = strings.TrimRight(cdnBase, "/") + "/" + templateSrc
	}

	var srcImg image.Image
	if strings.HasPrefix(templateSrc, "http") {
		resp, err := http.Get(templateSrc)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()

		srcImg, _, err = image.Decode(resp.Body)
		if err != nil {
			return nil, err
		}
	} else {
		f, err := os.Open(templateSrc)
		if err != nil {
			return nil, err
		}
		defer f.Close()
		srcImg, _, err = image.Decode(f)
		if err != nil {
			return nil, err
		}
	}

	bounds := srcImg.Bounds()
	canvas := image.NewRGBA(bounds)
	// 1. Isi background putih solid
	draw.Draw(canvas, bounds, image.White, image.Point{}, draw.Src)
	// 2. Gambar gambar template di atasnya
	draw.Draw(canvas, bounds, srcImg, bounds.Min, draw.Over)

	imgW := bounds.Max.X
	imgH := bounds.Max.Y

	fontBytes, err := os.ReadFile("./assets/fonts/OpenSans-Bold.ttf")
	if err != nil {
		fontBytes, err = os.ReadFile("./assets/fonts/Roboto-Bold.ttf")
		if err != nil {
			return nil, err
		}
	}

	parsedFont, err := freetype.ParseFont(fontBytes)
	if err != nil {
		return nil, err
	}

	nameColor := tplNameColor(tpl.NameColor)
	certTextAtPosition(parsedFont, canvas, bounds, imgW, imgH,
		strings.ToUpper(studentName),
		tpl.NameX, tpl.NameY, float64(tpl.NameFontSize), nameColor)

	courseColor := color.RGBA{R: 30, G: 64, B: 175, A: 255}
	certTextAtPosition(parsedFont, canvas, bounds, imgW, imgH,
		`"`+courseTitle+`"`,
		tpl.CourseTitleX, tpl.CourseTitleY, 36, courseColor)

	dateColor := color.RGBA{R: 71, G: 85, B: 105, A: 255}
	certTextAtPosition(parsedFont, canvas, bounds, imgW, imgH,
		dayjsFormatBridge(time.Now()),
		tpl.DateX, tpl.DateY, 28, dateColor)

	// 3. Pastikan seluruh pixel pada canvas bernilai Opaque (Alpha = 255)
	// Ini mencegah encoder JPEG mengkonversi pixel transparan (A < 255) menjadi lubang putih
	for i := 3; i < len(canvas.Pix); i += 4 {
		canvas.Pix[i] = 255
	}

	var buf bytes.Buffer
	err = jpeg.Encode(&buf, canvas, &jpeg.Options{Quality: 95})
	if err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func certTextAtPosition(
	f *truetype.Font,
	canvas *image.RGBA,
	bounds image.Rectangle,
	imgW, imgH int,
	text string,
	xPercent, yPercent, fontSize float64,
	textColor color.RGBA,
) {
	face := truetype.NewFace(f, &truetype.Options{
		Size:    fontSize,
		DPI:     72,
		Hinting: font.HintingFull,
	})
	defer face.Close()

	textWidth := certMeasureTextWidth(face, text)

	x := int(float64(imgW)*xPercent/100.0) - textWidth/2
	y := int(float64(imgH) * yPercent / 100.0)

	drawer := &font.Drawer{
		Dst:  canvas,
		Src:  image.NewUniform(textColor),
		Face: face,
		Dot:  fixed.Point26_6{X: fixed.I(x), Y: fixed.I(y)},
	}
	drawer.DrawString(text)
}

func tplNameColor(hex string) color.RGBA {
	hex = strings.TrimPrefix(hex, "#")
	if len(hex) != 6 {
		return color.RGBA{R: 15, G: 23, B: 42, A: 255}
	}

	vals := make([]uint8, 3)
	for i := 0; i < 3; i++ {
		hi := hexCharVal(hex[i*2])
		lo := hexCharVal(hex[i*2+1])
		vals[i] = hi*16 + lo
	}
	return color.RGBA{R: vals[0], G: vals[1], B: vals[2], A: 255}
}

func hexCharVal(c byte) uint8 {
	switch {
	case c >= '0' && c <= '9':
		return c - '0'
	case c >= 'a' && c <= 'f':
		return c - 'a' + 10
	case c >= 'A' && c <= 'F':
		return c - 'A' + 10
	}
	return 0
}

func certMeasureTextWidth(face font.Face, text string) int {
	width := fixed.Int26_6(0)
	prevC := rune(-1)
	for _, c := range text {
		if prevC >= 0 {
			width += face.Kern(prevC, c)
		}
		a, ok := face.GlyphAdvance(c)
		if ok {
			width += a
		}
		prevC = c
	}
	return int(math.Ceil(float64(width) / 64.0))
}
