-- Per-call AI request log. Independent of audit_entries: audit
-- captures one row per business action (was AI invoked); request_log
-- captures one row per provider call (which provider, how long, how
-- many tokens, did it succeed). This is the table compliance officers
-- query for "show me everything we sent to a model last quarter" and
-- the table the cost dashboard sums for $$ math.
--
-- Token counts are honest: if the upstream provider returned them we
-- store the real number, otherwise we store our 4-chars-per-token
-- estimate (NULL means estimator didn't even run).

CREATE TABLE IF NOT EXISTS ai_request_log (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(20) NOT NULL,
    actor_id        TEXT NOT NULL,
    provider        TEXT NOT NULL,
    model           TEXT NOT NULL,
    summary_type    TEXT,
    prompt_tokens   INTEGER,
    completion_tokens INTEGER,
    latency_ms      INTEGER NOT NULL,
    status          TEXT NOT NULL,
    error_code      TEXT,
    cost_usd_micros BIGINT,
    cached          BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_request_log_tenant_time
    ON ai_request_log (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_request_log_actor_time
    ON ai_request_log (tenant_id, actor_id, created_at DESC);

COMMENT ON COLUMN ai_request_log.cost_usd_micros IS
    'Estimated cost in USD micros (1e-6 USD). NULL = not calculated. Computed from token counts × per-model rates.';
COMMENT ON COLUMN ai_request_log.cached IS
    'TRUE when served from semantic cache (no provider call). cost_usd_micros is 0 in this case.';
