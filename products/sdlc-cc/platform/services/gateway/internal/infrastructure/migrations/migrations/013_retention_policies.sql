-- Per-tenant retention policies + hold windows. Day 33 of the
-- production-ready roadmap.

CREATE TABLE IF NOT EXISTS retention_policies (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    data_type   TEXT NOT NULL CHECK (data_type IN
        ('chat_history', 'documents', 'embeddings', 'audit_logs', 'spend_events')),
    days        INTEGER NOT NULL CHECK (days > 0),
    hold_until  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, data_type)
);

CREATE INDEX IF NOT EXISTS idx_retention_tenant
    ON retention_policies (tenant_id);

ALTER TABLE retention_policies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS retention_policies_isolation ON retention_policies;
CREATE POLICY retention_policies_isolation ON retention_policies
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
