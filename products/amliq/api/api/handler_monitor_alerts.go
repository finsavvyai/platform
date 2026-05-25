package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

// MonitorAlertHandler manages monitoring alert endpoints.
type MonitorAlertHandler struct {
	alerts   storage.MonitorAlertRepository
	profiles storage.MonitorProfileRepository
}

// NewMonitorAlertHandler creates a new alert handler.
func NewMonitorAlertHandler(
	a storage.MonitorAlertRepository, p storage.MonitorProfileRepository,
) *MonitorAlertHandler {
	return &MonitorAlertHandler{alerts: a, profiles: p}
}

// ListAlerts returns monitoring alerts for a tenant.
func (h *MonitorAlertHandler) ListAlerts(w http.ResponseWriter, r *http.Request) {
	tenantID := GetTenantID(r)
	if tenantID == "" {
		Error(w, "UNAUTHORIZED", "missing tenant", http.StatusUnauthorized)
		return
	}
	tid, _ := domain.NewTenantID(tenantID)
	alerts, err := h.alerts.ListByTenant(r.Context(), tid)
	if err != nil {
		Error(w, "DB_ERROR", "list alerts failed", http.StatusInternalServerError)
		return
	}
	filtered := filterMonitorAlerts(alerts, r)
	Success(w, map[string]interface{}{
		"alerts": filtered, "total": len(filtered),
	}, http.StatusOK)
}

func filterMonitorAlerts(
	alerts []domain.MonitorAlert, r *http.Request,
) []domain.MonitorAlert {
	severity := QueryParam(r, "severity")
	status := QueryParam(r, "status")
	if severity == "" && status == "" {
		return alerts
	}
	var result []domain.MonitorAlert
	for _, a := range alerts {
		if severity != "" && string(a.Severity) != severity {
			continue
		}
		if status == "reviewed" && !a.IsReviewed() {
			continue
		}
		if status == "pending" && a.IsReviewed() {
			continue
		}
		result = append(result, a)
	}
	return result
}

// ReviewAlert marks a monitoring alert as reviewed.
func (h *MonitorAlertHandler) ReviewAlert(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		Error(w, "MISSING_PARAM", "alert id required", http.StatusBadRequest)
		return
	}
	alert, err := h.alerts.GetByID(r.Context(), id)
	if err != nil || alert == nil {
		Error(w, "NOT_FOUND", "alert not found", http.StatusNotFound)
		return
	}
	var req struct {
		Disposition string `json:"disposition"`
		ReviewedBy  string `json:"reviewed_by"`
	}
	if err := DecodeJSON(r, &req); err != nil {
		Error(w, "INVALID", "bad json", http.StatusBadRequest)
		return
	}
	reviewed := alert.Review(req.ReviewedBy, req.Disposition)
	Success(w, reviewed, http.StatusOK)
}
