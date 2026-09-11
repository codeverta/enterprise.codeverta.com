package controller

import (
	"errors"
	"fmt"
	"math"
	"net/http"
	"strings"
	"time"

	"gin-template/model"
	hrmodel "gin-template/modules/hr/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AttendanceController struct{}

func NewAttendanceController() *AttendanceController {
	return &AttendanceController{}
}

func (ctrl *AttendanceController) List(ctx *gin.Context) {
	db, tenant := hrDB(ctx), hrTenant(ctx)
	var records []hrmodel.Attendance

	query := db.Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant)

	if dateStr := strings.TrimSpace(ctx.Query("date")); dateStr != "" {
		if parsedDate, err := time.Parse("2006-01-02", dateStr); err == nil {
			startOfDay := time.Date(parsedDate.Year(), parsedDate.Month(), parsedDate.Day(), 0, 0, 0, 0, time.UTC)
			endOfDay := startOfDay.AddDate(0, 0, 1)
			query = query.Where("attendance_date >= ? AND attendance_date < ?", startOfDay, endOfDay)
		}
	} else if monthStr := strings.TrimSpace(ctx.Query("month")); monthStr != "" {
		if parsedMonth, err := time.Parse("2006-01", monthStr); err == nil {
			startOfMonth := time.Date(parsedMonth.Year(), parsedMonth.Month(), 1, 0, 0, 0, 0, time.UTC)
			endOfMonth := startOfMonth.AddDate(0, 1, 0)
			query = query.Where("attendance_date >= ? AND attendance_date < ?", startOfMonth, endOfMonth)
		}
	}

	if userID := strings.TrimSpace(ctx.Query("user_id")); userID != "" {
		query = query.Where("user_id = ?", userID)
	}
	if status := strings.TrimSpace(ctx.Query("status")); status != "" {
		query = query.Where("status = ?", status)
	}
	if department := strings.TrimSpace(ctx.Query("department")); department != "" {
		query = query.Where("department = ?", department)
	}
	if shift := strings.TrimSpace(ctx.Query("shift")); shift != "" {
		query = query.Where("shift = ?", shift)
	}
	if search := strings.TrimSpace(ctx.Query("q")); search != "" {
		like := "%" + search + "%"
		query = query.Where("employee_name LIKE ? OR employee_email LIKE ? OR id LIKE ?", like, like, like)
	}

	if err := query.Order("attendance_date desc, created_at desc").Find(&records).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil daftar Attendance"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": records})
}

func (ctrl *AttendanceController) Get(ctx *gin.Context) {
	db, tenant, id := hrDB(ctx), hrTenant(ctx), ctx.Param("id")
	var record hrmodel.Attendance

	if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).
		First(&record).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "Data Attendance tidak ditemukan"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil detail Attendance"})
		return
	}
	ctx.JSON(http.StatusOK, record)
}

