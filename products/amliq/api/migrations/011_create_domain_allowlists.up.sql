CREATE TABLE domain_allowlists (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    subscription_id TEXT NOT NULL REFERENCES subscriptions(id),
    domains JSONB NOT NULL DEFAULT '[]',
    max_domains INTEGER NOT NULL DEFAULT 5,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_domain_allowlists_tenant ON domain_allowlists(tenant_id);
CREATE INDEX idx_domain_allowlists_subscription ON domain_allowlists(subscription_id);
