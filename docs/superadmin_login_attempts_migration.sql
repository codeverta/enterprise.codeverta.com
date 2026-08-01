-- Adds durable authentication-attempt history.
CREATE TABLE login_attempts (
    id CHAR(36) NOT NULL PRIMARY KEY,
    user_id CHAR(36) NULL,
    tenant_id CHAR(36) NULL,
    attempted_identifier VARCHAR(255) NOT NULL DEFAULT '',
    auth_method VARCHAR(40) NOT NULL,
    success BOOLEAN NOT NULL DEFAULT FALSE,
    http_status INT NOT NULL DEFAULT 0,
    failure_reason VARCHAR(255) NOT NULL DEFAULT '',
    ip_address VARCHAR(64) NOT NULL DEFAULT '',
    user_agent TEXT NOT NULL,
    created_at DATETIME(3) NOT NULL,
    INDEX idx_login_attempts_user_id (user_id),
    INDEX idx_login_attempts_tenant_id (tenant_id),
    INDEX idx_login_attempts_identifier (attempted_identifier),
    INDEX idx_login_attempts_method (auth_method),
    INDEX idx_login_attempts_success (success),
    INDEX idx_login_attempts_ip (ip_address),
    INDEX idx_login_attempts_created_at (created_at)
);

-- Promote the first trusted account explicitly after replacing the email.
-- UPDATE users SET role = 100 WHERE email = 'owner@example.com';
