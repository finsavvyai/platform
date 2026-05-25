-- Consolidated FinTech Schema - Simple Version (No Foreign Keys)
-- This version removes foreign key constraints to avoid migration issues
-- Data integrity will be handled at the application level

-- ============================================================================
-- SHARED/UTILITY TABLES
-- ============================================================================

-- Organizations (multi-tenant)
CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    plan TEXT DEFAULT 'starter',
    settings TEXT,
    billing_info TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT CHECK(status IN ('active', 'suspended', 'cancelled')) DEFAULT 'active'
);

-- API Keys
CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    permissions TEXT,
    last_used_at DATETIME,
    expires_at DATETIME,
    is_active BOOLEAN DEFAULT true,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT
);

-- ============================================================================
-- BILLING MODULE TABLES - US REGION
-- ============================================================================

CREATE TABLE IF NOT EXISTS billing_us_customers (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    billing_address TEXT,
    tax_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT,
    region TEXT DEFAULT 'US'
);

CREATE TABLE IF NOT EXISTS billing_us_invoices (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    invoice_number TEXT NOT NULL UNIQUE,
    amount_cents INTEGER NOT NULL,
    currency TEXT DEFAULT 'USD',
    status TEXT CHECK(status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')) DEFAULT 'draft',
    due_date DATETIME,
    paid_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    items TEXT,
    tax_amount_cents INTEGER DEFAULT 0,
    total_amount_cents INTEGER NOT NULL,
    notes TEXT,
    metadata TEXT,
    region TEXT DEFAULT 'US'
);

CREATE TABLE IF NOT EXISTS billing_us_payments (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    invoice_id TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    currency TEXT DEFAULT 'USD',
    status TEXT CHECK(status IN ('pending', 'processing', 'completed', 'failed', 'refunded')) DEFAULT 'pending',
    payment_method TEXT NOT NULL,
    transaction_id TEXT,
    gateway_response TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT,
    region TEXT DEFAULT 'US'
);

-- ============================================================================
-- BILLING MODULE TABLES - EU REGION
-- ============================================================================

CREATE TABLE IF NOT EXISTS billing_eu_customers (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    billing_address TEXT,
    tax_id TEXT,
    vat_number TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT,
    region TEXT DEFAULT 'EU'
);

CREATE TABLE IF NOT EXISTS billing_eu_invoices (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    invoice_number TEXT NOT NULL UNIQUE,
    amount_cents INTEGER NOT NULL,
    currency TEXT DEFAULT 'EUR',
    status TEXT CHECK(status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')) DEFAULT 'draft',
    due_date DATETIME,
    paid_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    items TEXT,
    tax_amount_cents INTEGER DEFAULT 0,
    vat_amount_cents INTEGER DEFAULT 0,
    total_amount_cents INTEGER NOT NULL,
    notes TEXT,
    metadata TEXT,
    region TEXT DEFAULT 'EU'
);

CREATE TABLE IF NOT EXISTS billing_eu_payments (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    invoice_id TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    currency TEXT DEFAULT 'EUR',
    status TEXT CHECK(status IN ('pending', 'processing', 'completed', 'failed', 'refunded')) DEFAULT 'pending',
    payment_method TEXT NOT NULL,
    transaction_id TEXT,
    sepa_mandate_id TEXT,
    gateway_response TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT,
    region TEXT DEFAULT 'EU'
);

-- ============================================================================
-- INTELLIGENCE MODULE TABLES - US REGION
-- ============================================================================

CREATE TABLE IF NOT EXISTS intelligence_us_accounts (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    account_number TEXT,
    account_type TEXT NOT NULL,
    balance_cents INTEGER DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    status TEXT CHECK(status IN ('active', 'inactive', 'frozen', 'closed')) DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT,
    region TEXT DEFAULT 'US'
);

CREATE TABLE IF NOT EXISTS intelligence_us_transactions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    currency TEXT DEFAULT 'USD',
    transaction_type TEXT CHECK(transaction_type IN ('credit', 'debit', 'transfer')) NOT NULL,
    description TEXT,
    category TEXT,
    subcategory TEXT,
    tags TEXT,
    counterparty TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT,
    region TEXT DEFAULT 'US'
);

CREATE TABLE IF NOT EXISTS intelligence_us_analyses (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    account_id TEXT,
    transaction_id TEXT,
    analysis_type TEXT NOT NULL,
    results TEXT NOT NULL,
    confidence_score REAL DEFAULT 0.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT,
    region TEXT DEFAULT 'US'
);

-- ============================================================================
-- INTELLIGENCE MODULE TABLES - EU REGION
-- ============================================================================

CREATE TABLE IF NOT EXISTS intelligence_eu_accounts (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    account_number TEXT,
    account_type TEXT NOT NULL,
    balance_cents INTEGER DEFAULT 0,
    currency TEXT DEFAULT 'EUR',
    status TEXT CHECK(status IN ('active', 'inactive', 'frozen', 'closed')) DEFAULT 'active',
    iban TEXT,
    bic TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT,
    region TEXT DEFAULT 'EU'
);

CREATE TABLE IF NOT EXISTS intelligence_eu_transactions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    currency TEXT DEFAULT 'EUR',
    transaction_type TEXT CHECK(transaction_type IN ('credit', 'debit', 'transfer')) NOT NULL,
    description TEXT,
    category TEXT,
    subcategory TEXT,
    tags TEXT,
    counterparty TEXT,
    sepa_end_to_end_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT,
    region TEXT DEFAULT 'EU'
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Organizations and shared tables
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_api_keys_org_id ON api_keys(organization_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);

-- Billing US indexes
CREATE INDEX IF NOT EXISTS idx_billing_us_customers_org_id ON billing_us_customers(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_us_customers_email ON billing_us_customers(email);
CREATE INDEX IF NOT EXISTS idx_billing_us_invoices_org_id ON billing_us_invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_us_invoices_customer_id ON billing_us_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_billing_us_invoices_status ON billing_us_invoices(status);
CREATE INDEX IF NOT EXISTS idx_billing_us_payments_org_id ON billing_us_payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_us_payments_invoice_id ON billing_us_payments(invoice_id);

-- Billing EU indexes
CREATE INDEX IF NOT EXISTS idx_billing_eu_customers_org_id ON billing_eu_customers(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_eu_customers_email ON billing_eu_customers(email);
CREATE INDEX IF NOT EXISTS idx_billing_eu_invoices_org_id ON billing_eu_invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_eu_invoices_customer_id ON billing_eu_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_billing_eu_invoices_status ON billing_eu_invoices(status);
CREATE INDEX IF NOT EXISTS idx_billing_eu_payments_org_id ON billing_eu_payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_eu_payments_invoice_id ON billing_eu_payments(invoice_id);

-- Intelligence US indexes
CREATE INDEX IF NOT EXISTS idx_intelligence_us_accounts_org_id ON intelligence_us_accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_intelligence_us_transactions_org_id ON intelligence_us_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_intelligence_us_transactions_account_id ON intelligence_us_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_intelligence_us_transactions_created_at ON intelligence_us_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_intelligence_us_transactions_category ON intelligence_us_transactions(category);
CREATE INDEX IF NOT EXISTS idx_intelligence_us_analyses_org_id ON intelligence_us_analyses(organization_id);

-- Intelligence EU indexes
CREATE INDEX IF NOT EXISTS idx_intelligence_eu_accounts_org_id ON intelligence_eu_accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_intelligence_eu_transactions_org_id ON intelligence_eu_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_intelligence_eu_transactions_account_id ON intelligence_eu_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_intelligence_eu_transactions_created_at ON intelligence_eu_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_intelligence_eu_transactions_category ON intelligence_eu_transactions(category);
CREATE INDEX IF NOT EXISTS idx_intelligence_eu_analyses_org_id ON intelligence_eu_analyses(organization_id);