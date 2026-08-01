package model

import (
	"fmt"
	"gin-template/common"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// interval: "monthly" | "yearly" | "lifetime" | "custom"
type SubscriptionPlan struct {
	ID                uuid.UUID                `json:"id" gorm:"type:char(36);primaryKey"`
	Name              string                   `json:"name" gorm:"type:varchar(100);not null"`
	Slug              string                   `json:"slug" gorm:"type:varchar(100);uniqueIndex;not null"` // cth: "pro-monthly"
	Description       string                   `json:"description" gorm:"type:text"`
	Amount            float64                  `json:"amount" gorm:"type:decimal(16,2);not null;default:0"`
	Currency          string                   `json:"currency" gorm:"type:varchar(8);default:'IDR'"`
	DurationDays      int                      `json:"duration_days" gorm:"not null"`             // 30, 365, 0 = lifetime
	Interval          string                   `json:"interval" gorm:"type:varchar(20);not null"` // monthly, yearly, lifetime, custom
	IsFree            bool                     `json:"is_free" gorm:"default:false"`
	RequiresApproval  bool                     `json:"requires_approval" gorm:"default:false"`
	IsActive          bool                     `json:"is_active" gorm:"default:true"`
	BundleID          *uuid.UUID               `json:"bundle_id" gorm:"type:char(36);index"`
	Bundle            *CourseBundle            `json:"bundle,omitempty" gorm:"foreignKey:BundleID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
	BundleIDs         []uuid.UUID              `json:"bundle_ids,omitempty" gorm:"-"`
	PlanBundles       []SubscriptionPlanBundle `json:"plan_bundles,omitempty" gorm:"foreignKey:PlanID"`
	PricingCategoryID *uuid.UUID               `json:"pricing_category_id" gorm:"type:char(36);index"`
	PricingCategory   *PricingCategory         `json:"pricing_category,omitempty" gorm:"foreignKey:PricingCategoryID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
	FeatureMeta       datatypes.JSON           `json:"feature_meta" gorm:"column:features;type:json"`

	// Limit akses konten (0 = unlimited)
	MaxCourses int `json:"max_courses" gorm:"default:0"`
	MaxUsers   int `json:"max_users" gorm:"default:1"` // untuk paket tim/kelas

	// Relations
	Features      []SubscriptionFeature `json:"features,omitempty" gorm:"foreignKey:PlanID"`
	Subscriptions []Subscription        `json:"-" gorm:"foreignKey:PlanID"`

	TenantID  *uuid.UUID     `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant    *Tenant        `json:"tenant,omitempty" gorm:"foreignKey:TenantID"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"deleted_at" gorm:"index"`
}

type SubscriptionPlanBundle struct {
	ID        uuid.UUID         `json:"id" gorm:"type:char(36);primaryKey"`
	PlanID    uuid.UUID         `json:"plan_id" gorm:"type:char(36);not null;index:idx_subscription_plan_bundle,unique"`
	Plan      *SubscriptionPlan `json:"-" gorm:"foreignKey:PlanID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	BundleID  uuid.UUID         `json:"bundle_id" gorm:"type:char(36);not null;index:idx_subscription_plan_bundle,unique"`
	Bundle    *CourseBundle     `json:"bundle,omitempty" gorm:"foreignKey:BundleID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	CreatedAt time.Time         `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt time.Time         `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt gorm.DeletedAt    `json:"deleted_at" gorm:"index"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index"`
	Tenant   *Tenant    `json:"-" gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (m *SubscriptionPlanBundle) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	if m.TenantID == nil {
		if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
			m.TenantID = &tenant.ID
		}
	}
	return nil
}

func SubscriptionPlanBundleIDs(db *gorm.DB, planID uuid.UUID, legacyBundleID *uuid.UUID) ([]uuid.UUID, error) {
	seen := map[uuid.UUID]bool{}
	bundleIDs := make([]uuid.UUID, 0)
	if legacyBundleID != nil && *legacyBundleID != uuid.Nil {
		seen[*legacyBundleID] = true
		bundleIDs = append(bundleIDs, *legacyBundleID)
	}
	if planID == uuid.Nil {
		return bundleIDs, nil
	}
	var joined []uuid.UUID
	if err := db.Model(&SubscriptionPlanBundle{}).Where("plan_id = ?", planID).Pluck("bundle_id", &joined).Error; err != nil {
		return nil, err
	}
	for _, bundleID := range joined {
		if bundleID == uuid.Nil || seen[bundleID] {
			continue
		}
		seen[bundleID] = true
		bundleIDs = append(bundleIDs, bundleID)
	}
	return bundleIDs, nil
}

func BundleCourseIDs(db *gorm.DB, bundleIDs []uuid.UUID) ([]uuid.UUID, error) {
	if len(bundleIDs) == 0 {
		return []uuid.UUID{}, nil
	}
	var courseIDs []uuid.UUID
	err := db.Model(&CourseBundleItem{}).
		Where("bundle_id IN ?", bundleIDs).
		Distinct("course_id").
		Pluck("course_id", &courseIDs).Error
	return courseIDs, err
}

func (p *SubscriptionPlan) BeforeCreate(tx *gorm.DB) error {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
		p.TenantID = &tenant.ID
	} else {
		return fmt.Errorf("tenant_id is required")
	}

	if p.Slug == "" {
		slugified := ""
		for _, r := range p.Name {
			if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
				slugified += string(r)
			} else if r >= 'A' && r <= 'Z' {
				slugified += string(r + 32)
			} else if r == ' ' || r == '-' || r == '_' {
				if len(slugified) > 0 && slugified[len(slugified)-1] != '-' {
					slugified += "-"
				}
			}
		}
		for len(slugified) > 0 && slugified[len(slugified)-1] == '-' {
			slugified = slugified[:len(slugified)-1]
		}
		if slugified == "" {
			slugified = "plan"
		}
		idStr := p.ID.String()
		uniqueSuffix := idStr[len(idStr)-6:]
		p.Slug = fmt.Sprintf("%s-%s", slugified, uniqueSuffix)
	}

	return nil
}

func (p *SubscriptionPlan) BeforeSave(tx *gorm.DB) error {
	if p.Currency == "" {
		p.Currency = "IDR"
	}
	if p.Interval == "" {
		p.Interval = "month"
	}
	return nil
}
