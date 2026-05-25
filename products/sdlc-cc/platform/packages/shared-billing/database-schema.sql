-- Unified Billing System Database Schema
-- Supports multi-product subscription management with Stripe integration

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  organization_id UUID,
  processor TEXT NOT NULL CHECK (processor IN ('stripe', 'lemonsqueezy')),
  processor_customer_id TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL CHECK (product_id IN ('all', 'qestro', 'queryflux', 'mcpoverflow', 'sdlc', 'pipewarden')),
  tier TEXT NOT NULL CHECK (tier IN ('starter', 'professional', 'enterprise')),
  processor TEXT NOT NULL CHECK (processor IN ('stripe', 'lemonsqueezy')),
  processor_subscription_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('active', 'cancelled', 'expired', 'past_due', 'paused', 'unpaid', 'on_trial', 'incomplete', 'incomplete_expired')),
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  trial_end TIMESTAMP WITH TIME ZONE,
  quota JSONB NOT NULL DEFAULT '{}',
  usage JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Checkout sessions table
CREATE TABLE IF NOT EXISTS checkout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  tier TEXT NOT NULL,
  processor TEXT NOT NULL,
  processor_session_id TEXT NOT NULL UNIQUE,
  amount INTEGER NOT NULL, -- in cents
  currency TEXT NOT NULL DEFAULT 'USD',
  url TEXT NOT NULL,
  success_url TEXT,
  cancel_url TEXT,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  processor TEXT NOT NULL,
  processor_invoice_id TEXT NOT NULL UNIQUE,
  number TEXT NOT NULL,
  amount INTEGER NOT NULL, -- in cents
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  paid_at TIMESTAMP WITH TIME ZONE,
  pdf_url TEXT,
  invoice_url TEXT,
  tax INTEGER DEFAULT 0,
  total INTEGER NOT NULL,
  line_items JSONB DEFAULT '[]',
  created TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Usage records table
CREATE TABLE IF NOT EXISTS usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  metric TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  billing_cycle TEXT NOT NULL, -- YYYY-MM format
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscription cancellations table
CREATE TABLE IF NOT EXISTS subscription_cancellations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  reason TEXT,
  feedback TEXT,
  cancelled_immediately BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quota exceeded notifications table
CREATE TABLE IF NOT EXISTS quota_exceeded_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  metric TEXT NOT NULL,
  limit INTEGER NOT NULL,
  used INTEGER NOT NULL,
  overage INTEGER NOT NULL,
  suggested_tier TEXT NOT NULL CHECK (suggested_tier IN ('starter', 'professional', 'enterprise')),
  notified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Organization billing table
CREATE TABLE IF NOT EXISTS organization_billing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('starter', 'professional', 'enterprise')),
  member_count INTEGER DEFAULT 0,
  active_subscriptions INTEGER DEFAULT 0,
  monthly_cost INTEGER DEFAULT 0, -- in cents
  usage JSONB DEFAULT '{}',
  quota JSONB DEFAULT '{}',
  next_billing_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security (RLS) Policies

-- Customers RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own customers" ON customers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own customers" ON customers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own customers" ON customers FOR UPDATE USING (auth.uid() = user_id);

-- Subscriptions RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own subscriptions" ON subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service roles can manage subscriptions" ON subscriptions FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Checkout sessions RLS
ALTER TABLE checkout_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own checkout sessions" ON checkout_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own checkout sessions" ON checkout_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Invoices RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own invoices" ON invoices FOR SELECT USING (auth.uid() = user_id);

-- Usage records RLS
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own usage records" ON usage_records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service roles can manage usage records" ON usage_records FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Subscription cancellations RLS
ALTER TABLE subscription_cancellations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own cancellation records" ON subscription_cancellations FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM subscriptions
    WHERE subscriptions.id = subscription_cancellations.subscription_id
    AND subscriptions.user_id = auth.uid()
  )
);

-- Quota exceeded notifications RLS
ALTER TABLE quota_exceeded_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own quota notifications" ON quota_exceeded_notifications FOR SELECT USING (auth.uid() = user_id);

-- Organization billing RLS
ALTER TABLE organization_billing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their organization billing" ON organization_billing FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.organization_id = organization_billing.organization_id
    AND user_profiles.id = auth.uid()
  )
);

-- Indexes for performance
CREATE INDEX idx_customers_user_id ON customers(user_id);
CREATE INDEX idx_customers_processor_customer_id ON customers(processor_customer_id);
CREATE INDEX idx_customers_email ON customers(email);

CREATE INDEX idx_subscriptions_customer_id ON subscriptions(customer_id);
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_processor_subscription_id ON subscriptions(processor_subscription_id);
CREATE INDEX idx_subscriptions_tier ON subscriptions(tier);
CREATE INDEX idx_subscriptions_product_id ON subscriptions(product_id);

