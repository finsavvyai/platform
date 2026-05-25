-- Migration: add cert_expires_at to sso_connections (SSO-05 gap closure)
-- D1 SQLite: ALTER TABLE ADD COLUMN is safe on existing rows (new column defaults to NULL).
ALTER TABLE sso_connections ADD COLUMN cert_expires_at TEXT;
