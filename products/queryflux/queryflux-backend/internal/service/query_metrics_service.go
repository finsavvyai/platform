package service

import (
	"sort"
	"sync"
	"time"
)

// QueryMetricsService tracks per-query latency and computes P50/P95/P99.
//
// All methods are safe for concurrent use. Samples are kept in a bounded
// ring buffer (default 10 000) so memory stays constant regardless of uptime.
type QueryMetricsService struct {
	mu      sync.RWMutex
	samples []float64 // latency in ms, ring buffer
	head    int
	count   int
	cap     int

	totalQueries int64
	totalErrors  int64
	startTime    time.Time
}

// MetricsSnapshot is a point-in-time view of collected metrics.
type MetricsSnapshot struct {
	TotalQueries int64   `json:"totalQueries"`
	TotalErrors  int64   `json:"totalErrors"`
	UptimeSeconds float64 `json:"uptimeSeconds"`
	P50Ms        float64 `json:"p50Ms"`
	P95Ms        float64 `json:"p95Ms"`
	P99Ms        float64 `json:"p99Ms"`
	AvgMs        float64 `json:"avgMs"`
	MaxMs        float64 `json:"maxMs"`
	SampleCount  int     `json:"sampleCount"`
}

// NewQueryMetricsService creates a service with the given ring-buffer capacity.
// Pass 0 to use the default of 10 000.
func NewQueryMetricsService(capacity int) *QueryMetricsService {
	if capacity <= 0 {
		capacity = 10_000
	}
	return &QueryMetricsService{
		samples:   make([]float64, capacity),
		cap:       capacity,
		startTime: time.Now(),
	}
}

// RecordQuery records a query latency sample. Set isError=true for failed queries.
func (s *QueryMetricsService) RecordQuery(latencyMs float64, isError bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.samples[s.head] = latencyMs
	s.head = (s.head + 1) % s.cap
	if s.count < s.cap {
		s.count++
	}

	s.totalQueries++
	if isError {
		s.totalErrors++
	}
}

// Snapshot returns a current point-in-time metrics view.
func (s *QueryMetricsService) Snapshot() MetricsSnapshot {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.count == 0 {
		return MetricsSnapshot{
			TotalQueries:  s.totalQueries,
			TotalErrors:   s.totalErrors,
			UptimeSeconds: time.Since(s.startTime).Seconds(),
		}
	}

	// Copy active samples and sort for percentile computation.
	active := make([]float64, s.count)
	copy(active, s.samples[:s.count])
	sort.Float64s(active)

	avg, max := computeStats(active)

	return MetricsSnapshot{
		TotalQueries:  s.totalQueries,
		TotalErrors:   s.totalErrors,
		UptimeSeconds: time.Since(s.startTime).Seconds(),
		P50Ms:         percentile(active, 0.50),
		P95Ms:         percentile(active, 0.95),
		P99Ms:         percentile(active, 0.99),
		AvgMs:         avg,
		MaxMs:         max,
		SampleCount:   s.count,
	}
}

// Reset clears all samples and counters. Useful between test runs.
func (s *QueryMetricsService) Reset() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.head = 0
	s.count = 0
	s.totalQueries = 0
	s.totalErrors = 0
	s.startTime = time.Now()
}

// ── private helpers ──────────────────────────────────────────────────────────

func percentile(sorted []float64, p float64) float64 {
	if len(sorted) == 0 {
		return 0
	}
	idx := int(float64(len(sorted)-1) * p)
	return sorted[idx]
}

func computeStats(sorted []float64) (avg, max float64) {
	if len(sorted) == 0 {
		return 0, 0
	}
	sum := 0.0
	for _, v := range sorted {
		sum += v
	}
	return sum / float64(len(sorted)), sorted[len(sorted)-1]
}
