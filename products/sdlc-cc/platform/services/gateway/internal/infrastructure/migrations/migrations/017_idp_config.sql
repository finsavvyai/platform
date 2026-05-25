-- Per-tenant SSO IdP configuration (SAML + OIDC).
-- Secrets (client_secret_enc, sp_key_enc) are AES-256-GCM encrypted at the
-- application layer before being persisted here.

CREATE TABLE IF NOT EXISTS idp_configs (
    id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- 'saml' or 'oidc'
    protocol        VARCHAR(4)  NOT NULL CHECK (protocol IN ('saml', 'oidc')),

    -- SAML fields (null when protocol = 'oidc')
    idp_entity_id   TEXT,
    sso_url         TEXT,
    idp_cert_pem    TEXT,       -- IdP signing certificate (PEM, plain — public cert)
    sp_entity_id    TEXT,
    acs_url         TEXT,
    metadata_url    TEXT,
    sp_key_enc      TEXT,       -- SP private key, AES-256-GCM encrypted
    sp_cert_pem     TEXT,       -- SP certificate (PEM, plain — public cert)

    -- OIDC fields (null when protocol = 'saml')
    issuer_url      TEXT,
    client_id       TEXT,
    client_secret_enc TEXT,     -- AES-256-GCM encrypted
    redirect_url    TEXT,
    scopes          TEXT[],     -- defaults to {openid, email, profile}

    -- Common
    mfa_required    BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- One IdP config per tenant.
    UNIQUE (tenant_id)
);

-- Keep updated_at current automatically.
CREATE OR REPLACE FUNCTION update_idp_configs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER idp_configs_updated_at
    BEFORE UPDATE ON idp_configs
    FOR EACH ROW EXECUTE FUNCTION update_idp_configs_updated_at();

COMMENT ON TABLE idp_configs IS
    'Per-tenant SSO provider configuration. Day 24 — SAML SSO + OIDC + MFA.';
