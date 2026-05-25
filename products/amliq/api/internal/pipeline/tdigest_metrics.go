package pipeline

import (
	"sync"
	"sync/atomic"
	"time"

	"github.com/caio/go-tdigest/v4"
)

// TDigestMetrics uses a streaming t-digest for O(1) percentile computation
// instead of sorting the entire latency buffer on every Stats() call.
type TDigestMetrics struct {
	total      atomic.Int64
	cacheHits  atomic.Int64
	cacheMiss  atomic.Int64
	queueDepth func() int
	mu         sync.Mutex
	digest     *tdigest.TDigest
	sumMs      int64
	startTime  time.Time
}

// NewTDigestMetrics creates a metrics collector with streaming quantiles.
func NewTDigestMetrics(queueDepthFn func() int) *TDigestMetrics {
	td, _ := tdigest.New(tdigest.Compression(100))
	return &TDigestMetrics{
		digest:     td,
		startTime:  time.Now(),
		queueDepth: queueDepthFn,
	}
}

// RecordScreening records a completed screening with its latency.
func (m *TDigestMetrics) RecordScreening(latencyMs int64) {
	m.total.Add(1)
	m.mu.Lock()
	_ = m.digest.Add(float64(latencyMs))
	m.sumMs += latencyMs
	m.mu.Unlock()
}

// RecordCacheHit increments the cache hit counter.
func (m *TDigestMetrics) RecordCacheHit() { m.cacheHits.Add(1) }

// RecordCacheMiss increments the cache miss counter.
func (m *TDigestMetrics) RecordCacheMiss() { m.cacheMiss.Add(1) }

// Stats returns a snapshot of current performance metrics.
// P95 is computed in O(1) via t-digest quantile estimation.
func (m *TDigestMetrics) Stats() MetricsSnapshot {
	total := m.total.Load()
	elapsed := time.Since(m.startTime).Seconds()
	perSec := float64(0)
	if elapsed > 0 {
		perSec = float64(total) / elapsed
	}
	m.mu.Lock()
	avgMs := int64(0)
	if total > 0 {
		avgMs = m.sumMs / total
	}
	p50Ms := int64(m.digest.Quantile(0.50))
	p95Ms := int64(m.digest.Quantile(0.95))
	p99Ms := int64(m.digest.Quantile(0.99))
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
