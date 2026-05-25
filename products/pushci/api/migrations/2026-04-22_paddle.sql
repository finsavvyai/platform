-- Replace LemonSqueezy with Paddle fields
ALTER TABLE users ADD COLUMN paddle_customer_id TEXT;
ALTER TABLE users ADD COLUMN paddle_subscription_id TEXT;
CREATE INDEX IF NOT EXISTS idx_users_paddle_customer ON users(paddle_customer_id);
