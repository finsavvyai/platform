-- DB_PRIMARY Database Schema
-- Contains: billing_us_*, billing_eu_*, intelligence_us_*, intelligence_eu_* tables

-- Billing tables for US region
CREATE TABLE IF NOT EXISTS billing_us_customers (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    billing_address TEXT, -- JSON
    shipping_address TEXT, -- JSON
    tax_id TEXT,
    payment_methods TEXT, -- JSON array
    metadata TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,

    -- Indexes
    INDEX idx_billing_us_customers_org (organization_id),
    INDEX idx_billing_us_customers_email (email),
    INDEX idx_billing_us_customers_active (is_active)
);

CREATE TABLE IF NOT EXISTS billing_us_invoices (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    invoice_number TEXT NOT NULL UNIQUE,
    po_number TEXT,
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    status TEXT CHECK(status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled', 'refunded')) DEFAULT 'draft',
    currency TEXT NOT NULL DEFAULT 'USD',
    subtotal_cents INTEGER NOT NULL DEFAULT 0,
    tax_cents INTEGER NOT NULL DEFAULT 0,
    total_cents INTEGER NOT NULL DEFAULT 0,
    paid_cents INTEGER NOT NULL DEFAULT 0,
    remaining_cents INTEGER GENERATED ALWAYS AS (total_cents - paid_cents) STORED,
    notes TEXT,
    terms TEXT,
    metadata TEXT, -- JSON
    pdf_url TEXT, -- R2 URL
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sent_at DATETIME,
    paid_at DATETIME,

    -- Foreign keys
    FOREIGN KEY (customer_id) REFERENCES billing_us_customers(id) ON DELETE CASCADE,

    -- Indexes
    INDEX idx_billing_us_invoices_org (organization_id),
    INDEX idx_billing_us_invoices_customer (customer_id),
    INDEX idx_billing_us_invoices_status (status),
    INDEX idx_billing_us_invoices_due (due_date),
    INDEX idx_billing_us_invoices_number (invoice_number)
);

CREATE TABLE IF NOT EXISTS billing_us_invoice_items (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL,
    description TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price_cents INTEGER NOT NULL,
    total_cents INTEGER GENERATED ALWAYS AS (quantity * unit_price_cents) STORED,
    tax_rate REAL DEFAULT 0,
    tax_cents INTEGER GENERATED ALWAYS AS (ROUND(quantity * unit_price_cents * tax_rate / 100)) STORED,
    product_code TEXT,
    metadata TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Foreign keys
    FOREIGN KEY (invoice_id) REFERENCES billing_us_invoices(id) ON DELETE CASCADE,

    -- Indexes
    INDEX idx_billing_us_items_invoice (invoice_id),
    INDEX idx_billing_us_items_product (product_code)
);

CREATE TABLE IF NOT EXISTS billing_us_payments (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    invoice_id TEXT,
    customer_id TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    status TEXT CHECK(status IN ('pending', 'processing', 'completed', 'failed', 'refunded', 'partially_refunded')) DEFAULT 'pending',
    payment_method TEXT NOT NULL, -- 'card', 'bank_transfer', 'sepa', etc.
    payment_method_details TEXT, -- JSON
    psp_transaction_id TEXT, -- Payment Service Provider transaction ID
    psp_name TEXT NOT NULL, -- 'stripe', 'lemon_squeezy', 'paypal'
    failure_reason TEXT,
    refund_reason TEXT,
    metadata TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME,

    -- Foreign keys
    FOREIGN KEY (invoice_id) REFERENCES billing_us_invoices(id),
    FOREIGN KEY (customer_id) REFERENCES billing_us_customers(id) ON DELETE CASCADE,

    -- Indexes
    INDEX idx_billing_us_payments_org (organization_id),
    INDEX idx_billing_us_payments_invoice (invoice_id),
    INDEX idx_billing_us_payments_customer (customer_id),
    INDEX idx_billing_us_payments_status (status),
    INDEX idx_billing_us_payments_psp (psp_name, psp_transaction_id)
);

-- Billing tables for EU region (same structure, different prefix)
CREATE TABLE IF NOT EXISTS billing_eu_customers (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    billing_address TEXT, -- JSON
    shipping_address TEXT, -- JSON
    tax_id TEXT,
    vat_number TEXT,
    payment_methods TEXT, -- JSON array
    metadata TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,

    -- Indexes
    INDEX idx_billing_eu_customers_org (organization_id),
    INDEX idx_billing_eu_customers_email (email),
    INDEX idx_billing_eu_customers_active (is_active)
);

CREATE TABLE IF NOT EXISTS billing_eu_invoices (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    invoice_number TEXT NOT NULL UNIQUE,
    po_number TEXT,
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    status TEXT CHECK(status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled', 'refunded')) DEFAULT 'draft',
    currency TEXT NOT NULL DEFAULT 'EUR',
    subtotal_cents INTEGER NOT NULL DEFAULT 0,
    tax_cents INTEGER NOT NULL DEFAULT 0,
    total_cents INTEGER NOT NULL DEFAULT 0,
    paid_cents INTEGER NOT NULL DEFAULT 0,
    remaining_cents INTEGER GENERATED ALWAYS AS (total_cents - paid_cents) STORED,
    vat_rate REAL DEFAULT 0,
    notes TEXT,
    terms TEXT,
    metadata TEXT, -- JSON
    pdf_url TEXT, -- R2 URL
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sent_at DATETIME,
    paid_at DATETIME,

    -- Foreign keys
    FOREIGN KEY (customer_id) REFERENCES billing_eu_customers(id) ON DELETE CASCADE,

    -- Indexes
    INDEX idx_billing_eu_invoices_org (organization_id),
    INDEX idx_billing_eu_invoices_customer (customer_id),
    INDEX idx_billing_eu_invoices_status (status),
    INDEX idx_billing_eu_invoices_due (due_date),
    INDEX idx_billing_eu_invoices_number (invoice_number)
);

CREATE TABLE IF NOT EXISTS billing_eu_invoice_items (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL,
    description TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price_cents INTEGER NOT NULL,
    total_cents INTEGER GENERATED ALWAYS AS (quantity * unit_price_cents) STORED,
    vat_rate REAL DEFAULT 0,
    vat_cents INTEGER GENERATED ALWAYS AS (ROUND(quantity * unit_price_cents * vat_rate / 100)) STORED,
    product_code TEXT,
    metadata TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Foreign keys
    FOREIGN KEY (invoice_id) REFERENCES billing_eu_invoices(id) ON DELETE CASCADE,

    -- Indexes
    INDEX idx_billing_eu_items_invoice (invoice_id),
    INDEX idx_billing_eu_items_product (product_code)
);

CREATE TABLE IF NOT EXISTS billing_eu_payments (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    invoice_id TEXT,
    customer_id TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'EUR',
    status TEXT CHECK(status IN ('pending', 'processing', 'completed', 'failed', 'refunded', 'partially_refunded')) DEFAULT 'pending',
    payment_method TEXT NOT NULL,
    payment_method_details TEXT, -- JSON
    psp_transaction_id TEXT,
    psp_name TEXT NOT NULL,
    failure_reason TEXT,
    refund_reason TEXT,
    metadata TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME,

    -- Foreign keys
    FOREIGN KEY (invoice_id) REFERENCES billing_eu_invoices(id),
    FOREIGN KEY (customer_id) REFERENCES billing_eu_customers(id) ON DELETE CASCADE,

    -- Indexes
    INDEX idx_billing_eu_payments_org (organization_id),
    INDEX idx_billing_eu_payments_invoice (invoice_id),
    INDEX idx_billing_eu_payments_customer (customer_id),
    INDEX idx_billing_eu_payments_status (status),
    INDEX idx_billing_eu_payments_psp (psp_name, psp_transaction_id)
);

-- Intelligence tables for US region
CREATE TABLE IF NOT EXISTS intelligence_us_transactions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    date DATE NOT NULL,
    description TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    balance_cents INTEGER,
    category TEXT,
    subcategory TEXT,
    tags TEXT, -- JSON array
    metadata TEXT, -- JSON
    imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Indexes
    INDEX idx_intelligence_us_transactions_org (organization_id),
    INDEX idx_intelligence_us_transactions_account (account_id),
    INDEX idx_intelligence_us_transactions_date (date),
    INDEX idx_intelligence_us_transactions_category (category),
    INDEX idx_intelligence_us_transactions_amount (amount_cents)
);

CREATE TABLE IF NOT EXISTS intelligence_us_accounts (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT CHECK(type IN ('checking', 'savings', 'credit_card', 'investment', 'loan', 'other')) NOT NULL,
    institution_name TEXT,
    last_sync DATETIME,
    balance_cents INTEGER DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',
    is_active BOOLEAN DEFAULT true,
    metadata TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Indexes
    INDEX idx_intelligence_us_accounts_org (organization_id),
    INDEX idx_intelligence_us_accounts_type (type),
    INDEX idx_intelligence_us_accounts_active (is_active)
);

CREATE TABLE IF NOT EXISTS intelligence_us_forecasts (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    account_id TEXT,
    forecast_type TEXT CHECK(forecast_type IN ('cash_flow', 'revenue', 'expenses', 'profit')) NOT NULL,
    model_version TEXT NOT NULL,
    forecast_date DATE NOT NULL,
    predicted_value_cents INTEGER NOT NULL,
    confidence_lower_cents INTEGER,
    confidence_upper_cents INTEGER,
    confidence_score REAL CHECK(confidence_score >= 0 AND confidence_score <= 1),
    actual_value_cents,
    accuracy_score REAL,
    metadata TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Foreign keys
    FOREIGN KEY (account_id) REFERENCES intelligence_us_accounts(id) ON DELETE SET NULL,

    -- Indexes
    INDEX idx_intelligence_us_forecasts_org (organization_id),
    INDEX idx_intelligence_us_forecasts_account (account_id),
    INDEX idx_intelligence_us_forecasts_type (forecast_type),
    INDEX idx_intelligence_us_forecasts_date (forecast_date)
);

-- Intelligence tables for EU region
CREATE TABLE IF NOT EXISTS intelligence_eu_transactions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    date DATE NOT NULL,
    description TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'EUR',
    balance_cents INTEGER,
    category TEXT,
    subcategory TEXT,
    tags TEXT, -- JSON array
    metadata TEXT, -- JSON
    imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Indexes
    INDEX idx_intelligence_eu_transactions_org (organization_id),
    INDEX idx_intelligence_eu_transactions_account (account_id),
    INDEX idx_intelligence_eu_transactions_date (date),
    INDEX idx_intelligence_eu_transactions_category (category),
    INDEX idx_intelligence_eu_transactions_amount (amount_cents)
);

