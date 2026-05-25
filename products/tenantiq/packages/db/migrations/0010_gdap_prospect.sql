-- GDAP Relationships
CREATE TABLE IF NOT EXISTS gdap_relationships (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  roles TEXT NOT NULL DEFAULT '[]',
  duration TEXT NOT NULL DEFAULT 'P90D',
  partner_tenant_id TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  terminated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_gdap_org ON gdap_relationships(org_id);
CREATE INDEX IF NOT EXISTS idx_gdap_status ON gdap_relationships(org_id, status);

-- GDAP Access Assignments
CREATE TABLE IF NOT EXISTS gdap_access_assignments (
  id TEXT PRIMARY KEY,
  relationship_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  security_group_id TEXT,
  roles TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gdap_access_rel ON gdap_access_assignments(relationship_id);

-- Partner Center Config
CREATE TABLE IF NOT EXISTS partner_config (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL UNIQUE,
  partner_id TEXT NOT NULL,
  partner_tenant_id TEXT NOT NULL,
  partner_name TEXT,
  status TEXT NOT NULL DEFAULT 'configured',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Prospect Scans (public, no org_id required)
CREATE TABLE IF NOT EXISTS prospect_scans (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  score INTEGER NOT NULL,
  grade TEXT NOT NULL,
  email_security TEXT NOT NULL DEFAULT '{}',
  identity_security TEXT NOT NULL DEFAULT '{}',
  m365_signals TEXT NOT NULL DEFAULT '{}',
  findings TEXT NOT NULL DEFAULT '[]',
  recommendations TEXT NOT NULL DEFAULT '[]',
  scan_duration INTEGER,
  ip_address TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_prospect_domain ON prospect_scans(domain);
