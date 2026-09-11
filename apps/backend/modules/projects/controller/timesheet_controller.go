package controller

import (
	"errors"
	"fmt"
	"math"
	"net/http"
	"strings"
	"time"

	"gin-template/model"
	projectsmodel "gin-template/modules/projects/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type TimesheetController struct{}

func NewTimesheetController() *TimesheetController {
	return &TimesheetController{}
}

func generateTimesheetNumber(db *gorm.DB, tenantID string) string {
	year := time.Now().Format("2006")
	prefix := "TS-" + year + "-"

	var count int64
	db.Model(&projectsmodel.Timesheet{}).
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id LIKE ?", tenantID, prefix+"%").
		Count(&count)
	return fmt.Sprintf("%s%05d", prefix, count+1)
}

func calculateTimesheetTotals(ts *projectsmodel.Timesheet) {
	var totalWorking, totalBillable, totalBillableAmt, totalCostingAmt float64

	for i := range ts.TimeLogs {
		log := &ts.TimeLogs[i]
		if log.Hours <= 0 && log.ToTime != nil && !log.ToTime.IsZero() && !log.FromTime.IsZero() {
			diff := log.ToTime.Sub(log.FromTime).Hours()
			if diff > 0 {
				log.Hours = math.Round(diff*100) / 100
			}
		}
		if log.IsBillable {
			log.BillingAmount = math.Round(log.Hours*log.BillingRate*100) / 100
			totalBillable += log.Hours
			totalBillableAmt += log.BillingAmount
		} else {
			log.BillingAmount = 0
		}
		log.CostingAmount = math.Round(log.Hours*log.CostingRate*100) / 100
		totalWorking += log.Hours
		totalCostingAmt += log.CostingAmount
	}

	ts.TotalWorkingHours = math.Round(totalWorking*100) / 100
	ts.TotalBillableHours = math.Round(totalBillable*100) / 100
	ts.TotalBillableAmount = math.Round(totalBillableAmt*100) / 100
	ts.TotalCostingAmount = math.Round(totalCostingAmt*100) / 100
}

func (ctrl *TimesheetController) List(ctx *gin.Context) {
	db, tenant := projDB(ctx), projTenant(ctx)
	var records []projectsmodel.Timesheet

	query := db.Preload("TimeLogs").
		Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant)

	if status := strings.TrimSpace(ctx.Query("status")); status != "" && !strings.EqualFold(status, "all") {
		query = query.Where("status = ?", status)
	}
	if employeeID := strings.TrimSpace(ctx.Query("employee_id")); employeeID != "" {
		query = query.Where("employee_id = ?", employeeID)
	}
	if projectID := strings.TrimSpace(ctx.Query("project_id")); projectID != "" {
		query = query.Where("project_id = ?", projectID)
	}
	if search := strings.TrimSpace(ctx.Query("q")); search != "" {
		like := "%" + search + "%"
		query = query.Where("id LIKE ? OR employee_name LIKE ? OR project_name LIKE ? OR customer LIKE ?", like, like, like, like)
	}

	if err := query.Order("created_at desc").Find(&records).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil daftar timesheet"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": records})
}

func (ctrl *TimesheetController) Get(ctx *gin.Context) {
	db, tenant, id := projDB(ctx), projTenant(ctx), ctx.Param("id")
	var ts projectsmodel.Timesheet

	if err := db.Preload("TimeLogs", func(tx *gorm.DB) *gorm.DB {
		return tx.Order("idx asc, created_at asc")
	}).Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).
		First(&ts).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "Timesheet tidak ditemukan"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil detail timesheet"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": ts})
}

type SaveTimesheetRequest struct {
	Series       string                           `json:"series"`
	EmployeeID   string                           `json:"employee_id" binding:"required"`
	EmployeeName string                           `json:"employee_name" binding:"required"`
	EmployeeEmail string                          `json:"employee_email"`
	Company      string                           `json:"company" binding:"required"`
	Customer     string                           `json:"customer"`
	Currency     string                           `json:"currency"`
	ExchangeRate float64                          `json:"exchange_rate"`
	Status       projectsmodel.TimesheetStatus    `json:"status"`
	ProjectID    *string                          `json:"project_id"`
	ProjectName  string                           `json:"project_name"`
	StartDate    *time.Time                       `json:"start_date"`
	EndDate      *time.Time                       `json:"end_date"`
	SalesInvoice string                           `json:"sales_invoice"`
	Notes        string                           `json:"notes"`
	TimeLogs     []projectsmodel.TimesheetDetail `json:"time_logs"`
}

