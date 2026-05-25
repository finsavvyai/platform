// Per-tenant SAML config loader. BEAT-PLAN Day 24 follow-up: reads
// tenant_saml_config rows so the gateway can serve per-tenant SAML
// auth requests + ACS validation. Schema lives at
// database/migrations/026_tenant_saml_config.sql.
package sso

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// TenantSAMLRow is the persisted row used by SAMLProvider construction.
type TenantSAMLRow struct {
	TenantID       uuid.UUID
	IDPEntityID    string
	IDPSSOURL      string
	IDPMetadataXML string
	IDPX509Cert    string
	SPEntityID     string
	SPACSURL       string
	SPKeyPEM       string
	SPCertPEM      string
	Enabled        bool
}

// ErrTenantSAMLNotConfigured is returned when no row exists for the
// tenant or when the row is disabled.
var ErrTenantSAMLNotConfigured = errors.New("sso: tenant SAML not configured")

// PgxLoader reads tenant_saml_config rows.
type PgxLoader struct {
	pool *pgxpool.Pool
}

// NewPgxLoader wires the loader. Pool is required.
func NewPgxLoader(pool *pgxpool.Pool) *PgxLoader {
	if pool == nil {
		panic("sso: pgxpool required")
	}
	return &PgxLoader{pool: pool}
}

// Load returns the SAML config row for a tenant, or
// ErrTenantSAMLNotConfigured when no enabled row exists.
func (l *PgxLoader) Load(ctx context.Context, tenantID uuid.UUID) (TenantSAMLRow, error) {
	row := l.pool.QueryRow(ctx,
		`SELECT tenant_id, idp_entity_id, idp_sso_url, idp_metadata_xml,
		        idp_x509_cert, sp_entity_id, sp_acs_url, sp_key_pem,
		        sp_cert_pem, enabled
		   FROM tenant_saml_config
		  WHERE tenant_id = $1 AND enabled = TRUE`,
		tenantID,
	)
	var r TenantSAMLRow
	err := row.Scan(&r.TenantID, &r.IDPEntityID, &r.IDPSSOURL, &r.IDPMetadataXML,
		&r.IDPX509Cert, &r.SPEntityID, &r.SPACSURL, &r.SPKeyPEM,
		&r.SPCertPEM, &r.Enabled,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return TenantSAMLRow{}, ErrTenantSAMLNotConfigured
		}
		return TenantSAMLRow{}, err
	}
	return r, nil
}
