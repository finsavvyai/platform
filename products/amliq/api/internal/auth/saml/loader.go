package saml

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
)

// ErrTenantSAMLNotConfigured is returned when no row exists for the
// tenant or when the row is disabled.
var ErrTenantSAMLNotConfigured = errors.New("saml: tenant not configured")

// SQLLoader reads tenant_saml_config rows. *sql.DB is required.
// We use database/sql (not pgxpool) so the same connection that
// backs the rest of aegis storage works here without a second pool.
type SQLLoader struct {
	db *sql.DB
}

// NewSQLLoader wires the loader. Panics on nil DB — that's a
// programmer error, not a runtime condition.
func NewSQLLoader(db *sql.DB) *SQLLoader {
	if db == nil {
		panic("saml: *sql.DB required")
	}
	return &SQLLoader{db: db}
}

// Load returns the SAML config row for a tenant, or
// ErrTenantSAMLNotConfigured when no enabled row exists. Disabled
// rows are treated as absent so a customer cutting SSO doesn't get
// stale assertions accepted.
func (l *SQLLoader) Load(ctx context.Context, tenantID string) (TenantSAMLRow, error) {
	row := l.db.QueryRowContext(ctx,
		`SELECT tenant_id, idp_entity_id, idp_sso_url, idp_metadata_xml,
		        idp_x509_cert, sp_entity_id, sp_acs_url, sp_key_pem,
		        sp_cert_pem, enabled,
		        COALESCE(role_attribute, ''),
		        COALESCE(role_map::text, '{}')
		   FROM tenant_saml_config
		  WHERE tenant_id = $1 AND enabled = TRUE`, tenantID)
	var r TenantSAMLRow
	var roleMapJSON string
	err := row.Scan(&r.TenantID, &r.IDPEntityID, &r.IDPSSOURL,
		&r.IDPMetadataXML, &r.IDPX509Cert, &r.SPEntityID,
		&r.SPACSURL, &r.SPKeyPEM, &r.SPCertPEM, &r.Enabled,
		&r.RoleAttribute, &roleMapJSON)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return TenantSAMLRow{}, ErrTenantSAMLNotConfigured
		}
		return TenantSAMLRow{}, err
	}
	if roleMapJSON != "" && roleMapJSON != "{}" {
		_ = json.Unmarshal([]byte(roleMapJSON), &r.RoleMap)
	}
	return r, nil
}
