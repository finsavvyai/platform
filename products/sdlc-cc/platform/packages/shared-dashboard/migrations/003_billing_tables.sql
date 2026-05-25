-- Billing Service Tables for LemonSqueezy Integration
-- AutoBoot Framework

-- Customers table (synced with LemonSqueezy)
CREATE TABLE IF NOT EXISTS billing_customers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  lemonsqueezy_customer_id TEXT UNIQUE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  company_name TEXT,
  country TEXT,
  region TEXT,
  city TEXT,
  billing_address TEXT,
  tax_number TEXT,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_billing_customers_user ON billing_customers(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_customers_ls ON billing_customers(lemonsqueezy_customer_id);

-- Subscriptions table (synced with LemonSqueezy)
CREATE TABLE IF NOT EXISTS billing_subscriptions (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  lemonsqueezy_subscription_id TEXT UNIQUE,
  product_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  variant_name TEXT NOT NULL,
  status TEXT NOT NULL,
  trial_ends_at DATETIME,
  billing_anchor INTEGER,
  renews_at DATETIME,
  ends_at DATETIME,
  cancelled_at DATETIME,
  card_brand TEXT,
  card_last_four TEXT,
  update_payment_method_url TEXT,
  urls TEXT,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES billing_customers(id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON billing_subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_ls ON billing_subscriptions(lemonsqueezy_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON billing_subscriptions(status);

-- Subscription items (for metered usage)
CREATE TABLE IF NOT EXISTS billing_subscription_items (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL,
  lemonsqueezy_item_id TEXT UNIQUE,
  price_id TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  is_usage_based INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (subscription_id) REFERENCES billing_subscriptions(id)
);

CREATE INDEX IF NOT EXISTS idx_subscription_items_sub ON billing_subscription_items(subscription_id);

-- Invoices table
CREATE TABLE IF NOT EXISTS billing_invoices (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  subscription_id TEXT,
  lemonsqueezy_invoice_id TEXT UNIQUE,
  invoice_number TEXT,
  status TEXT NOT NULL,
  billing_reason TEXT,
  subtotal INTEGER NOT NULL,
  discount_total INTEGER DEFAULT 0,
  tax_total INTEGER DEFAULT 0,
  total INTEGER NOT NULL,
  currency TEXT DEFAULT 'USD',
  refunded INTEGER DEFAULT 0,
  refunded_at DATETIME,
  invoice_url TEXT,
  pdf_url TEXT,
  due_date DATETIME,
  paid_at DATETIME,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES billing_customers(id)
);

CREATE INDEX IF NOT EXISTS idx_invoices_customer ON billing_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_subscription ON billing_invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON billing_invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_ls ON billing_invoices(lemonsqueezy_invoice_id);

-- Usage records (for metered billing)
CREATE TABLE IF NOT EXISTS billing_usage_records (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL,
  subscription_item_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  action TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT,
  FOREIGN KEY (subscription_id) REFERENCES billing_subscriptions(id),
  FOREIGN KEY (subscription_item_id) REFERENCES billing_subscription_items(id)
);

CREATE INDEX IF NOT EXISTS idx_usage_subscription ON billing_usage_records(subscription_id);
CREATE INDEX IF NOT EXISTS idx_usage_item_timestamp ON billing_usage_records(subscription_item_id, timestamp);

-- Webhook events log
CREATE TABLE IF NOT EXISTS billing_webhook_events (
  id TEXT PRIMARY KEY,
  lemonsqueezy_event_id TEXT UNIQUE,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  processed INTEGER DEFAULT 0,
  processed_at DATETIME,
  error TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_webhook_event_type ON billing_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_processed ON billing_webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_webhook_ls_event ON billing_webhook_events(lemonsqueezy_event_id);

-- License keys (for software licenses)
CREATE TABLE IF NOT EXISTS billing_license_keys (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  lemonsqueezy_license_id TEXT UNIQUE,
  key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  activation_limit INTEGER,
  activation_count INTEGER DEFAULT 0,
  expires_at DATETIME,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES billing_customers(id)
);

CREATE INDEX IF NOT EXISTS idx_license_customer ON billing_license_keys(customer_id);
CREATE INDEX IF NOT EXISTS idx_license_key ON billing_license_keys(key);
CREATE INDEX IF NOT EXISTS idx_license_status ON billing_license_keys(status);

-- License activations
CREATE TABLE IF NOT EXISTS billing_license_activations (
  id TEXT PRIMARY KEY,
  license_key_id TEXT NOT NULL,
  instance_name TEXT NOT NULL,
  instance_id TEXT NOT NULL,
  ip_address TEXT,
  activated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deactivated_at DATETIME,
  FOREIGN KEY (license_key_id) REFERENCES billing_license_keys(id)
);

CREATE INDEX IF NOT EXISTS idx_activation_license ON billing_license_activations(license_key_id);
CREATE INDEX IF NOT EXISTS idx_activation_instance ON billing_license_activations(instance_id);

-- Discounts and promotions
CREATE TABLE IF NOT EXISTS billing_discounts (
  id TEXT PRIMARY KEY,
  lemonsqueezy_discount_id TEXT UNIQUE,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  amount INTEGER,
  amount_type TEXT NOT NULL,
  duration TEXT NOT NULL,
  duration_in_months INTEGER,
  status TEXT DEFAULT 'active',
  max_redemptions INTEGER,
  redemption_count INTEGER DEFAULT 0,
  starts_at DATETIME,
  expires_at DATETIME,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_discount_code ON billing_discounts(code);
CREATE INDEX IF NOT EXISTS idx_discount_status ON billing_discounts(status);

-- Products catalog (synced from LemonSqueezy)
CREATE TABLE IF NOT EXISTS billing_products (
  id TEXT PRIMARY KEY,
  lemonsqueezy_product_id TEXT UNIQUE NOT NULL,
  store_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL,
  price INTEGER,
  price_formatted TEXT,
  currency TEXT DEFAULT 'USD',
  interval TEXT,
  interval_count INTEGER DEFAULT 1,
  is_subscription INTEGER DEFAULT 0,
  buy_now_url TEXT,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_product_ls ON billing_products(lemonsqueezy_product_id);
CREATE INDEX IF NOT EXISTS idx_product_status ON billing_products(status);
CREATE INDEX IF NOT EXISTS idx_product_slug ON billing_products(slug);
