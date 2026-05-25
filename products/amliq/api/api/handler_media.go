package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/storage"
)

// MediaHandler serves individual adverse media lookups.
type MediaHandler struct {
	media storage.AdverseMediaRepository
}

func NewMediaHandler(m storage.AdverseMediaRepository) *MediaHandler {
	return &MediaHandler{media: m}
}

func (h *MediaHandler) GetByEntity(w http.ResponseWriter, r *http.Request) {
	entityID := PathParam(r, "id")
	if entityID == "" {
		Error(w, "MISSING_PARAM", "entity id required", http.StatusBadRequest)
		return
	}
	hits, err := h.media.ListByEntity(r.Context(), entityID)
	if err != nil {
		Error(w, "DB_ERROR", "list failed", http.StatusInternalServerError)
		return
	}
	categorySummary := make(map[string]int)
	maxSeverity := 0
	for _, h := range hits {
		categorySummary[string(h.Category)]++
		if h.Severity > maxSeverity {
			maxSeverity = h.Severity
		}
	}
	Success(w, map[string]interface{}{
		"entity_id":    entityID,
		"hits":         hits,
		"total":        len(hits),
		"categories":   categorySummary,
		"max_severity": maxSeverity,
	}, http.StatusOK)
}
