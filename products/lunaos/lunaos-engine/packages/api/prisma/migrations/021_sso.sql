-- Migration: 021_sso (Phase 3.1 — fixed snake_case + deleted_at)
-- Purpose: Add SSO identity providers (SAML / OIDC) and SSO session tracking.
-- Tables : identity_providers, sso_sessions
-- Compatible with: PostgreSQL and SQLite (Cloudflare D1)
--
-- FIND-001 fix: All columns now use snake_case to match runtime queries
-- (matches existing convention in users, team_members, audit_log, etc.).
-- Adds the missing `deleted_at` column referenced by soft-delete code paths.

-- ----------------------------------------------------------------------------
-- identity_providers
-- One row per SAML/OIDC IdP wired into an organization.
-- Columns prefixed with `oidc_*` are populated only when type = 'oidc'.
-- Columns prefixed with `saml_*` are populated only when type = 'saml'.
-- The OIDC client secret is stored encrypted via secret-vault (v1: prefix).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS identity_providers (
    id                   TEXT     NOT NULL,
    org_id               TEXT     NOT NULL,
    type                 TEXT     NOT NULL,
    name                 TEXT     NOT NULL,
    enabled              INTEGER  NOT NULL DEFAULT 1,
    email_domain         TEXT,
    jit_enabled          INTEGER  NOT NULL DEFAULT 1,
    default_role         TEXT     NOT NULL DEFAULT 'member',

    oidc_issuer          TEXT,
    oidc_client_id       TEXT,
    oidc_client_secret   TEXT,
    oidc_discovery_url   TEXT,
    oidc_scopes          TEXT,

    saml_entity_id       TEXT,
    saml_sso_url         TEXT,
    saml_certificate     TEXT,
    saml_slo_url         TEXT,

    created_at           TEXT     NOT NULL DEFAULT (datetime('now')),
    updated_at           TEXT     NOT NULL DEFAULT (datetime('now')),
    deleted_at           TEXT,

    CONSTRAINT identity_providers_pkey PRIMARY KEY (id)
);

-- One IdP name per org (acts as stable handle for sibling services).
CREATE UNIQUE INDEX IF NOT EXISTS identity_providers_org_id_name_key
    ON identity_providers (org_id, name);

-- Email-domain lookup is the hot path for IdP discovery during login.
CREATE INDEX IF NOT EXISTS identity_providers_email_domain_idx
    ON identity_providers (email_domain);

-- Fast org listing (admin UI) excluding soft-deleted rows.
CREATE INDEX IF NOT EXISTS identity_providers_org_id_idx
    ON identity_providers (org_id);

-- ----------------------------------------------------------------------------
-- sso_sessions
-- Server-side ledger of active SSO sessions.
-- Used for SLO (single-logout) propagation and forced revocation.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sso_sessions (
    id              TEXT     NOT NULL,
    user_id         TEXT     NOT NULL,
    org_id          TEXT     NOT NULL,
    idp_id          TEXT     NOT NULL,
    name_id         TEXT     NOT NULL,
    session_index   TEXT,
    expires_at      TEXT     NOT NULL,
    created_at      TEXT     NOT NULL DEFAULT (datetime('now')),

    CONSTRAINT sso_sessions_pkey PRIMARY KEY (id)
);

-- Lookup all sessions for a user (logout, audit).
CREATE INDEX IF NOT EXISTS sso_sessions_user_id_idx
    ON sso_sessions (user_id);

-- Expiry sweep: cron evicts rows where expires_at < now().
CREATE INDEX IF NOT EXISTS sso_sessions_expires_at_idx
    ON sso_sessions (expires_at);
