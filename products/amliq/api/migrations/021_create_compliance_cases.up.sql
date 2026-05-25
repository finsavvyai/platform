CREATE TABLE compliance_cases (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    entity_id TEXT NOT NULL,
    entity_name TEXT NOT NULL,
    screening_id TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    priority TEXT NOT NULL DEFAULT 'medium',
    assigned_to TEXT,
    resolution TEXT,
    resolved_by TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_cases_tenant ON compliance_cases(tenant_id);
CREATE INDEX idx_cases_status ON compliance_cases(tenant_id, status);
