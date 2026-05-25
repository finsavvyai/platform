-- =====================================================
-- UNIFIED AUTHENTICATION SYSTEM DATABASE SCHEMA
-- =====================================================
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. USER PROFILES TABLE
-- Extended user profiles with product access and tier information
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  tier TEXT NOT NULL CHECK (tier IN ('starter', 'professional', 'enterprise')) DEFAULT 'starter',
  products JSONB NOT NULL DEFAULT '{
    "qestro": false,
    "queryflux": false,
    "mcpoverflow": false,
    "sdlc": false,
    "pipewarden": false,
    "adminUI": false,
    "documentProcessor": false,
    "developerPortal": false
  }'::jsonb,
  organization_id UUID REFERENCES organizations(id),
  preferences JSONB DEFAULT '{
    "theme": "system",
    "notifications": {
      "email": true,
      "inApp": true,
      "slack": false,
      "qestro": true,
      "queryflux": true,
      "mcpoverflow": true,
      "sdlc": true,
      "pipewarden": true
    },
    "language": "en",
    "timezone": "UTC"
  }'::jsonb,
  referral_code TEXT,
  mfa_secret TEXT,
  mfa_backup_codes TEXT[],
  mfa_enabled BOOLEAN DEFAULT false,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. SUBSCRIPTIONS TABLE
-- User subscriptions for different products and tiers
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL CHECK (product_id IN ('all', 'qestro', 'queryflux', 'mcpoverflow', 'sdlc')),
  tier TEXT NOT NULL CHECK (tier IN ('starter', 'professional', 'enterprise')),
  status TEXT NOT NULL CHECK (status IN ('active', 'cancelled', 'past_due', 'incomplete')),
  current_period_end TIMESTAMPTZ NOT NULL,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ORGANIZATIONS TABLE
-- Enterprise customer organizations
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('professional', 'enterprise')),
  domains TEXT[] DEFAULT '{}',
  sso_config JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ORGANIZATION MEMBERS TABLE
-- Users belonging to organizations
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  permissions JSONB DEFAULT '[]',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, organization_id)
);

-- 5. USAGE TRACKING TABLE
-- Track usage metrics for billing and analytics
CREATE TABLE IF NOT EXISTS usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  product TEXT NOT NULL,
  metric TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 6. AUDIT LOGS TABLE
-- Comprehensive audit trail for all actions
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id),
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 7. API KEYS TABLE
-- User-generated API keys for programmatic access
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL, -- First 8 characters for identification
  permissions JSONB DEFAULT '[]',
  last_used TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- 8. NOTIFICATIONS TABLE
-- User notifications across all products
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  product TEXT,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('info', 'success', 'warning', 'error')),
  read BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. SESSIONS TABLE
-- Track user sessions for security
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  session_token_hash TEXT NOT NULL,
  refresh_token_hash TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- User profiles indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_tier ON user_profiles(tier);
CREATE INDEX IF NOT EXISTS idx_user_profiles_organization ON user_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_created_at ON user_profiles(created_at);

-- Subscriptions indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_product_id ON subscriptions(product_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_current_period_end ON subscriptions(current_period_end);

-- Organization indexes
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_tier ON organizations(tier);

-- Organization members indexes
CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_organization_id ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_role ON organization_members(role);

-- Usage tracking indexes
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_id ON usage_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_product ON usage_tracking(product);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_timestamp ON usage_tracking(timestamp);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_product_timestamp ON usage_tracking(user_id, product, timestamp);

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource);

