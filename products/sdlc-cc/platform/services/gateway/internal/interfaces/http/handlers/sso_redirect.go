// SSO auto-redirect handler. BEAT-PLAN Day 25 follow-up: GET
// /api/v1/sso/start?email=user@verified-domain.com -> 302 to the
// tenant's configured SSO start URL when the email's domain is
// verified for some tenant. Used by login pages that want to skip
// the password screen for SSO-managed orgs.
package handlers

import (
	"context"
	"net/http"

	"github.com/google/uuid"

	dv "github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/domain_verification"
)

// SSOStart returns a handler that 302-redirects when the given
// email's domain matches a verified tenant; otherwise it returns 204
// so the caller can fall through to the password form.
func SSOStart(deps *Dependencies) http.HandlerFunc {
	store := domainStoreFromDeps(deps)
	return func(w http.ResponseWriter, r *http.Request) {
		email := r.URL.Query().Get("email")
		if email == "" {
			http.Error(w, "email query param required", http.StatusBadRequest)
			return
		}
		// SSOURLFunc is wired by deployment; fallback returns "" so
		// the redirector signals "no SSO configured" via empty url.
		ssoURLFn := dv.SSOURLFunc(func(_ context.Context, _ uuid.UUID) (string, error) {
			// TODO: read tenant_saml_config when Day 24 PgxLoader is in.
			return "", nil
		})
		redirector := dv.NewSSORedirector(store, ssoURLFn)
		url, err := redirector.RedirectURL(r.Context(), email)
		if err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		if url == "" {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		http.Redirect(w, r, url, http.StatusFound)
	}
}
