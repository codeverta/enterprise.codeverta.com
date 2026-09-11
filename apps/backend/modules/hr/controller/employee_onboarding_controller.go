package controller

import (
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

type EmployeeOnboardingController struct{}

func NewEmployeeOnboardingController() *EmployeeOnboardingController {
	return &EmployeeOnboardingController{}
}

func (ctrl *EmployeeOnboardingController) generateOnboardingNumber(db *gorm.DB, tenantID string) string {
	year := time.Now().Format("2006")
	prefix := "HR-ONB-" + year + "-"

	var count int64
	db.Model(&hrmodel.EmployeeOnboarding{}).Where("tenant_id = ? AND onboarding_number LIKE ?", tenantID, prefix+"%").Count(&count)
	return fmt.Sprintf("%s%05d", prefix, count+1)
}

func (ctrl *EmployeeOnboardingController) Options(ctx *gin.Context) {
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

	jobApplicants := []gin.H{
		{"id": "APPL-2026-001", "name": "Budi Santoso", "email": "budi.santoso@example.com", "phone": "+62 812-3456-7890", "designation": "Software Engineer", "department": "Engineering & IT"},
		{"id": "APPL-2026-002", "name": "Siti Aminah", "email": "siti.aminah@example.com", "phone": "+62 813-9876-5432", "designation": "HR Manager", "department": "Human Resources"},
		{"id": "APPL-2026-003", "name": "Rizky Pratama", "email": "rizky.pratama@example.com", "phone": "+62 811-1234-5678", "designation": "Accountant", "department": "Finance & Accounting"},
		{"id": "APPL-2026-004", "name": "Maria Veronica", "email": "maria.v@example.com", "phone": "+62 819-8765-4321", "designation": "Sales Executive", "department": "Sales & Marketing"},
		{"id": "APPL-2026-005", "name": "Dewi Lestari", "email": "dewi.lestari@example.com", "phone": "+62 817-2345-6789", "designation": "Operations Staff", "department": "Operations & Logistics"},
	}

	templates := []gin.H{
		{
			"template_name":  "Standard Employee Onboarding",
			"department":     "Human Resources",
			"designation":    "General Staff",
			"employee_grade": "Grade C (Mid-Level)",
			"activities": []gin.H{
				{"activity_name": "Perform a legal and professional background check", "role": "HR Manager", "begin_on": 0, "duration": 3, "required": true},
				{"activity_name": "Create an Employee master", "role": "HR Manager", "begin_on": 0, "duration": 1, "required": true},
				{"activity_name": "Create an Email Account", "role": "IT Support", "begin_on": 0, "duration": 1, "required": true},
				{"activity_name": "Create an identity card", "role": "Office Admin", "begin_on": 1, "duration": 2, "required": false},
				{"activity_name": "Allocate leaves", "role": "HR Manager", "begin_on": 1, "duration": 1, "required": true},
				{"activity_name": "Workspace & Laptop Provisioning", "role": "IT Support", "begin_on": 0, "duration": 2, "required": true},
				{"activity_name": "Orientation & Company Culture Introduction", "role": "HR Manager", "begin_on": 1, "duration": 1, "required": true},
			},
		},
		{
			"template_name":  "Engineering Onboarding",
			"department":     "Engineering & IT",
			"designation":    "Software Engineer",
			"employee_grade": "Grade B (Senior / Lead)",
			"activities": []gin.H{
				{"activity_name": "Perform background and technical credentials check", "role": "HR Manager", "begin_on": 0, "duration": 3, "required": true},
				{"activity_name": "Create an Employee master", "role": "HR Manager", "begin_on": 0, "duration": 1, "required": true},
				{"activity_name": "Setup Corporate Email & Communication Tools", "role": "IT Support", "begin_on": 0, "duration": 1, "required": true},
				{"activity_name": "GitHub / GitLab Repository Access & 2FA Setup", "role": "Tech Lead", "begin_on": 1, "duration": 1, "required": true},
				{"activity_name": "Dev Laptop Provisioning & Development Environment Setup", "role": "IT Support", "begin_on": 0, "duration": 2, "required": true},
				{"activity_name": "Assign Buddy & Architecture Codebase Walkthrough", "role": "Tech Lead", "begin_on": 1, "duration": 2, "required": true},
				{"activity_name": "Allocate leaves & benefits overview", "role": "HR Manager", "begin_on": 2, "duration": 1, "required": true},
			},
		},
	}

	ctx.JSON(http.StatusOK, gin.H{
		"job_applicants": jobApplicants,
		"employees":      employeeOptions,
		"companies": []string{
			"Codeverta Enterprise",
			"PT ZENIT TECHNOLOGY SOLUTION",
			"UD MILLION CANDLES",
		},
		"departments": []string{
			"Human Resources",
			"Engineering & IT",
			"Finance & Accounting",
			"Sales & Marketing",
			"Operations & Logistics",
		},
		"designations": []string{
			"Software Engineer",
			"HR Manager",
			"Accountant",
			"Sales Executive",
			"Operations Staff",
			"Product Designer",
		},
		"employee_grades": []string{
			"Grade A (Executive)",
			"Grade B (Senior / Lead)",
			"Grade C (Mid-Level)",
			"Grade D (Junior / Associate)",
			"Grade E (Intern / Trainee)",
		},
		"roles": []string{
			"HR Manager",
			"IT Support",
			"Office Admin",
			"Tech Lead",
			"Department Head",
			"Legal",
		},
		"templates": templates,
	})
}

func (ctrl *EmployeeOnboardingController) List(ctx *gin.Context) {
	tenant := hrTenant(ctx)
	db := hrDB(ctx)

	query := db.Model(&hrmodel.EmployeeOnboarding{}).Where("tenant_id = ?", tenant).Preload("Activities")

	if q := strings.TrimSpace(ctx.Query("q")); q != "" {
		like := "%" + q + "%"
		query = query.Where("onboarding_number LIKE ? OR applicant_name LIKE ? OR employee_name LIKE ? OR department LIKE ? OR designation LIKE ?", like, like, like, like, like)
	}
	if status := strings.TrimSpace(ctx.Query("status")); status != "" && status != "All" {
		query = query.Where("status = ?", status)
	}
	if dept := strings.TrimSpace(ctx.Query("department")); dept != "" && dept != "All" {
		query = query.Where("department = ?", dept)
	}

	var rows []hrmodel.EmployeeOnboarding
	if err := query.Order("created_at desc").Find(&rows).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data Employee Onboarding: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": rows})
}

func (ctrl *EmployeeOnboardingController) Get(ctx *gin.Context) {
	tenant := hrTenant(ctx)
	id := strings.TrimSpace(ctx.Param("id"))
	db := hrDB(ctx)

	var row hrmodel.EmployeeOnboarding
	if err := db.Where("tenant_id = ? AND (id = ? OR onboarding_number = ?)", tenant, id, id).Preload("Activities").First(&row).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Employee Onboarding tidak ditemukan"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": row})
}

