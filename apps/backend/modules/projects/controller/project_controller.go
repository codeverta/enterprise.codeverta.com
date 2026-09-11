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

type ProjectController struct{}

func NewProjectController() *ProjectController {
	return &ProjectController{}
}

func projDB(ctx *gin.Context) *gorm.DB {
	return model.GetDB(ctx).WithContext(ctx.Request.Context())
}

func projTenant(ctx *gin.Context) string {
	tenant := strings.TrimSpace(ctx.GetString("tenant_id"))
	if tenant == "" {
		return "00000000-0000-0000-0000-000000000001"
	}
	return tenant
}

func generateProjectNumber(db *gorm.DB, tenantID string, series string) string {
	year := time.Now().Format("2006")
	prefix := "PROJ-" + year + "-"
	if strings.Contains(series, "PROJ") {
		prefix = "PROJ-" + year + "-"
	}

	var count int64
	db.Model(&projectsmodel.Project{}).
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id LIKE ?", tenantID, prefix+"%").
		Count(&count)
	return fmt.Sprintf("%s%04d", prefix, count+1)
}

func generateTaskNumber(db *gorm.DB, tenantID string) string {
	year := time.Now().Format("2006")
	prefix := "TASK-" + year + "-"

	var count int64
	db.Model(&projectsmodel.Task{}).
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND task_code LIKE ?", tenantID, prefix+"%").
		Count(&count)
	return fmt.Sprintf("%s%04d", prefix, count+1)
}

// RecalculateProjectProgress updates project PercentComplete based on its tasks and method
func RecalculateProjectProgress(db *gorm.DB, projectID string) {
	if projectID == "" {
		return
	}

	var project projectsmodel.Project
	if err := db.First(&project, "id = ?", projectID).Error; err != nil {
		return
	}

	if project.PercentCompleteMethod == projectsmodel.PercentCompleteManual {
		return
	}

	var tasks []projectsmodel.Task
	if err := db.Where("project_id = ?", projectID).Find(&tasks).Error; err != nil || len(tasks) == 0 {
		db.Model(&project).Update("percent_complete", 0)
		return
	}

	var calculatedProgress float64
	switch project.PercentCompleteMethod {
	case projectsmodel.PercentCompleteTaskCompletion:
		var completedCount float64
		for _, t := range tasks {
			if t.Status == projectsmodel.TaskStatusCompleted || t.Progress >= 100 {
				completedCount++
			}
		}
		calculatedProgress = (completedCount / float64(len(tasks))) * 100

	case projectsmodel.PercentCompleteTaskProgress:
		var totalProgress float64
		for _, t := range tasks {
			totalProgress += t.Progress
		}
		calculatedProgress = totalProgress / float64(len(tasks))

	case projectsmodel.PercentCompleteTaskWeight:
		var totalWeight, weightedProgress float64
		for _, t := range tasks {
			w := t.TaskWeight
			if w <= 0 {
				w = 1
			}
			totalWeight += w
			weightedProgress += (t.Progress * w)
		}
		if totalWeight > 0 {
			calculatedProgress = weightedProgress / totalWeight
		}

	default:
		return
	}

	calculatedProgress = math.Round(calculatedProgress*100) / 100
	if calculatedProgress > 100 {
		calculatedProgress = 100
	} else if calculatedProgress < 0 {
		calculatedProgress = 0
	}

	db.Model(&project).Update("percent_complete", calculatedProgress)
}

// --- PROJECT HANDLERS ---

func (ctrl *ProjectController) ListProjects(ctx *gin.Context) {
	db, tenant := projDB(ctx), projTenant(ctx)
	var projects []projectsmodel.Project

	query := db.Preload("Tasks").
		Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant)

	if status := strings.TrimSpace(ctx.Query("status")); status != "" && !strings.EqualFold(status, "all") {
		query = query.Where("status = ?", status)
	}
	if priority := strings.TrimSpace(ctx.Query("priority")); priority != "" && !strings.EqualFold(priority, "all") {
		query = query.Where("priority = ?", priority)
	}
	if ptype := strings.TrimSpace(ctx.Query("project_type")); ptype != "" && !strings.EqualFold(ptype, "all") {
		query = query.Where("project_type = ?", ptype)
	}
	if search := strings.TrimSpace(ctx.Query("q")); search != "" {
		like := "%" + search + "%"
		query = query.Where("project_name LIKE ? OR id LIKE ? OR customer LIKE ? OR department LIKE ?", like, like, like, like)
	}

	if err := query.Order("created_at desc").Find(&projects).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil daftar proyek"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": projects})
}

