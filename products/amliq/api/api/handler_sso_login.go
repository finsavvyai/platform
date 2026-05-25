package api

import (
	"context"
	"errors"
	"net/http"

	authsaml "github.com/aegis-aml/aegis/internal/auth/saml"
)

// samlAuthenticator narrows the *authsaml.SAMLProvider surface to what
// the handlers call. Both the real provider and a test fake implement
// this; we pass the abstraction through samlFactory so the handler
// has no compile-time dependency on crewjam.
type samlAuthenticator interface {
	MakeAuthRequest(relayState string) (redirectURL, requestID string, err error)
	ValidateResponse(r *http.Request, possibleRequestIDs []string) (map[string]string, error)
}

// samlFactory is the handler-side abstraction over PerTenantFactory.
// Tests substitute a fake that returns a stub samlAuthenticator
// without touching Postgres or building a real SP. RoleMapping is
// queried by the ACS handler post-validation so each tenant can
// translate IdP role claims to aegis roles via tenant_saml_config.
type samlFactory interface {
	Provider(ctx context.Context, tenantID string) (samlAuthenticator, error)
	RoleMapping(ctx context.Context, tenantID string) (string, map[string]string, error)
}

// realSAMLFactory adapts *authsaml.PerTenantFactory to samlFactory.
// The interface conversion is done here so the handler stays free of
// the dependency.
type realSAMLFactory struct{ inner *authsaml.PerTenantFactory }

func (r *realSAMLFactory) Provider(ctx context.Context, tenantID string) (samlAuthenticator, error) {
	return r.inner.Provider(ctx, tenantID)
}

func (r *realSAMLFactory) RoleMapping(ctx context.Context, tenantID string) (string, map[string]string, error) {
	return r.inner.RoleMapping(ctx, tenantID)
}

// handleSSOLogin returns a handler for GET /sso/{tenant}/login. Loads
// the per-tenant SAMLProvider, builds an AuthnRequest, persists the
// request ID in a short-TTL cookie, and 302s to the IdP.
//
// We don't sign session state into the cookie because crewjam's
// ParseResponse already verifies audience + InResponseTo. The cookie
// just needs to survive a single round trip.
func handleSSOLogin(f samlFactory) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tenantID := r.PathValue("tenant")
		if tenantID == "" {
			Error(w, "MISSING_TENANT", "tenant required",
				http.StatusBadRequest)
			return
		}
		provider, err := f.Provider(r.Context(), tenantID)
		if err != nil {
			if errors.Is(err, authsaml.ErrTenantSAMLNotConfigured) {
				Error(w, "SSO_NOT_CONFIGURED",
					"SAML not configured for tenant",
					http.StatusNotFound)
				return
			}
			Error(w, "SSO_ERROR", "internal error",
				http.StatusInternalServerError)
			return
		}
		redirectURL, requestID, err := provider.MakeAuthRequest("")
		if err != nil {
			Error(w, "SSO_REQUEST_FAILED", "cannot build authn request",
				http.StatusInternalServerError)
			return
		}
		http.SetCookie(w, &http.Cookie{
			Name:     "aegis_saml_req",
			Value:    requestID,
			Path:     "/sso/" + tenantID + "/acs",
			MaxAge:   300,
			HttpOnly: true,
			Secure:   true,
			SameSite: http.SameSiteLaxMode,
		})
		http.Redirect(w, r, redirectURL, http.StatusFound)
	}
}