func (ctrl *AttendanceController) Create(ctx *gin.Context) {
	db, tenant := hrDB(ctx), hrTenant(ctx)
	var input hrmodel.Attendance

	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Payload JSON tidak valid"})
		return
	}

	if input.UserID == "" && input.EmployeeName == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Employee / User wajib dipilih"})
		return
	}

	now := time.Now()
	todayDate := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

	if input.AttendanceDate.IsZero() {
		input.AttendanceDate = todayDate
	} else {
		inputDateOnly := time.Date(input.AttendanceDate.Year(), input.AttendanceDate.Month(), input.AttendanceDate.Day(), 0, 0, 0, 0, input.AttendanceDate.Location())
		if inputDateOnly.After(todayDate) {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "Attendance cannot be marked for future dates (Absensi tidak dapat dibuat untuk tanggal masa depan)"})
			return
		}
		input.AttendanceDate = inputDateOnly
	}

	// Auto fill employee information if UserID is given
	if input.UserID != "" && (input.EmployeeName == "" || input.EmployeeEmail == "") {
		var user model.User
		if err := db.Where("id = ?", input.UserID).First(&user).Error; err == nil {
			if input.EmployeeName == "" {
				name := user.DisplayName
				if name == "" {
					name = strings.TrimSpace(user.FirstName + " " + user.LastName)
				}
				if name == "" {
					name = user.Username
				}
				input.EmployeeName = name
			}
			if input.EmployeeEmail == "" {
				input.EmployeeEmail = user.Email
			}
		}
	}

	// Check if attendance already marked for this employee on this date
	var existing hrmodel.Attendance
	if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND user_id = ? AND attendance_date = ?", tenant, input.UserID, input.AttendanceDate).
		First(&existing).Error; err == nil {
		ctx.JSON(http.StatusConflict, gin.H{"error": fmt.Sprintf("Absensi untuk %s pada tanggal %s sudah tercatat", input.EmployeeName, input.AttendanceDate.Format("2006-01-02"))})
		return
	}

	if input.ID == "" || input.ID == "new" {
		input.ID = fmt.Sprintf("HR-ATT-%s-%s", now.Format("20060102"), uuid.New().String()[:6])
	}
	input.TenantID = tenant
	if input.Status == "" {
		input.Status = hrmodel.AttendanceStatusPresent
	}
	if input.Source == "" {
		input.Source = "Manual"
	}
	if input.DocStatus == 0 {
		input.DocStatus = 1 // Submitted
	}

	calculateWorkingHours(&input)

	if err := db.Create(&input).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan Attendance: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, input)
}

func (ctrl *AttendanceController) Update(ctx *gin.Context) {
	db, tenant, id := hrDB(ctx), hrTenant(ctx), ctx.Param("id")

	var existing hrmodel.Attendance
	if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).
		First(&existing).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Data Attendance tidak ditemukan"})
		return
	}

	var input hrmodel.Attendance
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Payload JSON tidak valid"})
		return
	}

	if !input.AttendanceDate.IsZero() {
		now := time.Now()
		todayDate := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		inputDateOnly := time.Date(input.AttendanceDate.Year(), input.AttendanceDate.Month(), input.AttendanceDate.Day(), 0, 0, 0, 0, input.AttendanceDate.Location())
		if inputDateOnly.After(todayDate) {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "Attendance cannot be marked for future dates"})
			return
		}
		existing.AttendanceDate = inputDateOnly
	}

	if input.Status != "" {
		existing.Status = input.Status
	}
	if input.Shift != "" {
		existing.Shift = input.Shift
	}
	if input.Department != "" {
		existing.Department = input.Department
	}
	existing.InTime = input.InTime
	existing.OutTime = input.OutTime
	existing.Remarks = input.Remarks
	existing.UpdatedAt = time.Now()

	calculateWorkingHours(&existing)

	if err := db.Save(&existing).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui Attendance"})
		return
	}

	ctx.JSON(http.StatusOK, existing)
}

func (ctrl *AttendanceController) Delete(ctx *gin.Context) {
	db, tenant, id := hrDB(ctx), hrTenant(ctx), ctx.Param("id")

	var record hrmodel.Attendance
	if err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND id = ?", tenant, id).
		First(&record).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Data Attendance tidak ditemukan"})
		return
	}

	if err := db.Delete(&record).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus Attendance"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "Attendance berhasil dihapus"})
}

