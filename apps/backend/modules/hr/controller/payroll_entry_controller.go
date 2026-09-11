package controller

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"gin-template/model"
	hrmodel "gin-template/modules/hr/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type PayrollEntryController struct{}

func NewPayrollEntryController() *PayrollEntryController {
	return &PayrollEntryController{}
}

func hrDB(ctx *gin.Context) *gorm.DB {
	return model.GetDB(ctx).WithContext(ctx.Request.Context())
}

func hrTenant(ctx *gin.Context) string {
	return strings.TrimSpace(ctx.GetString("tenant_id"))
}

func (ctrl *PayrollEntryController) List(ctx *gin.Context) {
	db, tenant := hrDB(ctx), hrTenant(ctx)
	var entries []hrmodel.PayrollEntry

	query := db.Preload("Items").
		Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant)

	if status := strings.TrimSpace(ctx.Query("status")); status != "" {
		query = query.Where("status = ?", status)
	}
	if search := strings.TrimSpace(ctx.Query("q")); search != "" {
		like := "%" + search + "%"
		query = query.Where("id LIKE ? OR company LIKE ? OR department LIKE ?", like, like, like)
	}

	if err := query.Order("created_at desc").Find(&entries).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil daftar Payroll Entry"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"data": entries})
}

func (ctrl *PayrollEntryController) Get(ctx *gin.Context) {
	db, tenant, id := hrDB(ctx), hrTenant(ctx), ctx.Param("id")
	var entry hrmodel.PayrollEntry

	if err := db.Preload("Items").
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).
		First(&entry).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "Payroll Entry tidak ditemukan"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil detail Payroll Entry"})
		return
	}
	ctx.JSON(http.StatusOK, entry)
}

func (ctrl *PayrollEntryController) Create(ctx *gin.Context) {
	db, tenant := hrDB(ctx), hrTenant(ctx)
	var input hrmodel.PayrollEntry

	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Payload JSON tidak valid"})
		return
	}

	now := time.Now()
	if input.ID == "" || input.ID == "new" {
		input.ID = fmt.Sprintf("HR-PR-%s-%s", now.Format("2006"), uuid.New().String()[:6])
	}
	input.TenantID = tenant
	if input.Status == "" {
		input.Status = hrmodel.PayrollEntryStatusDraft
	}
	if input.PostingDate.IsZero() {
		input.PostingDate = now
	}
	if input.Currency == "" {
		input.Currency = "IDR"
	}
	if input.ExchangeRate <= 0 {
		input.ExchangeRate = 1.0
	}
	if input.Company == "" {
		input.Company = "PT ZENIT TECHNOLOGY SOLUTION"
	}
	if input.PayrollFrequency == "" {
		input.PayrollFrequency = "Monthly"
	}
	if input.StartDate.IsZero() {
		input.StartDate = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	}
	if input.EndDate.IsZero() {
		input.EndDate = input.StartDate.AddDate(0, 1, -1)
	}

	calculateTotals(&input)

	if err := db.Create(&input).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan Payroll Entry: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, input)
}

func (ctrl *PayrollEntryController) Update(ctx *gin.Context) {
	db, tenant, id := hrDB(ctx), hrTenant(ctx), ctx.Param("id")

	var existing hrmodel.PayrollEntry
	if err := db.Preload("Items").
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).
		First(&existing).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Payroll Entry tidak ditemukan"})
		return
	}

	if existing.Status == hrmodel.PayrollEntryStatusSubmitted {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Payroll Entry yang sudah Submitted tidak dapat diubah"})
		return
	}

	var input hrmodel.PayrollEntry
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Payload JSON tidak valid"})
		return
	}

	existing.PostingDate = input.PostingDate
	existing.PayrollFrequency = input.PayrollFrequency
	existing.Company = input.Company
	existing.Department = input.Department
	existing.Branch = input.Branch
	existing.Designation = input.Designation
	existing.StartDate = input.StartDate
	existing.EndDate = input.EndDate
	existing.PaymentAccount = input.PaymentAccount
	existing.CostCenter = input.CostCenter
	existing.UpdatedAt = time.Now()

	// Replace items if provided
	if input.Items != nil {
		_ = db.Where("payroll_entry_id = ?", existing.ID).Delete(&hrmodel.PayrollEntryEmployee{}).Error
		existing.Items = nil
		for _, item := range input.Items {
			if item.ID == "" {
				item.ID = "pre-" + uuid.New().String()[:8]
			}
			item.PayrollEntryID = existing.ID
			if item.GrossPay == 0 {
				item.GrossPay = item.BasicSalary + item.Allowances
			}
			item.NetPay = item.GrossPay - item.Deductions
			existing.Items = append(existing.Items, item)
		}
	}

	calculateTotals(&existing)

	if err := db.Save(&existing).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui Payroll Entry"})
		return
	}

	ctx.JSON(http.StatusOK, existing)
}

func (ctrl *PayrollEntryController) Delete(ctx *gin.Context) {
	db, tenant, id := hrDB(ctx), hrTenant(ctx), ctx.Param("id")

	var entry hrmodel.PayrollEntry
	if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).
		First(&entry).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Payroll Entry tidak ditemukan"})
		return
	}

	if entry.Status == hrmodel.PayrollEntryStatusSubmitted {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Payroll Entry yang sudah Submitted tidak dapat dihapus"})
		return
	}

	if err := db.Select("Items").Delete(&entry).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus Payroll Entry"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "Payroll Entry berhasil dihapus"})
}

