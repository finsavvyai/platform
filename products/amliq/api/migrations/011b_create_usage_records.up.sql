CREATE TABLE usage_records (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    product TEXT NOT NULL,
    period TEXT NOT NULL,
    metrics JSONB NOT NULL DEFAULT '{}',
    last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, product, period)
);

CREATE INDEX idx_usage_tenant_product_period ON usage_records(tenant_id, product, period);
