-- ai_request_log: one row per /v1/messages call. Backs both the
-- tenant-scoped console view and the admin /v1/audit/usage
-- aggregator. Schema mirrors sdlc-core/audit.AIRequestLog so the
-- pgx repo can scan rows directly into the struct.
--
-- Retention: handled out of band — typical compliance window is
-- 7 years. Add a partitioning strategy when row count justifies it
-- (estimate: 1M rows / customer / month at moderate volume).

CREATE TABLE IF NOT EXISTS ai_request_log (
  id                 BIGSERIAL PRIMARY KEY,
  tenant_id          TEXT        NOT NULL DEFAULT '',
  actor_id           TEXT        NOT NULL DEFAULT '',
  provider           TEXT        NOT NULL,
  model              TEXT        NOT NULL,
  summary_type       TEXT        NOT NULL DEFAULT '',
  prompt_tokens      INTEGER,
  completion_tokens  INTEGER,
  latency_ms         INTEGER      NOT NULL DEFAULT 0,
  status             TEXT        NOT NULL,         -- ok | error
  error_code         TEXT        NOT NULL DEFAULT '',
  cost_usd_micros    BIGINT,                       -- NULL when not estimated
  cached             BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_arl_tenant_time ON ai_request_log (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_arl_time        ON ai_request_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_arl_provider    ON ai_request_log (provider, created_at DESC);
