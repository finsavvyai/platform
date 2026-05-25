package saml

import (
	"database/sql"
	"os"
	"testing"

	_ "github.com/lib/pq"
)

// integration tests exercise SQLLoader against a real Postgres so we
// can lift coverage on the rows the unit tests can't fake.
// Opt-in via AEGIS_TEST_DATABASE_URL — never auto-run, so CI without
// a DB doesn't trip these.

func openTestDB(t *testing.T) *sql.DB {
	t.Helper()
	url := os.Getenv("AEGIS_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("AEGIS_TEST_DATABASE_URL not set; skipping integration")
	}
	db, err := sql.Open("postgres", url)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	if err := db.Ping(); err != nil {
		t.Skipf("postgres unreachable: %v", err)
	}
	return db
}

// setupSchema creates a minimal schema (just the FK target + the table
// under test) so the integration test doesn't need the full 60-file
// migration set. The shape mirrors migration 070 exactly.
func setupSchema(t *testing.T, db *sql.DB) {
	t.Helper()
	_, _ = db.Exec(`DROP TABLE IF EXISTS tenant_saml_config; DROP TABLE IF EXISTS tenants_t;`)
	_, err := db.Exec(`
		CREATE TABLE tenants_t (id VARCHAR(20) PRIMARY KEY);
		CREATE TABLE tenant_saml_config (
			tenant_id VARCHAR(20) PRIMARY KEY REFERENCES tenants_t(id) ON DELETE CASCADE,
			idp_entity_id TEXT NOT NULL,
			idp_sso_url TEXT NOT NULL,
			idp_metadata_xml TEXT NOT NULL DEFAULT '',
			idp_x509_cert TEXT NOT NULL,
			sp_entity_id TEXT NOT NULL,
			sp_acs_url TEXT NOT NULL,
			sp_key_pem TEXT NOT NULL,
			sp_cert_pem TEXT NOT NULL,
			enabled BOOLEAN NOT NULL DEFAULT TRUE,
			role_attribute TEXT,
			role_map JSONB NOT NULL DEFAULT '{}'::jsonb
		);`)
	if err != nil {
		t.Fatalf("schema: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(`DROP TABLE IF EXISTS tenant_saml_config; DROP TABLE IF EXISTS tenants_t;`)
	})
}
