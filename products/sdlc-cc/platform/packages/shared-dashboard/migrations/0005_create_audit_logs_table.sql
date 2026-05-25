-- Create dashboard_audit_logs table for security and compliance
-- Migration: 0005_create_audit_logs_table
-- Created: 2025-01-04

CREATE TABLE IF NOT EXISTS dashboard_audit_logs (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT,
  organization_id TEXT,
  action TEXT NOT NULL, -- e.g., 'user.login', 'api_key.created', 'organization.updated'
  resource_type TEXT NOT NULL, -- e.g., 'user', 'api_key', 'organization'
  resource_id TEXT,
  details TEXT, -- JSON with additional context
  ip_address TEXT,
  user_agent TEXT,
  status TEXT NOT NULL CHECK(status IN ('success', 'failure', 'warning')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES dashboard_users(id) ON DELETE SET NULL,
  FOREIGN KEY (organization_id) REFERENCES dashboard_organizations(id) ON DELETE SET NULL
);

-- Indexes for performance and querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON dashboard_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id ON dashboard_audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON dashboard_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON dashboard_audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON dashboard_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON dashboard_audit_logs(status);
