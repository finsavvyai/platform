// Package metrics is a zero-dep Prometheus text-format exporter.
// We deliberately avoid client_golang + its transitive deps because
// the metrics surface is small (5 counters, 1 latency sum/count) and
// hand-rolling keeps the binary lean. If the surface grows past ~15
// series, swap for client_golang.
package metrics

import (
	"fmt"
	"io"
	"sync/atomic"
)

// Registry is the singleton metrics state. Concurrent-safe via
// atomic ops; no mutexes on the hot path so /v1/messages stays
// fast under load.
type Registry struct {
	requestsOK            atomic.Int64
	requestsError         atomic.Int64
	requestsQuotaExceeded atomic.Int64
	requestsAuthFailed    atomic.Int64
	dlpRedactions         atomic.Int64
	latencyCount          atomic.Int64
	latencyMicrosSum      atomic.Int64
}

func NewRegistry() *Registry { return &Registry{} }

func (r *Registry) IncRequestOK()            { r.requestsOK.Add(1) }
func (r *Registry) IncRequestError()         { r.requestsError.Add(1) }
func (r *Registry) IncRequestQuotaExceeded() { r.requestsQuotaExceeded.Add(1) }
func (r *Registry) IncRequestAuthFailed()    { r.requestsAuthFailed.Add(1) }
func (r *Registry) AddDLPRedactions(n int)   { r.dlpRedactions.Add(int64(n)) }

// ObserveLatencyMicros records one provider call's latency. Prom
// scrapers compute averages from _sum/_count and rate from rate(_count[1m]).
// Real bucketed histograms are deferred until we genuinely need
// p50/p99 SLO charting; sum+count covers the day-one dashboards.
func (r *Registry) ObserveLatencyMicros(usec int64) {
	r.latencyCount.Add(1)
	r.latencyMicrosSum.Add(usec)
}

// WriteText emits Prom text format to w. Stable order so diff'ing
// scrape outputs across versions is sensible. HELP + TYPE per series
// because Prometheus stops scraping a metric whose type changes
// without an explicit declaration.
func (r *Registry) WriteText(w io.Writer) {
	emit := func(name, help, kind string, val int64) {
		fmt.Fprintf(w, "# HELP %s %s\n# TYPE %s %s\n%s %d\n",
			name, help, name, kind, name, val)
	}
	emit("sdlc_requests_total_ok",
		"Successful /v1/messages calls (provider returned 2xx)",
		"counter", r.requestsOK.Load())
	emit("sdlc_requests_total_error",
		"Failed /v1/messages calls (any provider/upstream error)",
		"counter", r.requestsError.Load())
	emit("sdlc_requests_total_quota_exceeded",
		"/v1/messages calls rejected by the quota enforcer (429)",
		"counter", r.requestsQuotaExceeded.Load())
	emit("sdlc_requests_total_auth_failed",
		"Bad sk_sdlc_* keys rejected by the auth middleware (401)",
		"counter", r.requestsAuthFailed.Load())
	emit("sdlc_dlp_redactions_total",
		"PAN/IBAN/BIC/email/phone tokens redacted by MaskAML",
		"counter", r.dlpRedactions.Load())
	emit("sdlc_provider_latency_microseconds_count",
		"Number of provider.Complete calls measured",
		"counter", r.latencyCount.Load())
	emit("sdlc_provider_latency_microseconds_sum",
		"Cumulative provider.Complete latency in microseconds",
		"counter", r.latencyMicrosSum.Load())
}
