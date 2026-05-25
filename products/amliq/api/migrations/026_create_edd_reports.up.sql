CREATE TABLE edd_reports (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    entity_id TEXT NOT NULL,
    entity_name TEXT NOT NULL,
    case_id TEXT REFERENCES compliance_cases(id),
    status TEXT NOT NULL DEFAULT 'pending',
    checklist JSONB NOT NULL DEFAULT '{}',
    notes TEXT,
    completed_by TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_edd_tenant ON edd_reports(tenant_id);
CREATE INDEX idx_edd_entity ON edd_reports(entity_id);
