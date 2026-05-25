package api

import (
	"context"
	"database/sql"
	"net/http"
	"time"

	"github.com/aegis-aml/aegis/internal/ingestion"
)

// AdminSourcesHandler manages data source operations.
type AdminSourcesHandler struct {
	db *sql.DB
}

func NewAdminSourcesHandler(db *sql.DB) *AdminSourcesHandler {
	return &AdminSourcesHandler{db: db}
}

// ListSources returns all data sources with entity counts.
func (h *AdminSourcesHandler) ListSources(
	w http.ResponseWriter, r *http.Request,
) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	rows, err := h.db.QueryContext(ctx, `
		SELECT list_id, COUNT(*) as cnt
		FROM entities
		GROUP BY list_id
		ORDER BY cnt DESC
	`)
	if err != nil {
		Error(w, "DB_ERROR", "query failed", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var loaded []map[string]interface{}
	totalEntities := 0
	for rows.Next() {
		var listID string
		var cnt int
		if err := rows.Scan(&listID, &cnt); err != nil {
			continue
		}
		loaded = append(loaded, map[string]interface{}{
			"list_id": listID, "count": cnt,
		})
		totalEntities += cnt
	}

	var pepCount int
	_ = h.db.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM pep_profiles").Scan(&pepCount)

	// Manual download sources (ICIJ, GLEIF, UK PSC)
	var manualSources []map[string]interface{}
	for _, s := range ingestion.ManualDownloadSources {
		manualSources = append(manualSources, map[string]interface{}{
			"name":         s.Name,
			"url":          s.URL,
			"frequency":    s.Frequency,
			"est_records":  s.EstRecords,
			"instructions": s.Instructions,
		})
	}

	Success(w, map[string]interface{}{
		"loaded":          loaded,
		"total_entities":  totalEntities,
		"total_peps":      pepCount,
		"total_profiles":  totalEntities + pepCount,
		"available_count": len(ingestion.AllSources),
		"manual_sources":  manualSources,
	}, http.StatusOK)
}
