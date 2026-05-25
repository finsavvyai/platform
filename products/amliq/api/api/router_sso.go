package api

import (
	"database/sql"
	"net/http"
	"os"

	authsaml "github.com/aegis-aml/aegis/internal/auth/saml"
)

// setupSSORoutes mounts /sso/{tenant}/login + /sso/{tenant}/acs.
// SSO is public-by-design (the IdP redirect kick-off can't carry our
// own JWT yet) so no authChain wraps these routes — crewjam's response
// validation IS the auth.
//
// Wires nothing when AEGIS_SSO_BASE_URL is unset or DB is nil so dev
// runs boot without SAML configured.
func setupSSORoutes(mux *http.ServeMux, db *sql.DB) {
	baseURL := os.Getenv("AEGIS_SSO_BASE_URL")
	if baseURL == "" || db == nil {
		return
	}
	loader := authsaml.NewSQLLoader(db)
	factory := &realSAMLFactory{
		inner: authsaml.NewPerTenantFactory(loader, baseURL),
	}
	mux.HandleFunc("GET /sso/{tenant}/login", handleSSOLogin(factory))
	mux.HandleFunc("POST /sso/{tenant}/acs", handleSSOACS(factory))
}
