-- Per-project encrypted provider API keys.
-- Plaintext is never stored; each row holds AES-256-GCM ciphertext + nonce.
CREATE TABLE IF NOT EXISTS provider_keys (
  project_id   TEXT NOT NULL,
  provider     TEXT NOT NULL,
  ciphertext_b64 TEXT NOT NULL,
  nonce_b64    TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (project_id, provider),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
