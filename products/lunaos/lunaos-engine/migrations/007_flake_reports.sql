-- Flake detection: historical test stability tracking
-- Classification: stable | flaky | broken

CREATE TABLE IF NOT EXISTS flake_reports (
  id TEXT PRIMARY KEY,
  test_id TEXT NOT NULL,
  classification TEXT NOT NULL,
  iterations INTEGER NOT NULL,
  passed INTEGER NOT NULL,
  success_rate REAL NOT NULL,
  avg_duration_ms INTEGER,
  stddev_duration_ms INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_flake_reports_test ON flake_reports(test_id);
CREATE INDEX IF NOT EXISTS idx_flake_reports_classification ON flake_reports(classification);
CREATE INDEX IF NOT EXISTS idx_flake_reports_created ON flake_reports(created_at DESC);
