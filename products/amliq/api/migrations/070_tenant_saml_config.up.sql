-- Per-tenant SAML SSO configuration. One row per tenant; the
-- enabled flag lets a customer cut SAML over/back without dropping
-- the row + losing their SP keypair.
--
-- Tenant ID type is VARCHAR(20) to match the global tnt_xxxxxxxxxxxx
-- format aegis uses everywhere else (see migrations/001_create_tenants.up.sql).

CREATE TABLE IF NOT EXISTS tenant_saml_config (
    tenant_id          VARCHAR(20) PRIMARY KEY
                       REFERENCES tenants(id) ON DELETE CASCADE,
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
