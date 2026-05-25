-- Partners & Partner Integrations
-- Migration 0008

CREATE TABLE IF NOT EXISTS partners (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  website TEXT,
  contact_email TEXT NOT NULL,
  api_key_hash TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_partners_org ON partners(org_id);

CREATE TABLE IF NOT EXISTS partner_integrations (
  id TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  install_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_partner_integrations_partner ON partner_integrations(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_integrations_category ON partner_integrations(category);

-- Partner API keys (separate table for multiple keys per partner)
CREATE TABLE IF NOT EXISTS partner_api_keys (
  id TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_partner_api_keys_partner ON partner_api_keys(partner_id);
