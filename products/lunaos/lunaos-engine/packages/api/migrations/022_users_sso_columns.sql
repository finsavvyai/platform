-- Migration: 022_users_sso_columns (Phase 3.1 gap-fix)
-- Purpose: Add org_id, role, provisioned_via columns to users table required
--          by the JIT provisioner (services/jit-provisioner.ts).
-- Compatible with: SQLite (Cloudflare D1) and PostgreSQL.
--
-- These columns are referenced unconditionally by the SSO INSERT in
-- jit-provisioner.ts. Without them every SSO login fails at INSERT-time.
-- All columns are nullable so existing password-auth users are unaffected.

ALTER TABLE users ADD COLUMN org_id          TEXT;
ALTER TABLE users ADD COLUMN role            TEXT DEFAULT 'member';
ALTER TABLE users ADD COLUMN provisioned_via TEXT;

-- The JIT lookup is `WHERE org_id = ? AND email = ? LIMIT 1`. Index this.
CREATE INDEX IF NOT EXISTS idx_users_org_id_email ON users(org_id, email);
