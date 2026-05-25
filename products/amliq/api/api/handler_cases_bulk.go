package api

import (
	"encoding/json"
	"net/http"

	"github.com/aegis-aml/aegis/internal/storage"
)

type BulkResolveRequest struct {
	CaseIDs       []string `json:"case_ids"`
	Disposition   string   `json:"disposition"`
	Justification string   `json:"justification"`
}

func handleBulkResolve(cases storage.CaseRepository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tenantID := GetTenantID(r)
		if tenantID == "" {
			Error(w, "UNAUTHORIZED", "tenant_id required", http.StatusUnauthorized)
			return
		}
		var req BulkResolveRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			Error(w, "INVALID_REQUEST", "invalid body", http.StatusBadRequest)
			return
		}
		if len(req.CaseIDs) == 0 {
			Error(w, "INVALID_REQUEST", "case_ids required", http.StatusBadRequest)
			return
		}
		if len(req.CaseIDs) > 100 {
			Error(w, "LIMIT_EXCEEDED", "max 100 cases per batch", http.StatusBadRequest)
			return
		}

		resolved := 0
		for _, caseID := range req.CaseIDs {
			if err := cases.UpdateStatus(r.Context(), caseID, req.Disposition); err != nil {
				continue
			}
			resolved++
		}
		Success(w, map[string]interface{}{
			"resolved": resolved,
			"total":    len(req.CaseIDs),
		}, http.StatusOK)
	}
}
