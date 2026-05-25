package api

import (
	"context"
	"database/sql"
	"net/http"
	"time"
)

// subsystemStatus reports one component's readiness for /health/full.
type subsystemStatus struct {
	Name    string `json:"name"`
	Status  string `json:"status"`
	Detail  string `json:"detail,omitempty"`
	Checked string `json:"checked_at"`
}

// HealthFull returns a per-subsystem readiness report at
// GET /health/full. Distinguishes "process up" (handled by /health)
// from "actually serving traffic". Overall status is "ok" only when
// every critical subsystem is ok; otherwise the response is 503.
func (h *HealthHandler) HealthFull(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	now := time.Now().UTC().Format(time.RFC3339)
	subs := []subsystemStatus{
		checkDatabase(ctx, h.db, now),
		checkListSyncFreshness(ctx, h.db, now),
	}
	overall := "ok"
	for _, s := range subs {
		if s.Status == "fail" || s.Status == "stale" {
			overall = "degraded"
		}
	}
	body := map[string]interface{}{
		"status":     overall,
		"version":    h.version,
		"time":       now,
		"subsystems": subs,
	}
	code := http.StatusOK
	if overall != "ok" {
		code = http.StatusServiceUnavailable
	}
	Success(w, body, code)
}

func checkDatabase(ctx context.Context, db *sql.DB, now string) subsystemStatus {
	if db == nil {
		return subsystemStatus{
			Name: "database", Status: "skipped",
			Detail: "no DB configured", Checked: now,
		}
	}
	if err := db.PingContext(ctx); err != nil {
		return subsystemStatus{
			Name: "database", Status: "fail",
			Detail: err.Error(), Checked: now,
		}
	}
	return subsystemStatus{Name: "database", Status: "ok", Checked: now}
}

// checkListSyncFreshness flags lists whose most recent sync is older
// than 48h. Threshold is conservative: most upstream sanctions and
// PEP feeds publish daily, so a two-day gap is the minimum signal a
// regulator expects a screening provider to surface.
func checkListSyncFreshness(
	ctx context.Context, db *sql.DB, now string,
) subsystemStatus {
	if db == nil {
		return subsystemStatus{
			Name: "list_sync", Status: "skipped",
			Detail: "no DB configured", Checked: now,
		}
	}
	var stale int
	err := db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM (
		   SELECT list_id FROM list_sync_audit
		    GROUP BY list_id
		   HAVING MAX(started_at) < NOW() - INTERVAL '48 hours'
		 ) s`,
	).Scan(&stale)
	if err != nil {
		return subsystemStatus{
			Name: "list_sync", Status: "unknown",
			Detail: err.Error(), Checked: now,
		}
	}
	if stale > 0 {
		return subsystemStatus{
			Name: "list_sync", Status: "stale",
			Detail: "lists not synced in 48h", Checked: now,
		}
	}
	return subsystemStatus{Name: "list_sync", Status: "ok", Checked: now}
}
