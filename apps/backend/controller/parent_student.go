package controller

import (
	"errors"
	"fmt"
	"net/http"
	"strings"

	"gin-template/common"
	"gin-template/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Helper untuk mengambil Parent ID dari context auth secara aman
func getAuthenticatedUserID(c *gin.Context) (uuid.UUID, bool) {
	userIDVal, exists := c.Get("id") // Sesuaikan string key ini jika di middleware Anda menggunakan "userID" atau "userId"
	if !exists {
		sendError(c, http.StatusUnauthorized, "Unauthorized access", nil)
		return uuid.Nil, false
	}

	switch v := userIDVal.(type) {
	case string:
		id, err := uuid.Parse(v)
		if err != nil {
			sendBadRequest(c, "Invalid user identity format", nil)
			return uuid.Nil, false
		}
		return id, true
	case uuid.UUID:
		return v, true
	default:
		sendError(c, http.StatusInternalServerError, "Internal identity mismatch", nil)
		return uuid.Nil, false
	}
}

type LinkStudentInput struct {
	LinkingCode string `json:"linking_code" binding:"required"`
}

type CreateChildAccountInput struct {
	Username    string `json:"username" validate:"required,min=3,max=12"`
	Email       string `json:"email" validate:"required,email,max=50"`
	Password    string `json:"password" validate:"required,min=8,max=20"`
	DisplayName string `json:"display_name" validate:"required,max=20"`
	FirstName   string `json:"first_name" validate:"max=100"`
	LastName    string `json:"last_name" validate:"max=100"`
	PhoneNumber string `json:"phone_number" validate:"max=20"`
}

// POST /lms/parent/students creates a student, profile, and ownership relation atomically.
func (ctrl *LMSController) CreateChildAccount(c *gin.Context) {
	parentID, ok := requireParentUser(c)
	if !ok {
		return
	}
	var input CreateChildAccountInput
	if err := c.ShouldBindJSON(&input); err != nil {
		sendBadRequest(c, "Data akun anak tidak valid", nil)
		return
	}
	input.Username = strings.TrimSpace(strings.ToLower(input.Username))
	input.Email = strings.TrimSpace(strings.ToLower(input.Email))
	input.DisplayName = strings.TrimSpace(input.DisplayName)
	input.FirstName = strings.TrimSpace(input.FirstName)
	input.LastName = strings.TrimSpace(input.LastName)
	input.PhoneNumber = strings.TrimSpace(input.PhoneNumber)
	if err := common.Validate.Struct(input); err != nil {
		sendBadRequest(c, fmt.Sprintf("Validation failed: %v", err), nil)
		return
	}
	tenantValue, exists := c.Get(common.CtxTenantKey)
	tenant, validTenant := tenantValue.(model.Tenant)
	if !exists || !validTenant {
		sendError(c, http.StatusInternalServerError, "Tenant context tidak tersedia", nil)
		return
	}
	hashedPassword, err := common.Password2Hash(input.Password)
	if err != nil {
		sendInternalError(c, err)
		return
	}

	student := model.User{
		Username: input.Username, Email: input.Email, Password: hashedPassword,
		DisplayName: input.DisplayName, FirstName: input.FirstName, LastName: input.LastName,
		PhoneNumber: input.PhoneNumber, Role: model.RoleStudent, Status: common.UserStatusEnabled,
		CreatedByID: &parentID, TenantID: &tenant.ID,
	}
	profile := model.Profile{}
	membership := model.Membership{}
	db := lmsDB(c, ctrl.DB).WithContext(c)
	err = db.Transaction(func(tx *gorm.DB) error {
		var duplicateCount int64
		globalUsers := tx.Session(&gorm.Session{NewDB: true}).Set("skip_tenant_scope", true).Unscoped().Model(&model.User{})
		if err := globalUsers.Where("email = ? OR username = ?", input.Email, input.Username).Count(&duplicateCount).Error; err != nil {
			return err
		}
		if duplicateCount > 0 {
			return errChildAccountExists
		}
		if err := tx.Create(&student).Error; err != nil {
			return err
		}

		// User.AfterCreate normally creates this. FirstOrCreate makes the endpoint
		// explicit and keeps compatibility if that hook is ever bypassed.
		profile = model.Profile{
			UserID: student.ID, FullName: strings.TrimSpace(input.FirstName + " " + input.LastName),
			DisplayName: input.DisplayName, PhoneNumber: input.PhoneNumber, TenantID: &tenant.ID,
		}
		if profile.FullName == "" {
			profile.FullName = input.DisplayName
		}
		if err := tx.Where("user_id = ?", student.ID).FirstOrCreate(&profile).Error; err != nil {
			return err
		}
		membership = model.Membership{ParentID: parentID, StudentID: student.ID, Status: "active", TenantID: &tenant.ID}
		return tx.Create(&membership).Error
	})
	if errors.Is(err, errChildAccountExists) {
		sendError(c, http.StatusConflict, "Email atau username sudah digunakan", nil)
		return
	}
	if err != nil {
		sendInternalError(c, err)
		return
	}

	sendSuccess(c, gin.H{
		"student": gin.H{
			"id": student.ID, "username": student.Username, "email": student.Email,
			"display_name": student.DisplayName, "first_name": student.FirstName,
			"last_name": student.LastName, "phone_number": student.PhoneNumber, "role": student.Role,
		},
		"profile_id": profile.ID, "membership_id": membership.ID,
	}, "Akun anak berhasil dibuat dan terhubung")
}

var errChildAccountExists = errors.New("child account email or username already exists")

// POST /lms/parent/link-student
// POST /lms/parent/link-student
func (ctrl *LMSController) LinkStudentByCode(c *gin.Context) {
	parentID, ok := getAuthenticatedUserID(c)
	if !ok {
		return
	}

	var input LinkStudentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		sendBadRequest(c, "Kode penghubung wajib diisi", nil)
		return
	}

	// Bersihkan input dan ambil raw hex kodenya saja (Misal: "CV-8D1E2A" -> "8d1e2a")
	cleanCode := strings.ToLower(strings.TrimPrefix(input.LinkingCode, "CV-"))
	if len(cleanCode) == 0 {
		sendBadRequest(c, "Format kode unik tidak valid", nil)
		return
	}

	db := lmsDB(c, ctrl.DB)

	// Cari user yang ID-nya diakhiri dengan kode tersebut
	var student model.User
	err := db.Where("id LIKE ?", "%"+cleanCode).First(&student).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		sendError(c, http.StatusNotFound, "Akun siswa tidak ditemukan, mohon periksa kembali kode Anda", nil)
		return
	}
	if err != nil {
		sendInternalError(c, err)
		return
	}

	// Pastikan parent tidak menghubungkan akunnya ke dirinya sendiri
	if student.ID == parentID {
		sendError(c, http.StatusConflict, "Anda tidak dapat menambahkan akun Anda sendiri sebagai anak", nil)
		return
	}

	// Siapkan display name siswa untuk response payload
	studentName := student.DisplayName
	if studentName == "" {
		studentName = student.FirstName + " " + student.LastName
	}
	studentName = strings.TrimSpace(studentName)
	if studentName == "" {
		studentName = student.Username
	}

	// Cek data relasi hingga ke record yang terkena soft-delete menggunakan .Unscoped()
	var existing model.Membership
	err = db.WithContext(c).Unscoped().
		Where("parent_id = ? AND student_id = ?", parentID, student.ID).
		First(&existing).Error

	if err == nil {
		// Skenario A: Data lama ditemukan tetapi dalam kondisi ter-soft delete (deleted_at != NULL)
		if existing.DeletedAt.Valid {
			// RESTORE data lama: bersihkan field deleted_at dan kembalikan status ke active
			err = db.WithContext(c).Unscoped().Model(&existing).Updates(map[string]interface{}{
				"deleted_at": nil,
				"status":     "active",
			}).Error

			if err != nil {
				sendInternalError(c, err)
				return
			}

			sendSuccess(c, gin.H{"student_name": studentName}, "Berhasil menghubungkan kembali akun anak")
			return
		}

		// Skenario B: Data ditemukan dan statusnya memang sudah aktif sedari awal
		sendError(c, http.StatusConflict, "Siswa ini sudah terhubung dengan akun Anda", nil)
		return
	}

	// Skenario C: Benar-benar relasi baru (tidak ada record unscoped sama sekali), lakukan INSERT biasa
	membership := model.Membership{
		ParentID:  parentID,
		StudentID: student.ID,
		Status:    "active",
	}

	// Wajib passing WithContext(c) agar middleware Tenant ID terbaca oleh hooks BeforeCreate
	if err := db.WithContext(c).Create(&membership).Error; err != nil {
		sendInternalError(c, err)
		return
	}

	sendSuccess(c, gin.H{"student_name": studentName}, "Berhasil menghubungkan akun anak")
}