CREATE TABLE IF NOT EXISTS intelligence_eu_accounts (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT CHECK(type IN ('checking', 'savings', 'credit_card', 'investment', 'loan', 'other')) NOT NULL,
    institution_name TEXT,
    last_sync DATETIME,
    balance_cents INTEGER DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'EUR',
    is_active BOOLEAN DEFAULT true,
    metadata TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Indexes
    INDEX idx_intelligence_eu_accounts_org (organization_id),
    INDEX idx_intelligence_eu_accounts_type (type),
    INDEX idx_intelligence_eu_accounts_active (is_active)
);

CREATE TABLE IF NOT EXISTS intelligence_eu_forecasts (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    account_id TEXT,
    forecast_type TEXT CHECK(forecast_type IN ('cash_flow', 'revenue', 'expenses', 'profit')) NOT NULL,
    model_version TEXT NOT NULL,
    forecast_date DATE NOT NULL,
    predicted_value_cents INTEGER NOT NULL,
    confidence_lower_cents INTEGER,
    confidence_upper_cents INTEGER,
    confidence_score REAL CHECK(confidence_score >= 0 AND confidence_score <= 1),
    actual_value_cents,
    accuracy_score REAL,
    metadata TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Foreign keys
    FOREIGN KEY (account_id) REFERENCES intelligence_eu_accounts(id) ON DELETE SET NULL,

    -- Indexes
    INDEX idx_intelligence_eu_forecasts_org (organization_id),
    INDEX idx_intelligence_eu_forecasts_account (account_id),
    INDEX idx_intelligence_eu_forecasts_type (forecast_type),
    INDEX idx_intelligence_eu_forecasts_date (forecast_date)
);

-- Ledger tables (shared across regions)
CREATE TABLE IF NOT EXISTS ledger_entries (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    region TEXT CHECK(region IN ('US', 'EU')) NOT NULL,
    account_id TEXT NOT NULL,
    transaction_id TEXT,
    entry_type TEXT CHECK(entry_type IN ('debit', 'credit')) NOT NULL,
    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL,
    description TEXT NOT NULL,
    reference_type TEXT, -- 'invoice', 'payment', 'expense', etc.
    reference_id TEXT,
    balance_after_cents INTEGER,
    metadata TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Indexes
    INDEX idx_ledger_entries_org (organization_id),
    INDEX idx_ledger_entries_region (region),
    INDEX idx_ledger_entries_account (account_id),
    INDEX idx_ledger_entries_transaction (transaction_id),
    INDEX idx_ledger_entries_created (created_at),
    UNIQUE INDEX idx_ledger_entries_unique (organization_id, region, account_id, transaction_id, reference_type, reference_id)
);