func (ctrl *EmployeeOnboardingController) Create(ctx *gin.Context) {
	tenant := hrTenant(ctx)
	db := hrDB(ctx)

	var input hrmodel.EmployeeOnboarding
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Payload data tidak valid: " + err.Error()})
		return
	}

	if strings.TrimSpace(input.ApplicantName) == "" && strings.TrimSpace(input.JobApplicant) != "" {
		input.ApplicantName = input.JobApplicant
	}
	if strings.TrimSpace(input.ApplicantName) == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Job Applicant / Nama Pelamar wajib diisi"})
		return
	}

	if strings.TrimSpace(input.Company) == "" {
		input.Company = "Codeverta Enterprise"
	}
	if strings.TrimSpace(input.Status) == "" {
		input.Status = "Pending"
	}

	input.ID = uuid.New().String()
	input.TenantID = tenant
	if strings.TrimSpace(input.OnboardingNumber) == "" {
		input.OnboardingNumber = ctrl.generateOnboardingNumber(db, tenant)
	}

	// Prepare activities
	for i := range input.Activities {
		input.Activities[i].ID = uuid.New().String()
		input.Activities[i].TenantID = tenant
		input.Activities[i].OnboardingID = input.ID
		if strings.TrimSpace(input.Activities[i].Status) == "" {
			input.Activities[i].Status = "Pending"
		}
	}

	// Calculate initial status based on activities
	input.Status = calculateOnboardingStatus(input.Activities)

	if err := db.Create(&input).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat Employee Onboarding: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{"data": input, "message": "Employee Onboarding berhasil dibuat"})
}

func (ctrl *EmployeeOnboardingController) Update(ctx *gin.Context) {
	tenant := hrTenant(ctx)
	id := strings.TrimSpace(ctx.Param("id"))
	db := hrDB(ctx)

	var existing hrmodel.EmployeeOnboarding
	if err := db.Where("tenant_id = ? AND (id = ? OR onboarding_number = ?)", tenant, id, id).First(&existing).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Employee Onboarding tidak ditemukan"})
		return
	}

	var input hrmodel.EmployeeOnboarding
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Payload data tidak valid: " + err.Error()})
		return
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		existing.JobApplicant = input.JobApplicant
		existing.ApplicantName = input.ApplicantName
		existing.ApplicantEmail = input.ApplicantEmail
		existing.ApplicantPhone = input.ApplicantPhone
		existing.Employee = input.Employee
		existing.EmployeeName = input.EmployeeName
		existing.Company = input.Company
		existing.Department = input.Department
		existing.Designation = input.Designation
		existing.EmployeeGrade = input.EmployeeGrade
		existing.EmployeeOnboardingTemplate = input.EmployeeOnboardingTemplate
		existing.DateOfJoining = input.DateOfJoining
		existing.Project = input.Project
		existing.Notes = input.Notes

		// Update activities
		if err := tx.Where("onboarding_id = ?", existing.ID).Delete(&hrmodel.EmployeeOnboardingActivity{}).Error; err != nil {
			return err
		}

		for _, act := range input.Activities {
			newAct := hrmodel.EmployeeOnboardingActivity{
				ID:           uuid.New().String(),
				TenantID:     tenant,
				OnboardingID: existing.ID,
				ActivityName: act.ActivityName,
				Role:         act.Role,
				User:         act.User,
				BeginOn:      act.BeginOn,
				Duration:     act.Duration,
				Required:     act.Required,
				Status:       act.Status,
				CompletedAt:  act.CompletedAt,
			}
			if newAct.Status == "" {
				newAct.Status = "Pending"
			}
			if err := tx.Create(&newAct).Error; err != nil {
				return err
			}
		}

		// Recalculate status
		existing.Status = calculateOnboardingStatus(input.Activities)

		return tx.Save(&existing).Error
	})

	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui Employee Onboarding: " + err.Error()})
		return
	}

	_ = db.Where("id = ?", existing.ID).Preload("Activities").First(&existing)
	ctx.JSON(http.StatusOK, gin.H{"data": existing, "message": "Employee Onboarding berhasil diperbarui"})
}

