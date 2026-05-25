package api

import (
	"log"
	"net/http"
	"strconv"

	"github.com/aegis-aml/aegis/internal/ratelimit"
)

// TierResolver returns the subscription tier for a tenant.
type TierResolver func(tenantID string) string

// RateLimitMiddleware enforces per-tenant rate limits based on tier.
func RateLimitMiddleware(
	limiter *ratelimit.RateLimiter,
	resolveTier TierResolver,
) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tenantID := extractTenantID(r)
			if tenantID == "" {
				Error(w, "MISSING_TENANT",
					"tenant_id required", http.StatusBadRequest)
				return
			}

			tier := resolveTier(tenantID)
			allowed, info := limiter.Allow(tenantID, tier)

			setRateLimitHeaders(w, info)

			if !allowed {
				retryAfter := int(info.RetryAfter.Seconds()) + 1
				w.Header().Set("Retry-After",
					strconv.Itoa(retryAfter))
				log.Printf("RATE_LIMIT tenant=%s tier=%s path=%s",
					tenantID, tier, r.URL.Path)
				Error(w, "RATE_LIMIT_EXCEEDED",
					"too many requests", http.StatusTooManyRequests)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func extractTenantID(r *http.Request) string {
	if claims, ok := ClaimsFromContext(r.Context()); ok {
		return claims.TenantID
	}
	return GetTenantID(r)
}

func setRateLimitHeaders(
	w http.ResponseWriter, info *ratelimit.RateLimitInfo,
) {
	if info == nil {
		return
	}
	w.Header().Set("X-RateLimit-Limit",
		strconv.Itoa(info.Limit))
	w.Header().Set("X-RateLimit-Remaining",
		strconv.Itoa(info.Remaining))
	w.Header().Set("X-RateLimit-Reset",
		strconv.FormatInt(info.ResetAt.Unix(), 10))
}
