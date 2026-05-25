-- Per-tenant SAML role mapping. Bank IT pushes back when our
-- handler hardcodes "viewer" as the default role: their IdP already
-- knows whether a user is compliance_officer / supervisor / analyst,
-- and they want that propagated.
--
-- role_attribute is the SAML claim name to read (defaults to "role"
-- in code if NULL). role_map is JSON: { idp_value -> aegis_role }.
-- Empty map = pass through whatever the IdP says. NULL row = use
-- the legacy default of "viewer".

ALTER TABLE tenant_saml_config
    ADD COLUMN IF NOT EXISTS role_attribute TEXT,
    ADD COLUMN IF NOT EXISTS role_map JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN tenant_saml_config.role_attribute IS
    'SAML attribute name carrying the role claim (e.g. "role" or the full XMLSoap URI). NULL = read first non-empty of {role, XMLSoap role URI}.';
COMMENT ON COLUMN tenant_saml_config.role_map IS
    'JSON map of IdP-value -> aegis-role. Empty = passthrough.';