// DELETE /lms/parent/students/:id
func (ctrl *LMSController) UnlinkStudent(c *gin.Context) {
	parentID, ok := getAuthenticatedUserID(c)
	if !ok {
		return
	}

	studentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		sendBadRequest(c, "Format ID siswa tidak valid", nil)
		return
	}

	db := lmsDB(c, ctrl.DB)

	// Lakukan soft delete record relasi di table memberships
	result := db.Where("parent_id = ? AND student_id = ?", parentID, studentID).Delete(&model.Membership{})
	if result.Error != nil {
		sendInternalError(c, result.Error)
		return
	}
	if result.RowsAffected == 0 {
		sendError(c, http.StatusNotFound, "Hubungan akun tidak ditemukan", nil)
		return
	}

	sendSuccess(c, nil, "Hubungan akun anak berhasil dihapus")
}

// GET /lms/student/linking-code
func (ctrl *LMSController) GetStudentLinkingCode(c *gin.Context) {
	studentID, ok := getAuthenticatedUserID(c)
	if !ok {
		return
	}

	// UUID string format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
	// Kita ambil blok terakhir (12 karakter), lalu slice 6 karakter pertamanya agar ringkas
	uuidStr := strings.ReplaceAll(studentID.String(), "-", "")
	if len(uuidStr) < 6 {
		sendError(c, http.StatusInternalServerError, "Invalid user identity token length", nil)
		return
	}

	// Hasilnya akan berupa kode dinamis riil, contoh: CV-8D1E2A
	linkingCode := "CV-" + strings.ToUpper(uuidStr[len(uuidStr)-6:])

	sendSuccess(c, gin.H{"linking_code": linkingCode}, "Linking code retrieved successfully")
}

