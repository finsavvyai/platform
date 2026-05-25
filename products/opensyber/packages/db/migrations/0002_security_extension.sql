-- OpenSyber D1 Database Schema Extension
-- Migration: 0002_security_extension
-- Date: 2026-02-24
-- Purpose: CISO-grade security platform tables

-- Add source tracking to security events
ALTER TABLE security_events ADD COLUMN source_ip TEXT;
ALTER TABLE security_events ADD COLUMN source_country TEXT;

-- Security Policies
CREATE TABLE IF NOT EXISTS security_policies (
  id TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  policy_type TEXT NOT NULL CHECK (policy_type IN (
    'network_allowlist', 'network_blocklist', 'file_path_rules',
    'shell_command_rules', 'ip_allowlist', 'rate_limit'
  )),
  name TEXT NOT NULL,
  rules TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_security_policies_instance_id ON security_policies(instance_id);
CREATE INDEX idx_security_policies_policy_type ON security_policies(policy_type);

-- Incidents
CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
    'open', 'investigating', 'contained', 'resolved', 'closed'
  )),
  root_cause TEXT,
  remediation TEXT,
  assignee TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);

CREATE INDEX idx_incidents_instance_id ON incidents(instance_id);
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_incidents_severity ON incidents(severity);

-- Incident Events (Timeline)
CREATE TABLE IF NOT EXISTS incident_events (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'status_change', 'comment', 'evidence', 'assignment'
  )),
  content TEXT NOT NULL,
  author_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_incident_events_incident_id ON incident_events(incident_id);

-- Incident ↔ Security Events Junction
CREATE TABLE IF NOT EXISTS incident_security_events (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  security_event_id TEXT NOT NULL REFERENCES security_events(id),
  linked_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_incident_security_events_incident_id ON incident_security_events(incident_id);
CREATE INDEX idx_incident_security_events_security_event_id ON incident_security_events(security_event_id);

-- Security Score History
CREATE TABLE IF NOT EXISTS security_score_history (
  id TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  overall INTEGER NOT NULL,
  credential_security INTEGER NOT NULL,
  skill_safety INTEGER NOT NULL,
  network_security INTEGER NOT NULL,
  update_status INTEGER NOT NULL,
  configuration_hardening INTEGER NOT NULL,
  vulnerability_management INTEGER NOT NULL,
  incident_readiness INTEGER NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_security_score_history_instance_id ON security_score_history(instance_id);
CREATE INDEX idx_security_score_history_recorded_at ON security_score_history(recorded_at);

-- Alert Rules
CREATE TABLE IF NOT EXISTS alert_rules (
  id TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  severity_filter TEXT,
  threshold INTEGER NOT NULL DEFAULT 1,
  window_minutes INTEGER NOT NULL DEFAULT 60,
  cooldown_minutes INTEGER NOT NULL DEFAULT 30,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_alert_rules_instance_id ON alert_rules(instance_id);

-- Alerts (Triggered)
CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  alert_rule_id TEXT NOT NULL REFERENCES alert_rules(id),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  title TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  triggered_count INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  acknowledged_at TEXT,
  resolved_at TEXT
);

CREATE INDEX idx_alerts_instance_id ON alerts(instance_id);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_alert_rule_id ON alerts(alert_rule_id);

-- Notification Channels
CREATE TABLE IF NOT EXISTS notification_channels (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL CHECK (channel_type IN ('email', 'webhook', 'slack')),
  name TEXT NOT NULL,
  config TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_notification_channels_user_id ON notification_channels(user_id);

-- Network Activity
CREATE TABLE IF NOT EXISTS network_activity (
  id TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  method TEXT NOT NULL,
  path TEXT,
  status_code INTEGER,
  action TEXT NOT NULL DEFAULT 'allowed' CHECK (action IN ('allowed', 'blocked')),
  bytes_transferred INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_network_activity_instance_id ON network_activity(instance_id);
CREATE INDEX idx_network_activity_domain ON network_activity(domain);
CREATE INDEX idx_network_activity_created_at ON network_activity(created_at);

-- File Baselines
CREATE TABLE IF NOT EXISTS file_baselines (
  id TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  permissions TEXT,
  size INTEGER,
  last_verified TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_file_baselines_instance_id ON file_baselines(instance_id);

-- File Integrity Events
CREATE TABLE IF NOT EXISTS file_integrity_events (
  id TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  change_type TEXT NOT NULL CHECK (change_type IN (
    'modified', 'created', 'deleted', 'permissions_changed'
  )),
  previous_hash TEXT,
  current_hash TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_file_integrity_events_instance_id ON file_integrity_events(instance_id);
CREATE INDEX idx_file_integrity_events_created_at ON file_integrity_events(created_at);

-- Vulnerability Scans
CREATE TABLE IF NOT EXISTS vulnerability_scans (
  id TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  scanner TEXT NOT NULL,
  critical_count INTEGER NOT NULL DEFAULT 0,
  high_count INTEGER NOT NULL DEFAULT 0,
  medium_count INTEGER NOT NULL DEFAULT 0,
  low_count INTEGER NOT NULL DEFAULT 0,
  scanned_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_vulnerability_scans_instance_id ON vulnerability_scans(instance_id);

-- Vulnerabilities
CREATE TABLE IF NOT EXISTS vulnerabilities (
  id TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  scan_id TEXT NOT NULL REFERENCES vulnerability_scans(id),
  cve_id TEXT,
  package_name TEXT NOT NULL,
  package_version TEXT,
  fixed_version TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  title TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
    'open', 'in_progress', 'fixed', 'ignored', 'false_positive'
  )),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_vulnerabilities_instance_id ON vulnerabilities(instance_id);
CREATE INDEX idx_vulnerabilities_scan_id ON vulnerabilities(scan_id);
CREATE INDEX idx_vulnerabilities_severity ON vulnerabilities(severity);
CREATE INDEX idx_vulnerabilities_status ON vulnerabilities(status);

-- Compliance Reports
CREATE TABLE IF NOT EXISTS compliance_reports (
  id TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  framework TEXT NOT NULL CHECK (framework IN ('soc2', 'iso27001', 'cis')),
  overall_score INTEGER NOT NULL,
  total_controls INTEGER NOT NULL,
  passing_controls INTEGER NOT NULL,
  failing_controls INTEGER NOT NULL,
  results TEXT NOT NULL,
  generated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_compliance_reports_instance_id ON compliance_reports(instance_id);
CREATE INDEX idx_compliance_reports_framework ON compliance_reports(framework);

-- Access Control Log
CREATE TABLE IF NOT EXISTS access_control_log (
  id TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  access_type TEXT NOT NULL CHECK (access_type IN ('api', 'ssh', 'console')),
  source_ip TEXT,
  source_country TEXT,
  action TEXT NOT NULL CHECK (action IN ('allowed', 'denied')),
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_access_control_log_instance_id ON access_control_log(instance_id);
CREATE INDEX idx_access_control_log_created_at ON access_control_log(created_at);
