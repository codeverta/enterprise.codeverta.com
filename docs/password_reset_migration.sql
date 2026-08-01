-- Password-reset links are stored as SHA-256 hashes and are single use.
CREATE TABLE password_reset_tokens (
    id CHAR(36) NOT NULL PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    tenant_id CHAR(36) NULL,
    token_hash CHAR(64) NOT NULL,
    expires_at DATETIME(3) NOT NULL,
    used_at DATETIME(3) NULL,
    requested_ip VARCHAR(64) NOT NULL DEFAULT '',
    created_at DATETIME(3) NOT NULL,
    UNIQUE KEY idx_password_reset_tokens_token_hash (token_hash),
    KEY idx_password_reset_tokens_user_id (user_id),
    KEY idx_password_reset_tokens_tenant_id (tenant_id),
    KEY idx_password_reset_tokens_expires_at (expires_at),
    KEY idx_password_reset_tokens_used_at (used_at)
);

-- Runtime configuration:
-- PASSWORD_RESET_URL=https://your-admin-domain.example/reset-password
-- PASSWORD_RESET_TEMPLATE_ID=<approved Tencent SES template id>
-- If PASSWORD_RESET_TEMPLATE_ID is 0, the existing email worker will use its SMTP fallback.
