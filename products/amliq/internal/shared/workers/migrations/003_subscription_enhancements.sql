-- Subscription Management Enhancements
-- Enhanced subscription tables with comprehensive features

-- Add new columns to existing subscriptions table
ALTER TABLE subscriptions ADD COLUMN plan_id TEXT;
ALTER TABLE subscriptions ADD COLUMN trial_start TEXT;
ALTER TABLE subscriptions ADD COLUMN trial_end TEXT;
ALTER TABLE subscriptions ADD COLUMN quantity INTEGER DEFAULT 1;
ALTER TABLE subscriptions ADD COLUMN billing_cycle TEXT DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly', 'quarterly'));
ALTER TABLE subscriptions ADD COLUMN amount REAL;
ALTER TABLE subscriptions ADD COLUMN currency TEXT DEFAULT 'USD';
ALTER TABLE subscriptions ADD COLUMN paused_at TEXT;
ALTER TABLE subscriptions ADD COLUMN resume_at TEXT;
ALTER TABLE subscriptions ADD COLUMN canceled_at TEXT;
ALTER TABLE subscriptions ADD COLUMN ended_at TEXT;

-- Update existing records to have default values
UPDATE subscriptions SET
  plan_id = plan,
  quantity = 1,
  billing_cycle = 'monthly',
  amount = 0,
  currency = 'USD'
WHERE plan_id IS NULL;

-- Drop old plan column after migration
-- ALTER TABLE subscriptions DROP COLUMN plan;

-- Create subscription plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly', 'quarterly')),
  features TEXT NOT NULL DEFAULT '[]',
  metadata TEXT NOT NULL DEFAULT '{}',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Create subscription events table for audit trail
CREATE TABLE IF NOT EXISTS subscription_events (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('created', 'updated', 'canceled', 'renewed', 'payment_succeeded', 'payment_failed', 'trial_started', 'trial_ended', 'paused', 'resumed', 'upgraded', 'downgraded')),
  data TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Create subscription metrics table for analytics
CREATE TABLE IF NOT EXISTS subscription_metrics (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  date TEXT NOT NULL,
  mrr REAL NOT NULL DEFAULT 0,
  arr REAL NOT NULL DEFAULT 0,
  active_subscriptions INTEGER NOT NULL DEFAULT 0,
  new_subscriptions INTEGER NOT NULL DEFAULT 0,
  churned_subscriptions INTEGER NOT NULL DEFAULT 0,
  trial_conversions INTEGER NOT NULL DEFAULT 0,
  upgrades INTEGER NOT NULL DEFAULT 0,
  downgrades INTEGER NOT NULL DEFAULT 0,
  revenue_upgrades REAL NOT NULL DEFAULT 0,
  revenue_downgrades REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  UNIQUE(organization_id, date)
);

-- Update subscription status check constraint to include all possible statuses
-- Note: SQLite doesn't support ALTER CONSTRAINT, so we'll handle this in the application layer

-- Create indexes for new tables and columns
CREATE INDEX idx_subscription_plans_org_id ON subscription_plans(organization_id);
CREATE INDEX idx_subscription_plans_active ON subscription_plans(active);
CREATE INDEX idx_subscription_plans_amount ON subscription_plans(amount);
CREATE INDEX idx_subscription_events_subscription_id ON subscription_events(subscription_id);
CREATE INDEX idx_subscription_events_type ON subscription_events(type);
CREATE INDEX idx_subscription_events_created_at ON subscription_events(created_at);
CREATE INDEX idx_subscription_metrics_org_id ON subscription_metrics(organization_id);
CREATE INDEX idx_subscription_metrics_date ON subscription_metrics(date);

-- Additional indexes for subscription table
CREATE INDEX idx_subscriptions_plan_id ON subscriptions(plan_id);
CREATE INDEX idx_subscriptions_status_new ON subscriptions(status);
CREATE INDEX idx_subscriptions_trial_end ON subscriptions(trial_end);
CREATE INDEX idx_subscriptions_current_period_end ON subscriptions(current_period_end);
CREATE INDEX idx_subscriptions_billing_cycle ON subscriptions(billing_cycle);
