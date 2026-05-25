-- Migration 018: billing tables for dual billing stack.
--
-- tenant_billing tracks the active subscription state per tenant.
-- billing_events is the append-only audit trail for all billing activity
-- from both LemonSqueezy (self-serve) and Stripe (enterprise invoices).
--
-- The two stacks share this schema so dashboards and the plan-enforcement
-- hook in chain.go read from a single tenant view.

CREATE TABLE IF NOT EXISTS tenant_billing (
    tenant_id              UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    ls_customer_id         TEXT,
    ls_subscription_id     TEXT,
    stripe_customer_id     TEXT,
    stripe_subscription_id TEXT,
    plan                   TEXT NOT NULL DEFAULT 'free',
    billing_source         TEXT NOT NULL DEFAULT 'lemonsqueezy'
                               CHECK (billing_source IN ('lemonsqueezy', 'stripe_invoice')),
    status                 TEXT NOT NULL DEFAULT 'active',
    payment_grace_until    TIMESTAMPTZ,
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS billing_events (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID        REFERENCES tenants(id) ON DELETE CASCADE,
    source      TEXT        NOT NULL CHECK (source IN ('lemonsqueezy', 'stripe_invoice')),
    event_name  TEXT        NOT NULL,
    event_id    TEXT        NOT NULL,
    raw_body    JSONB       NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS billing_events_tenant_idx
    ON billing_events(tenant_id, received_at DESC);

-- Idempotency lookup: (source, event_id) must be unique per event to
-- prevent double-processing from LS's at-least-once delivery.
CREATE UNIQUE INDEX IF NOT EXISTS billing_events_idempotency_idx
    ON billing_events(source, event_id);
