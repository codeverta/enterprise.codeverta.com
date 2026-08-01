package middleware

import (
	"fmt"

	"gorm.io/gorm"
)

func RegisterTenantPlugin(db *gorm.DB) {
	// Handler untuk Query (SELECT)
	handler := func(d *gorm.DB) {
		// 1. Cek flag skip untuk tabel global (countries, provinces, dll)
		if skip, ok := d.Get("skip_tenant_scope"); ok && skip.(bool) {
			return
		}

		// 2. Ambil tenant_id dari context GORM atau Statement Context (fallback untuk transaksi)
		var tenantID interface{}
		if tID, ok := d.Get("tenant_id"); ok {
			tenantID = tID
		} else if d.Statement.Context != nil {
			if ctxVal := d.Statement.Context.Value("tenant_id"); ctxVal != nil {
				tenantID = ctxVal
			}
		}

		if tenantID != nil && tenantID != "" {
			if d.Statement.Schema != nil {
				// Only inject if the model has a tenant_id field/column
				if field := d.Statement.Schema.LookUpField("tenant_id"); field != nil {
					tableName := d.Statement.Schema.Table
					d.Where(fmt.Sprintf("%s.tenant_id = ?", tableName), tenantID)
				}
			} else {
				// Fallback jika tidak pakai Model struct
				tableName := d.Statement.Table
				if tableName != "" && tableName != "course_mentors" && tableName != "tenants" && tableName != "reg_provinces" && tableName != "reg_regencies" && tableName != "reg_districts" {
					d.Where("tenant_id = ?", tenantID)
				}
			}
		} else {
			// SECURITY: Jika tidak ada tenant_id, paksa query gagal agar tidak bocor
			d.AddError(fmt.Errorf("access denied: no tenant_id provided"))
		}
	}

	// Daftarkan ke hook GORM
	db.Callback().Query().Before("gorm:query").Register("tenant_scope", handler)
	db.Callback().Update().Before("gorm:update").Register("tenant_scope", handler)
	db.Callback().Delete().Before("gorm:delete").Register("tenant_scope", handler)
}
