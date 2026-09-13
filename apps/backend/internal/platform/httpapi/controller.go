package httpapi

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"net"
	"net/http"
	"strings"

	"gin-template/internal/platform/adminauth"
	"gin-template/internal/platform/provisioning"
	"gin-template/internal/tenancy"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type Controller struct {
	Auth      *adminauth.Service
	Registry  *tenancy.Registry
	Databases *tenancy.DatabaseManager
	Provision *provisioning.Service
	Migrate   func(context.Context, *gorm.DB) error
}

func (h *Controller) Login(c *gin.Context) {
	var input struct {
		Email    string `json:"email" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if c.ShouldBindJSON(&input) != nil {
		writeError(c, http.StatusBadRequest, "INVALID_REQUEST", "Email and password are required")
		return
	}
	token, err := h.Auth.Login(input.Email, input.Password)
	if err != nil {
		writeError(c, http.StatusUnauthorized, "UNAUTHORIZED", "Invalid platform credentials")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"access_token": token, "token_type": "Bearer"}})
}

func (h *Controller) ListTenants(c *gin.Context) {
	rows, err := h.Registry.List(c.Request.Context())
	if err != nil {
		writeError(c, http.StatusInternalServerError, "PLATFORM_DATABASE_UNAVAILABLE", "Unable to list tenants")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}

func (h *Controller) CreateTenant(c *gin.Context) {
	var input struct {
		Name       string `json:"name" binding:"required"`
		Slug       string `json:"slug" binding:"required"`
		Domain     string `json:"domain" binding:"required"`
		Plan       string `json:"plan"`
		AdminEmail string `json:"admin_email" binding:"required"`
	}
	if c.ShouldBindJSON(&input) != nil {
		writeError(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid tenant provisioning request")
		return
	}
	initialPassword, err := randomSecret(24)
	if err != nil {
		writeError(c, http.StatusInternalServerError, "PROVISIONING_FAILED", "Unable to provision tenant")
		return
	}
	record, err := h.Provision.Create(c.Request.Context(), provisioning.Request{
		Name: input.Name, Slug: input.Slug, Domain: input.Domain, Plan: input.Plan,
		AdminEmail: input.AdminEmail, AdminPassword: initialPassword,
	})
	if err != nil {
		writeError(c, http.StatusInternalServerError, "PROVISIONING_FAILED", "Tenant provisioning failed")
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": record, "initial_admin": gin.H{
		"email": input.AdminEmail, "temporary_password": initialPassword, "must_change_password": true,
	}})
}

func (h *Controller) SetTenantState(c *gin.Context) {
	record, err := h.Registry.FindBySlug(c.Request.Context(), c.Param("slug"))
	if err != nil {
		writeError(c, http.StatusNotFound, "TENANT_NOT_FOUND", "Tenant not found")
		return
	}
	var input struct {
		Status tenancy.Status `json:"status" binding:"required"`
	}
	if c.ShouldBindJSON(&input) != nil || !allowedState(input.Status) {
		writeError(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid tenant status")
		return
	}
	if input.Status == tenancy.StatusActive || input.Status == tenancy.StatusTrial || input.Status == tenancy.StatusReadOnly {
		if err := h.Databases.HealthCheck(c.Request.Context(), record); err != nil {
			writeError(c, http.StatusServiceUnavailable, "TENANT_DATABASE_UNAVAILABLE", "Tenant database must be healthy before activation")
			return
		}
	}
	if err := h.Registry.UpdateState(c.Request.Context(), record.ID, input.Status, ""); err != nil {
		writeError(c, http.StatusInternalServerError, "PLATFORM_DATABASE_UNAVAILABLE", "Unable to update tenant")
		return
	}
	if input.Status == tenancy.StatusTerminated || input.Status == tenancy.StatusSuspended {
		_ = h.Databases.ClosePool(record.ID.String())
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"slug": record.Slug, "status": input.Status}})
}

func (h *Controller) Health(c *gin.Context) {
	record, err := h.Registry.FindBySlug(c.Request.Context(), c.Param("slug"))
	if err != nil {
		writeError(c, http.StatusNotFound, "TENANT_NOT_FOUND", "Tenant not found")
		return
	}
	if err := h.Databases.HealthCheck(c.Request.Context(), record); err != nil {
		writeError(c, http.StatusServiceUnavailable, "TENANT_DATABASE_UNAVAILABLE", "Tenant database is unavailable")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"slug": record.Slug, "database": "healthy"}})
}

func (h *Controller) MigrateTenant(c *gin.Context) {
	record, err := h.Registry.FindBySlug(c.Request.Context(), c.Param("slug"))
	if err != nil {
		writeError(c, http.StatusNotFound, "TENANT_NOT_FOUND", "Tenant not found")
		return
	}
	db, err := h.Databases.GetDB(c.Request.Context(), record)
	if err != nil || h.Migrate == nil || h.Migrate(c.Request.Context(), db) != nil {
		writeError(c, http.StatusInternalServerError, "MIGRATION_FAILED", "Tenant migration failed")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"slug": record.Slug, "migrated": true}})
}

func (h *Controller) BeginDomainVerification(c *gin.Context) {
	record, err := h.Registry.FindBySlug(c.Request.Context(), c.Param("slug"))
	if err != nil {
		writeError(c, http.StatusNotFound, "TENANT_NOT_FOUND", "Tenant not found")
		return
	}
	var input struct {
		Domain string `json:"domain" binding:"required"`
	}
	if c.ShouldBindJSON(&input) != nil {
		writeError(c, http.StatusBadRequest, "INVALID_REQUEST", "Domain is required")
		return
	}
	token, err := h.Registry.BeginDomainVerification(c.Request.Context(), record.ID, input.Domain)
	if err != nil {
		writeError(c, http.StatusConflict, "DOMAIN_REGISTRATION_FAILED", "Unable to register domain")
		return
	}
	domain, _ := tenancy.NormalizeHost(input.Domain)
	c.JSON(http.StatusCreated, gin.H{"data": gin.H{
		"domain": domain, "record_type": "TXT", "record_name": "_codeverta-verify." + domain,
		"record_value": "codeverta-verification=" + token,
	}})
}

func (h *Controller) VerifyDomain(c *gin.Context) {
	domain, err := h.Registry.PendingDomain(c.Request.Context(), c.Param("domain"))
	if err != nil {
		writeError(c, http.StatusNotFound, "TENANT_NOT_FOUND", "Pending domain not found")
		return
	}
	record, err := h.Registry.FindBySlug(c.Request.Context(), c.Param("slug"))
	if err != nil || record.ID != domain.TenantID {
		writeError(c, http.StatusNotFound, "TENANT_NOT_FOUND", "Pending domain not found")
		return
	}
	txtRecords, err := net.DefaultResolver.LookupTXT(c.Request.Context(), "_codeverta-verify."+domain.Domain)
	if err != nil {
		writeError(c, http.StatusConflict, "DOMAIN_NOT_VERIFIED", "Domain verification record was not found")
		return
	}
	expected := "codeverta-verification=" + domain.VerifyToken
	verified := false
	for _, value := range txtRecords {
		if strings.TrimSpace(value) == expected {
			verified = true
			break
		}
	}
	if !verified || h.Registry.ConfirmDomainVerification(c.Request.Context(), domain.Domain, domain.VerifyToken) != nil {
		writeError(c, http.StatusConflict, "DOMAIN_NOT_VERIFIED", "Domain verification record did not match")
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"domain": domain.Domain, "verified": true}})
}

func allowedState(status tenancy.Status) bool {
	switch status {
	case tenancy.StatusActive, tenancy.StatusTrial, tenancy.StatusSuspended, tenancy.StatusReadOnly, tenancy.StatusTerminated:
		return true
	default:
		return false
	}
}

func randomSecret(size int) (string, error) {
	buffer := make([]byte, size)
	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buffer), nil
}

func writeError(c *gin.Context, status int, code, message string) {
	c.AbortWithStatusJSON(status, gin.H{"error": gin.H{"code": strings.TrimSpace(code), "message": message, "request_id": c.GetString("request_id")}})
}
