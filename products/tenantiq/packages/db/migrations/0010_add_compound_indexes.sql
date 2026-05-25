-- Migration: 0010_add_compound_indexes.sql
-- Adds compound indexes on 7 high-read tables for multi-tenant query performance.
-- Each index covers (tenant_id/org_id, created_at/detected_at) — the two most
-- common filter columns in paginated dashboard queries.

-- 1. security_alerts: filter by tenant, order by detection time
CREATE INDEX IF NOT EXISTS idx_alerts_tenant_detected ON security_alerts (tenant_id, detected_at);

-- 2. audit_logs: filter by org, order by creation time
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created ON audit_logs (org_id, created_at);

-- 3. config_drifts: filter by tenant, order by detection time
CREATE INDEX IF NOT EXISTS idx_config_drifts_tenant_detected ON config_drifts (tenant_id, detected_at);

-- 4. config_snapshots: filter by tenant, order by creation time
CREATE INDEX IF NOT EXISTS idx_config_snapshots_tenant_created ON config_snapshots (tenant_id, created_at);

-- 5. copilot_assessments: filter by tenant, order by creation time
CREATE INDEX IF NOT EXISTS idx_copilot_tenant_created ON copilot_assessments (tenant_id, created_at);

-- 6. storage_analytics: filter by tenant, order by creation time
CREATE INDEX IF NOT EXISTS idx_storage_tenant_created ON storage_analytics (tenant_id, created_at);

-- 7. sync_jobs: filter by tenant, order by creation time
CREATE INDEX IF NOT EXISTS idx_sync_jobs_tenant_created ON sync_jobs (tenant_id, created_at);
