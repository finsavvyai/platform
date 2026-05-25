package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/screening"
	"github.com/aegis-aml/aegis/internal/storage"
)

// MediaScanHandler handles entity-level adverse media scanning.
type MediaScanHandler struct {
	scanner *screening.MediaScanner
	media   storage.AdverseMediaRepository
}

// NewMediaScanHandler creates a scan handler.
func NewMediaScanHandler(
	s *screening.MediaScanner,
	m storage.AdverseMediaRepository,
) *MediaScanHandler {
	return &MediaScanHandler{scanner: s, media: m}
}

// ScanRequest holds the entity name to scan.
type ScanRequest struct {
	EntityName string `json:"entity_name"`
}

// Scan runs adverse media screening for an entity.
func (h *MediaScanHandler) Scan(w http.ResponseWriter, r *http.Request) {
	var req ScanRequest
	if err := DecodeJSON(r, &req); err != nil || req.EntityName == "" {
		Error(w, "INVALID", "entity_name required", http.StatusBadRequest)
		return
	}
	hits, err := h.scanner.ScanEntity(r.Context(), req.EntityName)
	if err != nil {
		Error(w, "SCAN_ERROR", err.Error(), http.StatusInternalServerError)
		return
	}
	if hits == nil {
		hits = []domain.MediaHit{}
	}
	Success(w, map[string]interface{}{
		"entity_name": req.EntityName,
		"hits":        hits,
		"total":       len(hits),
	}, http.StatusOK)
}
