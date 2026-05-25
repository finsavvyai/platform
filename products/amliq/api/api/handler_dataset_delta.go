package api

import (
	"net/http"
	"time"

	"github.com/aegis-aml/aegis/internal/storage"
)

type DatasetDeltaHandler struct {
	entities storage.EntityRepository
}

func NewDatasetDeltaHandler(entities storage.EntityRepository) *DatasetDeltaHandler {
	return &DatasetDeltaHandler{entities: entities}
}

func (dh *DatasetDeltaHandler) Delta(w http.ResponseWriter, r *http.Request) {
	tenantID := GetTenantID(r)
	if tenantID == "" {
		Error(w, "UNAUTHORIZED", "missing tenant", http.StatusUnauthorized)
		return
	}

	sinceStr := QueryParam(r, "since")
	since := time.Now().AddDate(0, 0, -1)
	if sinceStr != "" {
		if parsed, err := time.Parse(time.RFC3339, sinceStr); err == nil {
			since = parsed
		}
	}

	entities, err := dh.entities.ListUpdatedSince(since)
	if err != nil {
		Error(w, "DB_ERROR", "failed to query", http.StatusInternalServerError)
		return
	}

	Success(w, map[string]interface{}{
		"tenant_id": tenantID,
		"since":     since.Format(time.RFC3339),
		"added":     entities,
		"modified":  []interface{}{},
		"removed":   []string{},
		"count":     len(entities),
	}, http.StatusOK)
}
