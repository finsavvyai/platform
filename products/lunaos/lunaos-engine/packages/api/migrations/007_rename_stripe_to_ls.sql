-- Migrate subscriptions from Stripe to LemonSqueezy column names
-- D1 doesn't support RENAME COLUMN, so recreate the table

CREATE TABLE IF NOT EXISTS subscriptions_new (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    ls_customer_id TEXT,
    ls_subscription_id TEXT,
    tier TEXT NOT NULL DEFAULT 'free' CHECK(tier IN ('free', 'pro', 'team')),
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'on_trial', 'past_due', 'cancelled', 'expired', 'incomplete')),
    current_period_start TEXT,
    current_period_end TEXT,
    cancel_at_period_end INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO subscriptions_new
    SELECT id, user_id, stripe_customer_id, stripe_subscription_id,
           tier, status, current_period_start, current_period_end,
           cancel_at_period_end, created_at, updated_at
    FROM subscriptions;

DROP TABLE IF EXISTS subscriptions;
ALTER TABLE subscriptions_new RENAME TO subscriptions;

CREATE INDEX IF NOT EXISTS idx_subscriptions_ls_sub ON subscriptions(ls_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_ls_cust ON subscriptions(ls_customer_id);
