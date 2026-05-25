package api

import (
	"fmt"
	"net/http"

	"github.com/aegis-aml/aegis/internal/billing"
	"github.com/aegis-aml/aegis/internal/domain"
)

// enforcePaid handles the billing-configured branch of
// UsageEnforcementMiddleware. Records usage on a 2xx response only.
func enforcePaid(
	w http.ResponseWriter, r *http.Request,
	next http.Handler, enforcer *billing.Enforcer,
	tenantID domain.TenantID,
) {
	allowed, remaining, err := enforcer.CheckAllowed(
		r.Context(), tenantID,
		domain.ProductAPI, domain.MetricAPIScreenings,
	)
	if err != nil {
		enforcePaidNoSubscription(w, r, next, enforcer, tenantID)
		return
	}
	if !allowed {
		trackUsageExhausted(tenantID.String(), "USAGE_LIMIT_EXCEEDED")
		PaywallError(w, "USAGE_LIMIT_EXCEEDED",
			"plan screening limit reached")
		return
	}
	// CheckAllowed only verifies headroom — without this increment
	// the quota counter never moves and "trial searches not
	// counting" reappears for paid plans on every billable endpoint.
	rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
	w.Header().Set("X-Usage-Remaining", fmt.Sprintf("%d", remaining-1))
	next.ServeHTTP(rec, r)
	if rec.status >= 200 && rec.status < 300 {
		_ = enforcer.RecordUsage(
			r.Context(), tenantID,
			domain.ProductAPI, domain.MetricAPIScreenings,
		)
	}
}

// enforcePaidNoSubscription is the path taken when CheckAllowed
// reports no active subscription. It funnels to CheckFreeTier and
// fails closed if that read errors — falling back to a per-process
// tracker would let a restart bypass the daily cap.
func enforcePaidNoSubscription(
	w http.ResponseWriter, r *http.Request,
	next http.Handler, enforcer *billing.Enforcer,
	tenantID domain.TenantID,
) {
	ftAllowed, rem, ftErr := enforcer.CheckFreeTier(r.Context(), tenantID)
	if ftErr != nil {
		Error(w, "USAGE_CHECK_UNAVAILABLE",
			"free tier counter temporarily unavailable",
			http.StatusServiceUnavailable)
		return
	}
	if !ftAllowed {
		trackUsageExhausted(tenantID.String(), "FREE_TIER_EXHAUSTED")
		PaywallError(w, "FREE_TIER_EXHAUSTED",
			"free tier limit reached, subscribe to continue")
		return
	}
	rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
	w.Header().Set("X-Usage-Remaining", fmt.Sprintf("%d", rem-1))
	next.ServeHTTP(rec, r)
	if rec.status >= 200 && rec.status < 300 {
		_ = enforcer.RecordFreeTier(r.Context(), tenantID)
	}
}
