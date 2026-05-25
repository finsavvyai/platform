package api

import (
	"encoding/json"
	"net/http"

	"github.com/aegis-aml/aegis/internal/screening"
	"github.com/aegis-aml/aegis/internal/storage"
)

// FastScreenRequest is the input for fast payment screening.
type FastScreenRequest struct {
	Name       string `json:"name"`
	EntityType string `json:"entity_type,omitempty"`
}

func handleFastScreen(
	engine *screening.FastEngine,
	entities storage.EntityRepository,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tenantID := GetTenantID(r)
		if tenantID == "" {
			Error(w, "UNAUTHORIZED", "tenant_id required", http.StatusUnauthorized)
			return
		}

		var req FastScreenRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			Error(w, "INVALID_REQUEST", "invalid body", http.StatusBadRequest)
			return
		}
		if req.Name == "" {
			Error(w, "VALIDATION", "name required", http.StatusBadRequest)
			return
		}

		candidates, err := entities.Search(req.Name)
		if err != nil {
			Error(w, "INTERNAL", "search entities failed", http.StatusInternalServerError)
			return
		}

		result := engine.Screen(req.Name, candidates)
		Success(w, result, http.StatusOK)
	}
}
