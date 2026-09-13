package tenancy

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

type Status string

const (
	StatusProvisioning Status = "provisioning"
	StatusActive       Status = "active"
	StatusTrial        Status = "trial"
	StatusSuspended    Status = "suspended"
	StatusReadOnly     Status = "read_only"
	StatusFailed       Status = "failed"
	StatusTerminated   Status = "terminated"
)

var (
	ErrTenantNotFound    = errors.New("tenant not found")
	ErrTenantUnavailable = errors.New("tenant database unavailable")
	ErrDomainUnverified  = errors.New("tenant domain is not verified")
)

// Context is the only tenant metadata exposed to application code. It never
// contains database credentials or infrastructure addresses.
type Context struct {
	ID     uuid.UUID
	Slug   string
	Domain string
	Plan   string
	Status Status
}

type Record struct {
	ID                        uuid.UUID `gorm:"type:char(36);primaryKey" json:"id"`
	Name                      string    `gorm:"size:160;not null" json:"name"`
	Slug                      string    `gorm:"size:80;uniqueIndex;not null" json:"slug"`
	PrimaryDomain             string    `gorm:"size:253;uniqueIndex;not null" json:"domain"`
	DatabaseDriver            string    `gorm:"size:20;not null;default:mysql" json:"database_driver"`
	DatabaseName              string    `gorm:"size:128;not null" json:"database_name"`
	DatabaseHost              string    `gorm:"size:253;not null" json:"database_host"`
	DatabasePort              uint16    `gorm:"not null" json:"database_port"`
	DatabaseUser              string    `gorm:"size:128;not null" json:"database_user"`
	DatabasePasswordEncrypted string    `gorm:"type:text;not null" json:"-"`
	Status                    Status    `gorm:"size:24;index;not null" json:"status"`
	Plan                      string    `gorm:"size:80;index;not null" json:"plan"`
	ClusterID                 string    `gorm:"size:80;index" json:"cluster_id"`
	ProvisioningError         string    `gorm:"type:text" json:"provisioning_error,omitempty"`
	SchemaVersion             int64     `gorm:"not null;default:0" json:"schema_version"`
	CreatedAt                 time.Time `json:"created_at"`
	UpdatedAt                 time.Time `json:"updated_at"`
	Domains                   []Domain  `gorm:"foreignKey:TenantID" json:"domains,omitempty"`
}

func (Record) TableName() string { return "platform_tenants" }

type Domain struct {
	ID          uuid.UUID  `gorm:"type:char(36);primaryKey" json:"id"`
	TenantID    uuid.UUID  `gorm:"type:char(36);not null;index" json:"tenant_id"`
	Domain      string     `gorm:"size:253;uniqueIndex;not null" json:"domain"`
	IsPrimary   bool       `gorm:"not null;default:false" json:"is_primary"`
	VerifyToken string     `gorm:"size:128" json:"-"`
	VerifiedAt  *time.Time `json:"verified_at"`
	CreatedAt   time.Time  `json:"created_at"`
}

func (Domain) TableName() string { return "tenant_domains" }

func (r Record) SafeContext(domain string) Context {
	return Context{ID: r.ID, Slug: r.Slug, Domain: domain, Plan: r.Plan, Status: r.Status}
}
