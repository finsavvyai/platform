package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
)

// RequireRole returns middleware that enforces minimum role permission.
func RequireRole(check func(domain.Role) bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, ok := ClaimsFromContext(r.Context())
			if !ok || claims.Role == "" {
				Error(w, "UNAUTHORIZED", "missing credentials",
					http.StatusUnauthorized)
				return
			}
			role, err := domain.ParseRole(claims.Role)
			if err != nil {
				Error(w, "INVALID_ROLE", err.Error(),
					http.StatusForbidden)
				return
			}
			if !check(role) {
				Error(w, "FORBIDDEN", "insufficient permissions",
					http.StatusForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// AdminOnly restricts to admin role.
func AdminOnly() func(http.Handler) http.Handler {
	return RequireRole(func(r domain.Role) bool {
		return r == domain.RoleAdmin
	})
}

// WriteAccess restricts to roles that can modify data.
func WriteAccess() func(http.Handler) http.Handler {
	return RequireRole(func(r domain.Role) bool {
		return r.CanWrite()
	})
}

// AuditAccess restricts to roles that can view audit trail.
func AuditAccess() func(http.Handler) http.Handler {
	return RequireRole(func(r domain.Role) bool {
		return r.CanViewAudit()
	})
}
