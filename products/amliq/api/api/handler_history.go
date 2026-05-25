package api

import (
	"net/http"
	"strconv"

	spgx "github.com/aegis-aml/aegis/internal/storage/pgx"
)

// HistoryHandler serves entity and screening history.
type HistoryHandler struct {
	history  *spgx.EntityHistoryRepo
	archiver *spgx.ScreeningArchiver
}

func NewHistoryHandler(
	h *spgx.EntityHistoryRepo, a *spgx.ScreeningArchiver,
) *HistoryHandler {
	return &HistoryHandler{history: h, archiver: a}
}

// EntityHistory returns change log for a specific entity.
// GET /api/v1/history/entity/{id}
func (h *HistoryHandler) EntityHistory(
	w http.ResponseWriter, r *http.Request,
) {
	entityID := PathParam(r, "id")
	if entityID == "" {
		Error(w, "VALIDATION", "entity id required", http.StatusBadRequest)
		return
	}
	limit, _ := strconv.Atoi(QueryParam(r, "limit"))
	changes, err := h.history.GetEntityHistory(r.Context(), entityID, limit)
	if err != nil {
		Error(w, "DB_ERROR", "history query failed", http.StatusInternalServerError)
		return
	}
	Success(w, map[string]interface{}{
		"entity_id": entityID,
		"changes":   changes,
		"total":     len(changes),
	}, http.StatusOK)
}

// RemovedEntities returns recently removed/delisted entities.
// GET /api/v1/history/removed?list_id=ofac-sdn&limit=50
func (h *HistoryHandler) RemovedEntities(
	w http.ResponseWriter, r *http.Request,
) {
	listID := QueryParam(r, "list_id")
	limit, _ := strconv.Atoi(QueryParam(r, "limit"))
	removed, err := h.history.GetRemovedEntities(r.Context(), listID, limit)
	if err != nil {
		Error(w, "DB_ERROR", "query failed", http.StatusInternalServerError)
		return
	}
	Success(w, map[string]interface{}{
		"removed": removed,
		"total":   len(removed),
	}, http.StatusOK)
}

// ArchiveStats returns screening retention statistics.
// GET /api/v1/history/archive/stats
func (h *HistoryHandler) ArchiveStats(
	w http.ResponseWriter, r *http.Request,
) {
	stats, err := h.archiver.Stats(r.Context())
	if err != nil {
		Error(w, "DB_ERROR", "stats failed", http.StatusInternalServerError)
		return
	}
	Success(w, stats, http.StatusOK)
}
