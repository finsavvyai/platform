package http

import (
	"context"
	"net/http"

	"github.com/finsavvyai/sdlc-cc/internal/tenant"
)

// tenantCtxKey is unexported so external packages can't collide with
// our value. Pull it out via TenantIDFromContext from inside this
// package.
type tenantCtxKey struct{}

// WithTenantResolver returns middleware that resolves the request's
// source IP to a tenant_id (via the supplied resolver) and stores it
// on the request context for downstream handlers (audit, billing).
// No-op when the resolver is nil so dev/no-DB binaries still work.
func WithTenantResolver(resolver tenant.Resolver, next http.Handler) http.Handler {
	if resolver == nil {
		return next
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Don't overwrite a tenant_id that an upstream gate (e.g. the
		// API-key middleware) already attributed — explicit token
		// wins over inference. CIDR is only the fallback.
		if TenantIDFromContext(r.Context()) != "" {
			next.ServeHTTP(w, r)
			return
		}
		// Honor an upstream-set X-Forwarded-For first hop if present;
		// the TLS terminator will write the original client IP there.
		ip := tenant.ParseRemoteAddr(firstHopFromXFF(r))
		if !ip.IsValid() {
			ip = tenant.ParseRemoteAddr(r.RemoteAddr)
		}
		if ip.IsValid() {
			if id := resolver.ResolveByIP(ip); id != "" {
				ctx := context.WithValue(r.Context(),
					tenantCtxKey{}, id)
				r = r.WithContext(ctx)
			}
		}
		next.ServeHTTP(w, r)
	})
}

// TenantIDFromContext returns the resolved tenant_id, or empty string
// if the resolver didn't match. Empty is a valid state — handlers
// should decide whether to bill to a default tenant or refuse.
func TenantIDFromContext(ctx context.Context) string {
	v, _ := ctx.Value(tenantCtxKey{}).(string)
	return v
}

// firstHopFromXFF reads the leftmost X-Forwarded-For value, which by
// convention is the originating client. Empty string when no header
// is present so the caller falls back to RemoteAddr.
func firstHopFromXFF(r *http.Request) string {
	xff := r.Header.Get("X-Forwarded-For")
	if xff == "" {
		return ""
	}
	for i := 0; i < len(xff); i++ {
		if xff[i] == ',' {
			return xff[:i]
		}
	}
	return xff
}
