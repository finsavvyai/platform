-- D1 SQLite Migration for Qestro Platform Module Tables
-- API Testing Studio, Security Center, Compliance Hub, Cloud Device Hub
-- Migration: 002_platform_modules.sql
-- Generated: 2026-01-05

-- ==========================================
-- API TESTING STUDIO TABLES
-- ==========================================

-- API Testing Collections - Postman-like request collections
CREATE TABLE IF NOT EXISTS api_testing_collections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  variables TEXT DEFAULT '{}',
  pre_request_script TEXT,
  test_script TEXT,
  tags TEXT DEFAULT '[]',
  is_public INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- API Testing Requests - Individual HTTP requests within collections
CREATE TABLE IF NOT EXISTS api_testing_requests (
  id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  method TEXT NOT NULL DEFAULT 'GET',
  url TEXT NOT NULL,
  headers TEXT DEFAULT '{}',
  query_params TEXT DEFAULT '{}',
  body TEXT,
  body_type TEXT DEFAULT 'json',
  auth TEXT,
  pre_request_script TEXT,
  test_script TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (collection_id) REFERENCES api_testing_collections(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- API Testing Environments - Environment variable sets
CREATE TABLE IF NOT EXISTS api_testing_environments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  variables TEXT NOT NULL DEFAULT '{}',
  is_active INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- API Testing History - Request execution history
CREATE TABLE IF NOT EXISTS api_testing_history (
  id TEXT PRIMARY KEY,
  request_id TEXT,
  user_id TEXT NOT NULL,
  method TEXT NOT NULL,
  url TEXT NOT NULL,
  request_headers TEXT DEFAULT '{}',
  request_body TEXT,
  response_status INTEGER,
  response_headers TEXT DEFAULT '{}',
  response_body TEXT,
  response_time INTEGER,
  response_size INTEGER,
  test_results TEXT DEFAULT '[]',
  executed_at INTEGER NOT NULL,
  FOREIGN KEY (request_id) REFERENCES api_testing_requests(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==========================================
-- SECURITY CENTER TABLES
-- ==========================================

-- Security Scans - OWASP and vulnerability scans
CREATE TABLE IF NOT EXISTS security_scans (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT,
  target TEXT NOT NULL,
  scan_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  start_time INTEGER,
  end_time INTEGER,
  duration INTEGER,
  summary TEXT DEFAULT '{}',
  config TEXT DEFAULT '{}',
  error_message TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Security Findings - Individual vulnerability findings
CREATE TABLE IF NOT EXISTS security_findings (
  id TEXT PRIMARY KEY,
  scan_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL,
  category TEXT,
  cvss_score REAL,
  location TEXT,
  evidence TEXT,
  recommendation TEXT,
  cve_id TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  fixed_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (scan_id) REFERENCES security_scans(id) ON DELETE CASCADE
);

-- Compliance Frameworks - SOC2, GDPR, HIPAA, PCI tracking
CREATE TABLE IF NOT EXISTS compliance_frameworks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  framework_type TEXT NOT NULL,
  name TEXT NOT NULL,
  overall_score INTEGER DEFAULT 0,
  last_assessment INTEGER,
  controls TEXT DEFAULT '[]',
  evidence TEXT DEFAULT '[]',
  next_assessment INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==========================================
-- CLOUD DEVICE HUB TABLES
-- ==========================================

-- Cloud Device Providers - BrowserStack, SauceLabs, LambdaTest configs
CREATE TABLE IF NOT EXISTS cloud_device_providers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider_type TEXT NOT NULL,
  name TEXT NOT NULL,
  config TEXT DEFAULT '{}',
  is_connected INTEGER DEFAULT 0,
  device_count INTEGER DEFAULT 0,
  last_sync_at INTEGER,
  metadata TEXT DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Cloud Devices - Individual cloud testing devices
CREATE TABLE IF NOT EXISTS cloud_devices (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  external_id TEXT,
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  model TEXT NOT NULL,
  os_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available',
  location TEXT DEFAULT '{}',
  capabilities TEXT DEFAULT '{}',
  tags TEXT DEFAULT '[]',
  last_seen_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (provider_id) REFERENCES cloud_device_providers(id) ON DELETE CASCADE
);

-- Cloud Device Reservations - Device booking system
CREATE TABLE IF NOT EXISTS cloud_device_reservations (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  project_id TEXT,
  start_time INTEGER NOT NULL,
  end_time INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  purpose TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (device_id) REFERENCES cloud_devices(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

-- ==========================================
-- INDEXES FOR NEW TABLES
-- ==========================================

-- API Testing indexes
CREATE INDEX IF NOT EXISTS idx_api_testing_collections_user_id ON api_testing_collections(user_id);
CREATE INDEX IF NOT EXISTS idx_api_testing_collections_project_id ON api_testing_collections(project_id);
CREATE INDEX IF NOT EXISTS idx_api_testing_requests_collection_id ON api_testing_requests(collection_id);
CREATE INDEX IF NOT EXISTS idx_api_testing_requests_user_id ON api_testing_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_api_testing_environments_user_id ON api_testing_environments(user_id);
CREATE INDEX IF NOT EXISTS idx_api_testing_history_request_id ON api_testing_history(request_id);
CREATE INDEX IF NOT EXISTS idx_api_testing_history_user_id ON api_testing_history(user_id);
CREATE INDEX IF NOT EXISTS idx_api_testing_history_executed_at ON api_testing_history(executed_at);

-- Security indexes
CREATE INDEX IF NOT EXISTS idx_security_scans_user_id ON security_scans(user_id);
CREATE INDEX IF NOT EXISTS idx_security_scans_project_id ON security_scans(project_id);
CREATE INDEX IF NOT EXISTS idx_security_scans_status ON security_scans(status);
CREATE INDEX IF NOT EXISTS idx_security_findings_scan_id ON security_findings(scan_id);
CREATE INDEX IF NOT EXISTS idx_security_findings_severity ON security_findings(severity);
CREATE INDEX IF NOT EXISTS idx_security_findings_status ON security_findings(status);
CREATE INDEX IF NOT EXISTS idx_compliance_frameworks_user_id ON compliance_frameworks(user_id);
CREATE INDEX IF NOT EXISTS idx_compliance_frameworks_type ON compliance_frameworks(framework_type);

-- Cloud Device indexes
CREATE INDEX IF NOT EXISTS idx_cloud_device_providers_user_id ON cloud_device_providers(user_id);
CREATE INDEX IF NOT EXISTS idx_cloud_device_providers_type ON cloud_device_providers(provider_type);
CREATE INDEX IF NOT EXISTS idx_cloud_devices_provider_id ON cloud_devices(provider_id);
CREATE INDEX IF NOT EXISTS idx_cloud_devices_platform ON cloud_devices(platform);
CREATE INDEX IF NOT EXISTS idx_cloud_devices_status ON cloud_devices(status);
CREATE INDEX IF NOT EXISTS idx_cloud_device_reservations_device_id ON cloud_device_reservations(device_id);
CREATE INDEX IF NOT EXISTS idx_cloud_device_reservations_user_id ON cloud_device_reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_cloud_device_reservations_status ON cloud_device_reservations(status);

-- Migration complete: 10 new tables with 24 indexes
