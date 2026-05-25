package middleware

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/ratelimit"
)

// slidingAllower is the minimal per-request gate used by SlidingWindow.
// RedisLimiter in the ratelimit package satisfies this interface.
type slidingAllower interface {
	Allow(ctx context.Context, tenantID, route string, weight int) (allowed bool, retryAfter time.Duration, err error)
}

// SlidingWindow returns middleware that enforces per-tenant, per-route rate
// limits using the Redis sliding-window limiter. When limiter is nil the
// middleware is a no-op (keeps dev environments working without Redis).
//
// On 429 it sets:
//   - Retry-After (seconds)
//   - X-RateLimit-Policy: sliding-window
func SlidingWindow(limiter slidingAllower) func(http.Handler) http.Handler {
	if limiter == nil {
		return passthrough
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tenantID, _ := r.Context().Value(CtxKeyTenantID).(string)
			if tenantID == "" {
				// No authenticated tenant context yet — let auth middleware handle it.
				next.ServeHTTP(w, r)
				return
			}

			route := routePattern(r)
			allowed, retryAfter, err := limiter.Allow(r.Context(), tenantID, route, 1)
			if err != nil {
				// Fail open: a rate-limiter outage must not block traffic.
				next.ServeHTTP(w, r)
				return
			}

			if !allowed {
				secs := int(retryAfter.Seconds())
				if secs < 1 {
					secs = 1
				}
				w.Header().Set("Retry-After", strconv.Itoa(secs))
				w.Header().Set("X-RateLimit-Policy", "sliding-window")
				writeErrorJSON(w, http.StatusTooManyRequests, "rate limit exceeded")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// routePattern returns the chi route pattern (e.g. /v1/rag/query) when
// available, falling back to the raw URL path. Chi's RouteContext is nil
// before the router resolves the pattern, so the fallback is necessary
// for requests matched by wildcard routes or test helpers.
func routePattern(r *http.Request) string {
	if rctx := chi.RouteContext(r.Context()); rctx != nil {
		if p := rctx.RoutePattern(); p != "" {
			return p
		}
	}
	return r.URL.Path
}

// TenantIDFromCtx extracts the tenant from the request context for the
// DB-backed RateLimit middleware below. Production wires the auth
// middleware's CtxKeyTenantID; tests inject their own.
type TenantIDFromCtx func(ctx context.Context) (uuid.UUID, bool)

// RateLimitConfig wires the (Day-7) DB-backed rate-limit middleware.
// Use this when per-tenant rules live in the rate_limits table; the
// simpler SlidingWindow above wraps a single allower.
type RateLimitConfig struct {
	Limiter    *ratelimit.Limiter
	Repo       *ratelimit.ConfigRepo
	GetTenant  TenantIDFromCtx
	FailClosed bool
}

// RateLimit is the DB-backed rate-limit middleware constructor.
//
// Order in the chain (post-Auth + Tenant, pre-Validate). On allow:
// X-RateLimit-{Limit,Remaining,Reset}. On deny: 429 + Retry-After.
// On config-miss: fails open by default; FailClosed = true tightens.
func RateLimit(cfg RateLimitConfig) func(http.Handler) http.Handler {
	if cfg.Limiter == nil || cfg.Repo == nil || cfg.GetTenant == nil {
		panic("ratelimit middleware: Limiter, Repo, and GetTenant required")
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tenantID, ok := cfg.GetTenant(r.Context())
			if !ok {
				next.ServeHTTP(w, r)
				return
			}
			rule, err := cfg.Repo.Match(r.Context(), tenantID, r.URL.Path)
			if err != nil {
				if errors.Is(err, ratelimit.ErrNoRule) && !cfg.FailClosed {
					next.ServeHTTP(w, r)
					return
				}
				http.Error(w, "rate limit lookup failed", http.StatusServiceUnavailable)
				return
			}
			key := tenantID.String() + ":" + rule.RoutePattern
			d, err := cfg.Limiter.Allow(r.Context(), key, rule.RequestsPerMinute, rule.Burst)
			if err != nil {
				http.Error(w, "rate limit unavailable", http.StatusServiceUnavailable)
				return
			}
			writeRateLimitHeaders(w.Header(), d)
			if !d.Allowed {
				retryAfterSecs := int64(d.RetryAfter.Round(time.Second) / time.Second)
				if retryAfterSecs < 1 {
					retryAfterSecs = 1
				}
				w.Header().Set("Retry-After", strconv.FormatInt(retryAfterSecs, 10))
				http.Error(w, "rate limit exceeded", http.StatusTooManyRequests)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func writeRateLimitHeaders(h http.Header, d ratelimit.Decision) {
	h.Set("X-RateLimit-Limit", strconv.Itoa(d.Limit))
	if d.Remaining < 0 {
		d.Remaining = 0
	}
	h.Set("X-RateLimit-Remaining", strconv.Itoa(d.Remaining))
	h.Set("X-RateLimit-Reset", strconv.FormatInt(d.ResetAt.Unix(), 10))
}