func (ctrl *EmployeeOnboardingController) Delete(ctx *gin.Context) {
	tenant := hrTenant(ctx)
	id := strings.TrimSpace(ctx.Param("id"))
	db := hrDB(ctx)

	var existing hrmodel.EmployeeOnboarding
	if err := db.Where("tenant_id = ? AND (id = ? OR onboarding_number = ?)", tenant, id, id).First(&existing).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Employee Onboarding tidak ditemukan"})
		return
	}

	if err := db.Select("Activities").Delete(&existing).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus Employee Onboarding: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "Employee Onboarding berhasil dihapus"})
}

func (ctrl *EmployeeOnboardingController) ToggleActivity(ctx *gin.Context) {
	tenant := hrTenant(ctx)
	onboardingID := strings.TrimSpace(ctx.Param("id"))
	activityID := strings.TrimSpace(ctx.Param("activity_id"))
	db := hrDB(ctx)

	var onboarding hrmodel.EmployeeOnboarding
	if err := db.Where("tenant_id = ? AND (id = ? OR onboarding_number = ?)", tenant, onboardingID, onboardingID).First(&onboarding).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Employee Onboarding tidak ditemukan"})
		return
	}

	var act hrmodel.EmployeeOnboardingActivity
	if err := db.Where("tenant_id = ? AND onboarding_id = ? AND id = ?", tenant, onboarding.ID, activityID).First(&act).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Activity tidak ditemukan"})
		return
	}

	if act.Status == "Completed" {
		act.Status = "Pending"
		act.CompletedAt = nil
	} else {
		act.Status = "Completed"
		now := time.Now()
		act.CompletedAt = &now
	}

	if err := db.Save(&act).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengubah status activity: " + err.Error()})
		return
	}

	// Recalculate parent onboarding status
	var allActs []hrmodel.EmployeeOnboardingActivity
	_ = db.Where("onboarding_id = ?", onboarding.ID).Find(&allActs).Error
	onboarding.Status = calculateOnboardingStatus(allActs)
	_ = db.Save(&onboarding).Error

	_ = db.Where("id = ?", onboarding.ID).Preload("Activities").First(&onboarding)
	ctx.JSON(http.StatusOK, gin.H{"data": onboarding, "message": "Status activity berhasil diperbarui"})
}

func (ctrl *EmployeeOnboardingController) CreateEmployee(ctx *gin.Context) {
	tenant := hrTenant(ctx)
	id := strings.TrimSpace(ctx.Param("id"))
	db := hrDB(ctx)

	var onboarding hrmodel.EmployeeOnboarding
	if err := db.Where("tenant_id = ? AND (id = ? OR onboarding_number = ?)", tenant, id, id).Preload("Activities").First(&onboarding).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Employee Onboarding tidak ditemukan"})
		return
	}

	empName := onboarding.EmployeeName
	if empName == "" {
		empName = onboarding.ApplicantName
	}
	empID := "EMP-" + time.Now().Format("2006") + "-" + strings.ToUpper(uuid.New().String()[:4])

	onboarding.Employee = empID
	onboarding.EmployeeName = empName
	if err := db.Save(&onboarding).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat/menautkan Employee: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"data":    onboarding,
		"message": fmt.Sprintf("Employee master berhasil dibuat dengan ID %s untuk %s", empID, empName),
	})
}

func calculateOnboardingStatus(activities []hrmodel.EmployeeOnboardingActivity) string {
	if len(activities) == 0 {
		return "Pending"
	}
	allCompleted := true
	anyCompleted := false
	for _, a := range activities {
		if a.Status == "Completed" {
			anyCompleted = true
		} else {
			allCompleted = false
		}
	}
	if allCompleted {
		return "Completed"
	}
	if anyCompleted {
		return "In Progress"
	}
	return "Pending"
}
