package model

import (
	"fmt"
	"gin-template/common"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type LMSRole string

const (
	LMSRoleStudent         LMSRole = "student"
	LMSRoleParent          LMSRole = "parent"
	LMSRoleMentor          LMSRole = "mentor"
	LMSRoleMentorEksternal LMSRole = "mentor_eksternal"
	LMSRoleAdmin           LMSRole = "admin"
)

type CourseStatus string

const (
	CourseStatusDraft     CourseStatus = "draft"
	CourseStatusPublished CourseStatus = "published"
	CourseStatusArchived  CourseStatus = "archived"
)

type LearningAssetType string

const (
	LearningAssetVideo     LearningAssetType = "video"
	LearningAssetEbook     LearningAssetType = "ebook"
	LearningAssetAudiobook LearningAssetType = "audiobook"
	LearningAssetWorksheet LearningAssetType = "worksheet"
	LearningAssetImage     LearningAssetType = "image"
)

type QuizQuestionType string

const (
	QuizQuestionSingle       QuizQuestionType = "single"
	QuizQuestionMultiple     QuizQuestionType = "multiple"
	QuizQuestionTrueFalse    QuizQuestionType = "true_false"
	QuizQuestionShortAnswer  QuizQuestionType = "short_answer"
	QuizQuestionArrangeWords QuizQuestionType = "arrange_words"
)

type QuizAttemptStatus string

const (
	QuizAttemptInProgress QuizAttemptStatus = "in_progress"
	QuizAttemptSubmitted  QuizAttemptStatus = "submitted"
	QuizAttemptPassed     QuizAttemptStatus = "passed"
	QuizAttemptFailed     QuizAttemptStatus = "failed"
	QuizAttemptExpired    QuizAttemptStatus = "expired"
)

type SubscriptionStatus string

const (
	SubscriptionStatusTrialing SubscriptionStatus = "trialing"
	SubscriptionStatusActive   SubscriptionStatus = "active"
	SubscriptionStatusPastDue  SubscriptionStatus = "past_due"
	SubscriptionStatusCanceled SubscriptionStatus = "canceled"
	SubscriptionStatusExpired  SubscriptionStatus = "expired"
)

type LMSPaymentStatus string

const (
	LMSPaymentPending LMSPaymentStatus = "pending"
	LMSPaymentPaid    LMSPaymentStatus = "paid"
	LMSPaymentFailed  LMSPaymentStatus = "failed"
	LMSPaymentExpired LMSPaymentStatus = "expired"
)

type Profile struct {
	ID                uuid.UUID      `json:"id" gorm:"type:char(36);primaryKey"`
	UserID            uuid.UUID      `json:"user_id" gorm:"type:char(36);not null;index"`
	User              User           `json:"-" gorm:"foreignKey:UserID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	FullName          string         `json:"full_name" gorm:"type:varchar(160);not null"`
	DisplayName       string         `json:"display_name" gorm:"type:varchar(80)"`
	PhoneNumber       string         `json:"phone_number" gorm:"type:varchar(30);index"`
	Nisn              string         `json:"nisn" gorm:"type:varchar(20)"`
	AvatarURL         string         `json:"avatar_url" gorm:"type:text"`
	Bio               string         `json:"bio" gorm:"type:text"`
	Headline          string         `json:"headline" gorm:"type:varchar(220)"`
	DateOfBirth       *time.Time     `json:"date_of_birth"`
	BankName          string         `json:"bank_name" gorm:"type:varchar(100)"`
	BankAccountNumber string         `json:"bank_account_number" gorm:"type:varchar(100)"`
	BankAccountName   string         `json:"bank_account_name" gorm:"type:varchar(150)"`
	Metadata          datatypes.JSON `json:"metadata" gorm:"type:json"`
	CreatedAt         time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt         time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt         gorm.DeletedAt `json:"deleted_at" gorm:"index"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`

	MentorID *uuid.UUID `json:"mentor_id,omitempty" gorm:"-"`
}

func (m *Profile) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	if m.TenantID != nil {
		return nil
	}
	if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
		m.TenantID = &tenant.ID
	} else {
		return fmt.Errorf("tenant_id is required for security isolation")
	}
	return nil
}

func (m *Profile) AfterFind(tx *gorm.DB) error {
	var user User
	if err := tx.Session(&gorm.Session{}).Set("skip_tenant_scope", true).Select("role").Where("id = ?", m.UserID).First(&user).Error; err == nil && user.Role == 30 {
		m.MentorID = &m.UserID
	}
	return nil
}

type UserRole struct {
	ID        uuid.UUID      `json:"id" gorm:"type:char(36);primaryKey"`
	UserID    uuid.UUID      `json:"user_id" gorm:"type:char(36);not null;index:idx_lms_user_role,unique"`
	User      User           `json:"-" gorm:"foreignKey:UserID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Role      LMSRole        `json:"role" gorm:"type:varchar(24);not null;index:idx_lms_user_role,unique"`
	CreatedAt time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt gorm.DeletedAt `json:"deleted_at" gorm:"index"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (m *UserRole) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
		m.TenantID = &tenant.ID
	} else {
		return fmt.Errorf("tenant_id is required for security isolation")
	}
	return nil
}

type LearningAsset struct {
	ID             uuid.UUID         `json:"id" gorm:"type:char(36);primaryKey"`
	LessonID       uuid.UUID         `json:"lesson_id" gorm:"type:char(36);not null;index"`
	Lesson         Lesson            `json:"-" gorm:"foreignKey:LessonID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Type           LearningAssetType `json:"type" gorm:"type:varchar(24);not null;index"`
	Title          string            `json:"title" gorm:"type:varchar(180);not null"`
	Description    string            `json:"description" gorm:"type:text"`
	FileURL        string            `json:"file_url" gorm:"type:text;not null"`
	ThumbnailURL   string            `json:"thumbnail_url" gorm:"type:text"`
	DurationSec    int               `json:"duration_sec" gorm:"default:0"`
	FileSize       int64             `json:"file_size" gorm:"default:0"`
	IsDownloadable bool              `json:"is_downloadable" gorm:"default:false"`
	SortOrder      int               `json:"sort_order" gorm:"default:0;index"`
	CreatedAt      time.Time         `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt      time.Time         `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt      gorm.DeletedAt    `json:"deleted_at" gorm:"index"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (m *LearningAsset) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
		m.TenantID = &tenant.ID
	} else {
		return fmt.Errorf("tenant_id is required for security isolation")
	}
	return nil
}

type LibraryItem struct {
	ID           uuid.UUID         `json:"id" gorm:"type:char(36);primaryKey"`
	Type         LearningAssetType `json:"type" gorm:"type:varchar(24);not null;index"`
	Title        string            `json:"title" gorm:"type:varchar(180);not null;index"`
	Description  string            `json:"description" gorm:"type:text"`
	FileURL      string            `json:"file_url" gorm:"type:text;not null"`
	ThumbnailURL string            `json:"thumbnail_url" gorm:"type:text"`
	Tags         datatypes.JSON    `json:"tags" gorm:"type:json"`
	IsPublished  bool              `json:"is_published" gorm:"default:false;index"`
	CreatedAt    time.Time         `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt    time.Time         `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt    gorm.DeletedAt    `json:"deleted_at" gorm:"index"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (m *LibraryItem) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
		m.TenantID = &tenant.ID
	} else {
		return fmt.Errorf("tenant_id is required for security isolation")
	}
	return nil
}

