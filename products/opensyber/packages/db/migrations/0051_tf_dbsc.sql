-- Sprint 37 — DBSC protocol tables.
-- See packages/db/src/schema/tf-dbsc.ts for documentation.

CREATE TABLE IF NOT EXISTS tf_dbsc_sessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  public_key TEXT NOT NULL,
  alg TEXT NOT NULL DEFAULT 'ES256',
  origin TEXT NOT NULL,
  bound_cookie_hash TEXT NOT NULL,
  bound_cookie_issued_at TEXT NOT NULL,
  bound_cookie_expires_at TEXT NOT NULL,
  attestation TEXT,
  revoked INTEGER NOT NULL DEFAULT 0,
  revoked_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tf_dbsc_sessions_tenant ON tf_dbsc_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tf_dbsc_sessions_device ON tf_dbsc_sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_tf_dbsc_sessions_cookie ON tf_dbsc_sessions(bound_cookie_hash);

CREATE TABLE IF NOT EXISTS tf_dbsc_challenges (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  challenge_hash TEXT NOT NULL,
  purpose TEXT NOT NULL,
  session_id TEXT,
  action_hash TEXT,
  issued_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  consumed INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_tf_dbsc_challenges_hash ON tf_dbsc_challenges(challenge_hash);
CREATE INDEX IF NOT EXISTS idx_tf_dbsc_challenges_expiry ON tf_dbsc_challenges(expires_at);
