package hrmodel

import (
	"time"

	"gorm.io/gorm"
)

type PayrollEntryStatus string

const (
	PayrollEntryStatusDraft     PayrollEntryStatus = "Draft"
	PayrollEntryStatusSubmitted PayrollEntryStatus = "Submitted"
	PayrollEntryStatusCancelled PayrollEntryStatus = "Cancelled"
)

type PayrollEntry struct {
	ID                 string                 `gorm:"type:varchar(64);primaryKey" json:"id"`
	TenantID           string                 `gorm:"type:varchar(64);index;not null" json:"tenant_id"`
	PostingDate        time.Time              `gorm:"type:date;not null" json:"posting_date"`
	PayrollFrequency   string                 `gorm:"type:varchar(50);default:'Monthly'" json:"payroll_frequency"`
	Company            string                 `gorm:"type:varchar(255)" json:"company"`
	Department         string                 `gorm:"type:varchar(255)" json:"department"`
	Branch             string                 `gorm:"type:varchar(255)" json:"branch"`
	Designation        string                 `gorm:"type:varchar(255)" json:"designation"`
	StartDate          time.Time              `gorm:"type:date;not null" json:"start_date"`
	EndDate            time.Time              `gorm:"type:date;not null" json:"end_date"`
	Currency           string                 `gorm:"type:varchar(10);default:'IDR'" json:"currency"`
	ExchangeRate       float64                `gorm:"type:decimal(18,6);default:1.0" json:"exchange_rate"`
	Status             PayrollEntryStatus     `gorm:"type:varchar(30);default:'Draft';index" json:"status"`
	TotalGrossPay      float64                `gorm:"type:decimal(18,2);default:0" json:"total_gross_pay"`
	TotalDeductions    float64                `gorm:"type:decimal(18,2);default:0" json:"total_deductions"`
	TotalNetPay        float64                `gorm:"type:decimal(18,2);default:0" json:"total_net_pay"`
	TotalEmployees     int                    `gorm:"default:0" json:"total_employees"`
	SalarySlipCreated  bool                   `gorm:"default:false" json:"salary_slip_created"`
	PaymentAccount     string                 `gorm:"type:varchar(255)" json:"payment_account"`
	CostCenter         string                 `gorm:"type:varchar(255)" json:"cost_center"`
	Items              []PayrollEntryEmployee `gorm:"foreignKey:PayrollEntryID;constraint:OnDelete:CASCADE" json:"items,omitempty"`
	CreatedAt          time.Time              `json:"created_at"`
	UpdatedAt          time.Time              `json:"updated_at"`
	DeletedAt          gorm.DeletedAt         `gorm:"index" json:"-"`
}

type PayrollEntryEmployee struct {
	ID             string         `gorm:"type:varchar(64);primaryKey" json:"id"`
	PayrollEntryID string         `gorm:"type:varchar(64);index;not null" json:"payroll_entry_id"`
	UserID         string         `gorm:"type:varchar(64);index" json:"user_id"`
	EmployeeName   string         `gorm:"type:varchar(255);not null" json:"employee_name"`
	EmployeeEmail  string         `gorm:"type:varchar(255)" json:"employee_email"`
	Department     string         `gorm:"type:varchar(255)" json:"department"`
	Designation    string         `gorm:"type:varchar(255)" json:"designation"`
	BasicSalary    float64        `gorm:"type:decimal(18,2);default:0" json:"basic_salary"`
	Allowances     float64        `gorm:"type:decimal(18,2);default:0" json:"allowances"`
	Deductions     float64        `gorm:"type:decimal(18,2);default:0" json:"deductions"`
	GrossPay       float64        `gorm:"type:decimal(18,2);default:0" json:"gross_pay"`
	NetPay         float64        `gorm:"type:decimal(18,2);default:0" json:"net_pay"`
	Status         string         `gorm:"type:varchar(30);default:'Pending'" json:"status"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}

func (PayrollEntry) TableName() string {
	return "hr_payroll_entries"
}

func (PayrollEntryEmployee) TableName() string {
	return "hr_payroll_entry_employees"
}
