package api

import (
	"encoding/json"
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

// ListScheduleHandler lets tenants change the per-list sync schedule.
type ListScheduleHandler struct {
	tenants storage.TenantRepository
}

func NewListScheduleHandler(tenants storage.TenantRepository) *ListScheduleHandler {
	return &ListScheduleHandler{tenants: tenants}
}

type scheduleReq struct {
	Schedule    string `json:"schedule"`
	SyncEnabled *bool  `json:"sync_enabled,omitempty"`
}

type scheduleResp struct {
	ListID       string `json:"list_id"`
	SyncSchedule string `json:"sync_schedule"`
	SyncEnabled  bool   `json:"sync_enabled"`
	SyncsPerDay  int    `json:"syncs_per_day"`
}

// Update handles PUT /api/v1/lists/marketplace/{listId}/schedule.
func (h *ListScheduleHandler) Update(w http.ResponseWriter, r *http.Request) {
	listID := PathParam(r, "listId")
	tid, err := domain.NewTenantID(GetTenantID(r))
	if err != nil {
		Error(w, "INVALID_TENANT", err.Error(), http.StatusBadRequest)
		return
	}
	var req scheduleReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		Error(w, "INVALID_REQUEST", "invalid request body", http.StatusBadRequest)
		return
	}
	if err := domain.ValidateSyncSchedule(req.Schedule); err != nil {
		Error(w, "INVALID_SCHEDULE", err.Error(), http.StatusBadRequest)
		return
	}
	tenant, err := h.tenants.GetByID(tid)
	if err != nil || tenant == nil {
		Error(w, "NOT_FOUND", "tenant not found", http.StatusNotFound)
		return
	}
	updated, ok := applyScheduleToList(tenant, listID, req)
	if !ok {
		Error(w, "NOT_ENABLED", "list not enabled for tenant", http.StatusNotFound)
		return
	}
	if err := h.tenants.Update(*tenant); err != nil {
		Error(w, "DB_ERROR", "failed to save schedule", http.StatusInternalServerError)
		return
	}
	InvalidateListCounts()
	Success(w, updated, http.StatusOK)
}

// applyScheduleToList mutates tenant in place; returns the patched list config.
func applyScheduleToList(tenant *domain.Tenant, listID string, req scheduleReq) (scheduleResp, bool) {
	for i, lc := range tenant.Config.EnabledLists {
		if lc.ListID != listID {
			continue
		}
		tenant.Config.EnabledLists[i].SyncSchedule = req.Schedule
		if req.SyncEnabled != nil {
			tenant.Config.EnabledLists[i].SyncEnabled = *req.SyncEnabled
		}
		return scheduleResp{
			ListID:       lc.ListID,
			SyncSchedule: req.Schedule,
			SyncEnabled:  tenant.Config.EnabledLists[i].SyncEnabled,
			SyncsPerDay:  syncsPerDayForExpr(req.Schedule),
		}, true
	}
	return scheduleResp{}, false
}

// syncsPerDayForExpr is a thin wrapper so handlers can report cadence.
func syncsPerDayForExpr(expr string) int {
	// Reuse domain validation; if invalid, report 0.
	if err := domain.ValidateSyncSchedule(expr); err != nil {
		return 0
	}
	// Defer actual math to domain: minimum guaranteed by validation.
	// For display we return MinSyncsPerDay as a safe floor; callers can
	// compute exact cadence via cron library if needed.
	return domain.MinSyncsPerDay
}
