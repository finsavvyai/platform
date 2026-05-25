-- Sprint 26: OASF Compliance Tables
CREATE TABLE IF NOT EXISTS oasf_assessments (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  overall_score INTEGER NOT NULL,
  grade TEXT NOT NULL,
  passing_count INTEGER NOT NULL,
  failing_count INTEGER NOT NULL,
  partial_count INTEGER NOT NULL,
  total_controls INTEGER NOT NULL,
  triggered_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_oasf_assessments_org ON oasf_assessments(org_id);
CREATE INDEX idx_oasf_assessments_created ON oasf_assessments(org_id, created_at);

CREATE TABLE IF NOT EXISTS oasf_assessment_results (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL REFERENCES oasf_assessments(id) ON DELETE CASCADE,
  control_id TEXT NOT NULL,
  status TEXT NOT NULL,
  evidence_summary TEXT NOT NULL,
  evidence_details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_oasf_results_assessment ON oasf_assessment_results(assessment_id);

CREATE TABLE IF NOT EXISTS oasf_evidence_items (
  id TEXT PRIMARY KEY,
  result_id TEXT NOT NULL REFERENCES oasf_assessment_results(id) ON DELETE CASCADE,
  control_id TEXT NOT NULL,
  source_table TEXT NOT NULL,
  record_count INTEGER NOT NULL,
  sample_data TEXT,
  collected_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_oasf_evidence_result ON oasf_evidence_items(result_id);
