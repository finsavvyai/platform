package policy

import (
	"sync"
	"sync/atomic"
	"time"
)

// PolicyMetricsCollector collects policy evaluation metrics
type PolicyMetricsCollector struct {
	evaluationsTotal   int64
	errorsTotal        int64
	cacheHits          int64
	totalLatency       int64
	latencies          []time.Duration
	lastEvaluationTime time.Time
	lastUpdateTime     time.Time
	mu                 sync.RWMutex
}

// NewPolicyMetricsCollector creates a new metrics collector
func NewPolicyMetricsCollector() *PolicyMetricsCollector {
	return &PolicyMetricsCollector{
		latencies:      make([]time.Duration, 0, 1000),
		lastUpdateTime: time.Now(),
	}
}

// RecordEvaluation records a policy evaluation
func (m *PolicyMetricsCollector) RecordEvaluation() {
	atomic.AddInt64(&m.evaluationsTotal, 1)
	m.lastEvaluationTime = time.Now()
	m.lastUpdateTime = time.Now()
}

// RecordError records a policy evaluation error
func (m *PolicyMetricsCollector) RecordError() {
	atomic.AddInt64(&m.errorsTotal, 1)
	m.lastUpdateTime = time.Now()
}

// RecordCacheHit records a cache hit
func (m *PolicyMetricsCollector) RecordCacheHit() {
	atomic.AddInt64(&m.cacheHits, 1)
	m.lastUpdateTime = time.Now()
}

// RecordLatency records evaluation latency
func (m *PolicyMetricsCollector) RecordLatency(latencyMs int) {
	atomic.AddInt64(&m.totalLatency, int64(latencyMs))

	m.mu.Lock()
	defer m.mu.Unlock()

	// Keep only last 1000 latency measurements
	if len(m.latencies) >= 1000 {
		m.latencies = m.latencies[1:]
	}
	m.latencies = append(m.latencies, time.Duration(latencyMs)*time.Millisecond)
	m.lastUpdateTime = time.Now()
}

// GetMetrics returns current metrics
func (m *PolicyMetricsCollector) GetMetrics() PolicyMetrics {
	m.mu.RLock()
	defer m.mu.RUnlock()

	evaluations := atomic.LoadInt64(&m.evaluationsTotal)
	errors := atomic.LoadInt64(&m.errorsTotal)
	cacheHits := atomic.LoadInt64(&m.cacheHits)
	totalLatency := atomic.LoadInt64(&m.totalLatency)

	avgLatency := time.Duration(0)
	if evaluations > 0 {
		avgLatency = time.Duration(totalLatency/evaluations) * time.Millisecond
	}

	p95Latency := m.calculateP95Latency()

	errorRate := float64(0)
	if evaluations > 0 {
		errorRate = float64(errors) / float64(evaluations) * 100
	}

	cacheHitRate := float64(0)
	if evaluations > 0 {
		cacheHitRate = float64(cacheHits) / float64(evaluations) * 100
	}

	evaluationsPerSec := 0.0
	if !m.lastEvaluationTime.IsZero() {
		duration := time.Since(m.lastUpdateTime)
		if duration > 0 {
			evaluationsPerSec = float64(evaluations) / duration.Seconds()
		}
	}

	return PolicyMetrics{
		EvaluationsTotal:  evaluations,
		EvaluationsPerSec: evaluationsPerSec,
		AvgLatency:        avgLatency,
		P95Latency:        p95Latency,
		CacheHitRate:      cacheHitRate,
		ActivePolicies:    0, // TODO: Implement active policy counting
		ErrorRate:         errorRate,
		LastUpdated:       m.lastUpdateTime,
	}
}

// calculateP95Latency calculates the 95th percentile latency
func (m *PolicyMetricsCollector) calculateP95Latency() time.Duration {
	if len(m.latencies) == 0 {
		return 0
	}

	// Sort a copy of latencies
	sorted := make([]time.Duration, len(m.latencies))
	copy(sorted, m.latencies)

	// Simple insertion sort (good enough for small arrays)
	for i := 1; i < len(sorted); i++ {
		key := sorted[i]
		j := i - 1
		for j >= 0 && sorted[j] > key {
			sorted[j+1] = sorted[j]
			j--
		}
		sorted[j+1] = key
	}

	// Calculate 95th percentile
	p95Index := int(float64(len(sorted)) * 0.95)
	if p95Index >= len(sorted) {
		p95Index = len(sorted) - 1
	}

	return sorted[p95Index]
}

// Reset resets all metrics
func (m *PolicyMetricsCollector) Reset() {
	atomic.StoreInt64(&m.evaluationsTotal, 0)
	atomic.StoreInt64(&m.errorsTotal, 0)
	atomic.StoreInt64(&m.cacheHits, 0)
	atomic.StoreInt64(&m.totalLatency, 0)

	m.mu.Lock()
	defer m.mu.Unlock()

	m.latencies = m.latencies[:0]
	m.lastUpdateTime = time.Now()
}

// GetEvaluationsPerPeriod returns evaluations count for the last period
func (m *PolicyMetricsCollector) GetEvaluationsPerPeriod(period time.Duration) int64 {
	// TODO: Implement sliding window evaluation counting
	return atomic.LoadInt64(&m.evaluationsTotal)
}

// GetErrorRate returns the current error rate
func (m *PolicyMetricsCollector) GetErrorRate() float64 {
	evaluations := atomic.LoadInt64(&m.evaluationsTotal)
	errors := atomic.LoadInt64(&m.errorsTotal)

	if evaluations == 0 {
		return 0
	}

	return float64(errors) / float64(evaluations) * 100
}

// GetCacheHitRate returns the current cache hit rate
func (m *PolicyMetricsCollector) GetCacheHitRate() float64 {
	evaluations := atomic.LoadInt64(&m.evaluationsTotal)
	cacheHits := atomic.LoadInt64(&m.cacheHits)

	if evaluations == 0 {
		return 0
	}

	return float64(cacheHits) / float64(evaluations) * 100
}
