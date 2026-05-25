CREATE TABLE invoices (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    product TEXT NOT NULL,
    subscription_id TEXT REFERENCES subscriptions(id),
    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    status TEXT NOT NULL DEFAULT 'draft',
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    lemonsqueezy_invoice_id TEXT UNIQUE,
    invoice_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoices_tenant_product ON invoices(tenant_id, product);
CREATE INDEX idx_invoices_subscription ON invoices(subscription_id);