func (ctrl *ProjectController) GetProject(ctx *gin.Context) {
	db, tenant, id := projDB(ctx), projTenant(ctx), ctx.Param("id")
	var project projectsmodel.Project

	if err := db.Preload("Tasks", func(tx *gorm.DB) *gorm.DB {
		return tx.Order("created_at asc")
	}).Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).
		First(&project).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "Proyek tidak ditemukan"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil detail proyek"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": project})
}

type CreateProjectRequest struct {
	NamingSeries          string                        `json:"naming_series"`
	ProjectName           string                        `json:"project_name" binding:"required"`
	Status                projectsmodel.ProjectStatus   `json:"status"`
	ProjectType           string                        `json:"project_type"`
	PercentCompleteMethod projectsmodel.PercentCompleteMethod `json:"percent_complete_method"`
	PercentComplete       float64                       `json:"percent_complete"`
	ProjectTemplate       string                        `json:"project_template"`
	Priority              string                        `json:"priority"`
	Department            string                        `json:"department"`
	Customer              string                        `json:"customer"`
	IsActive              *bool                         `json:"is_active"`
	ExpectedStartDate     *time.Time                    `json:"expected_start_date"`
	ExpectedEndDate       *time.Time                    `json:"expected_end_date"`
	ActualStartDate       *time.Time                    `json:"actual_start_date"`
	ActualEndDate         *time.Time                    `json:"actual_end_date"`
	EstimatedCost         float64                       `json:"estimated_cost"`
	TotalCostingAmount    float64                       `json:"total_costing_amount"`
	TotalExpenseClaim     float64                       `json:"total_expense_claim"`
	Notes                 string                        `json:"notes"`
}

func (ctrl *ProjectController) CreateProject(ctx *gin.Context) {
	db, tenant := projDB(ctx), projTenant(ctx)
	var req CreateProjectRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Data proyek tidak valid: " + err.Error()})
		return
	}

	namingSeries := req.NamingSeries
	if namingSeries == "" {
		namingSeries = "PROJ-.####"
	}
	projectID := generateProjectNumber(db, tenant, namingSeries)

	status := req.Status
	if status == "" {
		status = projectsmodel.ProjectStatusOpen
	}
	method := req.PercentCompleteMethod
	if method == "" {
		method = projectsmodel.PercentCompleteTaskCompletion
	}
	priority := req.Priority
	if priority == "" {
		priority = "Medium"
	}
	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	project := projectsmodel.Project{
		ID:                    projectID,
		TenantID:              tenant,
		NamingSeries:          namingSeries,
		ProjectName:           req.ProjectName,
		Status:                status,
		ProjectType:           req.ProjectType,
		PercentCompleteMethod: method,
		PercentComplete:       req.PercentComplete,
		ProjectTemplate:       req.ProjectTemplate,
		Priority:              priority,
		Department:            req.Department,
		Customer:              req.Customer,
		IsActive:              isActive,
		ExpectedStartDate:     req.ExpectedStartDate,
		ExpectedEndDate:       req.ExpectedEndDate,
		ActualStartDate:       req.ActualStartDate,
		ActualEndDate:         req.ActualEndDate,
		EstimatedCost:         req.EstimatedCost,
		TotalCostingAmount:    req.TotalCostingAmount,
		TotalExpenseClaim:     req.TotalExpenseClaim,
		Notes:                 req.Notes,
		CreatedAt:             time.Now(),
		UpdatedAt:             time.Now(),
	}

	if err := db.Create(&project).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat proyek: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{"data": project, "message": "Proyek berhasil dibuat"})
}

func (ctrl *ProjectController) UpdateProject(ctx *gin.Context) {
	db, tenant, id := projDB(ctx), projTenant(ctx), ctx.Param("id")
	var existing projectsmodel.Project
	if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).
		First(&existing).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Proyek tidak ditemukan"})
		return
	}

	var req CreateProjectRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Data proyek tidak valid: " + err.Error()})
		return
	}

	existing.ProjectName = req.ProjectName
	if req.Status != "" {
		existing.Status = req.Status
	}
	existing.ProjectType = req.ProjectType
	if req.PercentCompleteMethod != "" {
		existing.PercentCompleteMethod = req.PercentCompleteMethod
	}
	if req.PercentCompleteMethod == projectsmodel.PercentCompleteManual {
		existing.PercentComplete = req.PercentComplete
	}
	existing.ProjectTemplate = req.ProjectTemplate
	existing.Priority = req.Priority
	existing.Department = req.Department
	existing.Customer = req.Customer
	if req.IsActive != nil {
		existing.IsActive = *req.IsActive
	}
	existing.ExpectedStartDate = req.ExpectedStartDate
	existing.ExpectedEndDate = req.ExpectedEndDate
	existing.ActualStartDate = req.ActualStartDate
	existing.ActualEndDate = req.ActualEndDate
	existing.EstimatedCost = req.EstimatedCost
	existing.TotalCostingAmount = req.TotalCostingAmount
	existing.TotalExpenseClaim = req.TotalExpenseClaim
	existing.Notes = req.Notes
	existing.UpdatedAt = time.Now()

	if err := db.Save(&existing).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui proyek: " + err.Error()})
		return
	}

	// Recalculate progress if based on tasks
	RecalculateProjectProgress(db, existing.ID)

	ctx.JSON(http.StatusOK, gin.H{"data": existing, "message": "Proyek berhasil diperbarui"})
}

