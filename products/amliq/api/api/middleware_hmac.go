package api

import (
	"bytes"
	"io"
	"net/http"

	"github.com/aegis-aml/aegis/internal/webhook"
)

// HMACVerifier middleware validates X-AMLIQ-Signature on incoming requests.
// Requires ClaimsFromContext to have been populated upstream.
func HMACVerifier(store *WebhookSecretStore) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			sig := r.Header.Get("X-AMLIQ-Signature")
			if sig == "" {
				http.Error(w, "missing signature", http.StatusUnauthorized)
				return
			}
			claims, ok := ClaimsFromContext(r.Context())
			if !ok {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}
			body, err := io.ReadAll(r.Body)
			if err != nil {
				http.Error(w, "read body", http.StatusBadRequest)
				return
			}
			r.Body = io.NopCloser(bytes.NewReader(body))

			secret, err := store.Get(claims.TenantID)
			if err != nil {
				http.Error(w, "secret lookup failed", http.StatusInternalServerError)
				return
			}
			if err := webhook.Verify(secret, body, sig); err != nil {
				http.Error(w, "signature invalid: "+err.Error(), http.StatusUnauthorized)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
