package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/storage"
)

type BatchStatusHandler struct {
	batches storage.BatchRepository
	results storage.BatchResultRepository
}

func NewBatchStatusHandler(
	b storage.BatchRepository, r storage.BatchResultRepository,
) *BatchStatusHandler {
	return &BatchStatusHandler{batches: b, results: r}
}

func (h *BatchStatusHandler) GetBatch(w http.ResponseWriter, r *http.Request) {
	batchID := PathParam(r, "id")
	if batchID == "" {
		Error(w, "MISSING_PARAM", "id required", http.StatusBadRequest)
		return
	}
	job, err := h.batches.GetByID(r.Context(), batchID)
	if err != nil {
		Error(w, "NOT_FOUND", "batch not found", http.StatusNotFound)
		return
	}
	Success(w, map[string]interface{}{
		"batch_id":     job.ID,
		"status":       string(job.Status),
		"entity_count": job.EntityCount,
		"processed":    job.ProcessedAt,
		"match_count":  job.MatchCount,
		"created_at":   job.CreatedAt,
		"completed_at": job.CompletedAt,
	}, http.StatusOK)
}

func (h *BatchStatusHandler) GetResults(w http.ResponseWriter, r *http.Request) {
	batchID := PathParam(r, "id")
	if batchID == "" {
		Error(w, "MISSING_PARAM", "id required", http.StatusBadRequest)
		return
	}
	results, err := h.results.ListByBatchID(r.Context(), batchID)
	if err != nil {
		Error(w, "DB_ERROR", "failed to load", http.StatusInternalServerError)
		return
	}
	format := QueryParam(r, "format")
	if format == "csv" {
		writeBatchCSV(w, results)
		return
	}
	Success(w, results, http.StatusOK)
}
