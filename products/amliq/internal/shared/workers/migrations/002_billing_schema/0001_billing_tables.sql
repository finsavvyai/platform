-- FinSavvy AI Suite - Billing Schema
-- Smart Billing & Payment SDK with AI enhancement
-- Migration: 0001_billing_tables
-- Created: 2025-10-14

-- Customers table with AI categorization support
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    email TEXT,
    company_name TEXT,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    address TEXT, -- JSON for address object
    tax_id TEXT,
    customer_type TEXT NOT NULL DEFAULT 'individual' CHECK (customer_type IN ('individual', 'business')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    currency TEXT NOT NULL DEFAULT 'USD',
    language TEXT NOT NULL DEFAULT 'en',
    timezone TEXT NOT NULL DEFAULT 'UTC',
    payment_methods TEXT NOT NULL DEFAULT '[]', -- JSON array of payment methods
    billing_address TEXT, -- JSON for billing address
    shipping_address TEXT, -- JSON for shipping address
    notes TEXT,
    tags TEXT NOT NULL DEFAULT '[]', -- JSON array of tags
    ai_categorization TEXT, -- JSON for AI-generated categorization
    ai_risk_score REAL CHECK (ai_risk_score >= 0.0 AND ai_risk_score <= 1.0),
    ai_payment_predictability REAL CHECK (ai_payment_predictability >= 0.0 AND ai_payment_predictability <= 1.0),
    ai_recommended_actions TEXT, -- JSON for AI recommendations
    metadata TEXT NOT NULL DEFAULT '{}', -- JSON for additional metadata
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Foreign key constraint
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,

    -- Constraints
    CONSTRAINT customers_email_organization_unique UNIQUE (organization_id, email),
    CONSTRAINT customers_company_name_not_empty CHECK (customer_type = 'individual' OR company_name IS NOT NULL)
);

-- Indexes for customer queries
CREATE INDEX idx_customers_organization_id ON customers(organization_id);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_company_name ON customers(company_name);
CREATE INDEX idx_customers_status ON customers(status);
CREATE INDEX idx_customers_customer_type ON customers(customer_type);
CREATE INDEX idx_customers_ai_risk_score ON customers(ai_risk_score);

-- Products and services catalog
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    sku TEXT,
    type TEXT NOT NULL DEFAULT 'service' CHECK (type IN ('product', 'service', 'subscription', 'usage_based')),
    unit_price REAL NOT NULL CHECK (unit_price >= 0),
    currency TEXT NOT NULL DEFAULT 'USD',
    tax_rate REAL NOT NULL DEFAULT 0.0 CHECK (tax_rate >= 0.0 AND tax_rate <= 1.0),
    tax_inclusive BOOLEAN NOT NULL DEFAULT false,
    recurring_period TEXT CHECK (recurring_period IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
    trial_period_days INTEGER CHECK (trial_period_days >= 0),
    usage_unit TEXT, -- For usage-based pricing (e.g., 'hours', 'gb', 'api_calls')
    usage_pricing_tiers TEXT, -- JSON for usage-based pricing tiers
    is_active BOOLEAN NOT NULL DEFAULT true,
    requires_ai_processing BOOLEAN NOT NULL DEFAULT false,
    ai_processing_cost REAL CHECK (ai_processing_cost >= 0),
    ai_enhanced_description TEXT, -- AI-generated marketing description
    ai_recommended_pricing TEXT, -- JSON for AI pricing recommendations
    metadata TEXT NOT NULL DEFAULT '{}', -- JSON for additional metadata
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Foreign key constraint
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,

    -- Constraints
    CONSTRAINT products_sku_organization_unique UNIQUE (organization_id, sku),
    CONSTRAINT products_name_not_empty CHECK (length(name) > 0)
);

-- Indexes for product queries
CREATE INDEX idx_products_organization_id ON products(organization_id);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_type ON products(type);
CREATE INDEX idx_products_is_active ON products(is_active);

