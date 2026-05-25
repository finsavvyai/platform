// MFA step-up middleware. BEAT-PLAN S3.2 / Day 24 follow-up.
//
// Wrap any sub-router that demands a fresh MFA proof. On stale or
// missing proof we emit:
//
//   401 Unauthorized
//   WWW-Authenticate: MFA realm="step-up"
//   {"error":{"code":"MFA_REQUIRED",...}}
//
// The browser/app reads WWW-Authenticate, prompts for a TOTP code,
// posts it to /v1/auth/mfa/verify, then retries the original request.
package middleware

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/sso"
)

// MFAGate returns a middleware that enforces sso.EnsureFreshMFA.
// Pass a nil store to disable the gate (dev convenience). The user-id
// extractor returns uuid.Nil when no auth context is present; the
// middleware then 401s rather than letting an anonymous request bypass.
func MFAGate(store sso.MFAStore, userIDFromCtx func(r *http.Request) uuid.UUID) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if store == nil {
				next.ServeHTTP(w, r)
				return
			}
			uid := userIDFromCtx(r)
			if uid == uuid.Nil {
				writeMFAChallenge(w, "anonymous request — sign in first")
				return
			}
			err := sso.EnsureFreshMFA(r.Context(), store, uid, time.Now)
			if errors.Is(err, sso.ErrMFARequired) {
				writeMFAChallenge(w, "step-up MFA required")
				return
			}
			if err != nil {
				writeErrorJSON(w, http.StatusInternalServerError, "mfa lookup failed")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// writeMFAChallenge emits the standard 401 + WWW-Authenticate response.
func writeMFAChallenge(w http.ResponseWriter, message string) {
	w.Header().Set("WWW-Authenticate", `MFA realm="step-up"`)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"error": map[string]any{
			"code":    "MFA_REQUIRED",
			"message": message,
		},
	})
}
