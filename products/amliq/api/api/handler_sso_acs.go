package api

import (
	"errors"
	"net/http"

	authsaml "github.com/aegis-aml/aegis/internal/auth/saml"
)

// SSOAttrs is the mapped subset we lift from the SAML assertion into
// the JWT we mint. Email + nameID are required; role is optional and
// defaults to "viewer" when the IdP doesn't supply it.
type SSOAttrs struct {
	NameID string
	Email  string
	Role   string
}

// extractSSOAttrs maps a crewjam attribute bag to our SSOAttrs.
// Real-world IdPs (Okta, Azure AD, Google Workspace) emit different
// claim URIs for the same logical field; we accept all three common
// forms for email + role rather than failing closed on a vendor mismatch.
//
// roleAttr (optional) overrides which SAML attribute carries the
// role — set per-tenant when the IdP uses a non-standard claim URI.
// roleMap (optional) translates the IdP's role value to an aegis
// role; empty map = passthrough.
func extractSSOAttrs(attrs map[string]string, roleAttr string, roleMap map[string]string) (SSOAttrs, error) {
	out := SSOAttrs{NameID: attrs["nameID"], Role: "viewer"}
	for _, k := range []string{
		"email",
		"http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
		"urn:oid:0.9.2342.19200300.100.1.3",
	} {
		if v := attrs[k]; v != "" {
			out.Email = v
			break
		}
	}
	out.Role = pickRole(attrs, roleAttr, roleMap, out.Role)
	if out.Email == "" {
		return SSOAttrs{}, errors.New("saml: email attribute missing")
	}
	return out, nil
}

// pickRole resolves the user's aegis role from the SAML attribute bag.
// Order: tenant-configured attribute first, then default sweep over
// common claim URIs, then map through tenant role_map if the IdP
// value has a translation, else the IdP value verbatim, else fallback.
func pickRole(attrs map[string]string, roleAttr string, roleMap map[string]string, fallback string) string {
	candidates := []string{
		"role",
		"http://schemas.microsoft.com/ws/2008/06/identity/claims/role",
	}
	if roleAttr != "" {
		candidates = append([]string{roleAttr}, candidates...)
	}
	var raw string
	for _, k := range candidates {
		if v := attrs[k]; v != "" {
			raw = v
			break
		}
	}
	if raw == "" {
		return fallback
	}
	if mapped, ok := roleMap[raw]; ok && mapped != "" {
		return mapped
	}
	return raw
}

// handleSSOACS returns a handler for POST /sso/{tenant}/acs. Validates
// the IdP's SAML response, extracts attributes, and returns them as
// JSON. JWT minting is a separate concern — the auth package already
// owns it, so this handler stays a single-purpose validator and lets
// the caller (or a follow-up middleware) decide what to do with the
// validated identity.
func handleSSOACS(f samlFactory) http.HandlerFunc {
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
		var ids []string
		if c, err := r.Cookie("aegis_saml_req"); err == nil {
			ids = []string{c.Value}
		}
		attrs, err := provider.ValidateResponse(r, ids)
		if err != nil {
			Error(w, "SSO_VALIDATION_FAILED", "invalid SAML response",
				http.StatusUnauthorized)
			return
		}
		// Best-effort role mapping load: a tenant without a row here
		// shouldn't 500 — extractSSOAttrs falls back to the default
		// claim sweep when roleAttr/roleMap are zero values.
		roleAttr, roleMap, _ := f.RoleMapping(r.Context(), tenantID)
		mapped, err := extractSSOAttrs(attrs, roleAttr, roleMap)
		if err != nil {
			Error(w, "SSO_ATTR_MISSING", err.Error(),
				http.StatusBadRequest)
			return
		}
		Success(w, mapped, http.StatusOK)
	}
}
