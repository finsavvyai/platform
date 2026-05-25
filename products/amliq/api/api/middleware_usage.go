package api

import (
	"fmt"
	"net/http"
	"time"

	"github.com/aegis-aml/aegis/internal/billing"
	"github.com/aegis-aml/aegis/internal/domain"
)

// FreeTierScreeningsPerDay is the daily limit without a subscription.
const FreeTierScreeningsPerDay = 10

// IPDailyScreenCap is the per-IP daily backstop on top of the
// per-tenant cap. It exists to make multi-account farming
// (one human, N tenants × 10/day each) expensive: a single IP
// cannot exceed IPDailyScreenCap regardless of how many tenants
// it owns. Tuned high enough that a small office or VPN exit
// (3 paid users × 10/day) does not trip it accidentally.
const IPDailyScreenCap = 30

// ipDailyScreenLimiter is a process-wide per-IP daily counter for
// authenticated screening calls. Reset rolls the entire map every
// 24h. A persistent (Redis) implementation is a follow-up.
var ipDailyScreenLimiter = NewIPRateLimiter(IPDailyScreenCap, 24*time.Hour)

// UsageEnforcementMiddleware checks plan limits before screening.
func UsageEnforcementMiddleware(
	enforcer *billing.Enforcer,
) func(http.Handler) http.Handler {
	tracker := newFreeTierTracker()
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, ok := ClaimsFromContext(r.Context())
			if !ok {
				next.ServeHTTP(w, r)
				return
			}
			tenantID, err := domain.NewTenantID(claims.TenantID)
			if err != nil {
				next.ServeHTTP(w, r)
				return
			}
			if !ipDailyScreenLimiter.Allow(clientIP(r)) {
				Error(w, "IP_DAILY_LIMIT",
					"daily IP screening cap reached",
					http.StatusTooManyRequests)
				return
			}

			if enforcer != nil {
				enforcePaid(w, r, next, enforcer, tenantID)
				return
			}

			// No enforcer at all (dev / no-DB). Process-local
			// tracker resets on restart; not used in production
			// because deps.Enforcer is always wired when DB is up.
			remaining := tracker.tryUse(tenantID.String())
			if remaining < 0 {
				trackUsageExhausted(tenantID.String(), "FREE_TIER_EXHAUSTED")
				PaywallError(w, "FREE_TIER_EXHAUSTED",
					"daily free tier limit reached")
				return
			}
			w.Header().Set("X-Usage-Remaining",
				fmt.Sprintf("%d", remaining))
			next.ServeHTTP(w, r)
		})
	}
}
