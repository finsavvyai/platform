-- Enterprise gap closures (2026-04-22):
--   * MFA/TOTP enrollment tables  (closes ENTERPRISE_CAPABILITIES gap #1)
--   * Audit log hash-chain column (closes gap #2, tamper-evident logs)
--   * API token scopes column     (closes gap #9)
--   * Service account objects     (closes gap §2.1 service-accounts)
--   * SIEM export config table    (closes gap §2.2 SIEM feed)
--
-- All statements use IF NOT EXISTS to keep migrations idempotent on D1.

-- ---------- MFA / TOTP ----------
CREATE TABLE IF NOT EXISTS mfa_enrollments (
  user_id            TEXT PRIMARY KEY,
  secret             TEXT NOT NULL,
  created_at         INTEGER NOT NULL,
  confirmed_at       INTEGER,                 -- NULL = pending
  backup_codes_json  TEXT                     -- SHA-256 hex hashes
);

CREATE TABLE IF NOT EXISTS mfa_attempts (
  user_id       TEXT PRIMARY KEY,
  failed_count  INTEGER NOT NULL DEFAULT 0,
  expires_at    INTEGER NOT NULL              -- unix seconds
);

-- ---------- Audit hash chain ----------
-- audit_logs is defined in db.ts with id INTEGER AUTOINCREMENT and
-- created_at as an ISO datetime TEXT. We add prev_hash + row_hash
-- columns. `prev_hash` is the `row_hash` of the previous log entry
-- (NULL for the first row); `row_hash` = SHA-256(prev_hash ||
-- canonical_json(this_row_without_row_hash)). The chain is verified
-- by GET /api/audit/verify. Legacy rows inserted before this migration
-- will have NULL hashes and are treated as "pre-chain" by the verifier.
ALTER TABLE audit_logs ADD COLUMN prev_hash TEXT;
ALTER TABLE audit_logs ADD COLUMN row_hash  TEXT;
CREATE INDEX IF NOT EXISTS idx_audit_logs_row_hash ON audit_logs(row_hash);

-- ---------- Service accounts + scoped API tokens ----------
-- PushCI didn't previously have an api_tokens table — auth used JWTs
-- for humans and per-runner HMAC secrets for runners. Enterprise gap
-- #9 requires fine-grained, scope-bound tokens for CI systems and
-- agentic tooling. These tables introduce:
--
--   service_accounts   — non-human identity scoped to an org
--   api_tokens         — hashed bearer tokens, optionally linked to a
--                        service account, carrying a JSON scopes array
--                        (["runs:read","secrets:read", ...])
--
-- Token format issued to callers: `pctk_<32-char-random>`. We store the
-- SHA-256 hash in `token_hash` and never the plaintext (rotate ≠ reveal).

CREATE TABLE IF NOT EXISTS service_accounts (
  id            TEXT PRIMARY KEY,            -- ulid
  org_id        TEXT NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  created_at    INTEGER NOT NULL,
  created_by    TEXT NOT NULL,               -- user_sub of creator
  disabled_at   INTEGER,
  UNIQUE(org_id, name)
);
CREATE INDEX IF NOT EXISTS idx_service_accounts_org ON service_accounts(org_id);

CREATE TABLE IF NOT EXISTS api_tokens (
  id                  TEXT PRIMARY KEY,       -- ulid
  org_id              TEXT NOT NULL,
  name                TEXT NOT NULL,
  token_hash          TEXT NOT NULL UNIQUE,   -- SHA-256(plaintext)
  scopes_json         TEXT NOT NULL DEFAULT '[]',
  created_at          INTEGER NOT NULL,
  created_by          TEXT NOT NULL,          -- user_sub
  service_account_id  TEXT,                   -- FK -> service_accounts.id
  last_used_at        INTEGER,
  expires_at          INTEGER,
  revoked_at          INTEGER
);
CREATE INDEX IF NOT EXISTS idx_api_tokens_org  ON api_tokens(org_id);
CREATE INDEX IF NOT EXISTS idx_api_tokens_hash ON api_tokens(token_hash);

-- ---------- SIEM export configs ----------
CREATE TABLE IF NOT EXISTS siem_destinations (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL,
  kind            TEXT NOT NULL,             -- 'splunk' | 'datadog' | 'webhook' | 'syslog_https'
  endpoint_url    TEXT NOT NULL,
  auth_header     TEXT,                      -- bearer or HEC token (encrypted at app layer)
  created_at      INTEGER NOT NULL,
  last_success_at INTEGER,
  last_error      TEXT
);
CREATE INDEX IF NOT EXISTS idx_siem_destinations_org ON siem_destinations(org_id);
