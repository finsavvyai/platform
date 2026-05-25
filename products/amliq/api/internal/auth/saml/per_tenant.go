package saml

import (
	"context"
	"crypto"
	"crypto/x509"
	"fmt"
	"net/url"
)

// PerTenantFactory builds a SAMLProvider on demand for one tenant by
// reading the row + decoding the keypair. We don't cache providers
// because (a) crewjam ServiceProvider holds a private key — caching
// across requests is a key-handling decision the loader shouldn't
// make for the caller, and (b) login is rare enough that one DB hit
// per request is fine.
type PerTenantFactory struct {
	loader  *SQLLoader
	baseURL string
}

// NewPerTenantFactory wires the factory. baseURL is the public scheme+host
// the gateway is reachable at (e.g. https://api.aegis.cc); used to derive
// SP metadata + ACS URLs from the tenant ID. loader is *SQLLoader (or
// any *SQLLoader-compatible reader) so callers don't import database/sql.
func NewPerTenantFactory(loader *SQLLoader, baseURL string) *PerTenantFactory {
	return &PerTenantFactory{loader: loader, baseURL: baseURL}
}

// Provider returns a per-request SAMLProvider for the given tenant, or
// ErrTenantSAMLNotConfigured when no enabled row exists.
func (f *PerTenantFactory) Provider(ctx context.Context, tenantID string) (*SAMLProvider, error) {
	row, err := f.loader.Load(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	key, cert, err := LoadSPKeypair([]byte(row.SPKeyPEM), []byte(row.SPCertPEM))
	if err != nil {
		return nil, fmt.Errorf("saml: keypair load failed: %w", err)
	}
	return f.providerFromRow(row, key, cert)
}

// providerFromRow is split out so tests can inject a synthetic row +
// keypair without standing up Postgres.
func (f *PerTenantFactory) providerFromRow(row TenantSAMLRow, key crypto.Signer, cert *x509.Certificate) (*SAMLProvider, error) {
	cfg := SAMLConfig{
		IdPEntityID: row.IDPEntityID,
		SSOURL:      row.IDPSSOURL,
		IdPCertPEM:  []byte(row.IDPX509Cert),
		SPEntityID:  row.SPEntityID,
		ACSURL:      row.SPACSURL,
		MetadataURL: f.metadataURL(row.TenantID),
	}
	return NewSAMLProvider(cfg, key, cert)
}

// metadataURL composes the per-tenant metadata path the SP advertises
// in AuthnRequests; mounted by router_sso.go.
func (f *PerTenantFactory) metadataURL(tenantID string) string {
	u, _ := url.Parse(f.baseURL)
	u.Path = "/sso/" + tenantID + "/metadata"
	return u.String()
}

// RoleMapping returns the per-tenant SAML role-mapping config.
// roleAttr is the SAML attribute name to read for the user's role
// (empty string = use the handler's default sweep over common
// claim URIs). roleMap translates the IdP's value to an aegis role.
// Both empty = legacy "default to viewer" behaviour.
func (f *PerTenantFactory) RoleMapping(ctx context.Context, tenantID string) (string, map[string]string, error) {
	row, err := f.loader.Load(ctx, tenantID)
	if err != nil {
		return "", nil, err
	}
	return row.RoleAttribute, row.RoleMap, nil
}
