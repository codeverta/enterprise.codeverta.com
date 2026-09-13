package tenancy

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
)

type Middleware struct {
	resolver  Resolver
	databases *DatabaseManager
}

func NewMiddleware(resolver Resolver, databases *DatabaseManager) *Middleware {
	return &Middleware{resolver: resolver, databases: databases}
}
func tenantError(c *gin.Context, status int, code, message string) {
	requestID := c.GetString("request_id")
	c.AbortWithStatusJSON(status, gin.H{"error": gin.H{"code": code, "message": message, "request_id": requestID}})
}
func (m *Middleware) Resolve() gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Method == http.MethodOptions {
			c.Next()
			return
		}
		record, err := m.resolver.ResolveByHost(c.Request.Context(), c.Request.Host)
		if err != nil {
			tenantError(c, 404, "TENANT_NOT_FOUND", "Tenant not found")
			return
		}
		switch record.Status {
		case StatusActive, StatusTrial:
		case StatusReadOnly:
			if isMutation(c.Request.Method) && !isReadOnlyAuthRoute(c.Request.URL.Path) {
				tenantError(c, 403, "TENANT_READ_ONLY", "Tenant is in read-only mode")
				return
			}
		case StatusSuspended:
			tenantError(c, 403, "TENANT_SUSPENDED", "Tenant is suspended")
			return
		case StatusProvisioning:
			tenantError(c, 503, "TENANT_PROVISIONING", "Tenant is being provisioned")
			return
		default:
			tenantError(c, 404, "TENANT_NOT_FOUND", "Tenant not found")
			return
		}
		db, err := m.databases.GetDB(c.Request.Context(), record)
		if err != nil {
			tenantError(c, 503, "TENANT_DATABASE_UNAVAILABLE", "Tenant database is unavailable")
			return
		}
		host, _ := NormalizeHost(c.Request.Host)
		safe := record.SafeContext(host)
		ctx := WithScope(c.Request.Context(), safe, db)
		c.Request = c.Request.WithContext(ctx)
		c.Set("db", db.WithContext(ctx))
		c.Set("tenant_context", safe)
		c.Set("tenant_id", record.ID.String())
		c.Next()
	}
}

func isMutation(method string) bool {
	return method == http.MethodPost || method == http.MethodPut || method == http.MethodPatch || method == http.MethodDelete
}

func isReadOnlyAuthRoute(route string) bool {
	switch route {
	case "/api/auth/login", "/api/auth/refresh-token", "/api/auth/logout":
		return true
	default:
		return false
	}
}
func RequireJWTBinding() gin.HandlerFunc {
	return func(c *gin.Context) {
		tenant, ok := FromContext(c.Request.Context())
		if !ok {
			tenantError(c, 401, "UNAUTHORIZED", "Tenant context is missing")
			return
		}
		if claim, exists := c.Get("jwt_tenant_id"); exists && claim != nil {
			claimTenantID, valid := claim.(string)
			if !valid || claimTenantID == "" || claimTenantID != tenant.ID.String() {
				tenantError(c, 403, "FORBIDDEN", "Token does not belong to this tenant")
				return
			}
		}
		c.Next()
	}
}
func IsUnavailable(err error) bool { return errors.Is(err, ErrTenantUnavailable) }
