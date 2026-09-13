package entitlement

import (
	"context"
	"errors"
	"strings"
	"sync"
	"time"

	"gin-template/internal/tenancy"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Plan struct {
	ID        uuid.UUID `gorm:"type:char(36);primaryKey"`
	Slug      string    `gorm:"size:80;uniqueIndex;not null"`
	Name      string    `gorm:"size:160;not null"`
	IsActive  bool      `gorm:"not null;default:true"`
	CreatedAt time.Time
	UpdatedAt time.Time
}

func (Plan) TableName() string { return "platform_plans" }

type Grant struct {
	ID        uuid.UUID `gorm:"type:char(36);primaryKey"`
	PlanID    uuid.UUID `gorm:"type:char(36);not null;uniqueIndex:plan_feature"`
	Feature   string    `gorm:"size:120;not null;uniqueIndex:plan_feature"`
	Enabled   bool      `gorm:"not null;default:false"`
	Limit     *int64
	CreatedAt time.Time
	UpdatedAt time.Time
}

func (Grant) TableName() string { return "platform_plan_entitlements" }

type cacheEntry struct {
	grants  map[string]Grant
	expires time.Time
}

type Service struct {
	db    *gorm.DB
	ttl   time.Duration
	mu    sync.RWMutex
	cache map[string]cacheEntry
}

func New(db *gorm.DB, ttl time.Duration) *Service {
	if ttl <= 0 {
		ttl = 5 * time.Minute
	}
	return &Service{db: db, ttl: ttl, cache: make(map[string]cacheEntry)}
}

func (s *Service) Migrate() error { return s.db.AutoMigrate(&Plan{}, &Grant{}) }

func (s *Service) Has(ctx context.Context, feature string) (bool, error) {
	grant, found, err := s.lookup(ctx, feature)
	return found && grant.Enabled, err
}

func (s *Service) Limit(ctx context.Context, feature string) (int64, bool, error) {
	grant, found, err := s.lookup(ctx, feature)
	if err != nil || !found || !grant.Enabled || grant.Limit == nil {
		return 0, false, err
	}
	return *grant.Limit, true, nil
}

func (s *Service) lookup(ctx context.Context, feature string) (Grant, bool, error) {
	tenant, ok := tenancy.FromContext(ctx)
	if !ok {
		return Grant{}, false, errors.New("tenant context is required for entitlement check")
	}
	feature = strings.ToLower(strings.TrimSpace(feature))
	if feature == "" {
		return Grant{}, false, errors.New("feature is required")
	}
	grants, err := s.plan(ctx, tenant.Plan)
	if err != nil {
		return Grant{}, false, err
	}
	grant, found := grants[feature]
	return grant, found, nil
}

func (s *Service) plan(ctx context.Context, slug string) (map[string]Grant, error) {
	s.mu.RLock()
	cached, ok := s.cache[slug]
	s.mu.RUnlock()
	if ok && time.Now().Before(cached.expires) {
		return cached.grants, nil
	}
	var plan Plan
	if err := s.db.WithContext(ctx).First(&plan, "slug = ? AND is_active = ?", slug, true).Error; err != nil {
		return nil, err
	}
	var rows []Grant
	if err := s.db.WithContext(ctx).Where("plan_id = ?", plan.ID).Find(&rows).Error; err != nil {
		return nil, err
	}
	grants := make(map[string]Grant, len(rows))
	for _, row := range rows {
		grants[strings.ToLower(row.Feature)] = row
	}
	s.mu.Lock()
	s.cache[slug] = cacheEntry{grants: grants, expires: time.Now().Add(s.ttl)}
	s.mu.Unlock()
	return grants, nil
}

func (s *Service) Invalidate(planSlug string) {
	s.mu.Lock()
	delete(s.cache, strings.ToLower(strings.TrimSpace(planSlug)))
	s.mu.Unlock()
}
