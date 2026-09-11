package model

import (
	"time"

	"gorm.io/gorm"
)

type TimesheetStatus string

const (
	TimesheetStatusDraft     TimesheetStatus = "Draft"
	TimesheetStatusSubmitted TimesheetStatus = "Submitted"
	TimesheetStatusBilled    TimesheetStatus = "Billed"
	TimesheetStatusPayslip   TimesheetStatus = "Payslip"
	TimesheetStatusCancelled TimesheetStatus = "Cancelled"
)

type Timesheet struct {
	ID                  string            `gorm:"primaryKey;type:varchar(64)" json:"id"`
	TenantID            string            `gorm:"type:varchar(36);index" json:"tenant_id"`
	Series              string            `gorm:"type:varchar(64);default:'TS-.YYYY.-.#####'" json:"series"`
	EmployeeID          string            `gorm:"type:varchar(36);index" json:"employee_id"`
	EmployeeName        string            `gorm:"type:varchar(255);not null;index" json:"employee_name"`
	EmployeeEmail       string            `gorm:"type:varchar(255)" json:"employee_email"`
	Company             string            `gorm:"type:varchar(255);not null" json:"company"`
	Customer            string            `gorm:"type:varchar(255)" json:"customer"`
	Currency            string            `gorm:"type:varchar(16);default:'IDR'" json:"currency"`
	ExchangeRate        float64           `gorm:"type:decimal(12,4);default:1" json:"exchange_rate"`
	Status              TimesheetStatus   `gorm:"type:varchar(32);default:'Draft';index" json:"status"`
	ProjectID           *string           `gorm:"type:varchar(36);index" json:"project_id"`
	ProjectName         string            `gorm:"type:varchar(255)" json:"project_name"`
	StartDate           *time.Time        `json:"start_date"`
	EndDate             *time.Time        `json:"end_date"`
	TotalWorkingHours   float64           `gorm:"type:decimal(10,2);default:0" json:"total_working_hours"`
	TotalBillableHours  float64           `gorm:"type:decimal(10,2);default:0" json:"total_billable_hours"`
	TotalBilledHours    float64           `gorm:"type:decimal(10,2);default:0" json:"total_billed_hours"`
	TotalBillableAmount float64           `gorm:"type:decimal(15,2);default:0" json:"total_billable_amount"`
	TotalCostingAmount  float64           `gorm:"type:decimal(15,2);default:0" json:"total_costing_amount"`
	SalesInvoice        string            `gorm:"type:varchar(64)" json:"sales_invoice"`
	Notes               string            `gorm:"type:text" json:"notes"`
	TimeLogs            []TimesheetDetail `gorm:"foreignKey:TimesheetID" json:"time_logs,omitempty"`
	CreatedAt           time.Time         `json:"created_at"`
	UpdatedAt           time.Time         `json:"updated_at"`
	DeletedAt           gorm.DeletedAt    `gorm:"index" json:"-"`
}

func (Timesheet) TableName() string {
	return "project_timesheets"
}

type TimesheetDetail struct {
	ID            string         `gorm:"primaryKey;type:varchar(36)" json:"id"`
	TenantID      string         `gorm:"type:varchar(36);index" json:"tenant_id"`
	TimesheetID   string         `gorm:"type:varchar(64);not null;index" json:"timesheet_id"`
	Idx           int            `gorm:"default:1" json:"idx"`
	ActivityType  string         `gorm:"type:varchar(128);not null" json:"activity_type"`
	FromTime      time.Time      `json:"from_time"`
	ToTime        *time.Time     `json:"to_time"`
	Hours         float64        `gorm:"type:decimal(8,2);default:0" json:"hours"`
	ProjectID     *string        `gorm:"type:varchar(36);index" json:"project_id"`
	ProjectName   string         `gorm:"type:varchar(255)" json:"project_name"`
	TaskID        *string        `gorm:"type:varchar(36)" json:"task_id"`
	TaskName      string         `gorm:"type:varchar(255)" json:"task_name"`
	IsBillable    bool           `gorm:"default:false" json:"is_billable"`
	BillingRate   float64        `gorm:"type:decimal(15,2);default:0" json:"billing_rate"`
	BillingAmount float64        `gorm:"type:decimal(15,2);default:0" json:"billing_amount"`
	CostingRate   float64        `gorm:"type:decimal(15,2);default:0" json:"costing_rate"`
	CostingAmount float64        `gorm:"type:decimal(15,2);default:0" json:"costing_amount"`
	Description   string         `gorm:"type:text" json:"description"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

func (TimesheetDetail) TableName() string {
	return "project_timesheet_details"
}
