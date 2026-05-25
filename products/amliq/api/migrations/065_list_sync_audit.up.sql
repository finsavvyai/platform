-- 065: list_sync_audit — per-sync-attempt observability.
-- Every SyncList call (daily worker cron + reingest-global + manual
-- /admin/lists/refresh) writes one row here, regardless of outcome.
--
-- Admin /admin/list-health reads this table; failures are also
-- fanned out as audit_events + email + Slack/WhatsApp.

CREATE TABLE IF NOT EXISTS list_sync_audit (
    id                 BIGSERIAL PRIMARY KEY,
    tenant_id          TEXT        NOT NULL,
    list_id            TEXT        NOT NULL,
    status             TEXT        NOT NULL,     -- ok|failed|skipped|not_modified
    started_at         TIMESTAMPTZ NOT NULL,
    finished_at        TIMESTAMPTZ,
    duration_ms        INTEGER,
    entities_before    INTEGER,
    entities_after     INTEGER,
    delta              INTEGER,
    fetch_strategy     TEXT,                     -- session|browser-ua|chromedp|rod|etag-304|direct
    source_bytes       BIGINT,
    error              TEXT,
    triggered_by       TEXT        NOT NULL,     -- worker-cron|render-cron|manual|reingest-global
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lsa_list_started
    ON list_sync_audit (list_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_lsa_tenant_started
    ON list_sync_audit (tenant_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_lsa_failed
    ON list_sync_audit (status, started_at DESC)
    WHERE status <> 'ok' AND status <> 'not_modified';
