-- Migration 025 — domain verification persistence.
-- BEAT-PLAN Day 25 follow-up: replaces the in-memory MemStore so
-- domain ownership records survive restarts and can power
-- email-domain -> SSO auto-redirect.
--
-- A tenant can register the same domain only once; verification state
-- and expiry travel on the same row.

BEGIN;

CREATE TABLE IF NOT EXISTS tenant_domains (
    id              UUID PRIMARY KEY,
    tenant_id       UUID NOT NULL,
    domain          TEXT NOT NULL,
    token           TEXT NOT NULL,
    method          TEXT NOT NULL,
    status          TEXT NOT NULL,
    verified_at     TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, domain)
);

CREATE INDEX IF NOT EXISTS idx_tenant_domains_tenant ON tenant_domains (tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_domains_domain_verified
    ON tenant_domains (domain) WHERE status = 'verified';

COMMIT;
