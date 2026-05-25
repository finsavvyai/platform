-- Sprint 10: Enterprise Hardening & Scale
-- Adds: uptime_records, sla_configs, data_residency_configs, enterprise_leads

CREATE TABLE uptime_records (
  id TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL REFERENCES instances(id),
  checked_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('up', 'down', 'degraded')),
  response_time_ms INTEGER,
  check_type TEXT NOT NULL CHECK (check_type IN ('health', 'ping', 'agent')),
  FOREIGN KEY (instance_id) REFERENCES instances(id)
);

CREATE INDEX idx_uptime_instance_checked ON uptime_records(instance_id, checked_at);

CREATE TABLE sla_configs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL UNIQUE REFERENCES organizations(id),
  target_uptime REAL NOT NULL DEFAULT 99.9,
  check_interval_minutes INTEGER NOT NULL DEFAULT 5,
  alert_on_breach INTEGER DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE data_residency_configs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL UNIQUE REFERENCES organizations(id),
  region TEXT NOT NULL CHECK (region IN ('eu', 'us', 'ap')),
  storage_region TEXT NOT NULL,
  compute_region TEXT NOT NULL,
  enforce_strict INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE enterprise_leads (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_enterprise_leads_created ON enterprise_leads(created_at);
