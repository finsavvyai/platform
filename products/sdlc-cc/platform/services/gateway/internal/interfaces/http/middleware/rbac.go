// HTTP middleware that enforces fine-grained RBAC.
//
// Day 22 of the production-ready roadmap.
//
// Usage: wrap a route with RequirePermission("rate_limit:write") and
// the middleware reads the user id from the request context, calls
// Evaluator.Allow, and rejects with 403 on miss.
package middleware

import (
	"context"
	"net/http"

	"github.com/google/uuid"

	"github.com/sdlc-ai/platform/services/gateway/internal/domain/rbac"
)

// UserIDFromCtx extracts the authenticated user id from the request
// context. Production wires the auth middleware's CtxKeyUserID; tests
// inject a fixed id.
type UserIDFromCtx func(ctx context.Context) (uuid.UUID, bool)

// RBACConfig wires the middleware.
type RBACConfig struct {
	Evaluator *rbac.Evaluator
	GetUser   UserIDFromCtx
}

// RequirePermission returns middleware that enforces the given
// permission on every request the wrapped handler serves.
func RequirePermission(cfg RBACConfig, required rbac.Permission) func(http.Handler) http.Handler {
	if cfg.Evaluator == nil || cfg.GetUser == nil {
		panic("rbac middleware: Evaluator and GetUser required")
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userID, ok := cfg.GetUser(r.Context())
			if !ok {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}
			allowed, err := cfg.Evaluator.Allow(r.Context(), userID, required)
			if err != nil {
				http.Error(w, "rbac evaluation failed", http.StatusInternalServerError)
				return
			}
			if !allowed {
				http.Error(w, "forbidden: missing permission "+string(required), http.StatusForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
