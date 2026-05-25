package pipeline

import (
	"sort"
	"sync"
	"sync/atomic"
	"time"
)

// Metrics tracks real-time screening performance with atomic counters.
type Metrics struct {
	total      atomic.Int64
	cacheHits  atomic.Int64
	cacheMiss  atomic.Int64
	queueDepth func() int
	mu         sync.Mutex
	latencies  []int64
	startTime  time.Time
}

// MetricsSnapshot is a JSON-serializable performance snapshot.
// P50 + P99 are the tail-sensitive values a public latency status
// page needs; P95 stays for existing Prometheus exporters.
type MetricsSnapshot struct {
	ScreeningsTotal  int64   `json:"screenings_total"`
	ScreeningsPerSec float64 `json:"screenings_per_second"`
	AvgLatencyMs     int64   `json:"avg_latency_ms"`
	P50LatencyMs     int64   `json:"p50_latency_ms"`
	P95LatencyMs     int64   `json:"p95_latency_ms"`
	P99LatencyMs     int64   `json:"p99_latency_ms"`
	QueueDepth       int     `json:"queue_depth"`
	ActiveWorkers    int     `json:"active_workers"`
	CacheHitRate     float64 `json:"cache_hit_rate"`
}

// NewMetrics creates a metrics collector.
func NewMetrics(queueDepthFn func() int) *Metrics {
	return &Metrics{
		latencies:  make([]int64, 0, 10000),
		startTime:  time.Now(),
		queueDepth: queueDepthFn,
	}
}

// RecordScreening records a completed screening with its latency.
func (m *Metrics) RecordScreening(latencyMs int64) {
	m.total.Add(1)
	m.mu.Lock()
	m.latencies = append(m.latencies, latencyMs)
	if len(m.latencies) > 100000 {
		m.latencies = m.latencies[50000:]
	}
	m.mu.Unlock()
}

// RecordCacheHit increments the cache hit counter.
func (m *Metrics) RecordCacheHit() { m.cacheHits.Add(1) }

// RecordCacheMiss increments the cache miss counter.
func (m *Metrics) RecordCacheMiss() { m.cacheMiss.Add(1) }

// Stats returns a snapshot of current performance metrics.
func (m *Metrics) Stats() MetricsSnapshot {
	total := m.total.Load()
	elapsed := time.Since(m.startTime).Seconds()
	perSec := float64(0)
	if elapsed > 0 {
		perSec = float64(total) / elapsed
	}
	m.mu.Lock()
	avgMs, p50Ms, p95Ms, p99Ms := computeLatencies(m.latencies)
	m.mu.Unlock()
	hits, miss := m.cacheHits.Load(), m.cacheMiss.Load()
	hitRate := float64(0)
	if hits+miss > 0 {
		hitRate = float64(hits) / float64(hits+miss)
	}
	depth := 0
	if m.queueDepth != nil {
		depth = m.queueDepth()
	}
	return MetricsSnapshot{
		ScreeningsTotal: total, ScreeningsPerSec: perSec,
		AvgLatencyMs: avgMs,
		P50LatencyMs: p50Ms, P95LatencyMs: p95Ms, P99LatencyMs: p99Ms,
		QueueDepth: depth, CacheHitRate: hitRate,
	}
}

func computeLatencies(lats []int64) (avg, p50, p95, p99 int64) {
	n := len(lats)
	if n == 0 {
		return 0, 0, 0, 0
	}
	sorted := make([]int64, n)
	copy(sorted, lats)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i] < sorted[j] })
	var sum int64
	for _, v := range sorted {
		sum += v
	}
	idx := func(q float64) int {
		i := int(float64(n) * q)
		if i >= n {
			i = n - 1
		}
		return i
	}
	return sum / int64(n), sorted[idx(0.50)], sorted[idx(0.95)], sorted[idx(0.99)]
}