func (ctrl *ProjectController) DeleteProject(ctx *gin.Context) {
	db, tenant, id := projDB(ctx), projTenant(ctx), ctx.Param("id")

	if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).
		Delete(&projectsmodel.Project{}).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus proyek: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "Proyek berhasil dihapus"})
}

func (ctrl *ProjectController) ProjectOptions(ctx *gin.Context) {
	db, tenant := projDB(ctx), projTenant(ctx)

	var projectTypes []projectsmodel.ProjectType
	_ = db.Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant).Find(&projectTypes).Error

	var templates []projectsmodel.ProjectTemplate
	_ = db.Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant).Find(&templates).Error

	typeNames := make([]string, 0, len(projectTypes))
	for _, pt := range projectTypes {
		typeNames = append(typeNames, pt.Name)
	}

	templateNames := make([]string, 0, len(templates))
	for _, t := range templates {
		templateNames = append(templateNames, t.Name)
	}

	ctx.JSON(http.StatusOK, gin.H{
		"project_types": typeNames,
		"project_templates": templateNames,
		"percent_complete_methods": []string{
			string(projectsmodel.PercentCompleteManual),
			string(projectsmodel.PercentCompleteTaskCompletion),
			string(projectsmodel.PercentCompleteTaskProgress),
			string(projectsmodel.PercentCompleteTaskWeight),
		},
		"statuses": []string{
			string(projectsmodel.ProjectStatusOpen),
			string(projectsmodel.ProjectStatusCompleted),
			string(projectsmodel.ProjectStatusCancelled),
		},
		"priorities": []string{"Low", "Medium", "High"},
		"departments": []string{
			"Engineering & IT",
			"Operations & Logistics",
			"Sales & Marketing",
			"Finance & Accounting",
			"Human Resources",
			"Customer Support",
		},
		"customers": []string{
			"PT Pelanggan Indonesia",
			"PT Maju Bersama",
			"CV Sinar Makmur",
			"Global Logistics Pte Ltd",
		},
	})
}

// --- TASK HANDLERS ---

func (ctrl *ProjectController) ListTasks(ctx *gin.Context) {
	db, tenant := projDB(ctx), projTenant(ctx)
	var tasks []projectsmodel.Task

	query := db.Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant)

	if projectID := strings.TrimSpace(ctx.Query("project_id")); projectID != "" {
		query = query.Where("project_id = ?", projectID)
	}
	if status := strings.TrimSpace(ctx.Query("status")); status != "" && !strings.EqualFold(status, "all") {
		query = query.Where("status = ?", status)
	}
	if priority := strings.TrimSpace(ctx.Query("priority")); priority != "" && !strings.EqualFold(priority, "all") {
		query = query.Where("priority = ?", priority)
	}
	if search := strings.TrimSpace(ctx.Query("q")); search != "" {
		like := "%" + search + "%"
		query = query.Where("subject LIKE ? OR task_code LIKE ? OR project_name LIKE ? OR assigned_to LIKE ?", like, like, like, like)
	}

	if err := query.Order("created_at desc").Find(&tasks).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil daftar tugas"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": tasks})
}

func (ctrl *ProjectController) GetTask(ctx *gin.Context) {
	db, tenant, id := projDB(ctx), projTenant(ctx), ctx.Param("id")
	var task projectsmodel.Task

	if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND (id = ? OR task_code = ?)", tenant, id, id).
		First(&task).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "Tugas tidak ditemukan"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil detail tugas"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": task})
}

