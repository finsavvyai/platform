-- Score history for trend charts.
-- Persisted by /api/cis-benchmark/scan after each successful run.
-- /history endpoint already queries this; previously returned empty
-- because table didn't exist.

CREATE TABLE IF NOT EXISTS cis_scans (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL,
  org_id          TEXT,
  overall_score   INTEGER NOT NULL,
  pass_count      INTEGER NOT NULL DEFAULT 0,
  fail_count      INTEGER NOT NULL DEFAULT 0,
  partial_count   INTEGER NOT NULL DEFAULT 0,
  total_controls  INTEGER NOT NULL DEFAULT 0,
  section_scores  TEXT,
  scan_duration_ms INTEGER,
  scanned_at      TEXT NOT NULL,
  scanned_by      TEXT
);

CREATE INDEX IF NOT EXISTS idx_cis_scans_tenant ON cis_scans (tenant_id);
CREATE INDEX IF NOT EXISTS idx_cis_scans_tenant_at ON cis_scans (tenant_id, scanned_at);
