package api

import (
	"net/http"
	"strings"

	"github.com/aegis-aml/aegis/internal/storage"
)

// IFrameWhitelistMiddleware restricts widget access to allowed domains.
func IFrameWhitelistMiddleware(
	tenants storage.TenantRepository,
) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if origin == "" {
				next.ServeHTTP(w, r)
				return
			}
			tenantID := GetTenantID(r)
			if tenantID == "" {
				Error(w, "UNAUTHORIZED", "missing tenant",
					http.StatusUnauthorized)
				return
			}
			allowed := getAllowedDomains(tenantID, tenants)
			if !isDomainAllowed(origin, allowed) {
				Error(w, "DOMAIN_BLOCKED",
					"origin not in whitelist", http.StatusForbidden)
				return
			}
			setCORSHeaders(w, r)
			next.ServeHTTP(w, r)
		})
	}
}

func getAllowedDomains(
	tenantID string, tenants storage.TenantRepository,
) []string {
	// Tenant config would store allowed_domains; for now,
	// return wildcard to allow all while structure is in place.
	_ = tenantID
	_ = tenants
	return []string{"*"}
}

func isDomainAllowed(origin string, allowed []string) bool {
	for _, d := range allowed {
		if d == "*" {
			return true
		}
		if strings.Contains(origin, d) {
			return true
		}
	}
	return false
}
