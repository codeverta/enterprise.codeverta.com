-- Full application audit trail support.
-- Run once for an existing database; new installations are handled by AutoMigrate.
ALTER TABLE audit_logs
    MODIFY COLUMN record_id VARCHAR(255) NOT NULL DEFAULT '';

CREATE INDEX idx_audit_logs_table_record_created
    ON audit_logs (table_name, record_id, created_at);

CREATE INDEX idx_audit_logs_tenant_created
    ON audit_logs (tenant_id, created_at);
