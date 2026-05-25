-- Per-tenant DLP policy. BEAT-PLAN S1.3 / INTEGRATION-DEBT Day 34.
--
-- One row per tenant. action ∈ {allow, mask, redact, block}.
-- Missing row = allow (the middleware fails open).

CREATE TABLE IF NOT EXISTS tenant_dlp_policy (
    tenant_id  UUID PRIMARY KEY,
    action     TEXT NOT NULL CHECK (action IN ('allow','mask','redact','block')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_dlp_policy_action
    ON tenant_dlp_policy (action);
