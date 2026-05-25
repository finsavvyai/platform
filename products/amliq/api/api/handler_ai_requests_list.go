package api

import (
	"net/http"
	"strconv"
	"time"

	"github.com/aegis-aml/aegis/internal/storage"
)

// handleAIRequestsList returns the per-call AI request log for the
// calling tenant. AdminOnly upstream — this is the table compliance
// officers query for "show me everything we sent to a model" and a
// regular analyst shouldn't see other analysts' prompts/responses.
//
// Default window: last 30 days. Default limit: 100. Override via
// ?since=RFC3339&until=RFC3339&limit=N.
func handleAIRequestsList(repo storage.AIRequestLogRepository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, ok := ClaimsFromContext(r.Context())
		if !ok {
			Error(w, "MISSING_AUTH", "auth required",
				http.StatusUnauthorized)
			return
		}
		since, until, err := parseUsageWindow(r)
		if err != nil {
			Error(w, "BAD_REQUEST", err.Error(), http.StatusBadRequest)
			return
		}
		limit := 100
		if v := r.URL.Query().Get("limit"); v != "" {
			n, e := strconv.Atoi(v)
			if e != nil || n <= 0 || n > 1000 {
				Error(w, "BAD_REQUEST", "limit must be 1..1000",
					http.StatusBadRequest)
				return
			}
			limit = n
		}
		rows, err := repo.ListByTenant(r.Context(),
			claims.TenantID, since, until, limit)
		if err != nil {
			Error(w, "DB_ERROR", "request log query failed",
				http.StatusInternalServerError)
			return
		}
		Success(w, map[string]interface{}{
			"since":   since, "until": until,
			"limit":   limit, "count": len(rows),
			"records": rows,
		}, http.StatusOK)
	}
}

// AICostResponse is the manager-facing cost rollup.
type AICostResponse struct {
	Since         time.Time `json:"since"`
	Until         time.Time `json:"until"`
	TotalUSDCents int64     `json:"total_usd_cents"`
}

// handleAICost sums cost_usd_micros for the calling tenant and
// returns it as cents (the unit dashboards prefer for $$ display).
// AdminOnly upstream — analysts shouldn't see team-wide spend.
func handleAICost(repo storage.AIRequestLogRepository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, ok := ClaimsFromContext(r.Context())
		if !ok {
			Error(w, "MISSING_AUTH", "auth required",
				http.StatusUnauthorized)
			return
		}
		since, until, err := parseUsageWindow(r)
		if err != nil {
			Error(w, "BAD_REQUEST", err.Error(), http.StatusBadRequest)
			return
		}
		micros, err := repo.SumCostUSDMicros(r.Context(),
			claims.TenantID, since, until)
		if err != nil {
			Error(w, "DB_ERROR", "cost aggregation failed",
				http.StatusInternalServerError)
			return
		}
		Success(w, AICostResponse{
			Since: since, Until: until,
			TotalUSDCents: micros / 10_000,
		}, http.StatusOK)
	}
}
