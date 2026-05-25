ALTER TABLE tenant_saml_config
    DROP COLUMN IF EXISTS role_attribute,
    DROP COLUMN IF EXISTS role_map;
