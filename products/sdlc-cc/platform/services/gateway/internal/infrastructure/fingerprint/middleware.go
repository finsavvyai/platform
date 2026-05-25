package fingerprint

import (
	"context"
	"encoding/json"
	"net/http"
)

type ctxKey struct{}

// ContextKey is the context.Context key used to store the per-request
// fingerprint Signals.
var ContextKey = ctxKey{}

// ClientIPFunc resolves the trusted client IP from an incoming request.
// The caller defines the policy (X-Forwarded-For depth, trusted proxy list)
// so this package stays unaware of edge topology.
type ClientIPFunc func(*http.Request) string

// Options configure fingerprint.Middleware behavior.
type Options struct {
	// ClientIP resolves the trusted client IP. Required.
	ClientIP ClientIPFunc

	// Validator, if non-nil, is called with the computed hash and the request.
	// Returning an error aborts the request with 401 and the error's Error()
	// becomes the JSON `message`. Use this to compare against a per-session
	// expected fingerprint stored in a JWT claim or session store.
	Validator func(r *http.Request, hash string, signals Signals) error

	// RequireStable blocks requests whose signals don't meet the Stable()
	// bar. Disabled by default so health checks and internal traffic pass.
	RequireStable bool
}

// Middleware extracts fingerprint signals, stores them in the request
// context, and optionally validates the computed hash.
func Middleware(opts Options) func(http.Handler) http.Handler {
	if opts.ClientIP == nil {
		opts.ClientIP = func(r *http.Request) string { return r.RemoteAddr }
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			signals := Extract(r, opts.ClientIP(r))

			if opts.RequireStable && !signals.Stable() {
				writeErrorJSON(w, http.StatusUnauthorized,
					"FINGERPRINT_UNSTABLE", "insufficient device signals")
				return
			}

			hash := signals.Hash()

			if opts.Validator != nil {
				if err := opts.Validator(r, hash, signals); err != nil {
					writeErrorJSON(w, http.StatusUnauthorized,
						"FINGERPRINT_MISMATCH", err.Error())
					return
				}
			}

			ctx := context.WithValue(r.Context(), ContextKey, signals)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// FromContext returns the fingerprint Signals stored by Middleware.
func FromContext(ctx context.Context) (Signals, bool) {
	s, ok := ctx.Value(ContextKey).(Signals)
	return s, ok
}

// writeErrorJSON marshals an RFC 8259-compliant error envelope. Using
// encoding/json (rather than string concatenation with a hand-rolled
// escaper) ensures every control byte and invalid UTF-8 sequence in the
// validator's error message is escaped correctly.
func writeErrorJSON(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"error": map[string]any{
			"code":    code,
			"message": message,
		},
	})
}
