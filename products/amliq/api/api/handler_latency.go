package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/pipeline"
)

// LatencyHandler serves a PUBLIC, no-auth slice of the metrics
// snapshot — just the latency percentiles. Ships the numbers that
// back the "sub-50ms screening" marketing claim vs. incumbent
// vendors whose latency is never published. Admins still have the
// full metrics view (queue depth, cache hit rate, totals) behind
// /api/v1/admin/metrics.
type LatencyHandler struct {
	metrics *pipeline.Metrics
}

// NewLatencyHandler creates a latency snapshot handler.
func NewLatencyHandler(m *pipeline.Metrics) *LatencyHandler {
	return &LatencyHandler{metrics: m}
}

// publicLatency is the no-auth JSON shape.
type publicLatency struct {
	ScreeningsTotal  int64   `json:"screenings_total"`
	ScreeningsPerSec float64 `json:"screenings_per_second"`
	AvgLatencyMs     int64   `json:"avg_latency_ms"`
	P50LatencyMs     int64   `json:"p50_latency_ms"`
	P95LatencyMs     int64   `json:"p95_latency_ms"`
	P99LatencyMs     int64   `json:"p99_latency_ms"`
}

// Get returns the latency snapshot with no-cache headers so status
// widgets never see stale numbers.
func (lh *LatencyHandler) Get(w http.ResponseWriter, r *http.Request) {
	if lh.metrics == nil {
		Error(w, "NOT_CONFIGURED", "metrics not available",
			http.StatusServiceUnavailable)
		return
	}
	s := lh.metrics.Stats()
	w.Header().Set("Cache-Control", "no-store")
	Success(w, publicLatency{
		ScreeningsTotal:  s.ScreeningsTotal,
		ScreeningsPerSec: s.ScreeningsPerSec,
		AvgLatencyMs:     s.AvgLatencyMs,
		P50LatencyMs:     s.P50LatencyMs,
		P95LatencyMs:     s.P95LatencyMs,
		P99LatencyMs:     s.P99LatencyMs,
	}, http.StatusOK)
}
