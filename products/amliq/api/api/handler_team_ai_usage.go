package api

import (
	"net/http"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

// AIUsageEntry is one row in the team AI-usage report — a single
// team member's AI activity over the requested window. SummaryTypes
// breaks out alert/case/adverse_media so a compliance manager can
// see what their analysts are actually delegating to AI.
type AIUsageEntry struct {
	ActorID      string         `json:"actor_id"`
	AICallCount  int            `json:"ai_call_count"`
	SummaryTypes map[string]int `json:"summary_types"`
	LastCallAt   time.Time      `json:"last_call_at"`
}

// AIUsageResponse aggregates per-actor counts plus the window the
// caller is looking at. Total is denormalized for UI convenience.
type AIUsageResponse struct {
	Since      time.Time      `json:"since"`
	Until      time.Time      `json:"until"`
	Members    []AIUsageEntry `json:"members"`
	TotalCalls int            `json:"total_calls"`
}

// handleTeamAIUsage returns AISummarized audit entries grouped by
// actor for the calling tenant. Default window: last 30 days.
// Query: ?since=RFC3339&until=RFC3339 (both optional).
//
// This is a manager-facing view, so it requires AdminOnly upstream
// in router_team.go — analysts shouldn't see each other's AI usage.
func handleTeamAIUsage(audit storage.AuditRepository) http.HandlerFunc {
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
		tid, err := domain.NewTenantID(claims.TenantID)
		if err != nil {
			Error(w, "INVALID_TENANT", err.Error(), http.StatusBadRequest)
			return
		}
		entries, err := audit.ListByTenant(tid)
		if err != nil {
			Error(w, "DB_ERROR", "audit query failed",
				http.StatusInternalServerError)
			return
		}
		resp := buildAIUsageReport(entries, since, until)
		Success(w, resp, http.StatusOK)
	}
}

// parseUsageWindow reads the optional since/until query params and
// returns sensible defaults (last 30 days, ending now).
func parseUsageWindow(r *http.Request) (since, until time.Time, err error) {
	now := time.Now().UTC()
	until = now
	since = now.Add(-30 * 24 * time.Hour)
	if v := r.URL.Query().Get("since"); v != "" {
		t, e := time.Parse(time.RFC3339, v)
		if e != nil {
			return since, until, e
		}
		since = t
	}
	if v := r.URL.Query().Get("until"); v != "" {
		t, e := time.Parse(time.RFC3339, v)
		if e != nil {
			return since, until, e
		}
		until = t
	}
	return since, until, nil
}
