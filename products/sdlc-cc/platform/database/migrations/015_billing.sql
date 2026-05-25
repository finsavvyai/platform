-- Migration 015: Billing tables.
-- Version: 1.0.0
-- Description: Monthly invoices, contract-level discount tiers, and
--              per-(provider,model) line items. Backs the billing
--              package added on Phase 2 Day 31.
-- Dependencies: 002_create_core_tables.sql (tenants), 012_spend_events.sql.
-- Rollback: DROP TABLEs in reverse FK order.
-- Note: real Stripe wiring is SCAFFOLD-only in services/gateway/internal/
--       infrastructure/billing/stripe_uploader.go. This schema includes
--       a `stripe_invoice_id` column so when the integration goes live
--       no migration is needed.

BEGIN;

-- ---------------------------------------------------------------------------
-- discount_tiers — volume discount steps per contract.
-- contract_id is intentionally untyped (TEXT not FK) until the
-- contracts table lands; tenants without a contract have no rows here.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS discount_tiers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id         UUID NOT NULL,
    threshold_usd_cents BIGINT NOT NULL CHECK (threshold_usd_cents >= 0),
    discount_pct        INTEGER NOT NULL CHECK (discount_pct BETWEEN 0 AND 100),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (contract_id, threshold_usd_cents)
);

CREATE INDEX IF NOT EXISTS idx_discount_tiers_contract
    ON discount_tiers (contract_id, threshold_usd_cents DESC);

-- ---------------------------------------------------------------------------
-- invoices — one row per (tenant_id, year, month).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID NOT NULL,
    month                SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
    year                 SMALLINT NOT NULL CHECK (year BETWEEN 2020 AND 2100),
    subtotal_usd_cents   BIGINT NOT NULL CHECK (subtotal_usd_cents >= 0),
    discount_usd_cents   BIGINT NOT NULL DEFAULT 0 CHECK (discount_usd_cents >= 0),
    total_usd_cents      BIGINT NOT NULL CHECK (total_usd_cents >= 0),
    status               TEXT NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft','finalized','sent','paid','void')),
    applied_tier_id      UUID NULL REFERENCES discount_tiers(id) ON DELETE SET NULL,
    -- SCAFFOLD(P2-Day31): set when stripe_uploader is wired for real.
    stripe_invoice_id    TEXT NULL,
    generated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    finalized_at         TIMESTAMPTZ NULL,
    UNIQUE (tenant_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_period
    ON invoices (tenant_id, year DESC, month DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_status
    ON invoices (status, generated_at DESC);

-- ---------------------------------------------------------------------------
-- invoice_line_items — one row per (invoice, provider, model).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoice_line_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id          UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    model               TEXT NOT NULL,
    provider            TEXT NOT NULL,
    prompt_tokens       BIGINT NOT NULL DEFAULT 0 CHECK (prompt_tokens >= 0),
    completion_tokens   BIGINT NOT NULL DEFAULT 0 CHECK (completion_tokens >= 0),
    usd_cents           BIGINT NOT NULL CHECK (usd_cents >= 0),
    UNIQUE (invoice_id, provider, model)
);

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice
    ON invoice_line_items (invoice_id);

-- ---------------------------------------------------------------------------
-- Row-level security — invoices are tenant-scoped.
-- discount_tiers are contract-scoped; access goes through the contract,
-- so RLS is not enabled here (admins read it via service role).
-- ---------------------------------------------------------------------------
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invoices_isolation ON invoices;
CREATE POLICY invoices_isolation ON invoices
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invoice_line_items_isolation ON invoice_line_items;
CREATE POLICY invoice_line_items_isolation ON invoice_line_items
    USING (EXISTS (
        SELECT 1 FROM invoices i
        WHERE i.id = invoice_line_items.invoice_id
          AND i.tenant_id = current_setting('app.tenant_id', true)::uuid
    ));

-- Registration
INSERT INTO schema_migrations (version, name, applied_at)
VALUES ('015', 'billing', now())
ON CONFLICT (version) DO NOTHING;

COMMIT;
