-- OpenSyber Sprint C2 — Squid Secure Web Gateway state.
-- One row per tenant SWG instance. The Squid + e2guardian VM lifecycle
-- lives in agent-runtime; this table holds the orchestration metadata
-- (policy, upstream proxy, byte cap) and a paged audit log of decisions
-- the gateway emitted.

CREATE TABLE IF NOT EXISTS tf_swg_tenants (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,

  name TEXT NOT NULL,

  upstream_proxy TEXT,

  default_action TEXT NOT NULL DEFAULT 'allow'
    CHECK (default_action IN ('allow', 'block')),

  categories_blocked TEXT NOT NULL DEFAULT '[]',
  domains_allowlist TEXT NOT NULL DEFAULT '[]',
  domains_blocklist TEXT NOT NULL DEFAULT '[]',

  tls_intercept INTEGER NOT NULL DEFAULT 0,
  bytes_limit_daily INTEGER NOT NULL DEFAULT 0,

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tf_swg_tenants_tenant
  ON tf_swg_tenants(tenant_id);

CREATE TABLE IF NOT EXISTS tf_swg_decisions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT,

  requested_url TEXT NOT NULL,
  category TEXT,

  action TEXT NOT NULL
    CHECK (action IN ('allow', 'block', 'warn')),

  reason TEXT,
  bytes INTEGER NOT NULL DEFAULT 0,

  ts TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tf_swg_decisions_tenant_ts
  ON tf_swg_decisions(tenant_id, ts);

CREATE INDEX IF NOT EXISTS idx_tf_swg_decisions_action
  ON tf_swg_decisions(action);

CREATE INDEX IF NOT EXISTS idx_tf_swg_decisions_user
  ON tf_swg_decisions(user_id);
