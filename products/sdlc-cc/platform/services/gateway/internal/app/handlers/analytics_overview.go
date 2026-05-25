// Read-only analytics overview endpoint backed by spend_events.
//
// GET /admin/analytics/overview?from=&to=
//
// Returns aggregate query / token / spend stats plus top-N leaderboards.
// All aggregations honor tenant isolation (the store impl is responsible
// for scoping by current tenant). RBAC: `admin:analytics:read`.
//
// Day 30 of the production-ready roadmap (Track B — Spend & Analytics).
package handlers

import (
	"context"
	"net/http"
	"time"
)

// AnalyticsOverviewStore is the minimal slice the handler needs.
// In prod this is a Postgres-backed impl that queries spend_events
// (or the materialized views from migration 014).
type AnalyticsOverviewStore interface {
	Overview(ctx context.Context, q AnalyticsRange) (AnalyticsOverview, error)
}

// AnalyticsRange is the parsed window. Defaults: last 30d if both blank.
type AnalyticsRange struct {
	From time.Time
	To   time.Time
}

// AnalyticsOverview is the shape returned by GET /admin/analytics/overview.
type AnalyticsOverview struct {
	From          time.Time     `json:"from"`
	To            time.Time     `json:"to"`
	TotalQueries  int64         `json:"total_queries"`
	TotalTokens   int64         `json:"total_tokens"`
	TotalUSDCents int64         `json:"total_usd_cents"`
	AvgLatencyMS  float64       `json:"avg_latency_ms"`
	TopModels     []ModelTotal  `json:"top_models"`
	TopUsers      []UserTotal   `json:"top_users"`
}

// ModelTotal describes per-model aggregate spend + counts.
type ModelTotal struct {
	Provider  string `json:"provider"`
	Model     string `json:"model"`
	Queries   int64  `json:"queries"`
	Tokens    int64  `json:"tokens"`
	USDCents  int64  `json:"usd_cents"`
}

// UserTotal describes per-user aggregate spend.
type UserTotal struct {
	UserID    string `json:"user_id"`
	Queries   int64  `json:"queries"`
	Tokens    int64  `json:"tokens"`
	USDCents  int64  `json:"usd_cents"`
}

// AnalyticsOverviewDeps wires the store into the handler factory.
type AnalyticsOverviewDeps struct {
	Store AnalyticsOverviewStore
}

// AnalyticsOverviewHandler returns http.HandlerFunc for the overview API.
func AnalyticsOverviewHandler(deps AnalyticsOverviewDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rng, err := parseAnalyticsRange(r)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		out, err := deps.Store.Overview(r.Context(), rng)
		if err != nil {
			http.Error(w, "overview failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		out.From = rng.From
		out.To = rng.To
		writeAnalyticsJSON(w, http.StatusOK, out)
	}
}

// parseAnalyticsRange validates `from`/`to` query params (RFC3339).
// Empty defaults: To=now, From=To-30d. Caps the window at 365d so a
// malicious caller cannot scan all-time.
func parseAnalyticsRange(r *http.Request) (AnalyticsRange, error) {
	now := time.Now().UTC()
	rng := AnalyticsRange{From: now.AddDate(0, 0, -30), To: now}

	if raw := r.URL.Query().Get("from"); raw != "" {
		t, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			return rng, &queryError{"from must be RFC3339"}
		}
		rng.From = t
	}
	if raw := r.URL.Query().Get("to"); raw != "" {
		t, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			return rng, &queryError{"to must be RFC3339"}
		}
		rng.To = t
	}
	if !rng.From.Before(rng.To) {
		return rng, &queryError{"from must be < to"}
	}
	if rng.To.Sub(rng.From) > 365*24*time.Hour {
		return rng, &queryError{"window must be <= 365 days"}
	}
	return rng, nil
}
