package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

type BatchHandler struct {
	batches storage.BatchRepository
	results storage.BatchResultRepository
}

func NewBatchHandler(
	batches storage.BatchRepository,
	results storage.BatchResultRepository,
) *BatchHandler {
	return &BatchHandler{batches: batches, results: results}
}

type BatchScreenRequest struct {
	Entities []BatchEntity `json:"entities"`
	Format   string        `json:"format"`
}

type BatchEntity struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

func (bh *BatchHandler) BatchScreen(w http.ResponseWriter, r *http.Request) {
	tenantID := GetTenantID(r)
	if tenantID == "" {
		Error(w, "UNAUTHORIZED", "missing tenant", http.StatusUnauthorized)
		return
	}
	tid, err := domain.NewTenantID(tenantID)
	if err != nil {
		Error(w, "INVALID_TENANT", err.Error(), http.StatusBadRequest)
		return
	}

	var req BatchScreenRequest
	if err := DecodeJSON(r, &req); err != nil {
		Error(w, "INVALID_REQUEST", "bad json", http.StatusBadRequest)
		return
	}
	if len(req.Entities) == 0 {
		Error(w, "EMPTY_BATCH", "entities required", http.StatusBadRequest)
		return
	}

	job, err := domain.NewBatchJob(tid, len(req.Entities), req.Format)
	if err != nil {
		Error(w, "INVALID_BATCH", err.Error(), http.StatusBadRequest)
		return
	}
	if err := bh.batches.Create(r.Context(), job); err != nil {
		Error(w, "DB_ERROR", "failed to create batch", http.StatusInternalServerError)
		return
	}

	Success(w, map[string]interface{}{
		"batch_id":     job.ID,
		"entity_count": job.EntityCount,
		"status":       string(job.Status),
	}, http.StatusAccepted)
}
