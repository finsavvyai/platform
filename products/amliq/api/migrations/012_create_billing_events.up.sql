CREATE TABLE billing_events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    product TEXT,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_billing_events_tenant ON billing_events(tenant_id);
CREATE INDEX idx_billing_events_tenant_product ON billing_events(tenant_id, product);
CREATE INDEX idx_billing_events_type ON billing_events(event_type);
CREATE INDEX idx_billing_events_created ON billing_events(created_at DESC);
