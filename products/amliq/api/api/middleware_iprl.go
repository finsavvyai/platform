package api

import "net/http"

// ipRateLimited wraps a public handler with the shared per-IP demo
// limiter. Used to gate unauthenticated search endpoints (free-text
// extraction, public screen) so a single IP cannot bypass the
// per-tenant free-tier daily cap by hitting the no-auth surface.
func ipRateLimited(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ip := clientIP(r)
		if !publicScreenDemoLimiter.Allow(ip) {
			Error(w, "RATE_LIMITED",
				"public endpoint: rate limit exceeded",
				http.StatusTooManyRequests)
			return
		}
		next(w, r)
	}
}