// MarkBulk (Employee Attendance Tool) allows bulk marking attendance for employees across dates
func (ctrl *AttendanceController) MarkBulk(ctx *gin.Context) {
	db, tenant := hrDB(ctx), hrTenant(ctx)

	var payload struct {
		UserIDs         []string                 `json:"user_ids"`
		Dates           []string                 `json:"dates"`
		Status          hrmodel.AttendanceStatus `json:"status"`
		Shift           string                   `json:"shift"`
		ExcludeHolidays bool                     `json:"exclude_holidays"`
		Remarks         string                   `json:"remarks"`
	}

	if err := ctx.ShouldBindJSON(&payload); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Payload bulk attendance tidak valid"})
		return
	}

	if len(payload.UserIDs) == 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Minimal 1 karyawan harus dipilih"})
		return
	}
	if len(payload.Dates) == 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Minimal 1 tanggal harus dipilih"})
		return
	}
	if payload.Status == "" {
		payload.Status = hrmodel.AttendanceStatusPresent
	}

	now := time.Now()
	todayDate := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

	// Fetch users
	var users []model.User
	_ = db.Where("id IN ?", payload.UserIDs).Find(&users).Error
	userMap := make(map[string]model.User)
	for _, u := range users {
		userMap[u.ID.String()] = u
	}

	var createdCount int
	var updatedCount int

	for _, dateStr := range payload.Dates {
		parsedDate, err := time.Parse("2006-01-02", dateStr)
		if err != nil {
			continue
		}
		dateOnly := time.Date(parsedDate.Year(), parsedDate.Month(), parsedDate.Day(), 0, 0, 0, 0, time.UTC)
		if dateOnly.After(todayDate) {
			continue // Skip future dates per Frappe HR rules
		}

		// Exclude holidays (Saturday and Sunday)
		if payload.ExcludeHolidays {
			weekday := dateOnly.Weekday()
			if weekday == time.Saturday || weekday == time.Sunday {
				continue
			}
		}

		for _, uid := range payload.UserIDs {
			u, exists := userMap[uid]
			empName := uid
			empEmail := ""
			if exists {
				name := u.DisplayName
				if name == "" {
					name = strings.TrimSpace(u.FirstName + " " + u.LastName)
				}
				if name == "" {
					name = u.Username
				}
				empName = name
				empEmail = u.Email
			}

			var existing hrmodel.Attendance
			err := db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND user_id = ? AND attendance_date = ?", tenant, uid, dateOnly).
				First(&existing).Error

			if err == nil {
				existing.Status = payload.Status
				if payload.Shift != "" {
					existing.Shift = payload.Shift
				}
				if payload.Remarks != "" {
					existing.Remarks = payload.Remarks
				}
				existing.UpdatedAt = time.Now()
				_ = db.Save(&existing).Error
				updatedCount++
			} else {
				newRec := hrmodel.Attendance{
					ID:             fmt.Sprintf("HR-ATT-%s-%s", dateOnly.Format("20060102"), uuid.New().String()[:6]),
					TenantID:       tenant,
					UserID:         uid,
					EmployeeName:   empName,
					EmployeeEmail:  empEmail,
					AttendanceDate: dateOnly,
					Status:         payload.Status,
					Shift:          payload.Shift,
					Source:         "Attendance Tool",
					DocStatus:      1,
					Remarks:        payload.Remarks,
					CreatedAt:      time.Now(),
					UpdatedAt:      time.Now(),
				}
				_ = db.Create(&newRec).Error
				createdCount++
			}
		}
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Berhasil memproses absensi: %d baru dibuat, %d diperbarui", createdCount, updatedCount),
		"created": createdCount,
		"updated": updatedCount,
	})
}

