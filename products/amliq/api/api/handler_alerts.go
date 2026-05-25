package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
)

func (ah *AlertHandler) ListAlerts(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		Error(w, "MISSING_AUTH", "invalid or missing claims",
			http.StatusUnauthorized)
		return
	}

	tid, err := domain.NewTenantID(claims.TenantID)
	if err != nil {
		Error(w, "INVALID_TENANT", err.Error(), http.StatusBadRequest)
		return
	}

	alerts, err := ah.alerts.ListByTenant(tid)
	if err != nil {
		Error(w, "DB_ERROR", "internal error", http.StatusInternalServerError)
		return
	}

	status := QueryParam(r, "status")
	priority := QueryParam(r, "priority")

	var filtered []domain.Alert
	for _, alert := range alerts {
		if status != "" && alert.Status.String() != status {
			continue
		}
		if priority != "" && alert.Priority.String() != priority {
			continue
		}
		filtered = append(filtered, alert)
	}

	Paginated(w, filtered, int64(len(filtered)), http.StatusOK)
}

func (ah *AlertHandler) GetAlert(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		Error(w, "MISSING_AUTH", "invalid or missing claims",
			http.StatusUnauthorized)
		return
	}

	alertID := PathParam(r, "id")
	if alertID == "" {
		Error(w, "MISSING_PARAM", "id required", http.StatusBadRequest)
		return
	}

	alert, err := ah.alerts.GetByID(alertID)
	if err != nil {
		Error(w, "DB_ERROR", "alert lookup failed", http.StatusInternalServerError)
		return
	}
	if alert == nil || alert.TenantID.String() != claims.TenantID {
		Error(w, "NOT_FOUND", "alert not found", http.StatusNotFound)
		return
	}

	Success(w, alert, http.StatusOK)
}
