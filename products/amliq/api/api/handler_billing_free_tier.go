package api

import (
	"net/http"
	"time"

	"github.com/aegis-aml/aegis/internal/billing"
	"github.com/aegis-aml/aegis/internal/domain"
)

// freeTierSubscriptions returns a synthetic free-tier subscription
// so the frontend renders correctly without LemonSqueezy.
func freeTierSubscriptions(w http.ResponseWriter, _ *http.Request) {
	now := time.Now()
	end := now.AddDate(0, 1, 0)
	Success(w, []map[string]interface{}{
		{
			"id":      "free-tier",
			"product": "api",
			"status":  "active",
			"plan": map[string]interface{}{
				"id":           "free",
				"name":         "Free Tier",
				"monthlyPrice": 0,
				"limits": map[string]interface{}{
					"screenings": FreeTierScreeningsPerDay,
				},
			},
			"currentPeriodEnd": end.Format(time.RFC3339),
			"seatCount":        1,
		},
	}, http.StatusOK)
}

// freeTierUsageHandler returns the GET /api/v1/billing/usage handler
// when LemonSqueezy is not configured. The previous handler returned
// `current: 0` hardcoded, so the dashboard counter never moved and
// gave the impression that the daily cap wasn't being enforced. The
// cap *is* enforced by UsageEnforcementMiddleware via the same
// Enforcer; this handler reads from it so the UI matches reality.
func freeTierUsageHandler(enforcer *billing.Enforcer) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		current := freeTierCurrentUsage(r, enforcer)
		Success(w, map[string]interface{}{
			"product": "api",
			"metrics": []map[string]interface{}{{
				"name":    "Screenings",
				"current": current,
				"limit":   FreeTierScreeningsPerDay,
				"unit":    "per day",
			}},
		}, http.StatusOK)
	}
}

// freeTierCurrentUsage resolves today's screening count for the
// authenticated tenant. Returns 0 when the request is unauthenticated
// or the enforcer is missing — the prior cosmetic-only behavior.
func freeTierCurrentUsage(r *http.Request, enforcer *billing.Enforcer) int64 {
	if enforcer == nil {
		return 0
	}
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		return 0
	}
	tid, err := domain.NewTenantID(claims.TenantID)
	if err != nil {
		return 0
	}
	_, remaining, err := enforcer.CheckFreeTier(r.Context(), tid)
	if err != nil {
		return 0
	}
	used := int64(FreeTierScreeningsPerDay) - remaining
	if used < 0 {
		used = 0
	}
	return used
}

// freeTierInvoices returns an empty invoice list.
func freeTierInvoices(w http.ResponseWriter, _ *http.Request) {
	Success(w, []interface{}{}, http.StatusOK)
}

// freeTierCheckout tells the user to configure billing.
func freeTierCheckout(w http.ResponseWriter, _ *http.Request) {
	Error(w, "FREE_TIER",
		"Configure LEMONSQUEEZY_API_KEY for paid plans",
		http.StatusBadRequest)
}
