package http

import (
	"crypto/subtle"
	"encoding/json"
	"net/http"
	"os"
	"sort"
	"strconv"
	"time"

	"github.com/finsavvyai/sdlc-core/audit"
)

// AuditUsageHandler returns aggregated AI request stats for an admin
// console (TenantIQ governance UI, internal dashboards). Read-only,
// guarded by SDLC_ADMIN_BEARER so MSP customers see only what their
// admin tokens scope to.
//
// Query params:
//
//	tenant_id    optional: when set, scope to one tenant
//	since        unix-seconds: window start (default: 7d ago)
//	until        unix-seconds: window end (default: now)
//
// Response shape (stable contract for the UI):
//
//	{ "total_requests": N, "total_cost_usd_micros": M,
//	  "by_provider": [{provider, count, cost_usd_micros}],
//	  "by_status":   [{status, count}],
//	  "rows":        [...] }
func AuditUsageHandler(repo audit.Repository) http.HandlerFunc {
	expectedBearer := os.Getenv("SDLC_ADMIN_BEARER")

	return func(w http.ResponseWriter, r *http.Request) {
		if !checkAdminBearer(expectedBearer, r) {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		q := r.URL.Query()
		tenantID := q.Get("tenant_id")
		since := parseTimeOr(q.Get("since"), time.Now().Add(-7*24*time.Hour))
		until := parseTimeOr(q.Get("until"), time.Now())

		rows, err := repo.ListByTenant(r.Context(), tenantID, since, until, 1000)
		if err != nil {
			http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
			return
		}

		summary := summarize(rows)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(summary)
	}
}

func checkAdminBearer(expected string, r *http.Request) bool {
	if expected == "" {
		return false // refuse to serve admin data without an explicit token
	}
	auth := r.Header.Get("Authorization")
	const prefix = "Bearer "
	if len(auth) <= len(prefix) || auth[:len(prefix)] != prefix {
		return false
	}
	got := auth[len(prefix):]
	return subtle.ConstantTimeCompare([]byte(got), []byte(expected)) == 1
}

func parseTimeOr(raw string, fallback time.Time) time.Time {
	if raw == "" {
		return fallback
	}
	sec, err := strconv.ParseInt(raw, 10, 64)
	if err != nil {
		return fallback
	}
	return time.Unix(sec, 0)
}

// summarize builds the response payload from raw rows. Aggregates by
// provider and status; rows themselves come back so the UI can show
// per-call detail when an operator drills in.
func summarize(rows []audit.AIRequestLog) map[string]interface{} {
	type kv struct {
		Key   string `json:"key"`
		Count int    `json:"count"`
		Cost  int64  `json:"cost_usd_micros"`
	}
	provIdx := map[string]*kv{}
	statIdx := map[string]*kv{}
	var totalCost int64

	for _, r := range rows {
		if _, ok := provIdx[r.Provider]; !ok {
			provIdx[r.Provider] = &kv{Key: r.Provider}
		}
		provIdx[r.Provider].Count++
		if r.CostUSDMicros != nil {
			provIdx[r.Provider].Cost += *r.CostUSDMicros
			totalCost += *r.CostUSDMicros
		}
		if _, ok := statIdx[r.Status]; !ok {
			statIdx[r.Status] = &kv{Key: r.Status}
		}
		statIdx[r.Status].Count++
	}

	prov := make([]kv, 0, len(provIdx))
	for _, v := range provIdx {
		prov = append(prov, *v)
	}
	sort.Slice(prov, func(i, j int) bool { return prov[i].Count > prov[j].Count })
	stat := make([]kv, 0, len(statIdx))
	for _, v := range statIdx {
		stat = append(stat, *v)
	}
	sort.Slice(stat, func(i, j int) bool { return stat[i].Count > stat[j].Count })

	return map[string]interface{}{
		"total_requests":        len(rows),
		"total_cost_usd_micros": totalCost,
		"by_provider":           prov,
		"by_status":             stat,
		"rows":                  rows,
	}
}
