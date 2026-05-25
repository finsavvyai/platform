-- Per-call spend events + per-model pricing.
-- Days 28-31 of the production-ready roadmap.

CREATE TABLE IF NOT EXISTS model_pricing (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider        TEXT NOT NULL,
    model           TEXT NOT NULL,
    prompt_per_1m   BIGINT NOT NULL,  -- USD cents per 1M prompt tokens
    completion_per_1m BIGINT NOT NULL,
    effective_from  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (provider, model, effective_from)
);

CREATE TABLE IF NOT EXISTS spend_events (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL,
    user_id           UUID,
    api_key_id        UUID,
    provider          TEXT NOT NULL,
    model             TEXT NOT NULL,
    prompt_tokens     INTEGER NOT NULL,
    completion_tokens INTEGER NOT NULL,
    usd_cents         BIGINT NOT NULL,
    request_id        TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spend_tenant_time
    ON spend_events (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_spend_user
    ON spend_events (user_id, created_at DESC);

ALTER TABLE spend_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS spend_events_isolation ON spend_events;
CREATE POLICY spend_events_isolation ON spend_events
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE TABLE IF NOT EXISTS spend_limits (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope         TEXT NOT NULL CHECK (scope IN ('user', 'tenant')),
    scope_id      UUID NOT NULL,
    monthly_usd_cents BIGINT NOT NULL,
    soft_cap_pct  INTEGER NOT NULL DEFAULT 80 CHECK (soft_cap_pct BETWEEN 0 AND 100),
    hard_cap_pct  INTEGER NOT NULL DEFAULT 100 CHECK (hard_cap_pct BETWEEN 0 AND 200),
    UNIQUE (scope, scope_id)
);
