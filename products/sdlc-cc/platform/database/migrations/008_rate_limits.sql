-- migration: 008_rate_limits.sql
-- Per-tenant, per-route rate limit configuration.
-- Rows are read by RedisLimiter on every request; a missing row means
-- "no limit configured" (allow by default).

CREATE TABLE IF NOT EXISTS rate_limits (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID        NOT NULL,
    route_pattern       TEXT        NOT NULL,
    requests_per_minute INTEGER     NOT NULL DEFAULT 60 CHECK (requests_per_minute > 0),
    burst               INTEGER     NOT NULL DEFAULT 10  CHECK (burst > 0),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT rate_limits_tenant_route_uniq UNIQUE (tenant_id, route_pattern)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_tenant_id
    ON rate_limits (tenant_id);

-- Automatically keep updated_at current.
CREATE OR REPLACE FUNCTION rate_limits_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rate_limits_updated_at ON rate_limits;
CREATE TRIGGER rate_limits_updated_at
    BEFORE UPDATE ON rate_limits
    FOR EACH ROW EXECUTE FUNCTION rate_limits_set_updated_at();
