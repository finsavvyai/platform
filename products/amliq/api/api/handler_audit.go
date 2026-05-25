package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

type AuditHandler struct {
	audit storage.AuditRepository
}

func NewAuditHandler(audit storage.AuditRepository) *AuditHandler {
	return &AuditHandler{
		audit: audit,
	}
}

func (ah *AuditHandler) ListAuditTrail(w http.ResponseWriter, r *http.Request) {
	tenantIDStr := GetTenantID(r)
	if tenantIDStr == "" {
		Error(w, "MISSING_TENANT", "tenant_id required", http.StatusBadRequest)
		return
	}

	tenantID, err := domain.NewTenantID(tenantIDStr)
	if err != nil {
		Error(w, "INVALID_TENANT", err.Error(), http.StatusBadRequest)
		return
	}

	actionStr := QueryParam(r, "action")
	entries, err := ah.audit.ListByTenant(tenantID)
	if err != nil {
		Error(w, "DB_ERROR", "internal error", http.StatusInternalServerError)
		return
	}

	filtered := entries
	if actionStr != "" {
		action, err := domain.ParseAuditAction(actionStr)
		if err != nil {
			Error(w, "INVALID_ACTION", err.Error(), http.StatusBadRequest)
			return
		}
		filtered = []domain.AuditEntry{}
		for _, e := range entries {
			if e.Action == action {
				filtered = append(filtered, e)
			}
		}
	}

	result := make([]map[string]interface{}, len(filtered))
	for i, entry := range filtered {
		target := entry.ResourceType
		if entry.ResourceID != "" {
			target += " " + entry.ResourceID
		}
		result[i] = map[string]interface{}{
			"id":        entry.ID,
			"action":    entry.Action.String(),
			"actor":     entry.ActorID,
			"target":    target,
			"details":   entry.Details,
			"timestamp": entry.Timestamp.Format("2006-01-02T15:04:05Z"),
		}
	}

	response := map[string]interface{}{
		"entries": result,
	}
	Paginated(w, response, int64(len(result)), http.StatusOK)
}
