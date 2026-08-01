package model

import (
	"fmt"
	"gin-template/common"
	"time"

	"github.com/google/uuid" // go get github.com/google/uuid
	"gorm.io/gorm"
)

type AuditLog struct {
	ID        uuid.UUID `json:"id" gorm:"type:char(36);primaryKey"`
	CreatedAt time.Time `json:"created_at" gorm:"index:idx_audit_logs_table_record_created,priority:3;index:idx_audit_logs_tenant_created,priority:2"`
	UpdatedAt time.Time
	DeletedAt gorm.DeletedAt `gorm:"index"`

	// Changed integers to strings for UUID support
	UserID    uuid.UUID `json:"user_id" gorm:"type:char(36)"`
	Action    string    `json:"action" gorm:"size:50"`
	TableName string    `json:"table_name" gorm:"index:idx_audit_logs_table_record_created,priority:1"`
	RecordID  string    `json:"record_id" gorm:"type:varchar(255);index;index:idx_audit_logs_table_record_created,priority:2"` // Supports UUID, string, and composite primary keys.
	Changes   string    `json:"changes" gorm:"type:text"`
	IPAddress string    `json:"ip_address"`
	UserAgent string    `json:"user_agent"`

	TenantID *uuid.UUID `json:"tenant_id" gorm:"type:char(36);index;index:idx_audit_logs_tenant_created,priority:1"`
	Tenant   Tenant     `gorm:"foreignKey:TenantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

// BeforeCreate Hook to generate UUID automatically
func (a *AuditLog) BeforeCreate(tx *gorm.DB) (err error) {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}

	if tenant, ok := tx.Statement.Context.Value(common.CtxTenantKey).(Tenant); ok {
		a.TenantID = &tenant.ID
	} else {
		// Dalam riset Cybersecurity, ini penting:
		// Jangan biarkan record dibuat tanpa TenantID jika dalam mode multi-tenant
		return fmt.Errorf("tenant_id is required for security isolation")
	}
	return nil
}
