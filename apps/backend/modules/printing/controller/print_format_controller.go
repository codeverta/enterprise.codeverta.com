package controller

import (
	"errors"
	"net/http"
	"strings"

	"gin-template/model"
	printingmodel "gin-template/modules/printing/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type PrintFormatController struct{}

func NewPrintFormatController() *PrintFormatController { return &PrintFormatController{} }

func printingDB(ctx *gin.Context) *gorm.DB {
	return model.GetDB(ctx).WithContext(ctx.Request.Context())
}

func printingTenant(ctx *gin.Context) string { return strings.TrimSpace(ctx.GetString("tenant_id")) }

func (ctrl *PrintFormatController) List(ctx *gin.Context) {
	var rows []printingmodel.PrintFormat
	query := printingDB(ctx).Where("tenant_id = ?", printingTenant(ctx))
	if search := strings.TrimSpace(ctx.Query("q")); search != "" {
		like := "%" + search + "%"
		query = query.Where("name LIKE ? OR doc_type LIKE ? OR report LIKE ? OR module LIKE ?", like, like, like, like)
	}
	if err := query.Order("updated_at desc").Find(&rows).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil Print Format"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": rows})
}

func (ctrl *PrintFormatController) Get(ctx *gin.Context) {
	var row printingmodel.PrintFormat
	identifier := ctx.Param("id")
	if err := printingDB(ctx).Where("tenant_id = ? AND (id = ? OR name = ?)", printingTenant(ctx), identifier, identifier).First(&row).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "Print Format tidak ditemukan"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil Print Format"})
		return
	}
	ctx.JSON(http.StatusOK, row)
}

func normalizePrintFormat(input *printingmodel.PrintFormat) {
	input.Name = strings.TrimSpace(input.Name)
	input.PrintFormatFor = strings.TrimSpace(input.PrintFormatFor)
	if input.PrintFormatFor != "Report" {
		input.PrintFormatFor = "DocType"
	}
	input.DocType = strings.TrimSpace(input.DocType)
	input.Report = strings.TrimSpace(input.Report)
	input.Module = strings.TrimSpace(input.Module)
	input.DefaultPrintLanguage = strings.TrimSpace(input.DefaultPrintLanguage)
	if input.DefaultPrintLanguage == "" {
		input.DefaultPrintLanguage = "id"
	}
	if input.PDFGenerator != "wkhtmltopdf" {
		input.PDFGenerator = "chrome"
	}
	if input.PageNumber == "" {
		input.PageNumber = "Hide"
	}
}

func validatePrintFormat(input printingmodel.PrintFormat) string {
	if input.Name == "" {
		return "Name wajib diisi"
	}
	if input.PrintFormatFor == "DocType" && input.DocType == "" {
		return "DocType wajib dipilih"
	}
	if input.PrintFormatFor == "Report" && input.Report == "" {
		return "Report wajib dipilih"
	}
	return ""
}

func (ctrl *PrintFormatController) Create(ctx *gin.Context) {
	var input printingmodel.PrintFormat
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Data Print Format tidak valid"})
		return
	}
	normalizePrintFormat(&input)
	if message := validatePrintFormat(input); message != "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": message})
		return
	}
	input.ID = "pf-" + uuid.NewString()[:12]
	input.TenantID = printingTenant(ctx)
	if err := printingDB(ctx).Create(&input).Error; err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "unique") || strings.Contains(strings.ToLower(err.Error()), "duplicate") {
			ctx.JSON(http.StatusConflict, gin.H{"error": "Name Print Format sudah digunakan"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat Print Format"})
		return
	}
	ctx.JSON(http.StatusCreated, input)
}

func (ctrl *PrintFormatController) Update(ctx *gin.Context) {
	var existing printingmodel.PrintFormat
	db, tenant := printingDB(ctx), printingTenant(ctx)
	if err := db.Where("tenant_id = ? AND id = ?", tenant, ctx.Param("id")).First(&existing).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Print Format tidak ditemukan"})
		return
	}
	var input printingmodel.PrintFormat
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Data Print Format tidak valid"})
		return
	}
	normalizePrintFormat(&input)
	if message := validatePrintFormat(input); message != "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": message})
		return
	}
	input.ID, input.TenantID, input.CreatedAt = existing.ID, existing.TenantID, existing.CreatedAt
	if err := db.Save(&input).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui Print Format"})
		return
	}
	ctx.JSON(http.StatusOK, input)
}

func (ctrl *PrintFormatController) Delete(ctx *gin.Context) {
	result := printingDB(ctx).Where("tenant_id = ? AND id = ?", printingTenant(ctx), ctx.Param("id")).Delete(&printingmodel.PrintFormat{})
	if result.Error != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus Print Format"})
		return
	}
	if result.RowsAffected == 0 {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Print Format tidak ditemukan"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "Print Format terhapus"})
}
