-- TenantIQ Database Schema - Initial Migration
-- Generated: 2026-02-19

-- ============================================================================
-- Intelligence Engine Tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS intelligence_scans (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  scan_type TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL,
  findings_count INTEGER DEFAULT 0,
  alerts_created INTEGER DEFAULT 0,
  metadata TEXT
);

CREATE TABLE IF NOT EXISTS user_activity_snapshots (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  last_sign_in TEXT,
  last_exchange_activity TEXT,
  last_teams_activity TEXT,
  last_sharepoint_activity TEXT,
  assigned_licenses TEXT,
  license_cost_monthly INTEGER,
  snapshot_date TEXT NOT NULL,
  activity_score INTEGER
);

-- ============================================================================
-- Alert & Recommendation System Tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  resolved_at TEXT,
  resolved_by TEXT,
  resolution_notes TEXT,
  estimated_cost_impact INTEGER,
  estimated_risk_score INTEGER,
  affected_users INTEGER,
  resource_id TEXT,
  resource_type TEXT,
  metadata TEXT,
  recommendations TEXT,
  can_auto_remediate INTEGER DEFAULT 0,
  auto_remediation_action TEXT
);

CREATE INDEX IF NOT EXISTS idx_alerts_tenant_status ON alerts(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at);

CREATE TABLE IF NOT EXISTS alert_history (
  id TEXT PRIMARY KEY,
  alert_id TEXT NOT NULL,
  action TEXT NOT NULL,
  performed_by TEXT NOT NULL,
  performed_at TEXT NOT NULL,
  notes TEXT,
  metadata TEXT
);

-- ============================================================================
-- Remediation Engine Tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS remediations (
  id TEXT PRIMARY KEY,
  alert_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  initiated_by TEXT NOT NULL,
  initiated_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  target_resource_id TEXT NOT NULL,
  target_resource_type TEXT NOT NULL,
  action_parameters TEXT,
  success INTEGER DEFAULT 0,
  error_message TEXT,
  steps_completed TEXT,
  can_rollback INTEGER DEFAULT 1,
  rollback_data TEXT,
  rolled_back_at TEXT,
  rolled_back_by TEXT
);

CREATE TABLE IF NOT EXISTS remediation_steps (
  id TEXT PRIMARY KEY,
  remediation_id TEXT NOT NULL,
  step_number INTEGER NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  result TEXT
);

-- ============================================================================
-- Workflow Automation Tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  schedule TEXT,
  enabled INTEGER DEFAULT 1,
  parameters TEXT,
  conditions TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_executed_at TEXT,
  next_execution_at TEXT
);

CREATE TABLE IF NOT EXISTS workflow_executions (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  status TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  steps_total INTEGER,
  steps_completed INTEGER,
  steps_failed INTEGER,
  result TEXT,
  error_message TEXT
);

-- ============================================================================
-- Audit & Reporting Tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  resource_id TEXT,
  resource_type TEXT,
  action TEXT NOT NULL,
  result TEXT NOT NULL,
  details TEXT,
  ip_address TEXT,
  user_agent TEXT,
  timestamp TEXT NOT NULL,
  compliance_category TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant_timestamp ON audit_logs(tenant_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource_id);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  format TEXT NOT NULL,
  schedule TEXT,
  parameters TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  last_generated_at TEXT
);

CREATE TABLE IF NOT EXISTS report_executions (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  generated_by TEXT NOT NULL,
  status TEXT NOT NULL,
  file_url TEXT,
  row_count INTEGER,
  file_size INTEGER
);
