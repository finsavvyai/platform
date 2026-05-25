// Package saml wraps github.com/crewjam/saml with aegis-shaped
// per-tenant config: each tenant brings its own IdP metadata and gets
// its own SP keypair so a stolen cert from one customer can't sign
// AuthnRequests for another. Backed by migrations/070.
package saml

// TenantSAMLRow is the persisted row used by SAMLProvider construction.
// Mirrors the column set of tenant_saml_config 1:1. RoleAttribute /
// RoleMap come from migration 071 — they tell ACS how to map the
// IdP's role claim to an aegis role. Empty map + empty attribute =
// the legacy default-to-viewer behaviour.
type TenantSAMLRow struct {
	TenantID       string
	IDPEntityID    string
	IDPSSOURL      string
	IDPMetadataXML string
	IDPX509Cert    string
	SPEntityID     string
	SPACSURL       string
	SPKeyPEM       string
	SPCertPEM      string
	Enabled        bool
	RoleAttribute  string            // SAML claim name; empty = use defaults
	RoleMap        map[string]string // IdP value -> aegis role
}

// SAMLConfig is the runtime view crewjam ServiceProvider expects after
// we've loaded a row + parsed the keypair. MetadataURL is derived
// from SPEntityID + the path we mount in router_sso.go.
type SAMLConfig struct {
	IdPEntityID string
	SSOURL      string
	IdPCertPEM  []byte
	SPEntityID  string
	ACSURL      string
	MetadataURL string
}
