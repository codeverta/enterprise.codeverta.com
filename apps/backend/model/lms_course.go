package model

import (
	"fmt"
	"gin-template/common"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Course struct {
	ID               uuid.UUID      `json:"id" gorm:"type:char(36);primaryKey"`
	Title            string         `json:"title" gorm:"type:varchar(180);not null;index"`
	Slug             string         `json:"slug" gorm:"type:varchar(200);not null;uniqueIndex"`
	Description      string         `json:"description" gorm:"type:text"`
	ShortDescription string         `json:"short_description" gorm:"type:varchar(500)"`
	CoverImageURL    string         `json:"cover_image_url" gorm:"type:text"`
	CourseCategoryID uuid.UUID      `json:"course_category_id" gorm:"type:char(36);index"`
	CourseCategory   CourseCategory `json:"course_category,omitempty" gorm:"foreignKey:CourseCategoryID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;"`
	Level            string         `json:"level" gorm:"type:varchar(60);index"`
	AgeRange         string         `json:"age_range" gorm:"type:varchar(60)"`
	Status           CourseStatus   `json:"status" gorm:"type:varchar(24);default:'draft';index"`
	ViewCount        int64          `json:"view_count" gorm:"default:0;not null"`
	SortOrder        int            `json:"sort_order" gorm:"default:0;index"`
	MinimumPassingGrade float64      `json:"minimum_passing_grade" gorm:"type:decimal(5,2);default:0"`
	AllowSkip        bool           `json:"allow_skip" gorm:"default:false"`
	Price            float64        `json:"price" gorm:"type:decimal(16,2);default:0"`
	SellIndividual   bool           `json:"sell_individual" gorm:"default:false"`
	DiscountPercent  float64        `json:"discount_percent" gorm:"type:decimal(5,2);default:0"`
	PromoStartDate   *time.Time     `json:"promo_start_date"`
	PromoEndDate     *time.Time     `json:"promo_end_date"`
	OwnerType        string         `json:"owner_type" gorm:"type:varchar(20);default:'external'"`
	OrganizationID   *uuid.UUID     `json:"organization_id" gorm:"type:char(36);index"`
	Mentors          []User         `json:"mentors,omitempty" gorm:"many2many:course_mentors;joinForeignKey:course_id;joinReferences:mentor_id;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	PublishedAt      *time.Time     `json:"published_at"`
	CreatedAt        time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt        time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt        gorm.DeletedAt `json:"deleted_at" gorm:"index"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   Tenant     `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`

	TargetRoles []CourseTargetRole `json:"target_roles,omitempty" gorm:"foreignKey:CourseID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
}

func (m *Course) BeforeCreate(tx *gorm.DB) error {
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
