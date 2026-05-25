CREATE TABLE subscriptions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    product TEXT NOT NULL,
    plan_id TEXT NOT NULL,
    lemonsqueezy_id TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'active',
    seat_count INTEGER DEFAULT 0,
    promo_code TEXT,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_tenant_product ON subscriptions(tenant_id, product);
CREATE INDEX idx_subscriptions_ls_id ON subscriptions(lemonsqueezy_id);
