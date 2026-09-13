package tenancy

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"net"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Resolver interface {
	ResolveByHost(context.Context, string) (Record, error)
	ResolveByID(context.Context, string) (Record, error)
	Invalidate(string)
}
type cacheEntry struct {
	record  Record
	expires time.Time
}
type Registry struct {
	db    *gorm.DB
	ttl   time.Duration
	mu    sync.RWMutex
	hosts map[string]cacheEntry
}

func (r *Registry) Create(ctx context.Context, record *Record, domains ...Domain) error {
	record.Slug = strings.ToLower(strings.TrimSpace(record.Slug))
	primary, err := NormalizeHost(record.PrimaryDomain)
	if err != nil {
		return err
	}
	record.PrimaryDomain = primary
	for i := range domains {
		domain, err := NormalizeHost(domains[i].Domain)
		if err != nil {
			return err
		}
		domains[i].Domain = domain
	}
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(record).Error; err != nil {
			return err
		}
		for i := range domains {
			domains[i].TenantID = record.ID
			if domains[i].ID == uuid.Nil {
				domains[i].ID = uuid.New()
			}
		}
		if len(domains) > 0 {
			return tx.Create(&domains).Error
		}
		return nil
	})
}

func (r *Registry) List(ctx context.Context) ([]Record, error) {
	var records []Record
	err := r.db.WithContext(ctx).Preload("Domains").Order("created_at ASC").Find(&records).Error
	return records, err
}

func (r *Registry) FindBySlug(ctx context.Context, slug string) (Record, error) {
	var record Record
	err := r.db.WithContext(ctx).Preload("Domains").First(&record, "slug = ?", strings.ToLower(strings.TrimSpace(slug))).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return Record{}, ErrTenantNotFound
	}
	return record, err
}

func (r *Registry) UpdateState(ctx context.Context, id uuid.UUID, status Status, provisioningError string) error {
	err := r.db.WithContext(ctx).Model(&Record{}).Where("id = ?", id).Updates(map[string]any{
		"status": status, "provisioning_error": provisioningError, "updated_at": time.Now(),
	}).Error
	if err == nil {
		r.InvalidateTenant(id)
	}
	return err
}

func (r *Registry) InvalidateTenant(id uuid.UUID) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for host, entry := range r.hosts {
		if entry.record.ID == id {
			delete(r.hosts, host)
		}
	}
}

func (r *Registry) BeginDomainVerification(ctx context.Context, tenantID uuid.UUID, input string) (string, error) {
	host, err := NormalizeHost(input)
	if err != nil {
		return "", err
	}
	random := make([]byte, 32)
	if _, err := rand.Read(random); err != nil {
		return "", err
	}
	token := base64.RawURLEncoding.EncodeToString(random)
	var existing Domain
	findErr := r.db.WithContext(ctx).First(&existing, "domain = ?", host).Error
	if findErr == nil {
		if existing.TenantID != tenantID || existing.VerifiedAt != nil {
			return "", errors.New("domain is already registered")
		}
		if err := r.db.WithContext(ctx).Model(&existing).Update("verify_token", token).Error; err != nil {
			return "", err
		}
		return token, nil
	}
	if !errors.Is(findErr, gorm.ErrRecordNotFound) {
		return "", findErr
	}
	domain := Domain{ID: uuid.New(), TenantID: tenantID, Domain: host, VerifyToken: token, CreatedAt: time.Now().UTC()}
	if err := r.db.WithContext(ctx).Create(&domain).Error; err != nil {
		return "", err
	}
	return token, nil
}

func (r *Registry) PendingDomain(ctx context.Context, input string) (Domain, error) {
	host, err := NormalizeHost(input)
	if err != nil {
		return Domain{}, err
	}
	var domain Domain
	if err := r.db.WithContext(ctx).First(&domain, "domain = ? AND verified_at IS NULL", host).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return Domain{}, ErrTenantNotFound
		}
		return Domain{}, err
	}
	return domain, nil
}

// ConfirmDomainVerification must only be called after the DNS/HTTP verifier has
// observed proof. Constant-time comparison avoids leaking the verification token.
func (r *Registry) ConfirmDomainVerification(ctx context.Context, input, proof string) error {
	host, err := NormalizeHost(input)
	if err != nil {
		return err
	}
	var domain Domain
	if err := r.db.WithContext(ctx).First(&domain, "domain = ?", host).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrTenantNotFound
		}
		return err
	}
	if domain.VerifyToken == "" || subtle.ConstantTimeCompare([]byte(domain.VerifyToken), []byte(strings.TrimSpace(proof))) != 1 {
		return ErrDomainUnverified
	}
	now := time.Now().UTC()
	if err := r.db.WithContext(ctx).Model(&Domain{}).Where("id = ?", domain.ID).Updates(map[string]any{
		"verified_at": now, "verify_token": "",
	}).Error; err != nil {
		return err
	}
	r.Invalidate(host)
	return nil
}

func NewRegistry(db *gorm.DB, ttl time.Duration) *Registry {
	if ttl <= 0 {
		ttl = 5 * time.Minute
	}
	return &Registry{db: db, ttl: ttl, hosts: map[string]cacheEntry{}}
}
func (r *Registry) Migrate() error { return r.db.AutoMigrate(&Record{}, &Domain{}) }

func NormalizeHost(value string) (string, error) {
	host := strings.ToLower(strings.TrimSpace(value))
	if h, _, err := net.SplitHostPort(host); err == nil {
		host = h
	}
	host = strings.TrimSuffix(host, ".")
	if host == "" || len(host) > 253 || strings.ContainsAny(host, "/\\@") {
		return "", ErrTenantNotFound
	}
	for _, label := range strings.Split(host, ".") {
		if label == "" || len(label) > 63 {
			return "", ErrTenantNotFound
		}
		for _, c := range label {
			if (c < 'a' || c > 'z') && (c < '0' || c > '9') && c != '-' {
				return "", ErrTenantNotFound
			}
		}
	}
	return host, nil
}

func (r *Registry) ResolveByHost(ctx context.Context, input string) (Record, error) {
	host, err := NormalizeHost(input)
	if err != nil {
		return Record{}, err
	}
	r.mu.RLock()
	cached, ok := r.hosts[host]
	r.mu.RUnlock()
	if ok && time.Now().Before(cached.expires) {
		return cached.record, nil
	}
	var record Record
	err = r.db.WithContext(ctx).Preload("Domains").Joins("JOIN tenant_domains td ON td.tenant_id = platform_tenants.id").Where("td.domain = ? AND td.verified_at IS NOT NULL", host).First(&record).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return Record{}, ErrTenantNotFound
	}
	if err != nil {
		return Record{}, err
	}
	r.mu.Lock()
	r.hosts[host] = cacheEntry{record: record, expires: time.Now().Add(r.ttl)}
	r.mu.Unlock()
	return record, nil
}
func (r *Registry) ResolveByID(ctx context.Context, id string) (Record, error) {
	var row Record
	if err := r.db.WithContext(ctx).First(&row, "id = ?", id).Error; errors.Is(err, gorm.ErrRecordNotFound) {
		return row, ErrTenantNotFound
	} else {
		return row, err
	}
}
func (r *Registry) Invalidate(host string) {
	normalized, _ := NormalizeHost(host)
	r.mu.Lock()
	delete(r.hosts, normalized)
	r.mu.Unlock()
}