type CreateTaskRequest struct {
	Subject        string                    `json:"subject" binding:"required"`
	ProjectID      *string                   `json:"project_id"`
	ProjectName    string                    `json:"project_name"`
	Issue          string                    `json:"issue"`
	Type           string                    `json:"type"`
	Color          string                    `json:"color"`
	IsGroup        bool                      `json:"is_group"`
	Status         projectsmodel.TaskStatus  `json:"status"`
	Priority       projectsmodel.TaskPriority `json:"priority"`
	TaskWeight     float64                   `json:"task_weight"`
	ParentTaskID   *string                   `json:"parent_task_id"`
	ParentTaskName string                    `json:"parent_task_name"`
	IsTemplate     bool                      `json:"is_template"`
	ExpStartDate   *time.Time                `json:"exp_start_date"`
	ExpectedTime   float64                   `json:"expected_time"`
	ExpEndDate     *time.Time                `json:"exp_end_date"`
	ActStartDate   *time.Time                `json:"act_start_date"`
	ActEndDate     *time.Time                `json:"act_end_date"`
	ActualTime     float64                   `json:"actual_time"`
	Progress       float64                   `json:"progress"`
	IsMilestone    bool                      `json:"is_milestone"`
	Description    string                    `json:"description"`
	DependsOnTasks string                    `json:"depends_on_tasks"`
	AssignedTo     string                    `json:"assigned_to"`
}

func (ctrl *ProjectController) CreateTask(ctx *gin.Context) {
	db, tenant := projDB(ctx), projTenant(ctx)
	var req CreateTaskRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Data tugas tidak valid: " + err.Error()})
		return
	}

	taskID := uuid.NewString()
	taskCode := generateTaskNumber(db, tenant)

	status := req.Status
	if status == "" {
		status = projectsmodel.TaskStatusOpen
	}
	priority := req.Priority
	if priority == "" {
		priority = projectsmodel.TaskPriorityMedium
	}
	weight := req.TaskWeight
	if weight <= 0 {
		weight = 1
	}
	color := req.Color
	if color == "" {
		color = "#3B82F6"
	}

	projectName := req.ProjectName
	if req.ProjectID != nil && *req.ProjectID != "" {
		var p projectsmodel.Project
		if err := db.Select("id, project_name").First(&p, "id = ?", *req.ProjectID).Error; err == nil {
			projectName = p.ProjectName
		}
	}

	progress := req.Progress
	if status == projectsmodel.TaskStatusCompleted && progress < 100 {
		progress = 100
	}

	task := projectsmodel.Task{
		ID:             taskID,
		TenantID:       tenant,
		TaskCode:       taskCode,
		Subject:        req.Subject,
		ProjectID:      req.ProjectID,
		ProjectName:    projectName,
		Issue:          req.Issue,
		Type:           req.Type,
		Color:          color,
		IsGroup:        req.IsGroup,
		Status:         status,
		Priority:       priority,
		TaskWeight:     weight,
		ParentTaskID:   req.ParentTaskID,
		ParentTaskName: req.ParentTaskName,
		IsTemplate:     req.IsTemplate,
		ExpStartDate:   req.ExpStartDate,
		ExpectedTime:   req.ExpectedTime,
		ExpEndDate:     req.ExpEndDate,
		ActStartDate:   req.ActStartDate,
		ActEndDate:     req.ActEndDate,
		ActualTime:     req.ActualTime,
		Progress:       progress,
		IsMilestone:    req.IsMilestone,
		Description:    req.Description,
		DependsOnTasks: req.DependsOnTasks,
		AssignedTo:     req.AssignedTo,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	if err := db.Create(&task).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat tugas: " + err.Error()})
		return
	}

	if task.ProjectID != nil && *task.ProjectID != "" {
		RecalculateProjectProgress(db, *task.ProjectID)
	}

	ctx.JSON(http.StatusCreated, gin.H{"data": task, "message": "Tugas berhasil dibuat"})
}

