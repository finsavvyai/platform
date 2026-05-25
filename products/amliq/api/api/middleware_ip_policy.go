package api

import (
	"log"
	"net/http"

	"github.com/aegis-aml/aegis/internal/security"
)

// IPPolicyResolver returns the IP policy for a tenant.
type IPPolicyResolver func(tenantID string) *security.IPPolicy

// IPPolicyMiddleware enforces per-tenant IP restrictions.
func IPPolicyMiddleware(
	resolvePolicy IPPolicyResolver,
) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tenantID := GetTenantID(r)
			if tenantID == "" {
				next.ServeHTTP(w, r)
				return
			}

			policy := resolvePolicy(tenantID)
			if policy == nil {
				next.ServeHTTP(w, r)
				return
			}

			ip := clientIP(r)
			if !security.IsAllowed(ip, policy) {
				logBlockedIP(tenantID, ip, r.URL.Path)
				Error(w, "IP_BLOCKED",
					"request blocked by IP policy",
					http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func logBlockedIP(tenantID, ip, path string) {
	log.Printf("IP_BLOCKED tenant=%s ip=%s path=%s",
		tenantID, ip, path)
}
