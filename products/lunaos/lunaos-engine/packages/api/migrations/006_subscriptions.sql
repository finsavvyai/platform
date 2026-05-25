-- Subscriptions table for Stripe billing
-- Tracks user subscription state, synced via Stripe webhooks

CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    tier TEXT NOT NULL DEFAULT 'free' CHECK(tier IN ('free', 'pro', 'team')),
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'trialing', 'past_due', 'canceled', 'incomplete')),
    current_period_start TEXT,
    current_period_end TEXT,
    cancel_at_period_end INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_cust ON subscriptions(stripe_customer_id);