func (ctrl *ProjectController) UpdateTask(ctx *gin.Context) {
	db, tenant, id := projDB(ctx), projTenant(ctx), ctx.Param("id")
	var existing projectsmodel.Task
	if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND (id = ? OR task_code = ?)", tenant, id, id).
		First(&existing).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Tugas tidak ditemukan"})
		return
	}

	var req CreateTaskRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Data tugas tidak valid: " + err.Error()})
		return
	}

	existing.Subject = req.Subject
	oldProjectID := existing.ProjectID
	existing.ProjectID = req.ProjectID
	if req.ProjectID != nil && *req.ProjectID != "" {
		var p projectsmodel.Project
		if err := db.Select("id, project_name").First(&p, "id = ?", *req.ProjectID).Error; err == nil {
			existing.ProjectName = p.ProjectName
		}
	} else {
		existing.ProjectName = ""
	}

	existing.Issue = req.Issue
	existing.Type = req.Type
	if req.Color != "" {
		existing.Color = req.Color
	}
	existing.IsGroup = req.IsGroup
	if req.Status != "" {
		existing.Status = req.Status
	}
	if req.Priority != "" {
		existing.Priority = req.Priority
	}
	if req.TaskWeight > 0 {
		existing.TaskWeight = req.TaskWeight
	}
	existing.ParentTaskID = req.ParentTaskID
	existing.ParentTaskName = req.ParentTaskName
	existing.IsTemplate = req.IsTemplate
	existing.ExpStartDate = req.ExpStartDate
	existing.ExpectedTime = req.ExpectedTime
	existing.ExpEndDate = req.ExpEndDate
	existing.ActStartDate = req.ActStartDate
	existing.ActEndDate = req.ActEndDate
	existing.ActualTime = req.ActualTime
	existing.Progress = req.Progress
	if existing.Status == projectsmodel.TaskStatusCompleted && existing.Progress < 100 {
		existing.Progress = 100
	}
	existing.IsMilestone = req.IsMilestone
	existing.Description = req.Description
	existing.DependsOnTasks = req.DependsOnTasks
	existing.AssignedTo = req.AssignedTo
	existing.UpdatedAt = time.Now()

	if err := db.Save(&existing).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui tugas: " + err.Error()})
		return
	}

	// Recalculate progress for old and new project
	if oldProjectID != nil && *oldProjectID != "" {
		RecalculateProjectProgress(db, *oldProjectID)
	}
	if existing.ProjectID != nil && *existing.ProjectID != "" {
		RecalculateProjectProgress(db, *existing.ProjectID)
	}

	ctx.JSON(http.StatusOK, gin.H{"data": existing, "message": "Tugas berhasil diperbarui"})
}

func (ctrl *ProjectController) DeleteTask(ctx *gin.Context) {
	db, tenant, id := projDB(ctx), projTenant(ctx), ctx.Param("id")

	var task projectsmodel.Task
	if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND (id = ? OR task_code = ?)", tenant, id, id).
		First(&task).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Tugas tidak ditemukan"})
		return
	}

	projectID := task.ProjectID

	if err := db.Delete(&task).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus tugas: " + err.Error()})
		return
	}

	if projectID != nil && *projectID != "" {
		RecalculateProjectProgress(db, *projectID)
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "Tugas berhasil dihapus"})
}

func (ctrl *ProjectController) TaskOptions(ctx *gin.Context) {
	db, tenant := projDB(ctx), projTenant(ctx)

	var projects []projectsmodel.Project
	_ = db.Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant).
		Order("project_name asc").
		Find(&projects).Error

	projectOptions := make([]gin.H, 0, len(projects))
	for _, p := range projects {
		projectOptions = append(projectOptions, gin.H{
			"id":           p.ID,
			"project_name": p.ProjectName,
			"status":       p.Status,
		})
	}

	var parentTasks []projectsmodel.Task
	_ = db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND is_group = ?", tenant, true).
		Order("subject asc").
		Find(&parentTasks).Error

	parentOptions := make([]gin.H, 0, len(parentTasks))
	for _, pt := range parentTasks {
		parentOptions = append(parentOptions, gin.H{
			"id":        pt.ID,
			"task_code": pt.TaskCode,
			"subject":   pt.Subject,
		})
	}

	var activityTypes []projectsmodel.ActivityType
	_ = db.Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant).Find(&activityTypes).Error
	activityNames := make([]string, 0, len(activityTypes))
	for _, a := range activityTypes {
		activityNames = append(activityNames, a.Name)
	}

	ctx.JSON(http.StatusOK, gin.H{
		"projects":       projectOptions,
		"parent_tasks":   parentOptions,
		"activity_types": activityNames,
		"types":          []string{"Task", "Milestone", "Bug", "Enhancement", "Documentation", "Research"},
		"statuses": []string{
			string(projectsmodel.TaskStatusOpen),
			string(projectsmodel.TaskStatusWorking),
			string(projectsmodel.TaskStatusPendingReview),
			string(projectsmodel.TaskStatusOverdue),
			string(projectsmodel.TaskStatusTemplate),
			string(projectsmodel.TaskStatusCompleted),
			string(projectsmodel.TaskStatusCancelled),
		},
		"priorities": []string{
			string(projectsmodel.TaskPriorityLow),
			string(projectsmodel.TaskPriorityMedium),
			string(projectsmodel.TaskPriorityHigh),
			string(projectsmodel.TaskPriorityUrgent),
		},
	})
}
