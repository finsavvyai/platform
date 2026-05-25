-- Multi-Tenant SaaS Platform - Billing & Subscription Tables
-- Migration: Add missing SaaS tables to existing schema

-- ============================================================================
-- Subscriptions
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  tier TEXT NOT NULL,
  status TEXT NOT NULL,
  monthly_price INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  billing_interval TEXT NOT NULL DEFAULT 'monthly',
  current_period_start TEXT NOT NULL,
  current_period_end TEXT NOT NULL,
  cancel_at_period_end INTEGER DEFAULT 0,
  cancelled_at TEXT,
  payment_method TEXT,
  last_payment_status TEXT,
  last_payment_date TEXT,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  max_users INTEGER NOT NULL,
  max_scans_per_month INTEGER NOT NULL,
  max_alerts INTEGER NOT NULL,
  max_storage_gb INTEGER NOT NULL,
  features TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_organization ON subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON subscriptions(current_period_end);

-- ============================================================================
-- Usage Metrics
-- ============================================================================

CREATE TABLE IF NOT EXISTS usage_metrics (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  scans_executed INTEGER DEFAULT 0,
  alerts_generated INTEGER DEFAULT 0,
  remediations_executed INTEGER DEFAULT 0,
  api_calls_count INTEGER DEFAULT 0,
  storage_used_mb INTEGER DEFAULT 0,
  m365_users_monitored INTEGER DEFAULT 0,
  m365_licenses_tracked INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_usage_metrics_org_period ON usage_metrics(organization_id, period_start);

-- ============================================================================
-- Invoices
-- ============================================================================

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  subscription_id TEXT NOT NULL,
  invoice_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  subtotal INTEGER NOT NULL,
  tax INTEGER DEFAULT 0,
  total INTEGER NOT NULL,
  amount_paid INTEGER DEFAULT 0,
  amount_due INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  issue_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  paid_at TEXT,
  line_items TEXT NOT NULL,
  payment_method TEXT,
  stripe_invoice_id TEXT,
  pdf_url TEXT,
  created_at TEXT NOT NULL,
  metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_invoices_organization ON invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);

-- ============================================================================
-- Invitations
-- ============================================================================

CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  invited_by TEXT NOT NULL,
  invited_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  accepted_by TEXT,
  revoked_at TEXT,
  revoked_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_org_email ON invitations(organization_id, email);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status);

-- ============================================================================
-- API Keys
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  scopes TEXT NOT NULL,
  last_used_at TEXT,
  usage_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  expires_at TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  revoked_at TEXT,
  revoked_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_api_keys_organization ON api_keys(organization_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
