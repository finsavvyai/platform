-- 0008_scope_level.sql
-- Track whether a platform user signed in with full admin-consented scopes
-- or only personal delegated scopes (individual users who did not require
-- Global Admin consent). Default 'admin' so pre-existing rows keep today's
-- behavior.

ALTER TABLE platform_users ADD COLUMN scope_level TEXT NOT NULL DEFAULT 'admin';

CREATE INDEX IF NOT EXISTS idx_platform_users_scope_level ON platform_users(scope_level);
