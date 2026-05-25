package mocks

import (
	"context"
	"strings"
	"sync"
	"time"

	"github.com/queryflux/backend/internal/application/ports"
	"github.com/queryflux/backend/internal/domain"
)

// MockMonitoringService implements MonitoringService
type MockMonitoringService struct {
	metrics map[string]*ServiceMetrics
	mu      sync.RWMutex
}

type ServiceMetrics struct {
	Requests        int
	Errors          int
	TotalLatency    time.Duration
	TotalTokens     int
	LastRequestTime time.Time
}

func NewMockMonitoringService() *MockMonitoringService {
	return &MockMonitoringService{
		metrics: make(map[string]*ServiceMetrics),
	}
}

func (m *MockMonitoringService) RecordRequest(ctx context.Context, service domain.AIService, operation string, duration time.Duration, tokensUsed int, success bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	key := string(service) + ":" + operation
	if m.metrics[key] == nil {
		m.metrics[key] = &ServiceMetrics{}
	}

	m.metrics[key].Requests++
	m.metrics[key].TotalLatency += duration
	m.metrics[key].TotalTokens += tokensUsed
	m.metrics[key].LastRequestTime = time.Now()

	if !success {
		m.metrics[key].Errors++
	}
}

func (m *MockMonitoringService) RecordError(ctx context.Context, service domain.AIService, operation string, error string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	key := string(service) + ":" + operation
	if m.metrics[key] == nil {
		m.metrics[key] = &ServiceMetrics{}
	}

	m.metrics[key].Errors++
}

func (m *MockMonitoringService) RecordLatency(ctx context.Context, service domain.AIService, operation string, latency time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()

	key := string(service) + ":" + operation
	if m.metrics[key] == nil {
		m.metrics[key] = &ServiceMetrics{}
	}

	m.metrics[key].TotalLatency += latency
	m.metrics[key].Requests++
}

func (m *MockMonitoringService) GetAIMetrics(ctx context.Context, service domain.AIService, timeRange time.Duration) (map[string]interface{}, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var totalRequests, totalErrors, totalTokens int
	var totalLatency time.Duration

	for key, metrics := range m.metrics {
		if strings.HasPrefix(key, string(service)) {
			totalRequests += metrics.Requests
			totalErrors += metrics.Errors
			totalTokens += metrics.TotalTokens
			totalLatency += metrics.TotalLatency
		}
	}

	avgLatency := time.Duration(0)
	if totalRequests > 0 {
		avgLatency = totalLatency / time.Duration(totalRequests)
	}

	errorRate := float64(0)
	if totalRequests > 0 {
		errorRate = float64(totalErrors) / float64(totalRequests)
	}

	return map[string]interface{}{
		"total_requests":  totalRequests,
		"total_errors":    totalErrors,
		"total_tokens":    totalTokens,
		"average_latency": avgLatency,
		"error_rate":      errorRate,
	}, nil
}

func (m *MockMonitoringService) GetMetrics(ctx context.Context, query *ports.MetricsQuery) ([]*domain.Metric, error) {
	return nil, nil
}

func (m *MockMonitoringService) Start(ctx context.Context) error {
	return nil
}

func (m *MockMonitoringService) Stop(ctx context.Context) error {
	return nil
}

func (m *MockMonitoringService) CollectMetric(ctx context.Context, metric *domain.Metric) error {
	return nil
}

func (m *MockMonitoringService) CollectMetrics(ctx context.Context, metrics []*domain.Metric) error {
	return nil
}

func (m *MockMonitoringService) GetMetricSeries(ctx context.Context, query *ports.MetricsQuery) ([]*domain.MetricSeries, error) {
	return nil, nil
}

func (m *MockMonitoringService) CreateAlert(ctx context.Context, alert *domain.Alert) error {
	return nil
}

func (m *MockMonitoringService) GetAlerts(ctx context.Context, filters ports.AlertFilters) ([]*domain.Alert, error) {
	return nil, nil
}

func (m *MockMonitoringService) ResolveAlert(ctx context.Context, alertID string) error {
	return nil
}
