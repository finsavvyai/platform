-- Migration 0040: Latency indexes for hot-path queries
-- Round 3 latency audit (April 2026). Additive only — no column drops, no data changes.
-- Target: dashboard, score, marketplace, time-series queries.

-- ─── instances hot paths ────────────────────────────────────────────────────
-- Lookup "my running agents" by user — currently only userId is indexed.
-- Composite avoids a scan of all user rows when filtering by status.
CREATE INDEX IF NOT EXISTS idx_instances_user_status
  ON instances(user_id, status);

CREATE INDEX IF NOT EXISTS idx_instances_org_status
  ON instances(org_id, status);

-- ─── skills marketplace filtering ───────────────────────────────────────────
-- /api/marketplace filters by verificationStatus + tier/category and orders by
-- installCount. Composite (verification_status, tier) speeds the hot query.
CREATE INDEX IF NOT EXISTS idx_skills_tier
  ON skills(tier);

CREATE INDEX IF NOT EXISTS idx_skills_is_featured
  ON skills(is_featured)
  WHERE is_featured = 1;

CREATE INDEX IF NOT EXISTS idx_skills_verified_tier
  ON skills(verification_status, tier);

CREATE INDEX IF NOT EXISTS idx_skills_verified_category
  ON skills(verification_status, category);

CREATE INDEX IF NOT EXISTS idx_skills_install_count
  ON skills(install_count DESC);

-- ─── audit_log time-series ──────────────────────────────────────────────────
-- /instances/:id/audit orders by created_at DESC. Composite index supports
-- range scans without a separate sort.
CREATE INDEX IF NOT EXISTS idx_audit_log_instance_created
  ON audit_log(instance_id, created_at DESC);

-- ─── security_events time-series ────────────────────────────────────────────
-- Dashboard + /events endpoints scan recent events per instance.
CREATE INDEX IF NOT EXISTS idx_security_events_instance_created
  ON security_events(instance_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_events_instance_severity
  ON security_events(instance_id, severity);

-- ─── vulnerabilities per instance ───────────────────────────────────────────
-- Dashboard fetches open vulns then counts by severity. A composite on
-- (instance_id, status) makes the WHERE selective; severity counts can then
-- be computed via GROUP BY on the reduced set.
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_instance_status
  ON vulnerabilities(instance_id, status);

-- ─── alerts open-state filter ───────────────────────────────────────────────
-- Dashboard + alerts list filter by (instance_id, status='open').
CREATE INDEX IF NOT EXISTS idx_alerts_instance_status
  ON alerts(instance_id, status);

-- ─── incidents active filter ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_incidents_instance_status
  ON incidents(instance_id, status);

-- ─── security score history ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_security_score_history_instance_recorded
  ON security_score_history(instance_id, recorded_at DESC);