type Membership struct {
	ID        uuid.UUID      `json:"id" gorm:"type:char(36);primaryKey"`
	ParentID  uuid.UUID      `json:"parent_id" gorm:"type:char(36);not null;index:idx_membership_pair,unique"`
	StudentID uuid.UUID      `json:"student_id" gorm:"type:char(36);not null;index:idx_membership_pair,unique"`
	Status    string         `json:"status" gorm:"type:varchar(24);default:'active';index"`
	CreatedAt time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt gorm.DeletedAt `json:"deleted_at" gorm:"index"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (m *Membership) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
		m.TenantID = &tenant.ID
	} else {
		return fmt.Errorf("tenant_id is required for security isolation")
	}
	return nil
}

type StudentProgress struct {
	ID              uuid.UUID      `json:"id" gorm:"type:char(36);primaryKey"`
	StudentID       uuid.UUID      `json:"student_id" gorm:"type:char(36);not null;index:idx_student_lesson,unique"`
	CourseID        uuid.UUID      `json:"course_id" gorm:"type:char(36);not null;index"`
	ModuleID        uuid.UUID      `json:"module_id" gorm:"type:char(36);not null;index"`
	LessonID        uuid.UUID      `json:"lesson_id" gorm:"type:char(36);not null;index:idx_student_lesson,unique"`
	Status          string         `json:"status" gorm:"type:varchar(24);default:'in_progress';index"`
	IsCompleted     bool           `json:"is_completed" gorm:"default:false;index"`
	CompletedAt     *time.Time     `json:"completed_at"`
	LastPositionSec int            `json:"last_position_sec" gorm:"default:0"`
	ProgressPercent float64        `json:"progress_percent" gorm:"type:decimal(5,2);default:0"`
	CreatedAt       time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt       time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt       gorm.DeletedAt `json:"deleted_at" gorm:"index"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (m *StudentProgress) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
		m.TenantID = &tenant.ID
	} else {
		return fmt.Errorf("tenant_id is required for security isolation")
	}
	return nil
}

