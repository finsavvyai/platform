CREATE TABLE IF NOT EXISTS monitor_profiles (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    entity_name TEXT NOT NULL,
    entity_type TEXT NOT NULL DEFAULT 'individual',
    risk_level TEXT NOT NULL DEFAULT 'medium',
    lists_to_screen JSONB NOT NULL DEFAULT '["OFAC","EU","UN"]',
    frequency TEXT NOT NULL DEFAULT 'daily',
    status TEXT NOT NULL DEFAULT 'active',
    last_screened_at TIMESTAMPTZ,
    next_screen_at TIMESTAMPTZ NOT NULL,
    match_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_monitor_profiles_tenant
    ON monitor_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_monitor_profiles_due
    ON monitor_profiles(status, next_screen_at);

CREATE TABLE IF NOT EXISTS monitor_alerts (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES monitor_profiles(id),
    tenant_id TEXT NOT NULL,
    alert_type TEXT NOT NULL,
    match_score DOUBLE PRECISION NOT NULL DEFAULT 0,
    matched_entity TEXT NOT NULL DEFAULT '',
    previous_score DOUBLE PRECISION NOT NULL DEFAULT 0,
    severity TEXT NOT NULL DEFAULT 'medium',
    reviewed_by TEXT NOT NULL DEFAULT '',
    reviewed_at TIMESTAMPTZ,
    disposition TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_monitor_alerts_tenant
    ON monitor_alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_monitor_alerts_profile
    ON monitor_alerts(profile_id);
