-- Soft-delete column for orgs: enables 30-day grace period before hard-purge.
-- Set by LemonSqueezy unsubscribe handler / future scheduled-deletion endpoint.
-- A separate hard DELETE /api/account path remains for immediate erasure.
-- Idempotent: SQLite ALTER doesn't support IF NOT EXISTS for columns,
-- so the apply-script tolerates the duplicate-column error on rerun.
-- The index is safely re-runnable.
ALTER TABLE organizations ADD COLUMN deleted_at INTEGER;
CREATE INDEX IF NOT EXISTS idx_organizations_deleted_at ON organizations(deleted_at);
