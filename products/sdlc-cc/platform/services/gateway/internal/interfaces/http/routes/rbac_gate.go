// rbac_gate: tiny helper that returns the RequirePermission middleware
// when the deps carry a configured RBAC, or a passthrough otherwise.
//
// Why a helper: routes.go was 153 LOC of declarative chi wiring; making
// every mutating route conditional inline would double the size and
// hide the intent. This keeps each route a single readable line.
//
// BEAT-PLAN S1.1 / INTEGRATION-DEBT Day 22.
package routes

import (
	"net/http"

	"github.com/sdlc-ai/platform/services/gateway/internal/interfaces/http/handlers"
)

// rbacGate returns middleware that enforces perm when the suite is
// wired (deps.RBAC != nil). When RBAC is nil it is a passthrough so
// boot still succeeds against an empty AUDIT_SIGNING_KEY env in dev.
func rbacGate(deps *handlers.Dependencies, perm string) func(http.Handler) http.Handler {
	if deps == nil || deps.RBAC == nil {
		return func(next http.Handler) http.Handler { return next }
	}
	return deps.RBAC.RequirePermission(perm)
}
