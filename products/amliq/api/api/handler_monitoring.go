package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

type MonitorHandler struct {
	monitors storage.MonitorRepository
}

func NewMonitorHandler(m storage.MonitorRepository) *MonitorHandler {
	return &MonitorHandler{monitors: m}
}

type CreateMonitorRequest struct {
	EntityName string `json:"entity_name"`
	EntityType string `json:"entity_type"`
	Frequency  string `json:"frequency"`
}

func (h *MonitorHandler) Create(w http.ResponseWriter, r *http.Request) {
	tenantID := GetTenantID(r)
	if tenantID == "" {
		Error(w, "UNAUTHORIZED", "missing tenant", http.StatusUnauthorized)
		return
	}
	tid, _ := domain.NewTenantID(tenantID)
	var req CreateMonitorRequest
	if err := DecodeJSON(r, &req); err != nil {
		Error(w, "INVALID", "bad json", http.StatusBadRequest)
		return
	}
	entType, _ := domain.ParseEntityType(req.EntityType)
	mon, err := domain.NewOngoingMonitor(tid, req.EntityName, entType, req.Frequency)
	if err != nil {
		Error(w, "VALIDATION", err.Error(), http.StatusBadRequest)
		return
	}
	if err := h.monitors.Create(r.Context(), mon); err != nil {
		Error(w, "DB_ERROR", "create failed", http.StatusInternalServerError)
		return
	}
	Success(w, mon, http.StatusCreated)
}

func (h *MonitorHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID := GetTenantID(r)
	if tenantID == "" {
		Error(w, "UNAUTHORIZED", "missing tenant", http.StatusUnauthorized)
		return
	}
	tid, _ := domain.NewTenantID(tenantID)
	monitors, err := h.monitors.ListByTenant(r.Context(), tid)
	if err != nil {
		Error(w, "DB_ERROR", "list failed", http.StatusInternalServerError)
		return
	}
	Success(w, map[string]interface{}{
		"monitors": monitors, "total": len(monitors),
	}, http.StatusOK)
}

func (h *MonitorHandler) Delete(w http.ResponseWriter, r *http.Request) {
	monitorID := r.PathValue("id")
	if monitorID == "" {
		Error(w, "MISSING_PARAM", "monitor id required", http.StatusBadRequest)
		return
	}
	if err := h.monitors.Delete(r.Context(), monitorID); err != nil {
		Error(w, "DB_ERROR", "delete failed", http.StatusInternalServerError)
		return
	}
	Success(w, map[string]string{"status": "deleted"}, http.StatusOK)
}
