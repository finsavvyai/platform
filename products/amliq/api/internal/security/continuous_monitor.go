package security

import (
	"context"
	"fmt"
	"sync"
	"time"
)

type Monitor interface {
	RecordEvent(ctx context.Context, event SecurityEvent) error
	CheckAnomaly(ctx context.Context, tenantID string) (bool, error)
	GetMetrics(ctx context.Context) EventMetrics
}

type ContinuousMonitor struct {
	mu               sync.RWMutex
	events           []SecurityEvent
	tenantMetrics    map[string]*TenantMetrics
	anomalyThreshold int
}

func NewContinuousMonitor(anomalyThreshold int) *ContinuousMonitor {
	if anomalyThreshold < 1 {
		anomalyThreshold = 3
	}
	return &ContinuousMonitor{
		events:           []SecurityEvent{},
		tenantMetrics:    make(map[string]*TenantMetrics),
		anomalyThreshold: anomalyThreshold,
	}
}

func (cm *ContinuousMonitor) RecordEvent(ctx context.Context, event SecurityEvent) error {
	if event.ActorID == "" || event.TenantID == "" {
		return fmt.Errorf("invalid event: missing required fields")
	}
	cm.mu.Lock()
	defer cm.mu.Unlock()
	cm.events = append(cm.events, event)
	if _, exists := cm.tenantMetrics[event.TenantID]; !exists {
		cm.tenantMetrics[event.TenantID] = &TenantMetrics{
			EventCounts:    make(map[EventType]int),
			LastEventTimes: make(map[EventType]time.Time),
			Window:         5 * time.Minute,
			BaselineRate:   1.0,
		}
	}
	metrics := cm.tenantMetrics[event.TenantID]
	metrics.EventCounts[event.EventType]++
	metrics.LastEventTimes[event.EventType] = event.Timestamp
	return nil
}

func (cm *ContinuousMonitor) CheckAnomaly(ctx context.Context, tenantID string) (bool, error) {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	metrics, exists := cm.tenantMetrics[tenantID]
	if !exists {
		return false, nil
	}

	now := time.Now().UTC()
	recentCount := 0

	for _, event := range cm.events {
		if event.TenantID == tenantID &&
			event.Timestamp.After(now.Add(-metrics.Window)) {
			recentCount++
		}
	}

	if recentCount > int(float64(cm.anomalyThreshold)*metrics.BaselineRate) {
		metrics.CurrentRate = float64(recentCount)
		return true, nil
	}

	return false, nil
}

func (cm *ContinuousMonitor) GetMetrics(ctx context.Context) EventMetrics {
	cm.mu.RLock()
	defer cm.mu.RUnlock()

	metrics := EventMetrics{
		TotalEvents:      int64(len(cm.events)),
		EventsByType:     make(map[EventType]int64),
		EventsBySeverity: make(map[Severity]int64),
	}

	for _, event := range cm.events {
		metrics.EventsByType[event.EventType]++
		metrics.EventsBySeverity[event.Severity]++
		if event.Timestamp.After(metrics.LastEventTime) {
			metrics.LastEventTime = event.Timestamp
		}
	}

	return metrics
}
