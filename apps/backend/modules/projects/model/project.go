package model

import (
	"time"

	"gorm.io/gorm"
)

type ProjectStatus string

const (
	ProjectStatusOpen      ProjectStatus = "Open"
	ProjectStatusCompleted ProjectStatus = "Completed"
	ProjectStatusCancelled ProjectStatus = "Cancelled"
)

type PercentCompleteMethod string

const (
	PercentCompleteManual         PercentCompleteMethod = "Manual"
	PercentCompleteTaskCompletion PercentCompleteMethod = "Task Completion"
	PercentCompleteTaskProgress   PercentCompleteMethod = "Task Progress"
	PercentCompleteTaskWeight     PercentCompleteMethod = "Task Weight"
)

type TaskStatus string

const (
	TaskStatusOpen          TaskStatus = "Open"
	TaskStatusWorking       TaskStatus = "Working"
	TaskStatusPendingReview TaskStatus = "Pending Review"
	TaskStatusOverdue       TaskStatus = "Overdue"
	TaskStatusTemplate      TaskStatus = "Template"
	TaskStatusCompleted     TaskStatus = "Completed"
	TaskStatusCancelled     TaskStatus = "Cancelled"
)

type TaskPriority string

const (
	TaskPriorityLow    TaskPriority = "Low"
	TaskPriorityMedium TaskPriority = "Medium"
	TaskPriorityHigh   TaskPriority = "High"
	TaskPriorityUrgent TaskPriority = "Urgent"
)

// Project represents the ERP Project DocType
type Project struct {
	ID                    string                `gorm:"primaryKey;type:varchar(36)" json:"id"`
	TenantID              string                `gorm:"type:varchar(36);index" json:"tenant_id"`
	NamingSeries          string                `gorm:"type:varchar(64);default:'PROJ-.####'" json:"naming_series"`
	ProjectName           string                `gorm:"type:varchar(255);not null;index" json:"project_name"`
	Status                ProjectStatus         `gorm:"type:varchar(32);default:'Open';index" json:"status"`
	ProjectType           string                `gorm:"type:varchar(128)" json:"project_type"`
	PercentCompleteMethod PercentCompleteMethod `gorm:"type:varchar(64);default:'Task Completion'" json:"percent_complete_method"`
	PercentComplete       float64               `gorm:"type:decimal(6,2);default:0" json:"percent_complete"`
	ProjectTemplate       string                `gorm:"type:varchar(128)" json:"project_template"`
	Priority              string                `gorm:"type:varchar(32);default:'Medium'" json:"priority"`
	Department            string                `gorm:"type:varchar(128)" json:"department"`
	Customer              string                `gorm:"type:varchar(255)" json:"customer"`
	IsActive              bool                  `gorm:"default:true" json:"is_active"`
	ExpectedStartDate     *time.Time            `json:"expected_start_date"`
	ExpectedEndDate       *time.Time            `json:"expected_end_date"`
	ActualStartDate       *time.Time            `json:"actual_start_date"`
	ActualEndDate         *time.Time            `json:"actual_end_date"`
	EstimatedCost         float64               `gorm:"type:decimal(15,2);default:0" json:"estimated_cost"`
	TotalCostingAmount    float64               `gorm:"type:decimal(15,2);default:0" json:"total_costing_amount"`
	TotalExpenseClaim     float64               `gorm:"type:decimal(15,2);default:0" json:"total_expense_claim"`
	Notes                 string                `gorm:"type:text" json:"notes"`
	Tasks                 []Task                `gorm:"foreignKey:ProjectID" json:"tasks,omitempty"`
	CreatedAt             time.Time             `json:"created_at"`
	UpdatedAt             time.Time             `json:"updated_at"`
	DeletedAt             gorm.DeletedAt        `gorm:"index" json:"-"`
}

func (Project) TableName() string {
	return "projects"
}

// Task represents the ERP Task DocType
type Task struct {
	ID             string         `gorm:"primaryKey;type:varchar(36)" json:"id"`
	TenantID       string         `gorm:"type:varchar(36);index" json:"tenant_id"`
	TaskCode       string         `gorm:"type:varchar(64);index" json:"task_code"`
	Subject        string         `gorm:"type:varchar(255);not null;index" json:"subject"`
	ProjectID      *string        `gorm:"type:varchar(36);index" json:"project_id"`
	ProjectName    string         `gorm:"type:varchar(255)" json:"project_name"`
	Issue          string         `gorm:"type:varchar(128)" json:"issue"`
	Type           string         `gorm:"type:varchar(64)" json:"type"`
	Color          string         `gorm:"type:varchar(32);default:'#3B82F6'" json:"color"`
	IsGroup        bool           `gorm:"default:false" json:"is_group"`
	Status         TaskStatus     `gorm:"type:varchar(32);default:'Open';index" json:"status"`
	Priority       TaskPriority   `gorm:"type:varchar(32);default:'Medium'" json:"priority"`
	TaskWeight     float64        `gorm:"type:decimal(6,2);default:1" json:"task_weight"`
	ParentTaskID   *string        `gorm:"type:varchar(36);index" json:"parent_task_id"`
	ParentTaskName string         `gorm:"type:varchar(255)" json:"parent_task_name"`
	IsTemplate     bool           `gorm:"default:false" json:"is_template"`
	ExpStartDate   *time.Time     `json:"exp_start_date"`
	ExpectedTime   float64        `gorm:"type:decimal(8,2);default:0" json:"expected_time"` // in hours
	ExpEndDate     *time.Time     `json:"exp_end_date"`
	ActStartDate   *time.Time     `json:"act_start_date"`
	ActEndDate     *time.Time     `json:"act_end_date"`
	ActualTime     float64        `gorm:"type:decimal(8,2);default:0" json:"actual_time"` // in hours
	Progress       float64        `gorm:"type:decimal(6,2);default:0" json:"progress"`    // percent 0-100
	IsMilestone    bool           `gorm:"default:false" json:"is_milestone"`
	Description    string         `gorm:"type:text" json:"description"`
	DependsOnTasks string         `gorm:"type:text" json:"depends_on_tasks"` // JSON or comma separated
	AssignedTo     string         `gorm:"type:varchar(255)" json:"assigned_to"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}

func (Task) TableName() string {
	return "project_tasks"
}

// ProjectType represents lookup table for project types
type ProjectType struct {
	ID        string         `gorm:"primaryKey;type:varchar(36)" json:"id"`
	TenantID  string         `gorm:"type:varchar(36);index" json:"tenant_id"`
	Name      string         `gorm:"type:varchar(128);not null" json:"name"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (ProjectType) TableName() string {
	return "project_types"
}

// ProjectTemplate represents project templates
type ProjectTemplate struct {
	ID        string         `gorm:"primaryKey;type:varchar(36)" json:"id"`
	TenantID  string         `gorm:"type:varchar(36);index" json:"tenant_id"`
	Name      string         `gorm:"type:varchar(128);not null" json:"name"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (ProjectTemplate) TableName() string {
	return "project_templates"
}

// ActivityType represents task/project activity types
type ActivityType struct {
	ID        string         `gorm:"primaryKey;type:varchar(36)" json:"id"`
	TenantID  string         `gorm:"type:varchar(36);index" json:"tenant_id"`
	Name      string         `gorm:"type:varchar(128);not null" json:"name"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (ActivityType) TableName() string {
	return "project_activity_types"
}
