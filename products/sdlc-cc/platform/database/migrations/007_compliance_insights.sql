-- Migration 007: Compliance Insights
-- Version: 1.0.0
-- Description: Append-only signal stream, detected insights, scoring weights,
--              action audit trail, and entity graph for the Compliance Insights SKU.
-- Dependencies: 006_create_triggers_and_constraints.sql
-- Rollback: DROP TABLEs in reverse order; policies drop automatically.

BEGIN;

-- ---------------------------------------------------------------------------
-- signals: append-only normalised events from llm-gateway, dlp, opa, rag, usage
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS signals (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    source        TEXT NOT NULL
                  CHECK (source IN ('llm_gateway','dlp','opa','rag','usage')),
    event_type    TEXT NOT NULL,
    subject_user  UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    model         TEXT NULL,
    payload       JSONB NOT NULL,
    payload_hash  BYTEA NOT NULL,
    embedding     vector(384) NULL,
    occurred_at   TIMESTAMPTZ NOT NULL,
    ingested_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signals_tenant_occurred
    ON signals (tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_source
    ON signals (tenant_id, source, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_embedding
    ON signals USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ---------------------------------------------------------------------------
-- insights: detected clusters with impact score
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS insights (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    pattern_id      TEXT NOT NULL,
    severity        SMALLINT NOT NULL CHECK (severity BETWEEN 1 AND 5),
    status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','acting','resolved','dismissed')),
    raw_score       NUMERIC(6,3) NOT NULL,
    impact_score    NUMERIC(6,3) NOT NULL,
    score_breakdown JSONB NOT NULL,
    evidence_ids    UUID[] NOT NULL,
    first_seen      TIMESTAMPTZ NOT NULL,
    last_seen       TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_insights_open_by_impact
    ON insights (tenant_id, impact_score DESC)
    WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_insights_pattern
    ON insights (tenant_id, pattern_id, last_seen DESC);

-- ---------------------------------------------------------------------------
-- insight_scoring_weights: per-tenant scoring overrides
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS insight_scoring_weights (
    tenant_id   UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    weights     JSONB NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- insight_actions: audit trail for every adapter invocation
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS insight_actions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    insight_id    UUID NOT NULL REFERENCES insights(id) ON DELETE CASCADE,
    tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    adapter       TEXT NOT NULL,
    dry_run       BOOLEAN NOT NULL,
    request       JSONB NOT NULL,
    response      JSONB NULL,
    actor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    signature     BYTEA NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_insight_actions_insight
    ON insight_actions (insight_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_insight_actions_tenant
    ON insight_actions (tenant_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- insight_entities + insight_edges: lightweight graph in pg
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS insight_entities (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    kind        TEXT NOT NULL
                CHECK (kind IN ('user','model','doc','policy','api_key','adapter_target')),
    external_id TEXT NOT NULL,
    attrs       JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, kind, external_id)
);

CREATE TABLE IF NOT EXISTS insight_edges (
    src      UUID NOT NULL REFERENCES insight_entities(id) ON DELETE CASCADE,
    dst      UUID NOT NULL REFERENCES insight_entities(id) ON DELETE CASCADE,
    rel      TEXT NOT NULL,
    weight   NUMERIC(5,3) NOT NULL DEFAULT 1,
    PRIMARY KEY (src, dst, rel)
);

-- ---------------------------------------------------------------------------
-- Row-level security (matches existing app.current_tenant_id convention)
-- ---------------------------------------------------------------------------
ALTER TABLE signals                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE insights                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE insight_scoring_weights  ENABLE ROW LEVEL SECURITY;
ALTER TABLE insight_actions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE insight_entities         ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_signals ON signals;
CREATE POLICY tenant_isolation_signals ON signals
    FOR ALL TO app_user
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID
           OR current_setting('app.current_tenant_id', true) = 'system');

DROP POLICY IF EXISTS tenant_isolation_insights ON insights;
CREATE POLICY tenant_isolation_insights ON insights
    FOR ALL TO app_user
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID
           OR current_setting('app.current_tenant_id', true) = 'system');

DROP POLICY IF EXISTS tenant_isolation_insight_scoring_weights ON insight_scoring_weights;
CREATE POLICY tenant_isolation_insight_scoring_weights ON insight_scoring_weights
    FOR ALL TO app_user
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID
           OR current_setting('app.current_tenant_id', true) = 'system');

DROP POLICY IF EXISTS tenant_isolation_insight_actions ON insight_actions;
CREATE POLICY tenant_isolation_insight_actions ON insight_actions
    FOR ALL TO app_user
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID
           OR current_setting('app.current_tenant_id', true) = 'system');

DROP POLICY IF EXISTS tenant_isolation_insight_entities ON insight_entities;
CREATE POLICY tenant_isolation_insight_entities ON insight_entities
    FOR ALL TO app_user
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID
           OR current_setting('app.current_tenant_id', true) = 'system');

-- Edges inherit isolation through the entities they reference.
ALTER TABLE insight_edges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_insight_edges ON insight_edges;
CREATE POLICY tenant_isolation_insight_edges ON insight_edges
    FOR ALL TO app_user
    USING (EXISTS (
        SELECT 1 FROM insight_entities e
        WHERE e.id = insight_edges.src
          AND (e.tenant_id = current_setting('app.current_tenant_id', true)::UUID
               OR current_setting('app.current_tenant_id', true) = 'system')
    ));

-- ---------------------------------------------------------------------------
-- updated_at trigger for insights
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at_insights()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_insights_updated_at ON insights;
CREATE TRIGGER trg_insights_updated_at
    BEFORE UPDATE ON insights
    FOR EACH ROW EXECUTE FUNCTION set_updated_at_insights();

-- ---------------------------------------------------------------------------
-- Registration
-- ---------------------------------------------------------------------------
INSERT INTO schema_migrations (version, name, applied_at)
VALUES ('007', 'compliance_insights', now())
ON CONFLICT (version) DO NOTHING;

COMMIT;
