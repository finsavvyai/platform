-- Consolidated FinTech Schema - Multi-tenant Architecture
-- This schema uses table prefixes to support multiple services and regions
-- in fewer databases by using naming conventions instead of separate databases

-- ============================================================================
-- BILLING MODULE TABLES
-- ============================================================================

-- Billing - US Region
CREATE TABLE billing_us_customers (
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
    metadata TEXT, -- JSON for additional fields
    region TEXT DEFAULT 'US'
);

CREATE TABLE billing_us_invoices (
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
    items TEXT, -- JSON array of invoice items
    tax_amount_cents INTEGER DEFAULT 0,
    total_amount_cents INTEGER NOT NULL,
    notes TEXT,
    metadata TEXT,
    region TEXT DEFAULT 'US',
    FOREIGN KEY (customer_id) REFERENCES billing_us_customers(id)
);

CREATE TABLE billing_us_payments (
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
    region TEXT DEFAULT 'US',
    FOREIGN KEY (invoice_id) REFERENCES billing_us_invoices(id)
);

-- Billing - EU Region (same structure, different prefix)
CREATE TABLE billing_eu_customers (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    billing_address TEXT,
    tax_id TEXT,
    vat_number TEXT, -- EU specific
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT,
    region TEXT DEFAULT 'EU'
);

CREATE TABLE billing_eu_invoices (
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
    vat_amount_cents INTEGER DEFAULT 0, -- EU specific
    total_amount_cents INTEGER NOT NULL,
    notes TEXT,
    metadata TEXT,
    region TEXT DEFAULT 'EU',
    FOREIGN KEY (customer_id) REFERENCES billing_eu_customers(id)
);

CREATE TABLE billing_eu_payments (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    invoice_id TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    currency TEXT DEFAULT 'EUR',
    status TEXT CHECK(status IN ('pending', 'processing', 'completed', 'failed', 'refunded')) DEFAULT 'pending',
    payment_method TEXT NOT NULL,
    transaction_id TEXT,
    sepa_mandate_id TEXT, -- EU specific
    gateway_response TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT,
    region TEXT DEFAULT 'EU',
    FOREIGN KEY (invoice_id) REFERENCES billing_eu_invoices(id)
);

-- ============================================================================
-- COMPLIANCE MODULE TABLES
-- ============================================================================

-- Compliance - US Region
CREATE TABLE compliance_us_customers (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    verification_status TEXT CHECK(verification_status IN ('pending', 'verified', 'rejected', 'review_required')) DEFAULT 'pending',
    kyc_level INTEGER DEFAULT 1,
    risk_score INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    verified_at DATETIME,
    documents TEXT, -- JSON array of document references
    metadata TEXT,
    region TEXT DEFAULT 'US'
);

CREATE TABLE compliance_us_checks (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    check_type TEXT NOT NULL, -- 'sanctions', 'pep', 'kyc', 'aml', etc.
    status TEXT CHECK(status IN ('pending', 'passed', 'failed', 'review_required')) DEFAULT 'pending',
    provider TEXT NOT NULL, -- 'complyadvantage', 'opensanctions', etc.
    request_data TEXT,
    response_data TEXT,
    risk_score INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT,
    region TEXT DEFAULT 'US',
    FOREIGN KEY (customer_id) REFERENCES compliance_us_customers(id)
);

CREATE TABLE compliance_us_reports (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    report_type TEXT NOT NULL,
    content TEXT NOT NULL,
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'active',
    metadata TEXT,
    region TEXT DEFAULT 'US',
    FOREIGN KEY (customer_id) REFERENCES compliance_us_customers(id)
);

-- Compliance - EU Region (same structure, different prefix)
CREATE TABLE compliance_eu_customers (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    verification_status TEXT CHECK(verification_status IN ('pending', 'verified', 'rejected', 'review_required')) DEFAULT 'pending',
    kyc_level INTEGER DEFAULT 1,
    risk_score INTEGER DEFAULT 0,
    gdpr_compliant BOOLEAN DEFAULT false,
    data_processing_consent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    verified_at DATETIME,
    documents TEXT,
    metadata TEXT,
    region TEXT DEFAULT 'EU'
);

CREATE TABLE compliance_eu_checks (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    check_type TEXT NOT NULL,
    status TEXT CHECK(status IN ('pending', 'passed', 'failed', 'review_required')) DEFAULT 'pending',
    provider TEXT NOT NULL,
    request_data TEXT,
    response_data TEXT,
    risk_score INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT,
    region TEXT DEFAULT 'EU',
    FOREIGN KEY (customer_id) REFERENCES compliance_eu_customers(id)
);

-- ============================================================================
-- INTELLIGENCE MODULE TABLES
-- ============================================================================

