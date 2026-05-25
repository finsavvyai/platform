-- 0012_cis_tenant_overrides.sql
-- Phase 2 (leverage/ScubaGear): per-tenant config-as-code overrides for CIS controls.
-- Decisions modeled after ScubaGear annotations/exclusions:
--   accepted_risk: admin acknowledges fail; control reported as pass with provenance.
--   omit: control excluded from evaluation and from scoring totals.

CREATE TABLE IF NOT EXISTS cis_tenant_overrides (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  control_id TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('accepted_risk', 'omit')),
  justification TEXT NOT NULL,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT NOT NULL,
  UNIQUE (tenant_id, control_id)
);

CREATE INDEX IF NOT EXISTS idx_cis_overrides_tenant ON cis_tenant_overrides (tenant_id);
CREATE INDEX IF NOT EXISTS idx_cis_overrides_expiry ON cis_tenant_overrides (expires_at);
