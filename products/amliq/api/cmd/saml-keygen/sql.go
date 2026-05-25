package main

import (
	"fmt"
	"strings"
)

// buildSQL emits the INSERT statement that matches migration 070's
// tenant_saml_config schema. Single-quotes are doubled so a stray
// quote inside the IdP cert (vanishingly rare but possible) doesn't
// break the SQL.
func buildSQL(
	tenant, idpEntityID, idpSSOURL, idpCert,
	spEntityID, spACS, keyPEM, certPEM string,
) string {
	return fmt.Sprintf(`-- saml-keygen: per-tenant SAML config for %s
-- Generated SP keypair valid for ~10 years. Rotate proactively.
INSERT INTO tenant_saml_config (
    tenant_id, idp_entity_id, idp_sso_url, idp_x509_cert,
    sp_entity_id, sp_acs_url, sp_key_pem, sp_cert_pem, enabled
) VALUES (
    %s, %s, %s, %s,
    %s, %s, %s, %s, TRUE
);
`,
		tenant,
		sqlQ(tenant), sqlQ(idpEntityID), sqlQ(idpSSOURL), sqlQ(idpCert),
		sqlQ(spEntityID), sqlQ(spACS), sqlQ(keyPEM), sqlQ(certPEM),
	)
}

// sqlQ wraps a value as a single-quoted SQL literal, doubling any
// embedded single quotes per ANSI SQL escaping. Postgres-compatible.
func sqlQ(s string) string {
	return "'" + strings.ReplaceAll(s, "'", "''") + "'"
}
