-- Sprint 41 — TokenForge workforce subjects (OIDC-attested end-users).
-- See packages/db/src/schema/tf-subjects.ts for documentation.

CREATE TABLE IF NOT EXISTS tf_subjects (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  workforce_app_id TEXT NOT NULL,
  external_subject TEXT NOT NULL,
  email TEXT,
  name TEXT,
  metadata TEXT,
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tf_subjects_tenant ON tf_subjects(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tf_subjects_app_subject
  ON tf_subjects(workforce_app_id, external_subject);
CREATE INDEX IF NOT EXISTS idx_tf_subjects_email ON tf_subjects(email);
