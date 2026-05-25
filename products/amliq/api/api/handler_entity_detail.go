package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

// EntityDetailHandler serves full entity records with all metadata.
type EntityDetailHandler struct {
	entities storage.EntityRepository
}

// NewEntityDetailHandler creates a handler for entity detail lookups.
func NewEntityDetailHandler(entities storage.EntityRepository) *EntityDetailHandler {
	return &EntityDetailHandler{entities: entities}
}

// GetByID handles GET /api/v1/entities/{id}.
func (h *EntityDetailHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	rawID := r.PathValue("id")
	if rawID == "" {
		Error(w, "MISSING_ID", "entity id required", http.StatusBadRequest)
		return
	}

	entID, err := domain.NewEntityID(rawID)
	if err != nil {
		Error(w, "INVALID_ID", err.Error(), http.StatusBadRequest)
		return
	}

	entity, err := h.entities.GetByID(entID)
	if err != nil {
		Error(w, "LOOKUP_ERROR", "entity lookup failed", http.StatusInternalServerError)
		return
	}
	if entity == nil {
		Error(w, "NOT_FOUND", "entity not found", http.StatusNotFound)
		return
	}

	Success(w, entityDetailMap(*entity), http.StatusOK)
}