func (ctrl *TimesheetController) Create(ctx *gin.Context) {
	db, tenant := projDB(ctx), projTenant(ctx)
	var req SaveTimesheetRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Data timesheet tidak valid: " + err.Error()})
		return
	}

	tsID := generateTimesheetNumber(db, tenant)
	status := req.Status
	if status == "" {
		status = projectsmodel.TimesheetStatusDraft
	}
	currency := req.Currency
	if currency == "" {
		currency = "IDR"
	}
	rate := req.ExchangeRate
	if rate <= 0 {
		rate = 1
	}

	ts := projectsmodel.Timesheet{
		ID:            tsID,
		TenantID:      tenant,
		Series:        "TS-.YYYY.-.#####",
		EmployeeID:    req.EmployeeID,
		EmployeeName:  req.EmployeeName,
		EmployeeEmail: req.EmployeeEmail,
		Company:       req.Company,
		Customer:      req.Customer,
		Currency:      currency,
		ExchangeRate:  rate,
		Status:        status,
		ProjectID:     req.ProjectID,
		ProjectName:   req.ProjectName,
		StartDate:     req.StartDate,
		EndDate:       req.EndDate,
		SalesInvoice:  req.SalesInvoice,
		Notes:         req.Notes,
		TimeLogs:      req.TimeLogs,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	for i := range ts.TimeLogs {
		if ts.TimeLogs[i].ID == "" {
			ts.TimeLogs[i].ID = uuid.NewString()
		}
		ts.TimeLogs[i].TenantID = tenant
		ts.TimeLogs[i].TimesheetID = tsID
		ts.TimeLogs[i].Idx = i + 1
		ts.TimeLogs[i].CreatedAt = time.Now()
		ts.TimeLogs[i].UpdatedAt = time.Now()
	}

	calculateTimesheetTotals(&ts)

	if err := db.Create(&ts).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat timesheet: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{"data": ts, "message": "Timesheet berhasil disimpan sebagai Draft"})
}

func (ctrl *TimesheetController) Update(ctx *gin.Context) {
	db, tenant, id := projDB(ctx), projTenant(ctx), ctx.Param("id")
	var existing projectsmodel.Timesheet

	if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).
		First(&existing).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Timesheet tidak ditemukan"})
		return
	}

	if existing.Status == projectsmodel.TimesheetStatusSubmitted {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Timesheet yang sudah disubmit tidak dapat diubah lagi"})
		return
	}

	var req SaveTimesheetRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Data timesheet tidak valid: " + err.Error()})
		return
	}

	existing.EmployeeID = req.EmployeeID
	existing.EmployeeName = req.EmployeeName
	existing.EmployeeEmail = req.EmployeeEmail
	existing.Company = req.Company
	existing.Customer = req.Customer
	if req.Currency != "" {
		existing.Currency = req.Currency
	}
	if req.ExchangeRate > 0 {
		existing.ExchangeRate = req.ExchangeRate
	}
	if req.Status != "" {
		existing.Status = req.Status
	}
	existing.ProjectID = req.ProjectID
	existing.ProjectName = req.ProjectName
	existing.StartDate = req.StartDate
	existing.EndDate = req.EndDate
	existing.SalesInvoice = req.SalesInvoice
	existing.Notes = req.Notes
	existing.UpdatedAt = time.Now()

	// Replace time logs
	_ = db.Where("timesheet_id = ?", existing.ID).Delete(&projectsmodel.TimesheetDetail{}).Error

	existing.TimeLogs = req.TimeLogs
	for i := range existing.TimeLogs {
		if existing.TimeLogs[i].ID == "" {
			existing.TimeLogs[i].ID = uuid.NewString()
		}
		existing.TimeLogs[i].TenantID = tenant
		existing.TimeLogs[i].TimesheetID = existing.ID
		existing.TimeLogs[i].Idx = i + 1
		existing.TimeLogs[i].CreatedAt = time.Now()
		existing.TimeLogs[i].UpdatedAt = time.Now()
	}

	calculateTimesheetTotals(&existing)

	if err := db.Save(&existing).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui timesheet: " + err.Error()})
		return
	}

	for _, log := range existing.TimeLogs {
		db.Create(&log)
	}

	ctx.JSON(http.StatusOK, gin.H{"data": existing, "message": "Timesheet berhasil diperbarui"})
}