// GetEmployees fetches system Users/Employees and populates them into the Payroll Entry
func (ctrl *PayrollEntryController) GetEmployees(ctx *gin.Context) {
	db, tenant, id := hrDB(ctx), hrTenant(ctx), ctx.Param("id")

	var entry hrmodel.PayrollEntry
	if err := db.Preload("Items").
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).
		First(&entry).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Payroll Entry tidak ditemukan"})
		return
	}

	if entry.Status == hrmodel.PayrollEntryStatusSubmitted {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Payroll Entry yang sudah Submitted tidak dapat diubah"})
		return
	}

	var users []model.User
	if err := db.Where("status = ?", 1).Find(&users).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil daftar karyawan/user"})
		return
	}

	// Clean old items
	_ = db.Where("payroll_entry_id = ?", entry.ID).Delete(&hrmodel.PayrollEntryEmployee{}).Error

	var newItems []hrmodel.PayrollEntryEmployee
	for i, u := range users {
		name := u.DisplayName
		if name == "" {
			name = strings.TrimSpace(u.FirstName + " " + u.LastName)
		}
		if name == "" {
			name = u.Username
		}
		if name == "" {
			name = u.Email
		}

		dept := entry.Department
		if dept == "" {
			dept = "Operational"
		}
		desig := "Staff"
		if u.Role == 1 {
			desig = "Manager / Administrator"
		}

		// Calculate default basic salary per user
		basicSalary := 4500000.0 + float64(i*500000)
		if u.Balance > 0 {
			basicSalary = u.Balance
		}
		allowances := basicSalary * 0.15
		deductions := basicSalary * 0.05
		grossPay := basicSalary + allowances
		netPay := grossPay - deductions

		item := hrmodel.PayrollEntryEmployee{
			ID:             fmt.Sprintf("pre-%s-%d", uuid.New().String()[:6], i+1),
			PayrollEntryID: entry.ID,
			UserID:         u.ID.String(),
			EmployeeName:   name,
			EmployeeEmail:  u.Email,
			Department:     dept,
			Designation:    desig,
			BasicSalary:    basicSalary,
			Allowances:     allowances,
			Deductions:     deductions,
			GrossPay:       grossPay,
			NetPay:         netPay,
			Status:         "Pending",
			CreatedAt:      time.Now(),
			UpdatedAt:      time.Now(),
		}
		newItems = append(newItems, item)
	}

	entry.Items = newItems
	calculateTotals(&entry)

	if err := db.Save(&entry).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan data karyawan pada Payroll Entry"})
		return
	}

	ctx.JSON(http.StatusOK, entry)
}

func (ctrl *PayrollEntryController) Submit(ctx *gin.Context) {
	db, tenant, id := hrDB(ctx), hrTenant(ctx), ctx.Param("id")

	var entry hrmodel.PayrollEntry
	if err := db.Preload("Items").
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).
		First(&entry).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Payroll Entry tidak ditemukan"})
		return
	}

	if entry.Status == hrmodel.PayrollEntryStatusSubmitted {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Payroll Entry ini sudah Submitted"})
		return
	}

	if len(entry.Items) == 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Payroll Entry harus memiliki minimal 1 karyawan. Klik 'Get Employees' terlebih dahulu."})
		return
	}

	entry.Status = hrmodel.PayrollEntryStatusSubmitted
	entry.SalarySlipCreated = true
	entry.UpdatedAt = time.Now()

	for i := range entry.Items {
		entry.Items[i].Status = "Generated"
	}

	calculateTotals(&entry)

	if err := db.Save(&entry).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mensubmit Payroll Entry"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "Payroll Entry berhasil disubmit dan Salary Slips diproses",
		"data":    entry,
	})
}

func (ctrl *PayrollEntryController) Options(ctx *gin.Context) {
	db := hrDB(ctx)

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

	ctx.JSON(http.StatusOK, gin.H{
		"companies": []string{
			"PT ZENIT TECHNOLOGY SOLUTION",
			"UD MILLION CANDLES",
			"CODEVERTA ENTERPRISE",
		},
		"departments": []string{
			"All Departments",
			"Human Resources",
			"Engineering & IT",
			"Finance & Accounting",
			"Sales & Marketing",
			"Operations & Logistics",
		},
		"designations": []string{
			"All Designations",
			"Software Engineer",
			"HR Manager",
			"Accountant",
			"Sales Executive",
			"Operations Staff",
		},
		"payroll_frequencies": []string{
			"Monthly",
			"Weekly",
			"Bimonthly",
			"Fortnightly",
		},
		"employees": employeeOptions,
	})
}

func calculateTotals(entry *hrmodel.PayrollEntry) {
	var gross, ded, net float64
	for i := range entry.Items {
		if entry.Items[i].GrossPay == 0 {
			entry.Items[i].GrossPay = entry.Items[i].BasicSalary + entry.Items[i].Allowances
		}
		entry.Items[i].NetPay = entry.Items[i].GrossPay - entry.Items[i].Deductions
		gross += entry.Items[i].GrossPay
		ded += entry.Items[i].Deductions
		net += entry.Items[i].NetPay
	}
	entry.TotalEmployees = len(entry.Items)
	entry.TotalGrossPay = gross
	entry.TotalDeductions = ded
	entry.TotalNetPay = net
}
