-- Create dashboard_organizations table for multi-tenancy
-- Migration: 0004_create_organizations_table
-- Created: 2025-01-04

CREATE TABLE IF NOT EXISTS dashboard_organizations (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  owner_id TEXT NOT NULL,
  billing_email TEXT,
  subscription_plan TEXT NOT NULL DEFAULT 'free' CHECK(subscription_plan IN ('free', 'pro', 'enterprise')),
  subscription_status TEXT NOT NULL DEFAULT 'active' CHECK(subscription_status IN ('active', 'cancelled', 'past_due', 'trialing')),
  subscription_id TEXT, -- LemonSqueezy subscription ID
  trial_ends_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (owner_id) REFERENCES dashboard_users(id) ON DELETE RESTRICT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON dashboard_organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_owner ON dashboard_organizations(owner_id);
CREATE INDEX IF NOT EXISTS idx_organizations_subscription ON dashboard_organizations(subscription_id);
CREATE INDEX IF NOT EXISTS idx_organizations_active ON dashboard_organizations(is_active);

-- Trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS trigger_organizations_updated_at
AFTER UPDATE ON dashboard_organizations
BEGIN
  UPDATE dashboard_organizations SET updated_at = datetime('now') WHERE id = NEW.id;
END;
