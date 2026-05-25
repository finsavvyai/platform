-- Per-tenant, per-route rate limit configuration.
-- Backs the Redis sliding-window limiter introduced on Day 6 of the
-- production-ready roadmap. Limits are enforced in-process by the
-- gateway middleware reading this table on a cache (60s TTL) and
-- consulting Redis for the actual sliding-window count.
--
-- A tenant can have:
--   * one default rule with route_pattern = '*' (used when no specific
--     pattern matches) — exactly one row per (tenant_id, '*')
--   * any number of route-specific rules (e.g. '/v1/rag/query',
--     '/v1/documents/*')
--
-- Burst is the immediate-allowance ceiling (token-bucket-style cap on a
-- single 1-second slice). requests_per_minute is the sliding-window
-- limit over a rolling 60-second window.

CREATE TABLE IF NOT EXISTS rate_limits (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL,
    route_pattern       TEXT NOT NULL,
    requests_per_minute INTEGER NOT NULL CHECK (requests_per_minute > 0),
    burst               INTEGER NOT NULL CHECK (burst > 0),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT rate_limits_tenant_route_unique UNIQUE (tenant_id, route_pattern)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_tenant ON rate_limits (tenant_id);
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup
    ON rate_limits (tenant_id, route_pattern);

-- Row-Level Security: tenants only see their own rules.
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rate_limits_tenant_isolation ON rate_limits;
CREATE POLICY rate_limits_tenant_isolation ON rate_limits
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Audit who changed what.
CREATE OR REPLACE FUNCTION rate_limits_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS rate_limits_touch_updated_at ON rate_limits;
CREATE TRIGGER rate_limits_touch_updated_at
    BEFORE UPDATE ON rate_limits
    FOR EACH ROW
    EXECUTE FUNCTION rate_limits_touch_updated_at();

COMMENT ON TABLE rate_limits IS
    'Per-tenant per-route rate-limit configuration consumed by the Redis sliding-window limiter (Day 6 of production-ready roadmap).';
