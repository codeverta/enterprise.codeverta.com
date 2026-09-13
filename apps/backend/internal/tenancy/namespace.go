package tenancy

import (
	"context"
	"encoding/json"
	"errors"
	"path"
	"strings"
)

func CacheKey(ctx context.Context, parts ...string) (string, error) {
	tenant, ok := FromContext(ctx)
	if !ok {
		return "", errors.New("tenant context is required for cache key")
	}
	clean := make([]string, 0, len(parts)+2)
	clean = append(clean, "tenant", tenant.ID.String())
	for _, part := range parts {
		part = strings.Trim(strings.TrimSpace(part), ":")
		if part == "" || strings.ContainsAny(part, "\r\n") {
			return "", errors.New("invalid cache key segment")
		}
		clean = append(clean, part)
	}
	return strings.Join(clean, ":"), nil
}

func ObjectKey(ctx context.Context, category, name string) (string, error) {
	tenant, ok := FromContext(ctx)
	if !ok {
		return "", errors.New("tenant context is required for object key")
	}
	category = strings.Trim(category, "/")
	name = strings.Trim(name, "/")
	if category == "" || name == "" || path.Clean(category) != category || path.Clean(name) != name || strings.Contains(category, "..") || strings.Contains(name, "..") {
		return "", errors.New("invalid object key")
	}
	return path.Join("tenants", tenant.ID.String(), category, name), nil
}

type JobEnvelope struct {
	TenantID string          `json:"tenant_id"`
	Type     string          `json:"type"`
	Payload  json.RawMessage `json:"payload"`
}

type JobHandler func(context.Context, json.RawMessage) error

type JobRunner struct {
	Resolver  Resolver
	Databases *DatabaseManager
	Handlers  map[string]JobHandler
}

func (r JobRunner) Handle(ctx context.Context, job JobEnvelope) error {
	if r.Resolver == nil || r.Databases == nil || strings.TrimSpace(job.TenantID) == "" {
		return errors.New("tenant-aware job runner is not configured")
	}
	record, err := r.Resolver.ResolveByID(ctx, job.TenantID)
	if err != nil {
		return err
	}
	if record.Status != StatusActive && record.Status != StatusTrial {
		return ErrTenantUnavailable
	}
	handler := r.Handlers[job.Type]
	if handler == nil {
		return errors.New("unknown tenant job type")
	}
	db, err := r.Databases.GetDB(ctx, record)
	if err != nil {
		return err
	}
	jobContext := WithScope(ctx, record.SafeContext(""), db)
	return handler(jobContext, job.Payload)
}

func NewJob(ctx context.Context, jobType string, payload any) (JobEnvelope, error) {
	tenant, ok := FromContext(ctx)
	if !ok || strings.TrimSpace(jobType) == "" {
		return JobEnvelope{}, errors.New("tenant context and job type are required")
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return JobEnvelope{}, err
	}
	return JobEnvelope{TenantID: tenant.ID.String(), Type: jobType, Payload: body}, nil
}
