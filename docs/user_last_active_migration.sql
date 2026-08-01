-- Persist latest online heartbeat/activity timestamp for users.
-- This is not the same as last login; it is updated from websocket activity heartbeats.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS last_active_at DATETIME(3) NULL;

CREATE INDEX IF NOT EXISTS idx_users_last_active_at ON users (last_active_at);
