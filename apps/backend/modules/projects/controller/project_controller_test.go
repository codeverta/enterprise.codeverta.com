package controller

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	projectsmodel "gin-template/modules/projects/model"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupTestProjectDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	assert.NoError(t, err)

	err = projectsmodel.Migrate(db)
	assert.NoError(t, err)

	return db
}

func setupProjectTestRouter(db *gorm.DB) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	r.Use(func(c *gin.Context) {
		c.Set("db", db)
		c.Set("tenant_id", "00000000-0000-0000-0000-000000000001")
		c.Next()
	})

	ctrl := NewProjectController()

	pGroup := r.Group("/projects")
	{
		pGroup.GET("", ctrl.ListProjects)
		pGroup.GET("/options", ctrl.ProjectOptions)
		pGroup.GET("/:id", ctrl.GetProject)
		pGroup.POST("", ctrl.CreateProject)
		pGroup.PUT("/:id", ctrl.UpdateProject)
		pGroup.DELETE("/:id", ctrl.DeleteProject)
	}

	tGroup := r.Group("/tasks")
	{
		tGroup.GET("", ctrl.ListTasks)
		tGroup.GET("/options", ctrl.TaskOptions)
		tGroup.GET("/:id", ctrl.GetTask)
		tGroup.POST("", ctrl.CreateTask)
		tGroup.PUT("/:id", ctrl.UpdateTask)
		tGroup.DELETE("/:id", ctrl.DeleteTask)
	}

	return r
}

func TestProjectCRUDAndNamingSeries(t *testing.T) {
	db := setupTestProjectDB(t)
	r := setupProjectTestRouter(db)

	// 1. Create Project
	reqBody := CreateProjectRequest{
		NamingSeries:          "PROJ-.####",
		ProjectName:           "Website Redesign 2026",
		Status:                projectsmodel.ProjectStatusOpen,
		ProjectType:           "External",
		PercentCompleteMethod: projectsmodel.PercentCompleteTaskCompletion,
		Priority:              "High",
		Department:            "Engineering & IT",
		Customer:              "PT Pelanggan Indonesia",
		EstimatedCost:         50000000,
	}
	bodyBytes, _ := json.Marshal(reqBody)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/projects", bytes.NewBuffer(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)

	var createResp struct {
		Data    projectsmodel.Project `json:"data"`
		Message string                `json:"message"`
	}
	err := json.Unmarshal(w.Body.Bytes(), &createResp)
	assert.NoError(t, err)
	assert.NotEmpty(t, createResp.Data.ID)
	assert.Contains(t, createResp.Data.ID, "PROJ-")
	assert.Equal(t, "Website Redesign 2026", createResp.Data.ProjectName)

	projectID := createResp.Data.ID

	// 2. Get Project
	w = httptest.NewRecorder()
	req, _ = http.NewRequest(http.MethodGet, "/projects/"+projectID, nil)
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	// 3. Update Project
	updateReq := reqBody
	updateReq.ProjectName = "Website Redesign Enterprise"
	updateReq.Priority = "Medium"
	upBytes, _ := json.Marshal(updateReq)

	w = httptest.NewRecorder()
	req, _ = http.NewRequest(http.MethodPut, "/projects/"+projectID, bytes.NewBuffer(upBytes))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	// Verify update
	var fetched projectsmodel.Project
	db.First(&fetched, "id = ?", projectID)
	assert.Equal(t, "Website Redesign Enterprise", fetched.ProjectName)
	assert.Equal(t, "Medium", fetched.Priority)
}

func TestTaskProgressRecalculation(t *testing.T) {
	db := setupTestProjectDB(t)
	r := setupProjectTestRouter(db)

	// 1. Create Project with Task Completion Method
	now := time.Now()
	project := projectsmodel.Project{
		ID:                    "PROJ-2026-TEST",
		TenantID:              "00000000-0000-0000-0000-000000000001",
		ProjectName:           "Core ERP Integration",
		Status:                projectsmodel.ProjectStatusOpen,
		PercentCompleteMethod: projectsmodel.PercentCompleteTaskCompletion,
		PercentComplete:       0,
		CreatedAt:             now,
		UpdatedAt:             now,
	}
	db.Create(&project)

	// 2. Create Task 1 (Open)
	projID := project.ID
	task1Req := CreateTaskRequest{
		Subject:     "Database Migration",
		ProjectID:   &projID,
		Status:      projectsmodel.TaskStatusOpen,
		Progress:    0,
		TaskWeight:  1,
	}
	b1, _ := json.Marshal(task1Req)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/tasks", bytes.NewBuffer(b1))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusCreated, w.Code)

	var pAfterTask1 projectsmodel.Project
	db.First(&pAfterTask1, "id = ?", projID)
	assert.Equal(t, float64(0), pAfterTask1.PercentComplete)

	// 3. Create Task 2 (Completed)
	task2Req := CreateTaskRequest{
		Subject:     "API Gateway Setup",
		ProjectID:   &projID,
		Status:      projectsmodel.TaskStatusCompleted,
		Progress:    100,
		TaskWeight:  1,
	}
	b2, _ := json.Marshal(task2Req)
	w = httptest.NewRecorder()
	req, _ = http.NewRequest(http.MethodPost, "/tasks", bytes.NewBuffer(b2))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusCreated, w.Code)

	var pAfterTask2 projectsmodel.Project
	db.First(&pAfterTask2, "id = ?", projID)
	// 1 out of 2 completed -> 50%
	assert.Equal(t, float64(50), pAfterTask2.PercentComplete)

	// 4. Test Task Weight Method
	db.Model(&project).Update("percent_complete_method", projectsmodel.PercentCompleteTaskWeight)
	// Task 1: weight 3, progress 0
	// Task 2: weight 1, progress 100
	// Weighted: (0*3 + 100*1) / (3+1) = 100/4 = 25%
	var tasks []projectsmodel.Task
	db.Where("project_id = ?", projID).Find(&tasks)
	db.Model(&tasks[0]).Update("task_weight", 3)
	db.Model(&tasks[1]).Update("task_weight", 1)

	RecalculateProjectProgress(db, projID)

	var pWeighted projectsmodel.Project
	db.First(&pWeighted, "id = ?", projID)
	assert.Equal(t, float64(25), pWeighted.PercentComplete)
}

func TestProjectFilteringByStatus(t *testing.T) {
	db := setupTestProjectDB(t)
	r := setupProjectTestRouter(db)

	now := time.Now()
	pOpen := projectsmodel.Project{
		ID:          "PROJ-2026-OPEN",
		TenantID:    "00000000-0000-0000-0000-000000000001",
		ProjectName: "Open Project",
		Status:      projectsmodel.ProjectStatusOpen,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	pClosed := projectsmodel.Project{
		ID:          "PROJ-2026-DONE",
		TenantID:    "00000000-0000-0000-0000-000000000001",
		ProjectName: "Closed Project",
		Status:      projectsmodel.ProjectStatusCompleted,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	db.Create(&pOpen)
	db.Create(&pClosed)

	// Filter ?status=Open
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/projects?status=Open", nil)
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	var resp struct {
		Data []projectsmodel.Project `json:"data"`
	}
	err := json.Unmarshal(w.Body.Bytes(), &resp)
	assert.NoError(t, err)
	assert.Len(t, resp.Data, 1)
	assert.Equal(t, "Open Project", resp.Data[0].ProjectName)
}
