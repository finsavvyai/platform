/*
  # Add Subscriptions and Query Execution Tracking

  1. New Tables
    - `subscriptions` - Store LemonSqueezy subscription data
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key)
      - `lemon_squeezy_id` (text, unique)
      - `order_id` (text)
      - `product_id` (text)
      - `variant_id` (text)
      - `customer_id` (text)
      - `status` (text) - active, cancelled, expired, trial
      - `plan_name` (text)
      - `billing_cycle` (text) - monthly, yearly
      - `price` (numeric)
      - `currency` (text)
      - `trial_ends_at` (timestamp)
      - `renews_at` (timestamp)
      - `ends_at` (timestamp)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `query_executions` - Track query execution history
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key)
      - `connection_id` (uuid, foreign key)
      - `query_text` (text)
      - `status` (text) - success, error
      - `execution_time_ms` (integer)
      - `rows_affected` (integer)
      - `error_message` (text)
      - `executed_at` (timestamp)

  2. Security
    - Enable RLS on all new tables
    - Add appropriate policies
*/

-- Subscriptions Table
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  lemon_squeezy_id text UNIQUE,
  order_id text,
  product_id text,
  variant_id text,
  customer_id text,
  status text NOT NULL DEFAULT 'trial',
  plan_name text DEFAULT 'Free',
  billing_cycle text,
  price numeric(10, 2) DEFAULT 0,
  currency text DEFAULT 'USD',
  trial_ends_at timestamptz,
  renews_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription"
  ON subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription"
  ON subscriptions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Query Executions Table
CREATE TABLE IF NOT EXISTS query_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  connection_id uuid REFERENCES connections(id) ON DELETE SET NULL,
  query_text text NOT NULL,
  status text NOT NULL DEFAULT 'success',
  execution_time_ms integer,
  rows_affected integer,
  error_message text,
  executed_at timestamptz DEFAULT now()
);

ALTER TABLE query_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own query history"
  ON query_executions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own query history"
  ON query_executions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own query history"
  ON query_executions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_query_executions_user_id ON query_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_query_executions_connection_id ON query_executions(connection_id);
CREATE INDEX IF NOT EXISTS idx_query_executions_executed_at ON query_executions(executed_at DESC);

-- Function to automatically create trial subscription for new users
CREATE OR REPLACE FUNCTION create_trial_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO subscriptions (user_id, status, plan_name, trial_ends_at)
  VALUES (NEW.id, 'trial', 'Free Trial', now() + interval '14 days')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create trial subscription
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'create_user_trial_subscription'
  ) THEN
    CREATE TRIGGER create_user_trial_subscription
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION create_trial_subscription();
  END IF;
END $$;
