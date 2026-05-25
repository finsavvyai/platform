package api

import (
	"net/http"
	"strconv"

	"github.com/aegis-aml/aegis/internal/tasklog"
)

// TasksHandler returns scheduled task execution history.
type TasksHandler struct {
	registry *tasklog.Registry
}

func NewTasksHandler(reg *tasklog.Registry) *TasksHandler {
	return &TasksHandler{registry: reg}
}

// ListAll returns all task entries (admin only).
func (h *TasksHandler) ListAll(w http.ResponseWriter, r *http.Request) {
	limit := parseLimit(r, 50)
	entries := h.registry.List(limit)
	Success(w, map[string]interface{}{
		"tasks": entries,
		"total": len(entries),
	}, http.StatusOK)
}

// ListForTenant returns tasks visible to a tenant manager.
func (h *TasksHandler) ListForTenant(w http.ResponseWriter, r *http.Request) {
	tenantID := GetTenantID(r)
	if tenantID == "" {
		Error(w, "MISSING_TENANT", "tenant_id required", http.StatusBadRequest)
		return
	}
	limit := parseLimit(r, 50)
	entries := h.registry.ListByTenant(tenantID, limit)
	Success(w, map[string]interface{}{
		"tasks": entries,
		"total": len(entries),
	}, http.StatusOK)
}

func parseLimit(r *http.Request, def int) int {
	s := QueryParam(r, "limit")
	if s == "" {
		return def
	}
	n, err := strconv.Atoi(s)
	if err != nil || n < 1 || n > 200 {
		return def
	}
	return n
}
