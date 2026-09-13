package model

import (
	"context"
	"fmt"
	"strings"
	"time"

	"gin-template/common"
	"gin-template/internal/tenancy"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// BootstrapTenantAdmin creates the compatibility tenant identity and first ERP
// administrator inside one already-migrated physical tenant database.
func BootstrapTenantAdmin(ctx context.Context, db *gorm.DB, tenant tenancy.Record, email, password string) error {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" || len(password) < 12 {
		return fmt.Errorf("admin email and a password of at least 12 characters are required")
	}
	now := time.Now().UTC()
	legacyTenant := Tenant{ID: tenant.ID, Name: tenant.Name, Domain: tenant.PrimaryDomain, IsActive: true, CreatedAt: &now, UpdatedAt: &now}
	scoped := context.WithValue(ctx, common.CtxTenantKey, legacyTenant)
	tx := db.WithContext(scoped)
	if err := tx.Set("skip_tenant_scope", true).FirstOrCreate(&legacyTenant, Tenant{ID: tenant.ID}).Error; err != nil {
		return err
	}
	var count int64
	if err := tx.Model(&User{}).Where("LOWER(email) = ?", email).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	tenantID := tenant.ID
	admin := User{
		ID: uuid.New(), Username: email, Email: email, DisplayName: "Administrator",
		Password: string(hash), Role: RoleAdmin, Status: common.UserStatusEnabled,
		Token: uuid.NewString(), TenantID: &tenantID, CreatedAt: &now, UpdatedAt: &now,
	}
	return tx.Create(&admin).Error
}
