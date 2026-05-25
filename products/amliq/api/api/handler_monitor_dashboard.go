package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
)

// Dashboard returns monitoring statistics for the tenant.
func (h *MonitorAlertHandler) Dashboard(w http.ResponseWriter, r *http.Request) {
	tenantID := GetTenantID(r)
	if tenantID == "" {
		Error(w, "UNAUTHORIZED", "missing tenant", http.StatusUnauthorized)
		return
	}
	tid, _ := domain.NewTenantID(tenantID)
	profiles, _ := h.profiles.ListByTenant(r.Context(), tid)
	alerts, _ := h.alerts.ListByTenant(r.Context(), tid)
	stats := buildMonitorDashboard(profiles, alerts)
	Success(w, stats, http.StatusOK)
}

func buildMonitorDashboard(
	profiles []domain.MonitorProfile, alerts []domain.MonitorAlert,
) map[string]interface{} {
	pending := 0
	bySeverity := map[string]int{}
	for _, a := range alerts {
		if !a.IsReviewed() {
			pending++
		}
		bySeverity[string(a.Severity)]++
	}
	active := 0
	for _, p := range profiles {
		if p.Status == domain.MonitorActive {
			active++
		}
	}
	return map[string]interface{}{
		"active_profiles": active,
		"total_profiles":  len(profiles),
		"pending_alerts":  pending,
		"total_alerts":    len(alerts),
		"by_severity":     bySeverity,
	}
}
