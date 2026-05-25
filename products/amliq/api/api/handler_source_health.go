package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/ingestion"
)

// SourceHealthHandler exposes data source health information.
type SourceHealthHandler struct {
	tracker *ingestion.HealthTracker
}

// NewSourceHealthHandler creates a handler for source health checks.
func NewSourceHealthHandler(tracker *ingestion.HealthTracker) *SourceHealthHandler {
	return &SourceHealthHandler{tracker: tracker}
}

// GetHealth returns the health of all tracked data sources.
func (h *SourceHealthHandler) GetHealth(w http.ResponseWriter, r *http.Request) {
	var results []sourceHealthResponse
	allHealthy := h.tracker.AllHealthy()
	degraded := h.tracker.DegradedSources()

	for _, src := range ingestion.AllSources {
		sh := h.tracker.GetHealth(src.ID)
		if sh == nil {
			results = append(results, sourceHealthResponse{
				SourceID: src.ID,
				Name:     src.Name,
				Status:   "unknown",
			})
			continue
		}
		results = append(results, sourceHealthResponse{
			SourceID:     sh.SourceID,
			Name:         src.Name,
			Status:       string(sh.Status),
			LastSuccess:  sh.LastSuccess.String(),
			EntityCount:  sh.EntityCount,
			AvgLatencyMs: sh.AvgLatencyMs,
			Failures:     sh.ConsecutiveFailures,
		})
	}

	Success(w, map[string]interface{}{
		"sources":     results,
		"all_healthy": allHealthy,
		"degraded":    degraded,
	}, http.StatusOK)
}

type sourceHealthResponse struct {
	SourceID     string `json:"source_id"`
	Name         string `json:"name"`
	Status       string `json:"status"`
	LastSuccess  string `json:"last_success,omitempty"`
	EntityCount  int    `json:"entity_count"`
	AvgLatencyMs int64  `json:"avg_latency_ms"`
	Failures     int    `json:"consecutive_failures"`
}
