-- Admin Panel & Observability tables
-- sync_jobs, platform_metrics, audit_logs

CREATE TABLE IF NOT EXISTS sync_jobs (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'incremental',
    status TEXT NOT NULL DEFAULT 'pending',
    started_at INTEGER,
    completed_at INTEGER,
    error_message TEXT,
    items_processed INTEGER DEFAULT 0,
    items_failed INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_jobs_org ON sync_jobs(org_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_tenant ON sync_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON sync_jobs(status);

CREATE TABLE IF NOT EXISTS platform_metrics (
    id TEXT PRIMARY KEY,
    metric_type TEXT NOT NULL,
    value REAL NOT NULL,
    metadata TEXT,
    recorded_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_platform_metrics_type ON platform_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_platform_metrics_recorded ON platform_metrics(recorded_at);

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    org_id TEXT,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    details TEXT,
    ip_address TEXT,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON audit_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
