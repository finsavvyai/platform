package handlers

import (
	"encoding/json"
	"net/http"
	"strings"
)

// ScheduleRequest is the request body for POST /api/v1/connections/{name}/schedule.
type ScheduleRequest struct {
	CronExpr string `json:"cron_expr"` // e.g. "0 */6 * * *"
	Enabled  bool   `json:"enabled"`
	NotifyOn string `json:"notify_on"` // "all" | "findings_only"
}

// SetSchedule handles POST /api/v1/connections/{name}/schedule.
func (h *Handlers) SetSchedule(w http.ResponseWriter, r *http.Request) {
	name := extractConnectionName(r.URL.Path, "/schedule")
	if name == "" {
		jsonError(w, "missing connection name", http.StatusBadRequest)
		return
	}

	var req ScheduleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid JSON", http.StatusBadRequest)
		return
	}

	if !validCronExpr(req.CronExpr) {
		jsonError(w, "invalid cron expression: must have exactly 5 fields", http.StatusBadRequest)
		return
	}

	validNotify := map[string]bool{"all": true, "findings_only": true, "": true}
	if !validNotify[req.NotifyOn] {
		jsonError(w, "invalid notify_on: must be 'all' or 'findings_only'", http.StatusBadRequest)
		return
	}
	if req.NotifyOn == "" {
		req.NotifyOn = "all"
	}

	if err := h.db.SetSchedule(name, req.CronExpr, req.Enabled, req.NotifyOn); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	jsonOK(w, map[string]interface{}{
		"connection_name": name,
		"cron_expr":       req.CronExpr,
		"enabled":         req.Enabled,
		"notify_on":       req.NotifyOn,
	})
}

// GetSchedule handles GET /api/v1/connections/{name}/schedule.
func (h *Handlers) GetSchedule(w http.ResponseWriter, r *http.Request) {
	name := extractConnectionName(r.URL.Path, "/schedule")
	if name == "" {
		jsonError(w, "missing connection name", http.StatusBadRequest)
		return
	}

	sched, err := h.db.GetSchedule(name)
	if err != nil {
		jsonError(w, err.Error(), http.StatusNotFound)
		return
	}

	jsonOK(w, sched)
}

// DeleteSchedule handles DELETE /api/v1/connections/{name}/schedule.
func (h *Handlers) DeleteSchedule(w http.ResponseWriter, r *http.Request) {
	name := extractConnectionName(r.URL.Path, "/schedule")
	if name == "" {
		jsonError(w, "missing connection name", http.StatusBadRequest)
		return
	}

	if err := h.db.DeleteSchedule(name); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	jsonOK(w, map[string]string{"status": "deleted", "connection_name": name})
}

// validCronExpr checks that a cron expression has exactly 5 whitespace-separated fields.
func validCronExpr(expr string) bool {
	fields := strings.Fields(expr)
	return len(fields) == 5
}

// extractConnectionName extracts the connection name from a path like
// /api/v1/connections/{name}/schedule by trimming the given suffix.
func extractConnectionName(path, suffix string) string {
	base := "/api/v1/connections/"
	trimmed := strings.TrimPrefix(path, base)
	if trimmed == path {
		return ""
	}
	name := strings.TrimSuffix(trimmed, suffix)
	name = strings.Trim(name, "/")
	return name
}