CREATE INDEX idx_checkout_sessions_customer_id ON checkout_sessions(customer_id);
CREATE INDEX idx_checkout_sessions_user_id ON checkout_sessions(user_id);
CREATE INDEX idx_checkout_sessions_processor_session_id ON checkout_sessions(processor_session_id);
CREATE INDEX idx_checkout_sessions_completed ON checkout_sessions(completed);

CREATE INDEX idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX idx_invoices_user_id ON invoices(user_id);
CREATE INDEX idx_invoices_subscription_id ON invoices(subscription_id);
CREATE INDEX idx_invoices_processor_invoice_id ON invoices(processor_invoice_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_created ON invoices(created);

CREATE INDEX idx_usage_records_user_id ON usage_records(user_id);
CREATE INDEX idx_usage_records_subscription_id ON usage_records(subscription_id);
CREATE INDEX idx_usage_records_product_id ON usage_records(product_id);
CREATE INDEX idx_usage_records_billing_cycle ON usage_records(billing_cycle);
CREATE INDEX idx_usage_records_timestamp ON usage_records(timestamp);

CREATE INDEX idx_subscription_cancellations_subscription_id ON subscription_cancellations(subscription_id);

CREATE INDEX idx_quota_exceeded_notifications_user_id ON quota_exceeded_notifications(user_id);
CREATE INDEX idx_quota_exceeded_notifications_product_id ON quota_exceeded_notifications(product_id);

CREATE INDEX idx_organization_billing_organization_id ON organization_billing(organization_id);

-- Triggers for updated_at timestamp
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_customers_timestamp
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_subscriptions_timestamp
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_organization_billing_timestamp
  BEFORE UPDATE ON organization_billing
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();

-- Functions for billing operations

-- Function to get user's active subscription
CREATE OR REPLACE FUNCTION get_user_active_subscription(
  p_user_id UUID,
  p_product_id TEXT DEFAULT 'all'
)
RETURNS TABLE (
  subscription_id UUID,
  tier TEXT,
  status TEXT,
  current_period_end TIMESTAMP WITH TIME ZONE,
  quota JSONB,
  usage JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.tier,
    s.status,
    s.current_period_end,
    s.quota,
    s.usage
  FROM subscriptions s
  WHERE s.user_id = p_user_id
    AND s.product_id = p_product_id
    AND s.status = 'active'
    AND s.current_period_end > NOW()
  ORDER BY s.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate monthly usage
CREATE OR REPLACE FUNCTION calculate_monthly_usage(
  p_user_id UUID,
  p_product_id TEXT,
  p_metric TEXT,
  p_billing_cycle TEXT DEFAULT TO_CHAR(NOW(), 'YYYY-MM')
)
RETURNS INTEGER AS $$
DECLARE
  total_usage INTEGER;
BEGIN
  SELECT COALESCE(SUM(quantity), 0)
  INTO total_usage
  FROM usage_records
  WHERE user_id = p_user_id
    AND product_id = p_product_id
    AND metric = p_metric
    AND billing_cycle = p_billing_cycle;

  RETURN total_usage;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user exceeded quota
CREATE OR REPLACE FUNCTION check_quota_exceeded(
  p_user_id UUID,
  p_product_id TEXT,
  p_metric TEXT
)
RETURNS TABLE (
  limit INTEGER,
  used INTEGER,
  remaining INTEGER,
  exceeded BOOLEAN
) AS $$
DECLARE
  user_quota JSONB;
  user_limit INTEGER;
  user_used INTEGER;
BEGIN
  -- Get user's subscription and quota
  SELECT s.quota
  INTO user_quota
  FROM get_user_active_subscription(p_user_id, p_product_id)
  LIMIT 1;

  -- Extract limit from quota JSON
  user_limit := COALESCE((user_quota ->> p_metric)::INTEGER, 0);

  -- Calculate current usage
  user_used := calculate_monthly_usage(p_user_id, p_product_id, p_metric);

  -- Return quota information
  RETURN QUERY
  SELECT
    user_limit,
    user_used,
    CASE
      WHEN user_limit = -1 THEN -1 -- Unlimited
      ELSE GREATEST(0, user_limit - user_used)
    END,
    CASE
      WHEN user_limit = -1 THEN FALSE -- Unlimited
      ELSE user_used > user_limit
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_user_active_subscription TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_monthly_usage TO authenticated;
GRANT EXECUTE ON FUNCTION check_quota_exceeded TO authenticated;
GRANT EXECUTE ON FUNCTION trigger_set_timestamp TO authenticated;