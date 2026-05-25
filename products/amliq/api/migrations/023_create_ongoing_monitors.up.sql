CREATE TABLE ongoing_monitors (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    entity_name TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    frequency TEXT NOT NULL DEFAULT 'daily',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    last_screened_at TIMESTAMPTZ,
    next_screen_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ongoing_monitors_tenant ON ongoing_monitors(tenant_id);
CREATE INDEX idx_monitors_due ON ongoing_monitors(next_screen_at)
    WHERE active = TRUE;