-- AI-enhanced invoices with intelligent categorization
CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    invoice_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'paid', 'partially_paid', 'overdue', 'cancelled', 'void')),
    currency TEXT NOT NULL DEFAULT 'USD',
    subtotal REAL NOT NULL CHECK (subtotal >= 0),
    tax_amount REAL NOT NULL DEFAULT 0.0 CHECK (tax_amount >= 0),
    total_amount REAL NOT NULL CHECK (total_amount >= 0),
    amount_paid REAL NOT NULL DEFAULT 0.0 CHECK (amount_paid >= 0),
    amount_due REAL GENERATED ALWAYS AS (total_amount - amount_paid) VIRTUAL,
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    paid_date DATE,
    cancelled_date DATE,
    notes TEXT,
    terms TEXT,
    purchase_order TEXT,
    contract_id TEXT,
    project_id TEXT,
    department TEXT,
    cost_center TEXT,
    ai_generated BOOLEAN NOT NULL DEFAULT false,
    ai_confidence_score REAL CHECK (ai_confidence_score >= 0.0 AND ai_confidence_score <= 1.0),
    ai_categorization TEXT, -- JSON for AI categorization
    ai_risk_assessment TEXT, -- JSON for payment risk assessment
    ai_payment_prediction TEXT, -- JSON for payment likelihood prediction
    ai_recommended_actions TEXT, -- JSON for AI recommendations
    ai_processing_notes TEXT,
    ai_template_used TEXT,
    metadata TEXT NOT NULL DEFAULT '{}', -- JSON for additional metadata
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Foreign key constraints
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,

    -- Constraints
    CONSTRAINT invoices_invoice_number_organization_unique UNIQUE (organization_id, invoice_number),
    CONSTRAINT invoices_due_date_after_issue CHECK (due_date >= issue_date),
    CONSTRAINT invoices_total_calculation CHECK (total_amount = subtotal + tax_amount)
);

-- Indexes for invoice queries
CREATE INDEX idx_invoices_organization_id ON invoices(organization_id);
CREATE INDEX idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_issue_date ON invoices(issue_date);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
CREATE INDEX idx_invoices_ai_generated ON invoices(ai_generated);
CREATE INDEX idx_invoices_ai_risk_assessment ON invoices(ai_risk_assessment);

-- Invoice line items with AI-powered categorization
CREATE TABLE IF NOT EXISTS invoice_items (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL,
    product_id TEXT,
    description TEXT NOT NULL,
    quantity REAL NOT NULL CHECK (quantity > 0),
    unit_price REAL NOT NULL CHECK (unit_price >= 0),
    discount_amount REAL NOT NULL DEFAULT 0.0 CHECK (discount_amount >= 0),
    tax_rate REAL NOT NULL DEFAULT 0.0 CHECK (tax_rate >= 0.0),
    tax_amount REAL GENERATED ALWAYS AS (quantity * unit_price * tax_rate) VIRTUAL,
    total_amount REAL GENERATED ALWAYS AS (quantity * unit_price - discount_amount + (quantity * unit_price * tax_rate)) VIRTUAL,
    category TEXT,
    subcategory TEXT,
    ai_category_confidence REAL CHECK (ai_category_confidence >= 0.0 AND ai_category_confidence <= 1.0),
    ai_suggested_category TEXT,
    ai_description_enhancement TEXT,
    metadata TEXT NOT NULL DEFAULT '{}', -- JSON for additional metadata
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Foreign key constraints
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

-- Indexes for invoice item queries
CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX idx_invoice_items_product_id ON invoice_items(product_id);
CREATE INDEX idx_invoice_items_category ON invoice_items(category);

-- Payment processing with AI-powered fraud detection
CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    invoice_id TEXT,
    customer_id TEXT NOT NULL,
    amount REAL NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'USD',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded', 'partially_refunded')),
    payment_method TEXT NOT NULL,
    provider TEXT NOT NULL, -- 'stripe', 'paypal', 'lemonqueezy', etc.
    provider_transaction_id TEXT,
    provider_payment_method_id TEXT,
    failure_reason TEXT,
    failure_code TEXT,
    processed_at DATETIME,
    refunded_amount REAL NOT NULL DEFAULT 0.0 CHECK (refunded_amount >= 0),
    refund_reason TEXT,
    fees REAL NOT NULL DEFAULT 0.0 CHECK (fees >= 0),
    net_amount REAL GENERATED ALWAYS AS (amount - fees) VIRTUAL,
    ai_fraud_score REAL CHECK (ai_fraud_score >= 0.0 AND ai_fraud_score <= 1.0),
    ai_risk_level TEXT CHECK (ai_risk_level IN ('low', 'medium', 'high', 'critical')),
    ai_fraud_indicators TEXT, -- JSON for fraud indicators
    ai_verification_required BOOLEAN NOT NULL DEFAULT false,
    ai_verified_at DATETIME,
    metadata TEXT NOT NULL DEFAULT '{}', -- JSON for additional metadata
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Foreign key constraints
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT
);

