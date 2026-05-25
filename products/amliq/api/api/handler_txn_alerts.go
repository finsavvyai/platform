package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

// TxnAlertHandler serves transaction alert endpoints.
type TxnAlertHandler struct {
	alerts storage.TxnAlertRepository
}

func NewTxnAlertHandler(a storage.TxnAlertRepository) *TxnAlertHandler {
	return &TxnAlertHandler{alerts: a}
}

func (h *TxnAlertHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID := GetTenantID(r)
	if tenantID == "" {
		Error(w, "UNAUTHORIZED", "missing tenant", http.StatusUnauthorized)
		return
	}
	tid, _ := domain.NewTenantID(tenantID)
	alerts, err := h.alerts.ListByTenant(r.Context(), tid, 100)
	if err != nil {
		Error(w, "DB_ERROR", "list failed", http.StatusInternalServerError)
		return
	}
	Success(w, map[string]interface{}{
		"alerts": alerts, "total": len(alerts),
	}, http.StatusOK)
}

func (h *TxnAlertHandler) Summary(w http.ResponseWriter, r *http.Request) {
	tenantID := GetTenantID(r)
	if tenantID == "" {
		Error(w, "UNAUTHORIZED", "missing tenant", http.StatusUnauthorized)
		return
	}
	tid, _ := domain.NewTenantID(tenantID)
	counts, err := h.alerts.CountByType(r.Context(), tid)
	if err != nil {
		Error(w, "DB_ERROR", "count failed", http.StatusInternalServerError)
		return
	}
	Success(w, counts, http.StatusOK)
}
