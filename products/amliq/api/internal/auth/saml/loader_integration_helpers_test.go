package saml

import (
	"database/sql"
	"testing"
)

// mustInsertTenant adds a tenants_t row so the FK on tenant_saml_config
// has somewhere to point. Test-only.
func mustInsertTenant(t *testing.T, db *sql.DB, tenantID string) {
	t.Helper()
	if _, err := db.Exec(
		`INSERT INTO tenants_t (id) VALUES ($1)`, tenantID,
	); err != nil {
		t.Fatalf("seed tenant: %v", err)
	}
}

// mustInsertSAMLWithRoleMap is the role-aware variant. Pass nil
// roleMap to keep the legacy default behaviour.
func mustInsertSAMLWithRoleMap(t *testing.T, db *sql.DB, tenantID string, roleAttr, roleMapJSON string) {
	t.Helper()
	keyPEM, certPEM, err := GenerateSPKeypair(
		"https://aegis.cc/sso/" + tenantID + "/metadata")
	if err != nil {
		t.Fatalf("keygen: %v", err)
	}
	if roleMapJSON == "" {
		roleMapJSON = "{}"
	}
	_, err = db.Exec(`INSERT INTO tenant_saml_config (
		tenant_id, idp_entity_id, idp_sso_url, idp_x509_cert,
		sp_entity_id, sp_acs_url, sp_key_pem, sp_cert_pem, enabled,
		role_attribute, role_map
	) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, $9, $10::jsonb)`,
		tenantID,
		"https://idp.example.com/exk",
		"https://idp.example.com/sso",
		"-----BEGIN CERTIFICATE-----\nFAKE\n-----END CERTIFICATE-----",
		"https://aegis.cc/sso/"+tenantID+"/metadata",
		"https://aegis.cc/sso/"+tenantID+"/acs",
		string(keyPEM), string(certPEM),
		roleAttr, roleMapJSON)
	if err != nil {
		t.Fatalf("seed saml: %v", err)
	}
}

// mustInsertSAML inserts a fully-populated tenant_saml_config row with
// generated keypair + a placeholder IdP cert. enabled is parameterised
// so each test can pick whether the row should be live or shadow.
func mustInsertSAML(t *testing.T, db *sql.DB, tenantID string, enabled bool) {
	t.Helper()
	keyPEM, certPEM, err := GenerateSPKeypair(
		"https://aegis.cc/sso/" + tenantID + "/metadata")
	if err != nil {
		t.Fatalf("keygen: %v", err)
	}
	_, err = db.Exec(`INSERT INTO tenant_saml_config (
		tenant_id, idp_entity_id, idp_sso_url, idp_x509_cert,
		sp_entity_id, sp_acs_url, sp_key_pem, sp_cert_pem, enabled
	) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		tenantID,
		"https://idp.example.com/exk",
		"https://idp.example.com/sso",
		"-----BEGIN CERTIFICATE-----\nFAKE\n-----END CERTIFICATE-----",
		"https://aegis.cc/sso/"+tenantID+"/metadata",
		"https://aegis.cc/sso/"+tenantID+"/acs",
		string(keyPEM), string(certPEM), enabled)
	if err != nil {
		t.Fatalf("seed saml: %v", err)
	}
}
