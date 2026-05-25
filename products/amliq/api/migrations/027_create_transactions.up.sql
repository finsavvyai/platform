CREATE TABLE transactions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    entity_id TEXT NOT NULL,
    counterparty_id TEXT,
    amount_cents BIGINT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    direction TEXT NOT NULL,
    country TEXT,
    reference TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_txn_tenant ON transactions(tenant_id);
CREATE INDEX idx_txn_entity ON transactions(entity_id);

CREATE TABLE txn_alerts (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    transaction_id TEXT REFERENCES transactions(id),
    alert_type TEXT NOT NULL,
    severity INT NOT NULL DEFAULT 5,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_txn_alerts_tenant ON txn_alerts(tenant_id);
