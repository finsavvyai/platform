package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

// MediaScreenHandler provides adverse media batch screening.
type MediaScreenHandler struct {
	media storage.AdverseMediaRepository
}

func NewMediaScreenHandler(m storage.AdverseMediaRepository) *MediaScreenHandler {
	return &MediaScreenHandler{media: m}
}

type BatchMediaRequest struct {
	EntityIDs []string `json:"entity_ids"`
}

func (h *MediaScreenHandler) BatchScreen(w http.ResponseWriter, r *http.Request) {
	var req BatchMediaRequest
	if err := DecodeJSON(r, &req); err != nil || len(req.EntityIDs) == 0 {
		Error(w, "INVALID", "entity_ids required", http.StatusBadRequest)
		return
	}
	type entityMedia struct {
		EntityID string                   `json:"entity_id"`
		Hits     []domain.AdverseMediaHit `json:"hits"`
	}
	results := make([]entityMedia, 0, len(req.EntityIDs))
	for _, eid := range req.EntityIDs {
		hits, _ := h.media.ListByEntity(r.Context(), eid)
		results = append(results, entityMedia{EntityID: eid, Hits: hits})
	}
	Success(w, map[string]interface{}{
		"results": results, "total_entities": len(results),
	}, http.StatusOK)
}

func (h *MediaScreenHandler) Unreviewed(w http.ResponseWriter, r *http.Request) {
	tenantID := GetTenantID(r)
	if tenantID == "" {
		Error(w, "UNAUTHORIZED", "missing tenant", http.StatusUnauthorized)
		return
	}
	tid, _ := domain.NewTenantID(tenantID)
	hits, err := h.media.ListUnreviewed(r.Context(), tid, 50)
	if err != nil {
		Error(w, "DB_ERROR", "list failed", http.StatusInternalServerError)
		return
	}
	Success(w, map[string]interface{}{
		"hits": hits, "total": len(hits),
	}, http.StatusOK)
}
