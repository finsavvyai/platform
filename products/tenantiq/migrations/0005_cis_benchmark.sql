-- CIS Benchmark Scanner tables
CREATE TABLE IF NOT EXISTS cis_scans (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  overall_score INTEGER NOT NULL DEFAULT 0,
  pass_count INTEGER NOT NULL DEFAULT 0,
  fail_count INTEGER NOT NULL DEFAULT 0,
  partial_count INTEGER NOT NULL DEFAULT 0,
  total_controls INTEGER NOT NULL DEFAULT 0,
  scan_duration_ms INTEGER NOT NULL DEFAULT 0,
  scanned_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cis_scans_tenant ON cis_scans(tenant_id, scanned_at DESC);
