package http

import (
	"context"
	"net/http"
	"strings"

	"github.com/finsavvyai/sdlc-cc/internal/auth"
)

// Verifier is the surface auth-middleware needs from auth.Store.
// Decoupled so tests can drive without Postgres.
type Verifier interface {
	Verify(ctx context.Context, plaintext string) (string, error)
}

// WithAPIKeys is the auth gate for direct B2B traffic. Looks for a
// sk_sdlc_* token in Authorization: Bearer or X-API-Key, resolves
// it to a tenant_id, and stores that on the request context.
//
// Precedence:
//   1. Valid sk_sdlc_* → tenant_id from the key (override CIDR)
//   2. Bad sk_sdlc_*   → 401 (don't fall through to CIDR — explicit
//      key was offered + rejected, don't silently mis-attribute)
//   3. No sk_sdlc_*    → pass through unchanged. Transparent-proxy
//      traffic (customer's own Anthropic key) still gets to the
//      tenant_network_map resolver downstream.
//
// nil verifier disables the gate entirely so the binary boots
// without Postgres for dev / smoke runs.
func WithAPIKeys(verifier Verifier, next http.Handler) http.Handler {
	if verifier == nil {
		return next
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := extractSdlcToken(r)
		if token == "" {
			next.ServeHTTP(w, r)
			return
		}
		tenantID, err := verifier.Verify(r.Context(), token)
		if err != nil {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		ctx := context.WithValue(r.Context(), tenantCtxKey{}, tenantID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// extractSdlcToken returns the sk_sdlc_* token if the request offers
// one in either standard slot. Empty string means "no key offered" —
// the request keeps flowing so transparent-proxy customers (carrying
// their own Anthropic key) aren't blocked.
func extractSdlcToken(r *http.Request) string {
	if v := r.Header.Get("X-API-Key"); strings.HasPrefix(v, auth.KeyPrefix) {
		return v
	}
	bearer := r.Header.Get("Authorization")
	const p = "Bearer "
	if len(bearer) > len(p) && bearer[:len(p)] == p {
		t := bearer[len(p):]
		if strings.HasPrefix(t, auth.KeyPrefix) {
			return t
		}
	}
	return ""
}
