-- Sprint 35 — TokenForge signing keys for /.well-known/tokenforge/jwks.
-- See packages/db/src/schema/tf-signing-keys.ts for documentation.

CREATE TABLE IF NOT EXISTS tf_signing_keys (
  id TEXT PRIMARY KEY,
  kid TEXT NOT NULL UNIQUE,
  alg TEXT NOT NULL,
  public_jwk TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  rotated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_tf_signing_keys_status ON tf_signing_keys(status);
