package hrmodel

import (
	"fmt"

	"gorm.io/gorm"
)

func Migrate(db *gorm.DB) error {
	if db == nil {
		return fmt.Errorf("db is nil")
	}

	if err := db.AutoMigrate(
		&PayrollEntry{},
		&PayrollEntryEmployee{},
		&Attendance{},
		&EmployeeCheckin{},
		&ShiftType{},
		&EmployeeOnboarding{},
		&EmployeeOnboardingActivity{},
		&EmployeeOnboardingTemplate{},
		&EmployeeOnboardingTemplateDetail{},
	); err != nil {
		return fmt.Errorf("auto migrate HR models: %w", err)
	}

	indexes := []struct {
		table     interface{}
		indexName string
		columns   string
	}{
		{&PayrollEntry{}, "idx_hr_payroll_entry_tenant", "tenant_id"},
		{&PayrollEntry{}, "idx_hr_payroll_entry_status", "status"},
		{&PayrollEntryEmployee{}, "idx_hr_payroll_employee_entry", "payroll_entry_id"},
		{&PayrollEntryEmployee{}, "idx_hr_payroll_employee_user", "user_id"},
		{&Attendance{}, "idx_hr_attendance_tenant_date", "tenant_id, attendance_date"},
		{&Attendance{}, "idx_hr_attendance_user_date", "user_id, attendance_date"},
		{&EmployeeCheckin{}, "idx_hr_checkin_user_timestamp", "user_id, timestamp"},
		{&ShiftType{}, "idx_hr_shift_type_tenant", "tenant_id"},
		{&EmployeeOnboarding{}, "idx_hr_onboarding_tenant", "tenant_id"},
		{&EmployeeOnboarding{}, "idx_hr_onboarding_status", "status"},
		{&EmployeeOnboardingActivity{}, "idx_hr_onb_act_onboarding", "onboarding_id"},
		{&EmployeeOnboardingTemplate{}, "idx_hr_onb_tmpl_tenant", "tenant_id"},
	}

	for _, idx := range indexes {
		sql := fmt.Sprintf("CREATE INDEX IF NOT EXISTS %s ON %s(%s)", idx.indexName, getTableName(db, idx.table), idx.columns)
		_ = db.Exec(sql).Error
	}

	return nil
}

func getTableName(db *gorm.DB, model interface{}) string {
	stmt := &gorm.Statement{DB: db}
	_ = stmt.Parse(model)
	return stmt.Schema.Table
}