-- API keys indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_product ON notifications(product);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- Sessions indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_session_token_hash ON sessions(session_token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- User profiles RLS policies
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Subscriptions RLS policies
CREATE POLICY "Users can view own subscriptions" ON subscriptions
  FOR SELECT USING (
    user_id IN (
      SELECT id FROM user_profiles WHERE auth.uid() = id
    ) OR
    user_id IN (
      SELECT user_id FROM organization_members
      WHERE organization_id = user_profiles.organization_id
    )
  );

-- Organizations RLS policies
CREATE POLICY "Org members can view organization" ON organizations
  FOR SELECT USING (
    id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Organization members RLS policies
CREATE POLICY "Org members can view membership" ON organization_members
  FOR SELECT USING (
    user_id = auth.uid() OR
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Usage tracking RLS policies
CREATE POLICY "Users can view own usage" ON usage_tracking
  FOR SELECT USING (user_id IN (
    SELECT id FROM user_profiles WHERE auth.uid() = id
  ));

-- Audit logs RLS policies
CREATE POLICY "Users can view own audit logs" ON audit_logs
  FOR SELECT USING (user_id = auth.uid());

-- API keys RLS policies
CREATE POLICY "Users can manage own API keys" ON api_keys
  FOR ALL USING (user_id IN (
    SELECT id FROM user_profiles WHERE auth.uid() = id
  ));

-- Notifications RLS policies
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

-- Sessions RLS policies
CREATE POLICY "Users can view own sessions" ON sessions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can delete own sessions" ON sessions
  FOR DELETE USING (user_id = auth.uid());

-- =====================================================
-- TRIGGERS AND FUNCTIONS
-- =====================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to check if user can access a product
CREATE OR REPLACE FUNCTION check_product_access(
  user_uuid UUID,
  product_name TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  user_tier TEXT;
  user_products JSONB;
  has_subscription BOOLEAN;
BEGIN
  -- Get user tier and products
  SELECT tier, products INTO user_tier, user_products
  FROM user_profiles
  WHERE id = user_uuid;

  -- Check if user tier includes the product
  IF user_tier IN ('professional', 'enterprise') THEN
    RETURN TRUE;
  END IF;

  -- Check individual product access
  IF user_products ->> product_name = 'true' THEN
    RETURN TRUE;
  END IF;

  -- Check active subscriptions
  SELECT EXISTS(
    SELECT 1 FROM subscriptions
    WHERE user_id = user_uuid
    AND product_id = 'all'
    AND status = 'active'
  ) INTO has_subscription;

  RETURN has_subscription;
END;
$$ LANGUAGE plpgsql;

-- Function to get user's active subscription quota
CREATE OR REPLACE FUNCTION get_user_quota(
  user_uuid UUID,
  product_name TEXT,
  metric_name TEXT
)
RETURNS INTEGER AS $$
DECLARE
  user_tier TEXT;
  quota_value INTEGER;
BEGIN
  -- Get user tier
  SELECT tier INTO user_tier
  FROM user_profiles
  WHERE id = user_uuid;

  -- Return quota based on tier and metric
  CASE user_tier
    WHEN 'starter' THEN
      CASE product_name || '.' || metric_name
        WHEN 'qestro.testRuns' THEN RETURN 100;
        WHEN 'queryflux.connections' THEN RETURN 3;
        WHEN 'mcpoverflow.connectors' THEN RETURN 10;
        ELSE RETURN 0;
      END CASE;
    WHEN 'professional' THEN
      CASE product_name || '.' || metric_name
        WHEN 'qestro.testRuns' THEN RETURN 1000;
        WHEN 'queryflux.connections' THEN RETURN -1; -- unlimited
        WHEN 'mcpoverflow.connectors' THEN RETURN 100;
        ELSE RETURN 0;
      END CASE;
    WHEN 'enterprise' THEN
      RETURN -1; -- unlimited for all
    ELSE
      RETURN 0;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VIEWS FOR COMMON QUERIES
-- =====================================================

-- User subscription summary view
CREATE OR REPLACE VIEW user_subscription_summary AS
SELECT
  up.id,
  up.email,
  up.name,
  up.tier,
  up.products,
  up.organization_id,
  COUNT(s.id) as active_subscriptions,
  COALESCE(
    json_agg(
      json_build_object(
        'product', s.product_id,
        'tier', s.tier,
        'status', s.status,
        'current_period_end', s.current_period_end
      )
    ) FILTER (WHERE s.id IS NOT NULL),
    '[]'::json
  ) as subscriptions
FROM user_profiles up
LEFT JOIN subscriptions s ON up.id = s.user_id AND s.status = 'active'
GROUP BY up.id, up.email, up.name, up.tier, up.products, up.organization_id;

-- Usage analytics view
CREATE OR REPLACE VIEW usage_analytics AS
SELECT
  ut.user_id,
  up.email,
  up.tier,
  ut.product,
  ut.metric,
  SUM(ut.quantity) as total_usage,
  DATE_TRUNC('month', ut.timestamp) as month,
  DATE_TRUNC('week', ut.timestamp) as week
FROM usage_tracking ut
JOIN user_profiles up ON ut.user_id = up.id
WHERE ut.timestamp >= NOW() - INTERVAL '1 year'
GROUP BY ut.user_id, up.email, up.tier, ut.product, ut.metric,
         DATE_TRUNC('month', ut.timestamp), DATE_TRUNC('week', ut.timestamp);

-- =====================================================
-- SAMPLE DATA (OPTIONAL - FOR TESTING)
-- =====================================================

-- Insert sample organization
INSERT INTO organizations (id, name, slug, tier) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'Acme Corp', 'acme-corp', 'professional')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- SECURITY NOTES
-- =====================================================

/*
1. All sensitive data (MFA secrets, API keys) should be encrypted
2. JWT secrets must be strong and stored securely in environment variables
3. Enable database encryption at rest
4. Set up proper backup and recovery procedures
5. Monitor for suspicious activity using audit logs
6. Implement rate limiting on authentication endpoints
7. Use HTTPS for all communications
8. Set up proper user session management
*/