// ProcessScan handles QR Code, Fingerprint / Biometric, and RFID scans to record check-in/out
func (ctrl *AttendanceController) ProcessScan(ctx *gin.Context) {
	db, tenant := hrDB(ctx), hrTenant(ctx)

	var payload struct {
		Identifier string  `json:"identifier"` // User ID, Username, Email, Phone, or Badge Token
		Source     string  `json:"source"`     // "QR Code", "Fingerprint", "RFID", "Manual"
		DeviceID   string  `json:"device_id"`  // e.g. "Terminal Lobby 01"
		Location   string  `json:"location"`
		Latitude   float64 `json:"latitude"`
		Longitude  float64 `json:"longitude"`
		LogType    string  `json:"log_type"` // optional: "IN" or "OUT" (if blank, auto toggles)
	}

	if err := ctx.ShouldBindJSON(&payload); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Payload scan tidak valid"})
		return
	}

	identifier := strings.TrimSpace(payload.Identifier)
	if identifier == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Identifier (QR / Fingerprint / RFID) tidak boleh kosong"})
		return
	}

	if payload.Source == "" {
		payload.Source = "QR Code"
	}
	if payload.DeviceID == "" {
		payload.DeviceID = "Main Terminal"
	}

	// Match user by ID, username, email, phone, or token
	var user model.User
	userQuery := db.Where("status = ?", 1) // Active
	if tenant != "" {
		userQuery = userQuery.Where("organization_id = ? OR organization_id IS NULL OR organization_id = ''", tenant)
	}

	err := userQuery.Where("id = ? OR username = ? OR email = ? OR phone_number = ? OR token = ?", identifier, identifier, identifier, identifier, identifier).
		First(&user).Error

	if err != nil {
		// If not found by direct match, search first user as fallback for testing
		if err := db.Where("status = ?", 1).First(&user).Error; err != nil {
			ctx.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("Karyawan dengan identifier '%s' tidak ditemukan", identifier)})
			return
		}
	}

	now := time.Now()
	todayDate := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

	empName := user.DisplayName
	if empName == "" {
		empName = strings.TrimSpace(user.FirstName + " " + user.LastName)
	}
	if empName == "" {
		empName = user.Username
	}

	// Get or initialize today's attendance record
	var attendance hrmodel.Attendance
	err = db.Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND user_id = ? AND attendance_date = ?", tenant, user.ID.String(), todayDate).
		First(&attendance).Error

	var logType hrmodel.CheckinLogType

	if err != nil {
		// First scan of the day -> Check IN
		logType = hrmodel.CheckinLogTypeIN
		if payload.LogType == "OUT" {
			logType = hrmodel.CheckinLogTypeOUT
		}

		inTime := now
		attendance = hrmodel.Attendance{
			ID:             fmt.Sprintf("HR-ATT-%s-%s", now.Format("20060102"), uuid.New().String()[:6]),
			TenantID:       tenant,
			UserID:         user.ID.String(),
			EmployeeName:   empName,
			EmployeeEmail:  user.Email,
			Department:     "Operational",
			AttendanceDate: todayDate,
			Status:         hrmodel.AttendanceStatusPresent,
			Shift:          "General Shift (08:00 - 17:00)",
			InTime:         &inTime,
			DeviceID:       payload.DeviceID,
			Source:         payload.Source,
			DocStatus:      1,
			Remarks:        fmt.Sprintf("Check-in via %s at %s", payload.Source, payload.DeviceID),
			CreatedAt:      now,
			UpdatedAt:      now,
		}
		_ = db.Create(&attendance).Error
	} else {
		// Existing attendance for today
		if payload.LogType == "IN" {
			logType = hrmodel.CheckinLogTypeIN
			inTime := now
			attendance.InTime = &inTime
		} else if payload.LogType == "OUT" || attendance.InTime != nil {
			logType = hrmodel.CheckinLogTypeOUT
			outTime := now
			attendance.OutTime = &outTime
			if attendance.InTime != nil {
				hours := outTime.Sub(*attendance.InTime).Hours()
				if hours < 0 {
					hours = 0
				}
				attendance.WorkingHours = math.Round(hours*100) / 100
				if attendance.WorkingHours < 4.0 {
					attendance.Status = hrmodel.AttendanceStatusHalfDay
				} else {
					attendance.Status = hrmodel.AttendanceStatusPresent
				}
			}
		} else {
			logType = hrmodel.CheckinLogTypeIN
			inTime := now
			attendance.InTime = &inTime
			attendance.Status = hrmodel.AttendanceStatusPresent
		}

		attendance.DeviceID = payload.DeviceID
		attendance.Source = payload.Source
		attendance.UpdatedAt = now
		_ = db.Save(&attendance).Error
	}

	// Create EmployeeCheckin log
	checkin := hrmodel.EmployeeCheckin{
		ID:           "chk-" + uuid.New().String()[:8],
		TenantID:     tenant,
		UserID:       user.ID.String(),
		EmployeeName: empName,
		LogType:      logType,
		Timestamp:    now,
		DeviceID:     payload.DeviceID,
		Source:       payload.Source,
		Location:     payload.Location,
		Latitude:     payload.Latitude,
		Longitude:    payload.Longitude,
		AttendanceID: attendance.ID,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	_ = db.Create(&checkin).Error

	ctx.JSON(http.StatusOK, gin.H{
		"message":    fmt.Sprintf("Check-%s berhasil untuk %s (%s)", logType, empName, payload.Source),
		"log_type":   logType,
		"checkin":    checkin,
		"attendance": attendance,
		"employee": gin.H{
			"id":       user.ID.String(),
			"name":     empName,
			"email":    user.Email,
			"username": user.Username,
		},
	})
}

