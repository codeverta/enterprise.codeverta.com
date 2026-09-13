package provisioning

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"gin-template/internal/tenancy"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var slugPattern = regexp.MustCompile(`^[a-z][a-z0-9-]{1,38}[a-z0-9]$`)

type Request struct {
	Name          string
	Slug          string
	Domain        string
	Plan          string
	AdminEmail    string
	AdminPassword string
}

type DatabaseProvisioner interface {
	Create(context.Context, tenancy.Record, string) error
}

type Migrator func(context.Context, *gorm.DB) error
type Bootstrapper func(context.Context, *gorm.DB, tenancy.Record, Request) error

type Service struct {
	registry             *tenancy.Registry
	databases            *tenancy.DatabaseManager
	cipher               *tenancy.CredentialCipher
	provisioner          DatabaseProvisioner
	migrate              Migrator
	bootstrap            Bootstrapper
	dbHost               string
	dbPort               uint16
	platformDomainSuffix string
}

func NewService(registry *tenancy.Registry, databases *tenancy.DatabaseManager, cipher *tenancy.CredentialCipher, provisioner DatabaseProvisioner, migrate Migrator, bootstrap Bootstrapper, dbHost string, dbPort uint16, platformDomainSuffix string) *Service {
	return &Service{registry: registry, databases: databases, cipher: cipher, provisioner: provisioner, migrate: migrate, bootstrap: bootstrap, dbHost: dbHost, dbPort: dbPort, platformDomainSuffix: strings.ToLower(strings.TrimPrefix(strings.TrimSpace(platformDomainSuffix), "."))}
}

func (s *Service) Create(ctx context.Context, request Request) (tenancy.Record, error) {
	request.Slug = strings.ToLower(strings.TrimSpace(request.Slug))
	domain, err := tenancy.NormalizeHost(request.Domain)
	if err != nil || !slugPattern.MatchString(request.Slug) || strings.TrimSpace(request.Name) == "" || strings.TrimSpace(request.AdminEmail) == "" {
		return tenancy.Record{}, errors.New("invalid tenant provisioning request")
	}
	if request.Plan == "" {
		request.Plan = "starter"
	}
	if existing, findErr := s.registry.FindBySlug(ctx, request.Slug); findErr == nil {
		return existing, fmt.Errorf("tenant %q already exists with status %s", request.Slug, existing.Status)
	} else if !errors.Is(findErr, tenancy.ErrTenantNotFound) {
		return tenancy.Record{}, findErr
	}

	password, err := secureToken(32)
	if err != nil {
		return tenancy.Record{}, err
	}
	encrypted, err := s.cipher.Encrypt(password)
	if err != nil {
		return tenancy.Record{}, err
	}
	userSuffix, err := secureIdentifier(6)
	if err != nil {
		return tenancy.Record{}, err
	}
	dbStem := strings.ReplaceAll(request.Slug, "-", "_")
	now := time.Now().UTC()
	record := tenancy.Record{
		ID: uuid.New(), Name: strings.TrimSpace(request.Name), Slug: request.Slug, PrimaryDomain: domain,
		DatabaseDriver: "mysql", DatabaseName: "erp_" + dbStem, DatabaseHost: s.dbHost,
		DatabasePort: s.dbPort, DatabaseUser: "erp_" + dbStem[:min(len(dbStem), 12)] + "_" + strings.ToLower(userSuffix),
		DatabasePasswordEncrypted: encrypted, Status: tenancy.StatusProvisioning, Plan: request.Plan,
		CreatedAt: now, UpdatedAt: now,
	}
	var verifiedAt *time.Time
	if s.platformDomainSuffix != "" && domain == request.Slug+"."+s.platformDomainSuffix {
		verifiedAt = &now // Only platform-owned wildcard subdomains are pre-verified.
	}
	domainRow := tenancy.Domain{ID: uuid.New(), Domain: domain, IsPrimary: true, VerifiedAt: verifiedAt, CreatedAt: now}
	if err := s.registry.Create(ctx, &record, domainRow); err != nil {
		return tenancy.Record{}, err
	}
	fail := func(cause error) (tenancy.Record, error) {
		_ = s.registry.UpdateState(ctx, record.ID, tenancy.StatusFailed, cause.Error())
		record.Status = tenancy.StatusFailed
		record.ProvisioningError = cause.Error()
		return record, cause
	}
	if err := s.provisioner.Create(ctx, record, password); err != nil {
		return fail(fmt.Errorf("create tenant database: %w", err))
	}
	tenantDB, err := s.databases.GetDB(ctx, record)
	if err != nil {
		return fail(err)
	}
	if s.migrate != nil {
		if err := s.migrate(ctx, tenantDB); err != nil {
			return fail(fmt.Errorf("migrate tenant database: %w", err))
		}
	}
	if s.bootstrap != nil {
		if err := s.bootstrap(ctx, tenantDB, record, request); err != nil {
			return fail(fmt.Errorf("bootstrap tenant: %w", err))
		}
	}
	if err := s.registry.UpdateState(ctx, record.ID, tenancy.StatusActive, ""); err != nil {
		return fail(err)
	}
	record.Status = tenancy.StatusActive
	record.ProvisioningError = ""
	return record, nil
}

func secureToken(bytes int) (string, error) {
	buffer := make([]byte, bytes)
	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buffer), nil
}

func secureIdentifier(bytes int) (string, error) {
	buffer := make([]byte, bytes)
	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}
	return hex.EncodeToString(buffer), nil
}
