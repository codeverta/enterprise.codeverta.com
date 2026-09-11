package hrmodel

import (
	"time"
)

type EmployeeOnboarding struct {
	ID                         string                       `gorm:"primaryKey;type:varchar(64)" json:"id"`
	TenantID                   string                       `gorm:"type:varchar(64);index" json:"tenant_id"`
	OnboardingNumber           string                       `gorm:"type:varchar(64);index" json:"onboarding_number"`
	JobApplicant               string                       `gorm:"type:varchar(140);index" json:"job_applicant"`
	ApplicantName              string                       `gorm:"type:varchar(140)" json:"applicant_name"`
	ApplicantEmail             string                       `gorm:"type:varchar(140)" json:"applicant_email"`
	ApplicantPhone             string                       `gorm:"type:varchar(40)" json:"applicant_phone"`
	Employee                   string                       `gorm:"type:varchar(64);index" json:"employee"`
	EmployeeName               string                       `gorm:"type:varchar(140)" json:"employee_name"`
	Company                    string                       `gorm:"type:varchar(140)" json:"company"`
	Department                 string                       `gorm:"type:varchar(140)" json:"department"`
	Designation                string                       `gorm:"type:varchar(140)" json:"designation"`
	EmployeeGrade              string                       `gorm:"type:varchar(60)" json:"employee_grade"`
	EmployeeOnboardingTemplate string                       `gorm:"type:varchar(140)" json:"employee_onboarding_template"`
	DateOfJoining              string                       `gorm:"type:varchar(20)" json:"date_of_joining"`
	Status                     string                       `gorm:"type:varchar(40);default:'Pending'" json:"status"` // Pending, In Progress, Completed
	Project                    string                       `gorm:"type:varchar(140)" json:"project"`
	Notes                      string                       `gorm:"type:text" json:"notes"`
	Activities                 []EmployeeOnboardingActivity `gorm:"foreignKey:OnboardingID;constraint:OnDelete:CASCADE" json:"activities"`
	CreatedAt                  time.Time                    `json:"created_at"`
	UpdatedAt                  time.Time                    `json:"updated_at"`
}

func (EmployeeOnboarding) TableName() string {
	return "hr_employee_onboardings"
}

type EmployeeOnboardingActivity struct {
	ID           string     `gorm:"primaryKey;type:varchar(64)" json:"id"`
	TenantID     string     `gorm:"type:varchar(64);index" json:"tenant_id"`
	OnboardingID string     `gorm:"type:varchar(64);index;not null" json:"onboarding_id"`
	ActivityName string     `gorm:"type:varchar(255);not null" json:"activity_name"`
	Role         string     `gorm:"type:varchar(100)" json:"role"`
	User         string     `gorm:"type:varchar(140)" json:"user"`
	BeginOn      int        `gorm:"default:0" json:"begin_on"`
	Duration     int        `gorm:"default:1" json:"duration"`
	Required     bool       `gorm:"default:true" json:"required"`
	Status       string     `gorm:"type:varchar(40);default:'Pending'" json:"status"` // Pending, Completed
	CompletedAt  *time.Time `json:"completed_at,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

func (EmployeeOnboardingActivity) TableName() string {
	return "hr_employee_onboarding_activities"
}

type EmployeeOnboardingTemplate struct {
	ID            string                             `gorm:"primaryKey;type:varchar(64)" json:"id"`
	TenantID      string                             `gorm:"type:varchar(64);index" json:"tenant_id"`
	TemplateName  string                             `gorm:"type:varchar(140);not null" json:"template_name"`
	Department    string                             `gorm:"type:varchar(140)" json:"department"`
	Designation   string                             `gorm:"type:varchar(140)" json:"designation"`
	EmployeeGrade string                             `gorm:"type:varchar(60)" json:"employee_grade"`
	Company       string                             `gorm:"type:varchar(140)" json:"company"`
	Activities    []EmployeeOnboardingTemplateDetail `gorm:"foreignKey:TemplateID;constraint:OnDelete:CASCADE" json:"activities"`
	CreatedAt     time.Time                          `json:"created_at"`
	UpdatedAt     time.Time                          `json:"updated_at"`
}

func (EmployeeOnboardingTemplate) TableName() string {
	return "hr_employee_onboarding_templates"
}

type EmployeeOnboardingTemplateDetail struct {
	ID           string    `gorm:"primaryKey;type:varchar(64)" json:"id"`
	TenantID     string    `gorm:"type:varchar(64);index" json:"tenant_id"`
	TemplateID   string    `gorm:"type:varchar(64);index;not null" json:"template_id"`
	ActivityName string    `gorm:"type:varchar(255);not null" json:"activity_name"`
	Role         string    `gorm:"type:varchar(100)" json:"role"`
	User         string    `gorm:"type:varchar(140)" json:"user"`
	BeginOn      int       `gorm:"default:0" json:"begin_on"`
	Duration     int       `gorm:"default:1" json:"duration"`
	Required     bool      `gorm:"default:true" json:"required"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

func (EmployeeOnboardingTemplateDetail) TableName() string {
	return "hr_employee_onboarding_template_details"
}
