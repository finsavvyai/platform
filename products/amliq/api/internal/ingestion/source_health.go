package ingestion

import (
	"sync"
	"time"
)

// SourceStatus represents the health state of a data source.
type SourceStatus string

const (
	StatusHealthy  SourceStatus = "healthy"
	StatusDegraded SourceStatus = "degraded"
	StatusDown     SourceStatus = "down"
)

// SourceHealth tracks the operational health of a single data source.
type SourceHealth struct {
	SourceID            string       `json:"source_id"`
	Status              SourceStatus `json:"status"`
	LastSuccess         time.Time    `json:"last_success"`
	LastFailure         time.Time    `json:"last_failure"`
	ConsecutiveFailures int          `json:"consecutive_failures"`
	AvgLatencyMs        int64        `json:"avg_latency_ms"`
	EntityCount         int          `json:"entity_count"`
	totalLatency        int64
	successCount        int64
}

// HealthTracker monitors health of all data sources.
type HealthTracker struct {
	mu      sync.RWMutex
	sources map[string]*SourceHealth
}

// NewHealthTracker creates a new tracker.
func NewHealthTracker() *HealthTracker {
	return &HealthTracker{sources: make(map[string]*SourceHealth)}
}

// RecordSuccess records a successful fetch for a source.
func (ht *HealthTracker) RecordSuccess(sourceID string, latencyMs int64, count int) {
	ht.mu.Lock()
	defer ht.mu.Unlock()
	h := ht.getOrCreate(sourceID)
	h.LastSuccess = time.Now().UTC()
	h.ConsecutiveFailures = 0
	h.EntityCount = count
	h.totalLatency += latencyMs
	h.successCount++
	if h.successCount > 0 {
		h.AvgLatencyMs = h.totalLatency / h.successCount
	}
	h.Status = StatusHealthy
}

// RecordFailure records a failed fetch for a source.
func (ht *HealthTracker) RecordFailure(sourceID string, err error) {
	ht.mu.Lock()
	defer ht.mu.Unlock()
	h := ht.getOrCreate(sourceID)
	h.LastFailure = time.Now().UTC()
	h.ConsecutiveFailures++
	if h.ConsecutiveFailures >= 3 {
		h.Status = StatusDown
	} else {
		h.Status = StatusDegraded
	}
}

func (ht *HealthTracker) getOrCreate(id string) *SourceHealth {
	if h, ok := ht.sources[id]; ok {
		return h
	}
	h := &SourceHealth{SourceID: id, Status: StatusHealthy}
	ht.sources[id] = h
	return h
}