-- Intelligence - US Region
CREATE TABLE intelligence_us_accounts (
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

CREATE TABLE intelligence_us_transactions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    currency TEXT DEFAULT 'USD',
    transaction_type TEXT CHECK(transaction_type IN ('credit', 'debit', 'transfer')) NOT NULL,
    description TEXT,
    category TEXT, -- AI-categorized
    subcategory TEXT,
    tags TEXT, -- JSON array
    counterparty TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT,
    region TEXT DEFAULT 'US',
    FOREIGN KEY (account_id) REFERENCES intelligence_us_accounts(id)
);

CREATE TABLE intelligence_us_analyses (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    account_id TEXT,
    transaction_id TEXT,
    analysis_type TEXT NOT NULL, -- 'cash_flow', 'spending_pattern', 'risk_assessment', etc.
    results TEXT NOT NULL, -- JSON with analysis results
    confidence_score REAL DEFAULT 0.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT,
    region TEXT DEFAULT 'US',
    FOREIGN KEY (account_id) REFERENCES intelligence_us_accounts(id),
    FOREIGN KEY (transaction_id) REFERENCES intelligence_us_transactions(id)
);

-- Intelligence - EU Region (same structure, different prefix)
CREATE TABLE intelligence_eu_accounts (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    account_number TEXT,
    account_type TEXT NOT NULL,
    balance_cents INTEGER DEFAULT 0,
    currency TEXT DEFAULT 'EUR',
    status TEXT CHECK(status IN ('active', 'inactive', 'frozen', 'closed')) DEFAULT 'active',
    iban TEXT, -- EU specific
    bic TEXT, -- EU specific
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT,
    region TEXT DEFAULT 'EU'
);

CREATE TABLE intelligence_eu_transactions (
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
    sepa_end_to_end_id TEXT, -- EU specific
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT,
    region TEXT DEFAULT 'EU',
    FOREIGN KEY (account_id) REFERENCES intelligence_eu_accounts(id)
);

-- ============================================================================
-- RISK MODULE TABLES
-- ============================================================================

-- Risk - Using single database for both regions with region column
CREATE TABLE risk_assessments (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    transaction_id TEXT,
    risk_score INTEGER NOT NULL CHECK(risk_score >= 0 AND risk_score <= 100),
    risk_level TEXT CHECK(risk_level IN ('low', 'medium', 'high', 'critical')) NOT NULL,
    factors TEXT, -- JSON array of risk factors
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME,
    reviewer_id TEXT,
    status TEXT CHECK(status IN ('active', 'reviewed', 'mitigated')) DEFAULT 'active',
    metadata TEXT,
    region TEXT NOT NULL, -- 'US' or 'EU'
    FOREIGN KEY (transaction_id) REFERENCES intelligence_us_transactions(id) -- Can reference either region
);

CREATE TABLE risk_rules (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    rule_name TEXT NOT NULL,
    rule_type TEXT NOT NULL, -- 'transaction', 'customer', 'behavioral'
    conditions TEXT NOT NULL, -- JSON with rule conditions
    action TEXT NOT NULL, -- 'flag', 'block', 'review'
    risk_weight INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT,
    regions TEXT, -- JSON array of regions this applies to
    version INTEGER DEFAULT 1
);

CREATE TABLE risk_alerts (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    assessment_id TEXT NOT NULL,
    alert_type TEXT NOT NULL,
    severity TEXT CHECK(severity IN ('low', 'medium', 'high', 'critical')) NOT NULL,
    message TEXT NOT NULL,
    status TEXT CHECK(status IN ('open', 'investigating', 'resolved', 'false_positive')) DEFAULT 'open',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    resolved_by TEXT,
    metadata TEXT,
    region TEXT NOT NULL,
    FOREIGN KEY (assessment_id) REFERENCES risk_assessments(id)
);

-- ============================================================================
-- SHARED/UTILITY TABLES
-- ============================================================================

-- Organizations (multi-tenant)
CREATE TABLE organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    plan TEXT DEFAULT 'starter',
    settings TEXT, -- JSON with organization settings
    billing_info TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT CHECK(status IN ('active', 'suspended', 'cancelled')) DEFAULT 'active'
);

