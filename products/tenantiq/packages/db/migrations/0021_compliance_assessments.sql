-- Compliance score history per framework. Mirrors cis_scans (0020) for
-- ISO 27001 / SOC 2 / HIPAA / GDPR. Powers the /api/compliance-posture/trend
-- endpoint that ScoreTrendChart consumes on the /security/compliance page.

CREATE TABLE IF NOT EXISTS compliance_assessments (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL,
  org_id          TEXT,
  framework       TEXT NOT NULL,
  overall_score   INTEGER NOT NULL,
  pass_count      INTEGER NOT NULL DEFAULT 0,
  fail_count      INTEGER NOT NULL DEFAULT 0,
  partial_count   INTEGER NOT NULL DEFAULT 0,
  error_count     INTEGER NOT NULL DEFAULT 0,
  controls_json   TEXT,
  assessed_at     TEXT NOT NULL,
  assessed_by     TEXT
);

CREATE INDEX IF NOT EXISTS idx_compliance_tenant ON compliance_assessments (tenant_id);
CREATE INDEX IF NOT EXISTS idx_compliance_tenant_fw ON compliance_assessments (tenant_id, framework);
CREATE INDEX IF NOT EXISTS idx_compliance_tenant_at ON compliance_assessments (tenant_id, framework, assessed_at);
