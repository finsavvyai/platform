-- Align subscriptions table to LemonSqueezy schema used by billing-webhook-handlers.ts.
-- Legacy schema (0002) assumed Stripe + required NOT NULL plan metrics, which
-- caused every LS webhook INSERT to fail silently. Table is known-empty in
-- production at time of this migration; safe to drop and recreate.

DROP TABLE IF EXISTS subscriptions;

CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  ls_customer_id TEXT,
  ls_subscription_id TEXT UNIQUE,
  tier TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  current_period_end TEXT,
  cancel_at_period_end INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_organization ON subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subs_ls_sub_id ON subscriptions(ls_subscription_id);
