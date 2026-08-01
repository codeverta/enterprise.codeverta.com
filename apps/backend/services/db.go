package services

import "gorm.io/gorm"

func freshScopedDB(db *gorm.DB) *gorm.DB {
	fresh := db.Session(&gorm.Session{NewDB: true})

	if tenantID, ok := db.Get("tenant_id"); ok {
		fresh = fresh.Set("tenant_id", tenantID)
	}
	if skipTenantScope, ok := db.Get("skip_tenant_scope"); ok {
		fresh = fresh.Set("skip_tenant_scope", skipTenantScope)
	}

	return fresh
}
