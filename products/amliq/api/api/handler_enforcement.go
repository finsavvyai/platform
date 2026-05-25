package api

import (
	"context"
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
)

// EnforcementRepository reads enforcement actions.
type EnforcementRepository interface {
	GetByEntityID(ctx context.Context, entityID string) ([]domain.EnforcementAction, error)
	SearchByName(ctx context.Context, name string, limit int) ([]domain.EnforcementAction, error)
}

// EnforcementHandler serves enforcement action endpoints.
type EnforcementHandler struct {
	repo EnforcementRepository
}

func NewEnforcementHandler(repo EnforcementRepository) *EnforcementHandler {
	return &EnforcementHandler{repo: repo}
}

func (h *EnforcementHandler) GetByEntity(w http.ResponseWriter, r *http.Request) {
	entityID := r.PathValue("id")
	if entityID == "" {
		Error(w, "MISSING_PARAM", "entity id required", http.StatusBadRequest)
		return
	}
	actions, err := h.repo.GetByEntityID(r.Context(), entityID)
	if err != nil {
		Error(w, "INTERNAL", "query failed", http.StatusInternalServerError)
		return
	}
	if actions == nil {
		actions = []domain.EnforcementAction{}
	}
	Success(w, map[string]interface{}{
		"entity_id": entityID,
		"actions":   actions,
		"total":     len(actions),
	}, http.StatusOK)
}

func (h *EnforcementHandler) Search(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if query == "" {
		Error(w, "MISSING_PARAM", "query param 'q' required", http.StatusBadRequest)
		return
	}
	actions, err := h.repo.SearchByName(r.Context(), query, 50)
	if err != nil {
		Error(w, "INTERNAL", "search failed", http.StatusInternalServerError)
		return
	}
	if actions == nil {
		actions = []domain.EnforcementAction{}
	}
	Success(w, map[string]interface{}{
		"query":   query,
		"results": actions,
		"total":   len(actions),
	}, http.StatusOK)
}
