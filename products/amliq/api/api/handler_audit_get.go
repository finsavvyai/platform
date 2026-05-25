package api

import "net/http"

func (ah *AuditHandler) GetAuditEntry(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		Error(w, "MISSING_AUTH", "invalid or missing claims",
			http.StatusUnauthorized)
		return
	}

	entryID := PathParam(r, "id")
	if entryID == "" {
		Error(w, "MISSING_PARAM", "id required", http.StatusBadRequest)
		return
	}

	entry, err := ah.audit.GetByID(entryID)
	if err != nil {
		Error(w, "DB_ERROR", "audit lookup failed",
			http.StatusInternalServerError)
		return
	}
	if entry == nil || entry.TenantID.String() != claims.TenantID {
		Error(w, "NOT_FOUND", "audit entry not found", http.StatusNotFound)
		return
	}

	response := map[string]interface{}{
		"id":            entry.ID,
		"action":        entry.Action.String(),
		"actor_id":      entry.ActorID,
		"resource_type": entry.ResourceType,
		"resource_id":   entry.ResourceID,
		"timestamp":     entry.Timestamp.Unix(),
		"details":       entry.Details,
	}
	Success(w, response, http.StatusOK)
}