-- Audit Logs (immutable)
CREATE TABLE audit_logs (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id TEXT,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    old_values TEXT, -- JSON
    new_values TEXT, -- JSON
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT,
    region TEXT,
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

-- API Keys
CREATE TABLE api_keys (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    permissions TEXT, -- JSON array of permissions
    last_used_at DATETIME,
    expires_at DATETIME,
    is_active BOOLEAN DEFAULT true,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT,
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Billing indexes
CREATE INDEX idx_billing_us_customers_org_id ON billing_us_customers(organization_id);
CREATE INDEX idx_billing_us_customers_email ON billing_us_customers(email);
CREATE INDEX idx_billing_us_invoices_org_id ON billing_us_invoices(organization_id);
CREATE INDEX idx_billing_us_invoices_customer_id ON billing_us_invoices(customer_id);
CREATE INDEX idx_billing_us_invoices_status ON billing_us_invoices(status);
CREATE INDEX idx_billing_us_payments_org_id ON billing_us_payments(organization_id);
CREATE INDEX idx_billing_us_payments_invoice_id ON billing_us_payments(invoice_id);

CREATE INDEX idx_billing_eu_customers_org_id ON billing_eu_customers(organization_id);
CREATE INDEX idx_billing_eu_customers_email ON billing_eu_customers(email);
CREATE INDEX idx_billing_eu_invoices_org_id ON billing_eu_invoices(organization_id);
CREATE INDEX idx_billing_eu_invoices_customer_id ON billing_eu_invoices(customer_id);
CREATE INDEX idx_billing_eu_invoices_status ON billing_eu_invoices(status);
CREATE INDEX idx_billing_eu_payments_org_id ON billing_eu_payments(organization_id);
CREATE INDEX idx_billing_eu_payments_invoice_id ON billing_eu_payments(invoice_id);

-- Compliance indexes
CREATE INDEX idx_compliance_us_customers_org_id ON compliance_us_customers(organization_id);
CREATE INDEX idx_compliance_us_customers_customer_id ON compliance_us_customers(customer_id);
CREATE INDEX idx_compliance_us_customers_status ON compliance_us_customers(verification_status);
CREATE INDEX idx_compliance_us_checks_org_id ON compliance_us_checks(organization_id);
CREATE INDEX idx_compliance_us_checks_customer_id ON compliance_us_checks(customer_id);
CREATE INDEX idx_compliance_us_checks_type ON compliance_us_checks(check_type);

CREATE INDEX idx_compliance_eu_customers_org_id ON compliance_eu_customers(organization_id);
CREATE INDEX idx_compliance_eu_customers_customer_id ON compliance_eu_customers(customer_id);
CREATE INDEX idx_compliance_eu_customers_status ON compliance_eu_customers(verification_status);
CREATE INDEX idx_compliance_eu_checks_org_id ON compliance_eu_checks(organization_id);
CREATE INDEX idx_compliance_eu_checks_customer_id ON compliance_eu_checks(customer_id);
CREATE INDEX idx_compliance_eu_checks_type ON compliance_eu_checks(check_type);

-- Intelligence indexes
CREATE INDEX idx_intelligence_us_accounts_org_id ON intelligence_us_accounts(organization_id);
CREATE INDEX idx_intelligence_us_transactions_org_id ON intelligence_us_transactions(organization_id);
CREATE INDEX idx_intelligence_us_transactions_account_id ON intelligence_us_transactions(account_id);
CREATE INDEX idx_intelligence_us_transactions_created_at ON intelligence_us_transactions(created_at);
CREATE INDEX idx_intelligence_us_transactions_category ON intelligence_us_transactions(category);
CREATE INDEX idx_intelligence_us_analyses_org_id ON intelligence_us_analyses(organization_id);

CREATE INDEX idx_intelligence_eu_accounts_org_id ON intelligence_eu_accounts(organization_id);
CREATE INDEX idx_intelligence_eu_transactions_org_id ON intelligence_eu_transactions(organization_id);
CREATE INDEX idx_intelligence_eu_transactions_account_id ON intelligence_eu_transactions(account_id);
CREATE INDEX idx_intelligence_eu_transactions_created_at ON intelligence_eu_transactions(created_at);
CREATE INDEX idx_intelligence_eu_transactions_category ON intelligence_eu_transactions(category);
CREATE INDEX idx_intelligence_eu_analyses_org_id ON intelligence_eu_analyses(organization_id);

-- Risk indexes
CREATE INDEX idx_risk_assessments_org_id ON risk_assessments(organization_id);
CREATE INDEX idx_risk_assessments_customer_id ON risk_assessments(customer_id);
CREATE INDEX idx_risk_assessments_risk_score ON risk_assessments(risk_score);
CREATE INDEX idx_risk_assessments_region ON risk_assessments(region);
CREATE INDEX idx_risk_alerts_org_id ON risk_alerts(organization_id);
CREATE INDEX idx_risk_alerts_assessment_id ON risk_alerts(assessment_id);
CREATE INDEX idx_risk_alerts_status ON risk_alerts(status);
CREATE INDEX idx_risk_alerts_severity ON risk_alerts(severity);

-- Shared indexes
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_audit_logs_org_id ON audit_logs(organization_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_api_keys_org_id ON api_keys(organization_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);