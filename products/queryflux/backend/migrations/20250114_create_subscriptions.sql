-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    country VARCHAR(2),
    zip VARCHAR(20),
    store_id VARCHAR(50) NOT NULL,
    lemonsqueezy_id VARCHAR(50) UNIQUE,
    lemonsqueezy_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for customers
CREATE INDEX idx_customers_user_id ON customers(user_id);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_lemonsqueezy_id ON customers(lemonsqueezy_id);

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    store_id VARCHAR(50) NOT NULL,
    order_id VARCHAR(50),
    product_id VARCHAR(50),
    variant_id VARCHAR(50),
    status VARCHAR(50) NOT NULL DEFAULT 'on_trial',
    plan_type VARCHAR(50),
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    renews_at TIMESTAMP WITH TIME ZONE,
    ends_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancellation_reason TEXT,
    usage_limit INTEGER DEFAULT 100,
    current_usage INTEGER DEFAULT 0,
    lemonsqueezy_id VARCHAR(50) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for subscriptions
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_customer_id ON subscriptions(customer_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_lemonsqueezy_id ON subscriptions(lemonsqueezy_id);
CREATE INDEX idx_subscriptions_ends_at ON subscriptions(ends_at);

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    lemonsqueezy_id VARCHAR(50) UNIQUE,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    due_date TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    refunded_at TIMESTAMP WITH TIME ZONE,
    refund_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    billing_address TEXT,
    item_description TEXT,
    invoice_url TEXT,
    download_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for invoices
CREATE INDEX idx_invoices_user_id ON invoices(user_id);
CREATE INDEX idx_invoices_subscription_id ON invoices(subscription_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX idx_invoices_lemonsqueezy_id ON invoices(lemonsqueezy_id);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);

-- Create subscription_usage_logs table for tracking usage over time
CREATE TABLE IF NOT EXISTS subscription_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for usage logs
CREATE INDEX idx_subscription_usage_logs_subscription_id ON subscription_usage_logs(subscription_id);
CREATE INDEX idx_subscription_usage_logs_user_id ON subscription_usage_logs(user_id);
CREATE INDEX idx_subscription_usage_logs_created_at ON subscription_usage_logs(created_at);
CREATE INDEX idx_subscription_usage_logs_action ON subscription_usage_logs(action);

-- Create webhook_events table for logging webhook events
CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(100) NOT NULL UNIQUE,
    event_name VARCHAR(100) NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    payload JSONB NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for webhook events
CREATE INDEX idx_webhook_events_event_id ON webhook_events(event_id);
CREATE INDEX idx_webhook_events_event_name ON webhook_events(event_name);
CREATE INDEX idx_webhook_events_processed ON webhook_events(processed);
CREATE INDEX idx_webhook_events_created_at ON webhook_events(created_at);

-- Create subscription_plans table for storing plan configurations
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    plan_type VARCHAR(50) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    billing_interval VARCHAR(50), -- monthly, yearly, lifetime
    features JSONB NOT NULL DEFAULT '[]',
    usage_limits JSONB NOT NULL DEFAULT '{}',
    lemonsqueezy_variant_id VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for subscription plans
CREATE INDEX idx_subscription_plans_plan_type ON subscription_plans(plan_type);
CREATE INDEX idx_subscription_plans_is_active ON subscription_plans(is_active);
CREATE INDEX idx_subscription_plans_sort_order ON subscription_plans(sort_order);

-- Insert default plans
INSERT INTO subscription_plans (name, display_name, description, plan_type, price, billing_interval, features, usage_limits, sort_order) VALUES
('free', 'Free', 'Perfect for getting started', 'free', 0.00, 'monthly',
 '["Basic query execution", "Up to 3 connections", "Export results", "Community support"]',
 '{"connections": 3, "queries_per_day": 100, "saved_queries": 10}',
 0),
('pro_monthly', 'Pro Monthly', 'For professionals and teams', 'monthly', 29.00, 'monthly',
 '["Unlimited connections", "Unlimited queries", "AI-powered optimization", "Priority support", "Advanced analytics"]',
 '{"connections": -1, "queries_per_day": -1, "saved_queries": -1}',
 1),
('pro_yearly', 'Pro Yearly', 'Best value for professionals', 'yearly', 290.00, 'yearly',
 '["Unlimited connections", "Unlimited queries", "AI-powered optimization", "Priority support", "Advanced analytics", "2 months free"]',
 '{"connections": -1, "queries_per_day": -1, "saved_queries": -1}',
 2),
('enterprise', 'Enterprise', 'For large organizations', 'enterprise', 999.00, 'monthly',
 '["Everything in Pro", "Unlimited users", "SSO authentication", "Custom integrations", "Dedicated support", "SLA guarantee"]',
 '{"connections": -1, "queries_per_day": -1, "saved_queries": -1, "users": -1}',
 3)
ON CONFLICT (name) DO NOTHING;

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON subscription_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add RLS (Row Level Security) policies
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_usage_logs ENABLE ROW LEVEL SECURITY;

-- Users can only view their own data
CREATE POLICY "Users can view own customers" ON customers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own subscriptions" ON subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own invoices" ON invoices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own usage logs" ON subscription_usage_logs FOR SELECT USING (auth.uid() = user_id);

-- Service role can access all data
CREATE POLICY "Service role full access to customers" ON customers FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access to subscriptions" ON subscriptions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access to invoices" ON invoices FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access to usage logs" ON subscription_usage_logs FOR ALL USING (auth.role() = 'service_role');