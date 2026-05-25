-- TokenForge ZTNA — per-app gating policy.
-- Each row maps a public hostname (CNAME'd to the ztna-proxy worker) to an
-- upstream origin. The proxy enforces device verification + a minimum trust
-- score before forwarding requests.

CREATE TABLE IF NOT EXISTS tf_ztna_apps (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id),
  org_id TEXT REFERENCES organizations(id),

  hostname TEXT NOT NULL,
  upstream TEXT NOT NULL,

  required_trust_score INTEGER NOT NULL DEFAULT 70,
  forward_write_methods INTEGER NOT NULL DEFAULT 1,

  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'deleted')),

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tf_ztna_apps_hostname
  ON tf_ztna_apps(hostname);

CREATE INDEX IF NOT EXISTS idx_tf_ztna_apps_owner_user_id
  ON tf_ztna_apps(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_tf_ztna_apps_org_id
  ON tf_ztna_apps(org_id);

CREATE INDEX IF NOT EXISTS idx_tf_ztna_apps_status
  ON tf_ztna_apps(status);
