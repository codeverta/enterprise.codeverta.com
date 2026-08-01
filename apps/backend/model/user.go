package model

import (
	"encoding/json"
	"errors"
	"fmt"
	"gin-template/common"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/google/uuid" // Menggunakan package UUID
	"gorm.io/gorm"
)

// 1 (Active / Enabled)

// Akun aktif dan dapat digunakan untuk masuk (login) ke platform (selama kata sandi/password sudah diatur).
// 2 (Inactive / Disabled)

// Akun dinonaktifkan oleh admin. User dengan status ini tidak akan bisa login ke platform.
// 3 (Pending Activation)

// Akun baru yang berhasil didaftarkan namun belum melakukan aktivasi/pembuatan password. User harus membuka tautan aktivasi yang dikirimkan ke email mereka untuk mengatur password terlebih dahulu sebelum statusnya berubah menjadi Active (1).
// 4 (Pending Approval) (Tambahan fitur baru)

// Pendaftaran gratis yang membutuhkan persetujuan admin. Akun tidak akan menerima email aktivasi dan subscription-nya tidak akan aktif sampai admin menyetujuinya di dashboard.

// User if you add sensitive fields, don't forget to clean them in setupLogin function.
// Otherwise, the sensitive information will be saved on local storage in plain text!
type User struct {
	ID               uuid.UUID      `json:"id" gorm:"type:char(36);primaryKey"`
	Username         string         `json:"username" gorm:"unique;index" validate:"max=12"`
	Password         string         `json:"password" gorm:"not null;" validate:"min=8,max=20"`
	DisplayName      string         `json:"display_name" gorm:"index" validate:"max=20"`
	Role             int            `json:"role" gorm:"type:int;default:1"`   // admin, common
	Status           int            `json:"status" gorm:"type:int;default:1"` // enabled, disabled
	Token            string         `json:"token" gorm:"index"`
	Email            string         `json:"email" gorm:"unique;index" validate:"max=50"`
	VerificationCode string         `json:"verification_code" gorm:"-:all"`
	PhoneNumber      string         `json:"phone_number" gorm:"size:20;index"`
	FirstName        string         `json:"first_name" gorm:"type:varchar(100);index"`
	LastName         string         `json:"last_name" gorm:"type:varchar(100);index"`
	DateOfBirth      time.Time      `json:"date_of_birth" gorm:"type:date"`
	IdType           string         `json:"id_type" gorm:"type:varchar(20)"`
	Gender           string         `json:"gender" gorm:"type:varchar(15)"`
	Country          string         `json:"country" gorm:"type:varchar(100)"`
	Province         string         `json:"province" gorm:"type:varchar(100)"`
	City             string         `json:"city" gorm:"type:varchar(100)"`
	Address          string         `json:"address" gorm:"type:text"`
	CreatedByID      *uuid.UUID     `json:"created_by_id" gorm:"type:char(36)"`
	UpdatedByID      *uuid.UUID     `json:"updated_by_id" gorm:"type:char(36)"`
	UpdatedBy        *User          `gorm:"foreignKey:UpdatedByID;references:ID" json:"-"`
	CreatedBy        *User          `gorm:"foreignKey:CreatedByID;references:ID" json:"-"`
	Balance          float64        `json:"balance" gorm:"type:decimal(16,2);default:0"`
	MentorType       string         `json:"mentor_type" gorm:"type:varchar(20);default:'independent';index"`
	OrganizationID   *uuid.UUID     `json:"organization_id" gorm:"type:char(36);index"`
	LastActiveAt     *time.Time     `json:"last_active_at" gorm:"index"`
	CreatedAt        *time.Time     `json:"created_at"`
	UpdatedAt        *time.Time     `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `json:"deleted_at" gorm:"index"`

	TenantID      *uuid.UUID            `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant        Tenant                `gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
	WebAuthnCreds []webauthn.Credential `gorm:"-" json:"-"`
	Profile       *Profile              `json:"profile,omitempty" gorm:"foreignKey:UserID;references:ID"`
}

type GenderType string

const (
	Male   GenderType = "Male"
	Female GenderType = "Female"
)

func (user *User) BeforeCreate(tx *gorm.DB) (err error) {
	if user.ID == uuid.Nil {
		user.NewID()
	}

	// FIX: Jika TenantID sudah diisi manual (misal saat seeding), lewati cek context
	if user.TenantID != nil {
		return nil
	}

	if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
		user.TenantID = &tenant.ID
	} else {
		return fmt.Errorf("tenant_id is required for security isolation")
	}
	return nil
}

func (user *User) AfterCreate(tx *gorm.DB) error {
	profile := Profile{
		UserID:      user.ID,
		FullName:    userProfileName(*user),
		DisplayName: user.DisplayName,
		PhoneNumber: user.PhoneNumber,
		TenantID:    user.TenantID,
	}
	if err := tx.Where("user_id = ?", user.ID).FirstOrCreate(&profile).Error; err != nil {
		return err
	}

	// Automatically create a wallet for the user if it doesn't exist yet
	var count int64
	if err := tx.Model(&Wallet{}).Where("owner_type = ? AND owner_id = ?", WalletOwnerUser, user.ID).Count(&count).Error; err == nil && count == 0 {
		tenantID := uuid.Nil
		if user.TenantID != nil {
			tenantID = *user.TenantID
		} else if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
			tenantID = tenant.ID
		}
		if tenantID != uuid.Nil {
			wallet := Wallet{
				OwnerType: WalletOwnerUser,
				OwnerID:   user.ID,
				Balance:   0,
				Currency:  "IDR",
				IsActive:  true,
				TenantID:  tenantID,
			}
			_ = tx.Create(&wallet).Error
		}
	}

	return nil
}

func userProfileName(user User) string {
	name := strings.TrimSpace(user.FirstName + " " + user.LastName)
	for _, candidate := range []string{name, user.DisplayName, user.Username, user.Email} {
		if value := strings.TrimSpace(candidate); value != "" {
			return value
		}
	}
	return "User"
}

// Helper untuk membuat ID baru
func (user *User) NewID() {
	user.ID = uuid.New()
}

func GetAllUsers(startIdx int, num int, c *gin.Context) (users []*User, err error) {
	db := GetDB(c)
	err = db.Debug().Order("id desc").Limit(num).Offset(startIdx).Select([]string{"id", "username", "display_name", "role", "status", "email", "created_at", "updated_at"}).Find(&users).Error
	return users, err
}

func SearchUsers(keyword string) (users []*User, err error) {
	// Perbaikan: Di sini, GORM akan mengkonversi keyword string ke UUID jika digunakan untuk 'id',
	// tetapi ini rentan error jika keyword bukan UUID valid.
	// Jika Anda ingin pencarian berdasarkan ID, pastikan keyword dapat di-parse menjadi UUID.
	err = DB.Select([]string{"id", "username", "display_name", "role", "status", "email"}).Where("id = ? or username LIKE ? or email LIKE ? or display_name LIKE ?", keyword, keyword+"%", keyword+"%", keyword+"%").Find(&users).Error
	return users, err
}

// Perbaikan: Mengubah parameter id dari string menjadi uuid.UUID
func GetUserById(id uuid.UUID, selectAll bool) (*User, error) {
	if id == uuid.Nil {
		return nil, errors.New("ID not found")
	}
	user := User{}
	var err error = nil

	// GORM secara otomatis menangani perbandingan uuid.UUID dengan kolom char(36)
	if selectAll {
		err = DB.First(&user, "id = ?", id).Error
	} else {
		err = DB.Set("skip_tenant_scope", true).Select([]string{"id", "username", "display_name", "role", "status", "email"}).First(&user, "id = ?", id).Error
	}

	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, errors.New("User not found")
	}

	return &user, err
}

// Perbaikan: Mengubah parameter id dari string menjadi uuid.UUID
func DeleteUserById(c *gin.Context, id uuid.UUID) (err error) {
	if id == uuid.Nil {
		return errors.New("ID not found")
	}
	db := GetDB(c)
	// GORM akan menggunakan primary key `id` yang disediakan untuk menghapus
	result := db.Delete(&User{}, "id = ?", id)

	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("User record not found to delete")
	}
	return nil
}

func (user *User) Insert(c *gin.Context) error {
	var err error
	if user.Password != "" {
		user.Password, err = common.Password2Hash(user.Password)
		if err != nil {
			return err
		}
	}
	db := GetDB(c)
	// Jika ID belum terisi, BeforeCreate akan menjalankannya
	err = db.WithContext(c).Create(user).Error
	return err
}

func (user *User) Update(c *gin.Context, updatePassword bool) error {
	var err error
	if updatePassword {
		user.Password, err = common.Password2Hash(user.Password)
		if err != nil {
			return err
		}
	}
	db := GetDB(c)

	// Hanya update field yang tidak nol, dan GORM akan menggunakan ID yang ada pada struct user
	// Perbaikan: Pastikan ID tidak di-update oleh user.
	err = db.WithContext(c).Model(user).Omit("id").Updates(user).Error
	return err
}

func (user *User) Delete() error {
	if user.ID == uuid.Nil {
		return errors.New("ID not found or invalid UUID format")
	}

	result := DB.Delete(user)

	if result.Error != nil {
		return result.Error
	}

	if result.RowsAffected == 0 {
		return errors.New("User record not found to delete")
	}

	return nil
}

func (user *User) Create() error {
	return DB.Create(user).Error
}

func (user *User) ToResponse(isAdmin bool) map[string]interface{} {
	return map[string]interface{}{
		"id":           user.ID,
		"first_name":   user.FirstName,
		"last_name":    user.LastName,
		"display_name": user.DisplayName,
		"email":        user.Email,
		"phone_number": user.PhoneNumber,
		"gender":       user.Gender,
		"city":         user.City,
		"province":     user.Province,
		"country":      user.Country,
		"created_at":   user.CreatedAt,
		"updated_at":   user.UpdatedAt,
	}
}

func GenerateParticipantUniqueCode(tx *gorm.DB, categoryName string) (string, error) {
	prefix := "00"
	re := regexp.MustCompile(`(\d+)`)
	match := re.FindString(categoryName)
	if match != "" {
		num, _ := strconv.Atoi(match)
		prefix = fmt.Sprintf("%02d", num)
	}

	for i := 0; i < 10; i++ {
		candidateCode := fmt.Sprintf("%s%s", prefix, common.GenerateRandomString(5))
		var count int64
		if err := tx.Model(&User{}).Where("unique_code = ?", candidateCode).Count(&count).Error; err != nil {
			return "", err
		}
		if count == 0 {
			return candidateCode, nil
		}
	}

	return "", fmt.Errorf("failed to generate unique code after 10 attempts")
}

// ValidateAndFill check password & user status
func (user *User) ValidateAndFill(c *gin.Context) (err error) {
	return user.ValidateAndFillByIdentifier(c, user.Email, user.Password)
}

// ValidateAndFillByIdentifier authenticates using either an email address or a
// username. The lookup is case-insensitive while password verification remains
// unchanged.
func (user *User) ValidateAndFillByIdentifier(c *gin.Context, identifier string, password string) error {
	DB := GetDB(c)
	identifier = strings.TrimSpace(strings.ToLower(identifier))
	if identifier == "" || password == "" {
		return errors.New("Email, username, or password cannot be empty")
	}

	result := DB.Set("skip_tenant_scope", true).
		Where("LOWER(email) = ? OR LOWER(username) = ?", identifier, identifier).
		First(user)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return errors.New("Email or username incorrect, or user disabled")
		}
		return result.Error
	}

	if !common.ValidatePasswordAndHash(password, user.Password) {
		return errors.New("Email or password incorrect, or user disabled")
	}
	if user.Status != common.UserStatusEnabled {
		return errors.New("account_deactivated")
	}
	return nil
}

func (user *User) FillUserById() error {
	if user.ID == uuid.Nil {
		return errors.New("ID not found!")
	}
	// Mencari berdasarkan ID
	result := DB.Where(User{ID: user.ID}).First(user)
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return errors.New("User not found")
	}
	return nil
}

func (user *User) FillUserByEmail() error {
	if user.Email == "" {
		return errors.New("Email is empty!")
	}
	result := DB.Where(User{Email: user.Email}).First(user)
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return errors.New("User not found by email")
	}
	return nil
}

func (user *User) FillUserByUsername() error {
	if user.Username == "" {
		return errors.New("Username is empty!")
	}
	result := DB.Where(User{Username: user.Username}).First(user)
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return errors.New("User not found by username")
	}
	return nil
}

func ValidateUserToken(token string) (user *User) {
	if token == "" {
		return nil
	}
	token = strings.Replace(token, "Bearer ", "", 1)
	user = &User{}
	if DB.Where("token = ?", token).First(user).RowsAffected == 1 {
		return user
	}
	return nil
}

func IsEmailAlreadyTaken(email string) bool {
	return DB.Where("email = ?", email).Find(&User{}).RowsAffected == 1
}

func IsUsernameAlreadyTaken(username string) bool {
	return DB.Where("username = ?", username).Find(&User{}).RowsAffected == 1
}

func ResetUserPasswordByEmail(email string, password string) error {
	if email == "" || password == "" {
		return errors.New("Email address or password cannot be empty!")
	}
	hashedPassword, err := common.Password2Hash(password)
	if err != nil {
		return err
	}
	err = DB.Model(&User{}).Where("email = ?", email).Update("password", hashedPassword).Error
	return err
}

func (u User) MarshalJSON() ([]byte, error) {
	type Alias User
	return json.Marshal(&struct {
		Password string `json:"password,omitempty"`
		*Alias
	}{
		Password: "",
		Alias:    (*Alias)(&u),
	})
}
