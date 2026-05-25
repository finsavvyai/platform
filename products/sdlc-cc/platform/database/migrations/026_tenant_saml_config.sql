-- Migration 026 — per-tenant SAML configuration.
-- BEAT-PLAN Day 24 follow-up: backs the SAMLProvider per-tenant
-- metadata loader and the /sso/{tenant_id}/login + /acs ACS routes.
--
-- Each tenant brings their own IdP metadata (URL or inline XML), a
-- preferred SSO start URL, and the SP keypair the gateway uses to
-- sign auth requests + validate the IdP response.

BEGIN;

CREATE TABLE IF NOT EXISTS tenant_saml_config (
    tenant_id          UUID PRIMARY KEY,
    idp_entity_id      TEXT NOT NULL,
    idp_sso_url        TEXT NOT NULL,
    idp_metadata_xml   TEXT NOT NULL DEFAULT '',
    idp_x509_cert      TEXT NOT NULL,
    sp_entity_id       TEXT NOT NULL,
    sp_acs_url         TEXT NOT NULL,
    sp_key_pem         TEXT NOT NULL,
    sp_cert_pem        TEXT NOT NULL,
    enabled            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_saml_config_enabled
    ON tenant_saml_config (tenant_id) WHERE enabled = TRUE;

COMMIT;
