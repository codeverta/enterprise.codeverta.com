package model

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Migrate runs schema migrations and seeds default lookup data for the projects module.
func Migrate(db *gorm.DB) error {
	models := []interface{}{
		&Project{},
		&Task{},
		&ProjectType{},
		&ProjectTemplate{},
		&ActivityType{},
		&Timesheet{},
		&TimesheetDetail{},
	}

	for _, m := range models {
		if err := db.AutoMigrate(m); err != nil {
			return fmt.Errorf("failed to migrate %T: %w", m, err)
		}
	}

	// Create composite indexes for multi-tenant query performance
	indexes := []string{
		"CREATE INDEX IF NOT EXISTS idx_projects_tenant_status ON projects (tenant_id, status);",
		"CREATE INDEX IF NOT EXISTS idx_projects_tenant_name ON projects (tenant_id, project_name);",
		"CREATE INDEX IF NOT EXISTS idx_project_tasks_tenant_project ON project_tasks (tenant_id, project_id);",
		"CREATE INDEX IF NOT EXISTS idx_project_tasks_tenant_status ON project_tasks (tenant_id, status);",
		"CREATE INDEX IF NOT EXISTS idx_timesheets_tenant_status ON project_timesheets (tenant_id, status);",
		"CREATE INDEX IF NOT EXISTS idx_timesheets_tenant_employee ON project_timesheets (tenant_id, employee_id);",
		"CREATE INDEX IF NOT EXISTS idx_timesheets_tenant_project ON project_timesheets (tenant_id, project_id);",
		"CREATE INDEX IF NOT EXISTS idx_timesheet_details_ts ON project_timesheet_details (timesheet_id);",
	}

	for _, idx := range indexes {
		// Ignore errors on DBs that don't support CREATE INDEX IF NOT EXISTS identical syntax
		_ = db.Exec(idx).Error
	}

	// Seed default Project Types if empty
	var typeCount int64
	db.Model(&ProjectType{}).Count(&typeCount)
	if typeCount == 0 {
		defaultTypes := []string{"Internal", "External", "Service", "Research & Development"}
		for _, name := range defaultTypes {
			db.Create(&ProjectType{
				ID:        uuid.NewString(),
				TenantID:  "00000000-0000-0000-0000-000000000001",
				Name:      name,
				CreatedAt: time.Now(),
				UpdatedAt: time.Now(),
			})
		}
	}

	// Seed default Activity Types if empty
	var activityCount int64
	db.Model(&ActivityType{}).Count(&activityCount)
	if activityCount == 0 {
		defaultActivities := []string{"Communication", "Planning", "Development", "Design", "Testing", "Review", "Deployment", "Support"}
		for _, name := range defaultActivities {
			db.Create(&ActivityType{
				ID:        uuid.NewString(),
				TenantID:  "00000000-0000-0000-0000-000000000001",
				Name:      name,
				CreatedAt: time.Now(),
				UpdatedAt: time.Now(),
			})
		}
	}

	return nil
}