-- Indexes for payment queries
CREATE INDEX idx_payments_organization_id ON payments(organization_id);
CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX idx_payments_customer_id ON payments(customer_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_provider ON payments(provider);
CREATE INDEX idx_payments_processed_at ON payments(processed_at);
CREATE INDEX idx_payments_ai_fraud_score ON payments(ai_fraud_score);

-- Subscription management with AI-powered churn prediction
CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trialing', 'past_due', 'cancelled', 'unpaid', 'paused')),
    billing_period TEXT NOT NULL CHECK (billing_period IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
    unit_price REAL NOT NULL CHECK (unit_price >= 0),
    currency TEXT NOT NULL DEFAULT 'USD',
    quantity REAL NOT NULL DEFAULT 1 CHECK (quantity > 0),
    trial_start DATETIME,
    trial_end DATETIME,
    current_period_start DATETIME NOT NULL,
    current_period_end DATETIME NOT NULL,
    cancelled_at DATETIME,
    ended_at DATETIME,
    pause_reason TEXT,
    payment_method_id TEXT,
    ai_churn_probability REAL CHECK (ai_churn_probability >= 0.0 AND ai_churn_probability <= 1.0),
    ai_churn_factors TEXT, -- JSON for churn risk factors
    ai_retention_recommendations TEXT, -- JSON for AI recommendations
    ai_ltv_prediction REAL CHECK (ai_ltv_prediction >= 0),
    ai_expansion_opportunity BOOLEAN NOT NULL DEFAULT false,
    metadata TEXT NOT NULL DEFAULT '{}', -- JSON for additional metadata
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Foreign key constraints
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
);

-- Indexes for subscription queries
CREATE INDEX idx_subscriptions_organization_id ON subscriptions(organization_id);
CREATE INDEX idx_subscriptions_customer_id ON subscriptions(customer_id);
CREATE INDEX idx_subscriptions_product_id ON subscriptions(product_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_ai_churn_probability ON subscriptions(ai_churn_probability);

-- Bank accounts for reconciliation
CREATE TABLE IF NOT EXISTS bank_accounts (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK (account_type IN ('checking', 'savings', 'business', 'corporate')),
    currency TEXT NOT NULL DEFAULT 'USD',
    bank_name TEXT,
    last_four TEXT,
    routing_number TEXT,
    account_number_encrypted TEXT,
    plaid_item_id TEXT,
    plaid_access_token_encrypted TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    balance REAL,
    last_sync DATETIME,
    sync_status TEXT CHECK (sync_status IN ('success', 'failed', 'pending', 'never')),
    metadata TEXT NOT NULL DEFAULT '{}', -- JSON for additional metadata
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Foreign key constraint
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Indexes for bank account queries
CREATE INDEX idx_bank_accounts_organization_id ON bank_accounts(organization_id);
CREATE INDEX idx_bank_accounts_is_active ON bank_accounts(is_active);
CREATE INDEX idx_bank_accounts_last_sync ON bank_accounts(last_sync);

-- Bank transactions for AI-powered reconciliation
CREATE TABLE IF NOT EXISTS bank_transactions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    bank_account_id TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    description TEXT NOT NULL,
    reference_number TEXT,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('credit', 'debit')),
    category TEXT,
    subcategory TEXT,
    date DATE NOT NULL,
    posted_date DATE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'posted', 'reconciled', 'disputed')),
    reconciliation_status TEXT DEFAULT 'unreconciled' CHECK (reconciliation_status IN ('unreconciled', 'matched', 'manually_matched', 'discrepancy')),
    matched_invoice_id TEXT,
    matched_payment_id TEXT,
    ai_category_confidence REAL CHECK (ai_category_confidence >= 0.0 AND ai_category_confidence <= 1.0),
    ai_suggested_category TEXT,
    ai_match_confidence REAL CHECK (ai_match_confidence >= 0.0 AND ai_match_confidence <= 1.0),
    ai_suggested_matches TEXT, -- JSON for AI suggested matches
    metadata TEXT NOT NULL DEFAULT '{}', -- JSON for additional metadata
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Foreign key constraints
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (matched_invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
    FOREIGN KEY (matched_payment_id) REFERENCES payments(id) ON DELETE SET NULL
);

-- Indexes for bank transaction queries
CREATE INDEX idx_bank_transactions_organization_id ON bank_transactions(organization_id);
CREATE INDEX idx_bank_transactions_bank_account_id ON bank_transactions(bank_account_id);
CREATE INDEX idx_bank_transactions_date ON bank_transactions(date);
CREATE INDEX idx_bank_transactions_category ON bank_transactions(category);
CREATE INDEX idx_bank_transactions_reconciliation_status ON bank_transactions(reconciliation_status);