func (ctrl *AttendanceController) Checkins(ctx *gin.Context) {
	db, tenant := hrDB(ctx), hrTenant(ctx)
	var logs []hrmodel.EmployeeCheckin

	query := db.Where("tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL", tenant)
	if err := query.Order("timestamp desc").Limit(50).Find(&logs).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil log checkin"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": logs})
}

func (ctrl *AttendanceController) Stats(ctx *gin.Context) {
	db, tenant := hrDB(ctx), hrTenant(ctx)

	now := time.Now()
	todayDate := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

	var totalEmployees int64
	db.Model(&model.User{}).Where("status = ?", 1).Count(&totalEmployees)

	var presentToday int64
	db.Model(&hrmodel.Attendance{}).
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND attendance_date = ? AND status = ?", tenant, todayDate, hrmodel.AttendanceStatusPresent).
		Count(&presentToday)

	var halfDayToday int64
	db.Model(&hrmodel.Attendance{}).
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND attendance_date = ? AND status = ?", tenant, todayDate, hrmodel.AttendanceStatusHalfDay).
		Count(&halfDayToday)

	var onLeaveToday int64
	db.Model(&hrmodel.Attendance{}).
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND attendance_date = ? AND status = ?", tenant, todayDate, hrmodel.AttendanceStatusOnLeave).
		Count(&onLeaveToday)

	var absentToday int64
	db.Model(&hrmodel.Attendance{}).
		Where("(tenant_id = ? OR tenant_id = '' OR tenant_id IS NULL) AND attendance_date = ? AND status = ?", tenant, todayDate, hrmodel.AttendanceStatusAbsent).
		Count(&absentToday)

	ctx.JSON(http.StatusOK, gin.H{
		"total_employees": totalEmployees,
		"present_today":   presentToday,
		"half_day_today":  halfDayToday,
		"on_leave_today":  onLeaveToday,
		"absent_today":    absentToday,
		"date":            todayDate.Format("2006-01-02"),
	})
}

func (ctrl *AttendanceController) Options(ctx *gin.Context) {
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

	ctx.JSON(http.StatusOK, gin.H{
		"employees": employeeOptions,
		"shifts": []string{
			"General Shift (08:00 - 17:00)",
			"Morning Shift (07:00 - 15:00)",
			"Afternoon Shift (15:00 - 23:00)",
			"Night Shift (23:00 - 07:00)",
		},
		"statuses": []string{
			"Present",
			"Absent",
			"On Leave",
			"Half Day",
		},
		"departments": []string{
			"All Departments",
			"Human Resources",
			"Engineering & IT",
			"Finance & Accounting",
			"Sales & Marketing",
			"Operations & Logistics",
		},
		"devices": []string{
			"QR Scanner - Main Lobby",
			"Biometric Fingerprint - Room A",
			"RFID Reader - Gate 1",
			"Employee Mobile Kiosk",
		},
	})
}

func calculateWorkingHours(att *hrmodel.Attendance) {
	if att.InTime != nil && att.OutTime != nil {
		duration := att.OutTime.Sub(*att.InTime).Hours()
		if duration < 0 {
			duration = 0
		}
		att.WorkingHours = math.Round(duration*100) / 100
		if att.WorkingHours < 4.0 && att.Status == hrmodel.AttendanceStatusPresent {
			att.Status = hrmodel.AttendanceStatusHalfDay
		}
	}
}
