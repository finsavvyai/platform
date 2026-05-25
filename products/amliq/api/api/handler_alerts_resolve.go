package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
)

func (ah *AlertHandler) ResolveAlert(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		Error(w, "METHOD_NOT_ALLOWED", "use PUT", http.StatusMethodNotAllowed)
		return
	}

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

	var req ResolveAlertRequest
	if err := DecodeJSON(r, &req); err != nil {
		Error(w, "INVALID_REQUEST", "failed to decode body",
			http.StatusBadRequest)
		return
	}

	alert, err := ah.alerts.GetByID(alertID)
	if err != nil {
		Error(w, "DB_ERROR", "internal error", http.StatusInternalServerError)
		return
	}
	if alert == nil {
		Error(w, "NOT_FOUND", "alert not found", http.StatusNotFound)
		return
	}

	resolved := alert.Resolve(req.Justification)

	if err := ah.alerts.Update(resolved); err != nil {
		Error(w, "DB_ERROR", "internal error", http.StatusInternalServerError)
		return
	}

	tid, err := domain.NewTenantID(claims.TenantID)
	if err == nil {
		auditEntry, err := domain.NewAuditEntry(
			tid,
			domain.AuditActionAlertResolved,
			claims.UserID,
			"Alert",
			alertID,
		)
		if err == nil {
			ah.audit.Create(auditEntry)
		}
	}

	Success(w, resolved, http.StatusOK)
}
