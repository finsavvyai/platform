-- 018_webhook_dlq.sql
-- Webhook delivery dead-letter queue. After 5 failed attempts the
-- retrier (services/gateway/internal/infrastructure/webhooks/retrier.go)
-- pushes the failed delivery here so operators can inspect and replay.

BEGIN;

CREATE TABLE IF NOT EXISTS webhook_dlq (
    id              BIGSERIAL PRIMARY KEY,
    endpoint_id     TEXT NOT NULL,
    tenant_id       TEXT NOT NULL,
    url             TEXT NOT NULL,
    payload         BYTEA NOT NULL,
    headers         JSONB NOT NULL,
    attempts        INT NOT NULL,
    last_status     INT NOT NULL,
    last_error      TEXT NOT NULL DEFAULT '',
    failed_at       TIMESTAMPTZ NOT NULL,
    replayed        BOOLEAN NOT NULL DEFAULT false,
    replayed_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_dlq_tenant
    ON webhook_dlq (tenant_id, failed_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_dlq_unreplayed
    ON webhook_dlq (replayed, failed_at DESC) WHERE replayed = false;

COMMIT;