type UpdateLinkedStudentInput struct {
	DisplayName string `json:"display_name" validate:"required,max=20"`
	FirstName   string `json:"first_name" validate:"max=100"`
	LastName    string `json:"last_name" validate:"max=100"`
	Email       string `json:"email" validate:"required,email,max=50"`
	PhoneNumber string `json:"phone_number" validate:"max=20"`
	Password    string `json:"password" validate:"omitempty,min=8,max=20"`
}

// PUT /lms/parent/students/:student_id
func (ctrl *LMSController) UpdateLinkedStudent(c *gin.Context) {
	parentID, ok := requireParentUser(c)
	if !ok {
		return
	}

	studentID, err := uuid.Parse(c.Param("student_id"))
	if err != nil {
		sendBadRequest(c, "Format ID siswa tidak valid", nil)
		return
	}

	// Validate relationship: parent must own the student child
	if !ctrl.validateParentStudent(c, parentID, studentID) {
		return
	}

	var input UpdateLinkedStudentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		sendBadRequest(c, "Invalid input data format", nil)
		return
	}

	// Manual validator check
	if err := common.Validate.Struct(input); err != nil {
		sendBadRequest(c, fmt.Sprintf("Validation failed: %v", err), nil)
		return
	}

	db := lmsDB(c, ctrl.DB)

	// Fetch student user
	var student model.User
	if err := db.Where("id = ?", studentID).First(&student).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			sendError(c, http.StatusNotFound, "Akun siswa tidak ditemukan", nil)
			return
		}
		sendInternalError(c, err)
		return
	}

	// Email uniqueness check
	if strings.ToLower(input.Email) != strings.ToLower(student.Email) {
		var count int64
		if err := db.Model(&model.User{}).Where("email = ? AND id != ?", strings.ToLower(input.Email), studentID).Count(&count).Error; err != nil {
			sendInternalError(c, err)
			return
		}
		if count > 0 {
			sendError(c, http.StatusConflict, "Email sudah digunakan oleh akun lain", nil)
			return
		}
	}

	// Update student info
	student.DisplayName = input.DisplayName
	student.FirstName = input.FirstName
	student.LastName = input.LastName
	student.Email = strings.ToLower(input.Email)
	student.PhoneNumber = input.PhoneNumber

	updatePassword := false
	if input.Password != "" {
		student.Password = input.Password
		updatePassword = true
	}

	if err := student.Update(c, updatePassword); err != nil {
		sendInternalError(c, err)
		return
	}

	sendSuccess(c, student, "Informasi siswa berhasil diperbarui")
}
