-- Migration: 022_users_sso_columns (Phase 3.1 gap-fix)
-- Purpose: Add org_id, role, provisioned_via columns to users table required
--          by the JIT provisioner (services/jit-provisioner.ts).
-- Compatible with: SQLite (Cloudflare D1) and PostgreSQL.

ALTER TABLE users ADD COLUMN org_id          TEXT;
ALTER TABLE users ADD COLUMN role            TEXT DEFAULT 'member';
ALTER TABLE users ADD COLUMN provisioned_via TEXT;

CREATE INDEX IF NOT EXISTS idx_users_org_id_email ON users(org_id, email);