type FAQ struct {
	ID          uuid.UUID      `json:"id" gorm:"type:char(36);primaryKey"`
	Question    string         `json:"question" gorm:"type:text;not null"`
	Answer      string         `json:"answer" gorm:"type:text;not null"`
	Category    string         `json:"category" gorm:"type:varchar(80);index"`
	SortOrder   int            `json:"sort_order" gorm:"default:0;index"`
	IsPublished bool           `json:"is_published" gorm:"default:false;index"`
	CreatedAt   time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt   time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt   gorm.DeletedAt `json:"deleted_at" gorm:"index"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (m *FAQ) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
		m.TenantID = &tenant.ID
	} else {
		return fmt.Errorf("tenant_id is required for security isolation")
	}
	return nil
}

type Testimonial struct {
	ID          uuid.UUID      `json:"id" gorm:"type:char(36);primaryKey"`
	Name        string         `json:"name" gorm:"type:varchar(120);not null"`
	Role        string         `json:"role" gorm:"type:varchar(80)"`
	Content     string         `json:"content" gorm:"type:text;not null"`
	AvatarURL   string         `json:"avatar_url" gorm:"type:text"`
	Rating      int            `json:"rating" gorm:"default:5"`
	SortOrder   int            `json:"sort_order" gorm:"default:0;index"`
	IsPublished bool           `json:"is_published" gorm:"default:false;index"`
	CreatedAt   time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt   time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt   gorm.DeletedAt `json:"deleted_at" gorm:"index"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (m *Testimonial) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
		m.TenantID = &tenant.ID
	} else {
		return fmt.Errorf("tenant_id is required for security isolation")
	}
	return nil
}

type SiteContent struct {
	ID        uuid.UUID      `json:"id" gorm:"type:char(36);primaryKey"`
	Key       string         `json:"key" gorm:"type:varchar(120);not null;uniqueIndex"`
	Title     string         `json:"title" gorm:"type:varchar(180)"`
	Content   datatypes.JSON `json:"content" gorm:"type:json"`
	CreatedAt time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt gorm.DeletedAt `json:"deleted_at" gorm:"index"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (m *SiteContent) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
		m.TenantID = &tenant.ID
	} else {
		return fmt.Errorf("tenant_id is required for security isolation")
	}
	return nil
}

type ParentGuide struct {
	ID          uuid.UUID      `json:"id" gorm:"type:char(36);primaryKey"`
	Title       string         `json:"title" gorm:"type:varchar(180);not null"`
	Content     string         `json:"content" gorm:"type:text;not null"`
	SortOrder   int            `json:"sort_order" gorm:"default:0;index"`
	IsPublished bool           `json:"is_published" gorm:"default:false;index"`
	CreatedAt   time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt   time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt   gorm.DeletedAt `json:"deleted_at" gorm:"index"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (m *ParentGuide) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
		m.TenantID = &tenant.ID
	} else {
		return fmt.Errorf("tenant_id is required for security isolation")
	}
	return nil
}

func LMSModels() []interface{} {
	models := []interface{}{
		&Profile{}, &UserRole{}, &Course{}, &Module{}, &Lesson{},
		&CourseCategory{}, &LearningAsset{}, &Quiz{}, &QuizQuestion{}, &QuizOption{},
		&QuizAttempt{}, &QuizAnswer{}, &QuizProgress{}, &LibraryItem{}, &Membership{}, &Subscription{},
		&LMSPayment{}, &StudentProgress{}, &FAQ{},
		&Testimonial{}, &SiteContent{}, &ParentGuide{},
		&LevelUnlock{}, &Assignment{}, &Class{}, &ClassStudent{},
		&CourseBundle{}, &CourseBundleItem{},
		&ScheduleTemplate{}, &ScheduleTemplateItem{}, &StudentSchedule{}, &StudentScheduleItem{},
		&CertificateTemplate{}, &StudentCertificate{}, &PricingCategory{},
		&CourseCategoryTargetRole{}, &CourseTargetRole{},
		&ReadinessResponse{},
		&AIImageGeneration{}, &AIImageDailyQuota{},
	}
	return append(models, CommunityModels()...)
}
