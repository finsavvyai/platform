-- 022_webhook_endpoints.sql
-- BEAT-PLAN Day 38 — outbound webhook subscriptions.
--
-- Every tenant configures one or more endpoints subscribing to a
-- specific event_type. The dispatcher fans out matching events,
-- signs the payload with the per-endpoint secret (HMAC-SHA256), and
-- hands delivery to the existing Retrier (5 attempts -> webhook DLQ).

CREATE TABLE IF NOT EXISTS webhook_endpoints (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    event_type  TEXT NOT NULL,
    url         TEXT NOT NULL,
    secret      BYTEA NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, event_type, url)
);

CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_tenant_event
    ON webhook_endpoints (tenant_id, event_type)
    WHERE is_active = TRUE;

ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS webhook_endpoints_isolation ON webhook_endpoints;
CREATE POLICY webhook_endpoints_isolation ON webhook_endpoints
    FOR ALL TO app_user
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID
           OR current_setting('app.current_tenant_id', true) = 'system');

-- Re-runnable updated_at trigger.
DROP TRIGGER IF EXISTS webhook_endpoints_updated_at ON webhook_endpoints;
CREATE TRIGGER webhook_endpoints_updated_at
    BEFORE UPDATE ON webhook_endpoints
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON COLUMN webhook_endpoints.secret IS
    'HMAC signing key. Treat as encrypted-at-rest via pgcrypto in production.';