-- Billing analytics and metrics
CREATE TABLE IF NOT EXISTS billing_analytics (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_revenue REAL NOT NULL DEFAULT 0.0,
    new_customers INTEGER NOT NULL DEFAULT 0,
    churned_customers INTEGER NOT NULL DEFAULT 0,
    total_invoices INTEGER NOT NULL DEFAULT 0,
    paid_invoices INTEGER NOT NULL DEFAULT 0,
    overdue_invoices INTEGER NOT NULL DEFAULT 0,
    average_invoice_value REAL NOT NULL DEFAULT 0.0,
    days_sales_outstanding REAL NOT NULL DEFAULT 0.0,
    monthly_recurring_revenue REAL NOT NULL DEFAULT 0.0,
    annual_recurring_revenue REAL NOT NULL DEFAULT 0.0,
    customer_lifetime_value REAL NOT NULL DEFAULT 0.0,
    customer_acquisition_cost REAL NOT NULL DEFAULT 0.0,
    churn_rate REAL NOT NULL DEFAULT 0.0,
    expansion_revenue REAL NOT NULL DEFAULT 0.0,
    contraction_revenue REAL NOT NULL DEFAULT 0.0,
    ai_forecast_accuracy REAL CHECK (ai_forecast_accuracy >= 0.0 AND ai_forecast_accuracy <= 1.0),
    ai_insights TEXT, -- JSON for AI-generated insights
    ai_recommendations TEXT, -- JSON for AI recommendations
    metadata TEXT NOT NULL DEFAULT '{}', -- JSON for additional metadata
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Foreign key constraint
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,

    -- Constraints
    CONSTRAINT billing_analytics_period_unique UNIQUE (organization_id, period_type, period_start)
);

-- Indexes for billing analytics queries
CREATE INDEX idx_billing_analytics_organization_id ON billing_analytics(organization_id);
CREATE INDEX idx_billing_analytics_period_type ON billing_analytics(period_type);
CREATE INDEX idx_billing_analytics_period_start ON billing_analytics(period_start);

-- Automated billing rules with AI optimization
CREATE TABLE IF NOT EXISTS billing_rules (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('invoice_created', 'payment_received', 'customer_created', 'subscription_created', 'custom')),
    trigger_conditions TEXT NOT NULL DEFAULT '{}', -- JSON for trigger conditions
    actions TEXT NOT NULL DEFAULT '[]', -- JSON array of actions to execute
    is_active BOOLEAN NOT NULL DEFAULT true,
    priority INTEGER NOT NULL DEFAULT 0,
    ai_optimized BOOLEAN NOT NULL DEFAULT false,
    ai_performance_score REAL CHECK (ai_performance_score >= 0.0 AND ai_performance_score <= 1.0),
    ai_recommendations TEXT, -- JSON for AI optimization recommendations
    execution_count INTEGER NOT NULL DEFAULT 0,
    last_executed DATETIME,
    metadata TEXT NOT NULL DEFAULT '{}', -- JSON for additional metadata
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Foreign key constraint
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Indexes for billing rules queries
CREATE INDEX idx_billing_rules_organization_id ON billing_rules(organization_id);
CREATE INDEX idx_billing_rules_trigger_type ON billing_rules(trigger_type);
CREATE INDEX idx_billing_rules_is_active ON billing_rules(is_active);
CREATE INDEX idx_billing_rules_priority ON billing_rules(priority);

-- Triggers for automatic timestamp updates
CREATE TRIGGER IF NOT EXISTS update_customers_updated_at
    AFTER UPDATE ON customers
    FOR EACH ROW
    BEGIN
        UPDATE customers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_products_updated_at
    AFTER UPDATE ON products
    FOR EACH ROW
    BEGIN
        UPDATE products SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_invoices_updated_at
    AFTER UPDATE ON invoices
    FOR EACH ROW
    BEGIN
        UPDATE invoices SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_invoice_items_updated_at
    AFTER UPDATE ON invoice_items
    FOR EACH ROW
    BEGIN
        UPDATE invoice_items SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_payments_updated_at
    AFTER UPDATE ON payments
    FOR EACH ROW
    BEGIN
        UPDATE payments SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_subscriptions_updated_at
    AFTER UPDATE ON subscriptions
    FOR EACH ROW
    BEGIN
        UPDATE subscriptions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_bank_accounts_updated_at
    AFTER UPDATE ON bank_accounts
    FOR EACH ROW
    BEGIN
        UPDATE bank_accounts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_bank_transactions_updated_at
    AFTER UPDATE ON bank_transactions
    FOR EACH ROW
    BEGIN
        UPDATE bank_transactions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_billing_analytics_updated_at
    AFTER UPDATE ON billing_analytics
    FOR EACH ROW
    BEGIN
        UPDATE billing_analytics SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_billing_rules_updated_at
    AFTER UPDATE ON billing_rules
    FOR EACH ROW
    BEGIN
        UPDATE billing_rules SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;