func (ctrl *TimesheetController) Submit(ctx *gin.Context) {
	db, tenant, id := projDB(ctx), projTenant(ctx), ctx.Param("id")
	var ts projectsmodel.Timesheet

	if err := db.Preload("TimeLogs").Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).
		First(&ts).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Timesheet tidak ditemukan"})
		return
	}

	if ts.Status == projectsmodel.TimesheetStatusSubmitted {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Timesheet sudah disubmit"})
		return
	}
	if len(ts.TimeLogs) == 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Timesheet tidak dapat disubmit tanpa adanya baris Time Log"})
		return
	}

	ts.Status = projectsmodel.TimesheetStatusSubmitted
	ts.UpdatedAt = time.Now()
	if err := db.Save(&ts).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal submit timesheet"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": ts, "message": "Timesheet berhasil disubmit"})
}

func (ctrl *TimesheetController) Cancel(ctx *gin.Context) {
	db, tenant, id := projDB(ctx), projTenant(ctx), ctx.Param("id")
	var ts projectsmodel.Timesheet

	if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).
		First(&ts).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Timesheet tidak ditemukan"})
		return
	}

	ts.Status = projectsmodel.TimesheetStatusCancelled
	ts.UpdatedAt = time.Now()
	if err := db.Save(&ts).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membatalkan timesheet"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": ts, "message": "Timesheet berhasil dibatalkan"})
}

func (ctrl *TimesheetController) Delete(ctx *gin.Context) {
	db, tenant, id := projDB(ctx), projTenant(ctx), ctx.Param("id")
	var ts projectsmodel.Timesheet

	if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).
		First(&ts).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Timesheet tidak ditemukan"})
		return
	}

	if ts.Status == projectsmodel.TimesheetStatusSubmitted {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Timesheet yang sudah disubmit tidak dapat dihapus, harap batalkan terlebih dahulu"})
		return
	}

	_ = db.Where("timesheet_id = ?", ts.ID).Delete(&projectsmodel.TimesheetDetail{}).Error
	if err := db.Delete(&ts).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus timesheet"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "Timesheet berhasil dihapus"})
}

func (ctrl *TimesheetController) Options(ctx *gin.Context) {
	db, tenant := projDB(ctx), projTenant(ctx)

	// Fetch employees
	var users []model.User
	_ = db.Where("status = ?", 1).Find(&users).Error
	employeeOptions := make([]gin.H, 0, len(users))
	for _, u := range users {
		name := u.DisplayName
		if name == "" {
			name = strings.TrimSpace(u.FirstName + " " + u.LastName)
		}
		if name == "" {
			name = u.Username
		}
		employeeOptions = append(employeeOptions, gin.H{
			"id":       u.ID.String(),
			"name":     name,
			"email":    u.Email,
			"username": u.Username,
		})
	}

	// Fetch projects
	var projects []projectsmodel.Project
	_ = db.Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant).
		Order("project_name asc").
		Find(&projects).Error

	projectOptions := make([]gin.H, 0, len(projects))
	for _, p := range projects {
		projectOptions = append(projectOptions, gin.H{
			"id":           p.ID,
			"project_name": p.ProjectName,
			"customer":     p.Customer,
		})
	}

	// Fetch tasks
	var tasks []projectsmodel.Task
	_ = db.Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant).
		Order("subject asc").
		Find(&tasks).Error

	taskOptions := make([]gin.H, 0, len(tasks))
	for _, t := range tasks {
		taskOptions = append(taskOptions, gin.H{
			"id":         t.ID,
			"task_code":  t.TaskCode,
			"subject":    t.Subject,
			"project_id": t.ProjectID,
		})
	}

	// Fetch activity types
	var actTypes []projectsmodel.ActivityType
	_ = db.Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant).Find(&actTypes).Error
	activityNames := make([]string, 0, len(actTypes))
	for _, a := range actTypes {
		activityNames = append(activityNames, a.Name)
	}
	if len(activityNames) == 0 {
		activityNames = []string{"Communication", "Planning", "Development", "Design", "Testing", "Review", "Deployment", "Support"}
	}

	ctx.JSON(http.StatusOK, gin.H{
		"employees": employeeOptions,
		"projects":  projectOptions,
		"tasks":     taskOptions,
		"activity_types": activityNames,
		"companies": []string{
			"PT ZENIT TECHNOLOGY SOLUTION",
			"UD MILLION CANDLES",
			"CODEVERTA ENTERPRISE",
		},
		"customers": []string{
			"PT Pelanggan Indonesia",
			"PT Maju Bersama",
			"CV Sinar Makmur",
			"Global Logistics Pte Ltd",
		},
		"statuses": []string{
			string(projectsmodel.TimesheetStatusDraft),
			string(projectsmodel.TimesheetStatusSubmitted),
			string(projectsmodel.TimesheetStatusBilled),
			string(projectsmodel.TimesheetStatusCancelled),
		},
	})
}
