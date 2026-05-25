-- Migration 014: Analytics materialized views over spend_events.
-- Version: 1.0.0
-- Description: Daily per-tenant + per-user aggregate views to back the
--              admin analytics dashboard (Day 30 of the production-ready
--              roadmap, Phase 2 Track B).
-- Dependencies: 012_spend_events.sql (defines spend_events table).
--               In this repo migration 012 lives under
--               services/gateway/internal/infrastructure/migrations/migrations/
--               and is applied via the gateway migrator before this one.
-- Rollback: DROP MATERIALIZED VIEWs in reverse order.

BEGIN;

-- ---------------------------------------------------------------------------
-- mv_spend_daily_per_tenant
-- One row per (tenant_id, day) summarising query/token/spend totals.
-- Refreshed by the helper sproc below; CONCURRENTLY-capable (unique idx).
-- ---------------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_spend_daily_per_tenant AS
SELECT
    tenant_id,
    date_trunc('day', created_at)::date            AS day,
    COUNT(*)                                       AS queries,
    SUM(prompt_tokens + completion_tokens)::bigint AS tokens,
    SUM(usd_cents)::bigint                         AS usd_cents
FROM spend_events
GROUP BY tenant_id, date_trunc('day', created_at)::date
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_mv_spend_daily_tenant
    ON mv_spend_daily_per_tenant (tenant_id, day);

CREATE INDEX IF NOT EXISTS idx_mv_spend_daily_tenant_day
    ON mv_spend_daily_per_tenant (day);

-- ---------------------------------------------------------------------------
-- mv_spend_daily_per_user
-- One row per (tenant_id, user_id, day). Excludes events without user_id
-- (system / api-key-only calls) since per-user analytics are user-scoped.
-- ---------------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_spend_daily_per_user AS
SELECT
    tenant_id,
    user_id,
    date_trunc('day', created_at)::date            AS day,
    COUNT(*)                                       AS queries,
    SUM(prompt_tokens + completion_tokens)::bigint AS tokens,
    SUM(usd_cents)::bigint                         AS usd_cents
FROM spend_events
WHERE user_id IS NOT NULL
GROUP BY tenant_id, user_id, date_trunc('day', created_at)::date
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_mv_spend_daily_user
    ON mv_spend_daily_per_user (tenant_id, user_id, day);

CREATE INDEX IF NOT EXISTS idx_mv_spend_daily_user_day
    ON mv_spend_daily_per_user (day);

-- ---------------------------------------------------------------------------
-- refresh_spend_analytics_views()
-- Helper sproc that refreshes both views CONCURRENTLY so the dashboard
-- never sees a half-empty view during the refresh window. Caller should
-- run this every 5 minutes (cron / pg_cron / external scheduler).
--
-- Returns the number of seconds the refresh took, useful for monitoring.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION refresh_spend_analytics_views()
RETURNS NUMERIC
LANGUAGE plpgsql AS $$
DECLARE
    started TIMESTAMPTZ := clock_timestamp();
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_spend_daily_per_tenant;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_spend_daily_per_user;
    RETURN EXTRACT(EPOCH FROM (clock_timestamp() - started));
EXCEPTION
    WHEN feature_not_supported THEN
        -- CONCURRENTLY needs a unique index + populated view. On the
        -- very first call the view is empty (WITH NO DATA), so fall
        -- back to a non-concurrent refresh to seed it.
        REFRESH MATERIALIZED VIEW mv_spend_daily_per_tenant;
        REFRESH MATERIALIZED VIEW mv_spend_daily_per_user;
        RETURN EXTRACT(EPOCH FROM (clock_timestamp() - started));
END;
$$;

COMMENT ON FUNCTION refresh_spend_analytics_views() IS
  'Phase 2 Day 30: refresh the spend analytics MVs. Run every 5 minutes.';

-- Registration
INSERT INTO schema_migrations (version, name, applied_at)
VALUES ('014', 'analytics_views', now())
ON CONFLICT (version) DO NOTHING;

COMMIT;
