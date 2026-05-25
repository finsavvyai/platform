package api

import (
	"fmt"
	"net/http"

	"github.com/aegis-aml/aegis/internal/pipeline"
)

// MetricsHandler serves real-time performance statistics.
type MetricsHandler struct {
	metrics *pipeline.Metrics
}

// NewMetricsHandler creates a metrics endpoint handler.
func NewMetricsHandler(m *pipeline.Metrics) *MetricsHandler {
	return &MetricsHandler{metrics: m}
}

// GetMetrics returns JSON performance snapshot.
func (mh *MetricsHandler) GetMetrics(w http.ResponseWriter, r *http.Request) {
	if mh.metrics == nil {
		Error(w, "NOT_CONFIGURED", "metrics not available", http.StatusServiceUnavailable)
		return
	}
	Success(w, mh.metrics.Stats(), http.StatusOK)
}

// GetPrometheus returns Prometheus-compatible text metrics.
func (mh *MetricsHandler) GetPrometheus(w http.ResponseWriter, r *http.Request) {
	if mh.metrics == nil {
		http.Error(w, "metrics not available", http.StatusServiceUnavailable)
		return
	}
	stats := mh.metrics.Stats()
	w.Header().Set("Content-Type", "text/plain; version=0.0.4")
	w.WriteHeader(http.StatusOK)

	fmt.Fprintf(w, "# HELP amliq_screenings_total Total screenings processed\n")
	fmt.Fprintf(w, "# TYPE amliq_screenings_total counter\n")
	fmt.Fprintf(w, "amliq_screenings_total %d\n", stats.ScreeningsTotal)

	fmt.Fprintf(w, "# HELP amliq_screenings_per_second Current throughput\n")
	fmt.Fprintf(w, "# TYPE amliq_screenings_per_second gauge\n")
	fmt.Fprintf(w, "amliq_screenings_per_second %.2f\n", stats.ScreeningsPerSec)

	fmt.Fprintf(w, "# HELP amliq_latency_avg_ms Average latency\n")
	fmt.Fprintf(w, "# TYPE amliq_latency_avg_ms gauge\n")
	fmt.Fprintf(w, "amliq_latency_avg_ms %d\n", stats.AvgLatencyMs)

	fmt.Fprintf(w, "# HELP amliq_latency_p95_ms P95 latency\n")
	fmt.Fprintf(w, "# TYPE amliq_latency_p95_ms gauge\n")
	fmt.Fprintf(w, "amliq_latency_p95_ms %d\n", stats.P95LatencyMs)

	fmt.Fprintf(w, "# HELP amliq_queue_depth Current queue depth\n")
	fmt.Fprintf(w, "# TYPE amliq_queue_depth gauge\n")
	fmt.Fprintf(w, "amliq_queue_depth %d\n", stats.QueueDepth)

	fmt.Fprintf(w, "# HELP amliq_cache_hit_rate Cache hit ratio\n")
	fmt.Fprintf(w, "# TYPE amliq_cache_hit_rate gauge\n")
	fmt.Fprintf(w, "amliq_cache_hit_rate %.4f\n", stats.CacheHitRate)
}
