-- TokenForge canonical schema (CISCO-dua.md §5).
-- Phase 1 baseline. Subsequent migrations add per-feature columns
-- without renaming.

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  lemon_sub_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS apps (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  mode TEXT NOT NULL,
  name TEXT NOT NULL,
  origin TEXT NOT NULL,
  api_key_hash TEXT NOT NULL,
  short_cookie_ttl_sec INTEGER NOT NULL DEFAULT 300,
  long_cookie_ttl_sec INTEGER NOT NULL DEFAULT 2592000,
  idp_type TEXT NOT NULL DEFAULT 'none',
  idp_config TEXT,
  enforce_policy INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS apps_tenant_idx ON apps(tenant_id);
CREATE INDEX IF NOT EXISTS apps_origin_idx ON apps(origin);

CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL REFERENCES apps(id),
  external_subject TEXT NOT NULL,
  metadata TEXT,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS subjects_app_subject_idx ON subjects(app_id, external_subject);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL REFERENCES apps(id),
  subject_id TEXT NOT NULL REFERENCES subjects(id),
  public_key_jwk TEXT NOT NULL,
  binding_class TEXT NOT NULL,
  origin TEXT NOT NULL,
  user_agent TEXT,
  ip_first TEXT,
  geo_first TEXT,
  asn_first TEXT,
  bound_cookie_hash TEXT NOT NULL,
  bound_cookie_issued_at INTEGER NOT NULL,
  bound_cookie_expires_at INTEGER NOT NULL,
  long_cookie_hash TEXT,
  long_cookie_expires_at INTEGER,
  created_at INTEGER NOT NULL,
  last_refresh_at INTEGER,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  revoked_reason TEXT
);
CREATE INDEX IF NOT EXISTS sessions_app_idx ON sessions(app_id);
CREATE INDEX IF NOT EXISTS sessions_subject_idx ON sessions(subject_id);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL,
  session_id TEXT,
  type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  ip TEXT,
  geo TEXT,
  ua TEXT,
  payload TEXT,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS audit_app_at_idx ON audit_events(app_id, at);
CREATE INDEX IF NOT EXISTS audit_session_idx ON audit_events(session_id);

CREATE TABLE IF NOT EXISTS policies (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL REFERENCES apps(id),
  name TEXT NOT NULL,
  rules TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
