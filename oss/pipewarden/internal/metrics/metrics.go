// Package metrics exposes Prometheus counters/histograms for production observability.
// Mounted at GET /metrics by the router. Cardinality kept low: status code group
// and method only — no per-path labels — to avoid label explosion.
package metrics

import (
	"net/http"
	"strconv"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	httpRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "pipewarden_http_requests_total",
			Help: "Total HTTP requests processed, labelled by method and status class.",
		},
		[]string{"method", "status_class"},
	)

	httpRequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "pipewarden_http_request_duration_seconds",
			Help:    "HTTP request latency in seconds.",
			Buckets: []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10},
		},
		[]string{"method"},
	)

	scansTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "pipewarden_scans_total",
			Help: "Total pipeline scans run, labelled by analyzer type and outcome.",
		},
		[]string{"analyzer", "outcome"},
	)

	findingsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "pipewarden_findings_total",
			Help: "Total findings produced, labelled by severity.",
		},
		[]string{"severity"},
	)
)

func init() {
	prometheus.MustRegister(httpRequestsTotal, httpRequestDuration, scansTotal, findingsTotal)
}

// Handler returns the Prometheus scrape handler for GET /metrics.
func Handler() http.Handler {
	return promhttp.Handler()
}

// RecordHTTP increments request counters and observes latency.
func RecordHTTP(method string, status int, duration time.Duration) {
	httpRequestsTotal.WithLabelValues(method, statusClass(status)).Inc()
	httpRequestDuration.WithLabelValues(method).Observe(duration.Seconds())
}

// RecordScan increments scan counters per analyzer outcome.
func RecordScan(analyzer, outcome string) {
	scansTotal.WithLabelValues(analyzer, outcome).Inc()
}

// RecordFinding increments the per-severity finding counter.
func RecordFinding(severity string) {
	findingsTotal.WithLabelValues(severity).Inc()
}

func statusClass(status int) string {
	if status == 0 {
		return "unknown"
	}
	return strconv.Itoa(status/100) + "xx"
}
