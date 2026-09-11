package hrmodel

import (
	"time"

	"gorm.io/gorm"
)

type AttendanceStatus string

const (
	AttendanceStatusPresent AttendanceStatus = "Present"
	AttendanceStatusAbsent  AttendanceStatus = "Absent"
	AttendanceStatusOnLeave AttendanceStatus = "On Leave"
	AttendanceStatusHalfDay AttendanceStatus = "Half Day"
)

type CheckinLogType string

const (
	CheckinLogTypeIN  CheckinLogType = "IN"
	CheckinLogTypeOUT CheckinLogType = "OUT"
)

type Attendance struct {
	ID             string           `gorm:"type:varchar(64);primaryKey" json:"id"`
	TenantID       string           `gorm:"type:varchar(64);index;not null" json:"tenant_id"`
	UserID         string           `gorm:"type:varchar(64);index" json:"user_id"`
	EmployeeName   string           `gorm:"type:varchar(255);not null" json:"employee_name"`
	EmployeeEmail  string           `gorm:"type:varchar(255)" json:"employee_email"`
	Department     string           `gorm:"type:varchar(255)" json:"department"`
	AttendanceDate time.Time        `gorm:"type:date;not null;index" json:"attendance_date"`
	Status         AttendanceStatus `gorm:"type:varchar(30);not null;index" json:"status"`
	Shift          string           `gorm:"type:varchar(100)" json:"shift"`
	InTime         *time.Time       `json:"in_time"`
	OutTime        *time.Time       `json:"out_time"`
	WorkingHours   float64          `gorm:"type:decimal(5,2);default:0" json:"working_hours"`
	LateEntry      bool             `gorm:"default:false" json:"late_entry"`
	EarlyExit      bool             `gorm:"default:false" json:"early_exit"`
	DeviceID       string           `gorm:"type:varchar(100)" json:"device_id"`
	Source         string           `gorm:"type:varchar(50);default:'Manual'" json:"source"` // Manual, QR Code, Fingerprint, RFID, Attendance Tool
	DocStatus      int              `gorm:"type:int;default:1" json:"docstatus"`            // 0=Draft, 1=Submitted, 2=Cancelled
	Remarks        string           `gorm:"type:text" json:"remarks"`
	CreatedAt      time.Time        `json:"created_at"`
	UpdatedAt      time.Time        `json:"updated_at"`
	DeletedAt      gorm.DeletedAt   `gorm:"index" json:"-"`
}

type EmployeeCheckin struct {
	ID           string         `gorm:"type:varchar(64);primaryKey" json:"id"`
	TenantID     string         `gorm:"type:varchar(64);index;not null" json:"tenant_id"`
	UserID       string         `gorm:"type:varchar(64);index;not null" json:"user_id"`
	EmployeeName string         `gorm:"type:varchar(255);not null" json:"employee_name"`
	LogType      CheckinLogType `gorm:"type:varchar(10);not null" json:"log_type"` // IN, OUT
	Timestamp    time.Time      `gorm:"not null;index" json:"timestamp"`
	DeviceID     string         `gorm:"type:varchar(100)" json:"device_id"`
	Source       string         `gorm:"type:varchar(50);default:'QR Code'" json:"source"` // QR Code, Fingerprint, RFID, Kiosk
	Location     string         `gorm:"type:varchar(255)" json:"location"`
	Latitude     float64        `gorm:"type:decimal(10,8)" json:"latitude"`
	Longitude    float64        `gorm:"type:decimal(11,8)" json:"longitude"`
	AttendanceID string         `gorm:"type:varchar(64);index" json:"attendance_id"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

type ShiftType struct {
	ID                   string         `gorm:"type:varchar(64);primaryKey" json:"id"`
	TenantID             string         `gorm:"type:varchar(64);index;not null" json:"tenant_id"`
	Name                 string         `gorm:"type:varchar(255);not null" json:"name"`
	StartTime            string         `gorm:"type:varchar(10);not null" json:"start_time"` // e.g. "08:00"
	EndTime              string         `gorm:"type:varchar(10);not null" json:"end_time"`   // e.g. "17:00"
	LateThresholdMinutes int            `gorm:"default:15" json:"late_threshold_minutes"`
	EarlyExitMinutes     int            `gorm:"default:15" json:"early_exit_minutes"`
	CreatedAt            time.Time      `json:"created_at"`
	UpdatedAt            time.Time      `json:"updated_at"`
	DeletedAt            gorm.DeletedAt `gorm:"index" json:"-"`
}

func (Attendance) TableName() string {
	return "hr_attendances"
}

func (EmployeeCheckin) TableName() string {
	return "hr_employee_checkins"
}

func (ShiftType) TableName() string {
	return "hr_shift_types"
}
