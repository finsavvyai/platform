-- Replace Stripe with LemonSqueezy fields
ALTER TABLE users ADD COLUMN ls_customer_id TEXT;
ALTER TABLE users ADD COLUMN ls_subscription_id TEXT;
CREATE INDEX IF NOT EXISTS idx_users_ls_customer ON users(ls_customer_id);
