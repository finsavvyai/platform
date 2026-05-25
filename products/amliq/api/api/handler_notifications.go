package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

// NotificationHandler serves recent events for the current tenant.
type NotificationHandler struct {
	audit storage.AuditRepository
}

func NewNotificationHandler(a storage.AuditRepository) *NotificationHandler {
	return &NotificationHandler{audit: a}
}

// List returns recent audit events as notifications.
// GET /api/v1/notifications
func (h *NotificationHandler) List(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		Error(w, "UNAUTHORIZED", "missing auth", http.StatusUnauthorized)
		return
	}

	tid, err := domain.NewTenantID(claims.TenantID)
	if err != nil {
		Error(w, "INVALID_TENANT", err.Error(), http.StatusBadRequest)
		return
	}

	entries, err := h.audit.ListByTenant(tid)
	if err != nil {
		Error(w, "DB_ERROR", "failed to load notifications",
			http.StatusInternalServerError)
		return
	}

	// Limit to most recent 20
	if len(entries) > 20 {
		entries = entries[:20]
	}

	Success(w, map[string]interface{}{
		"entries": entries,
		"total":   len(entries),
	}, http.StatusOK)
}
