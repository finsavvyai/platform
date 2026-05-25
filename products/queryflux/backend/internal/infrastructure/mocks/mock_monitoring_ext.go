package mocks

import (
	"context"
	"strings"
	"time"

	"github.com/queryflux/backend/internal/application/ports"
	"github.com/queryflux/backend/internal/domain"
)

func (m *MockMonitoringService) CreateDashboard(ctx context.Context, dashboard *domain.MonitoringDashboard) error {
	return nil
}

func (m *MockMonitoringService) GetDashboard(ctx context.Context, id string) (*domain.MonitoringDashboard, error) {
	return nil, nil
}

func (m *MockMonitoringService) GetDashboards(ctx context.Context, filters ports.DashboardFilters) ([]*domain.MonitoringDashboard, error) {
	return nil, nil
}

func (m *MockMonitoringService) GetHealthChecks(ctx context.Context) ([]*domain.HealthCheck, error) {
	return nil, nil
}

func (m *MockMonitoringService) ExportPrometheusMetrics(ctx context.Context) (string, error) {
	return "", nil
}

func (m *MockMonitoringService) GetErrorRate(ctx context.Context, service domain.AIService, timeRange time.Duration) (float64, error) {
	metrics, err := m.GetAIMetrics(ctx, service, timeRange)
	if err != nil {
		return 0, err
	}

	if errorRate, ok := metrics["error_rate"].(float64); ok {
		return errorRate, nil
	}

	return 0, nil
}

func (m *MockMonitoringService) GetAverageLatency(ctx context.Context, service domain.AIService, operation string, timeRange time.Duration) (time.Duration, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	key := string(service) + ":" + operation
	if metrics, ok := m.metrics[key]; ok && metrics.Requests > 0 {
		return metrics.TotalLatency / time.Duration(metrics.Requests), nil
	}

	return 0, nil
}

func (m *MockMonitoringService) GetTokenUsage(ctx context.Context, service domain.AIService, timeRange time.Duration) (int, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	totalTokens := 0
	for key, metrics := range m.metrics {
		if strings.HasPrefix(key, string(service)) {
			totalTokens += metrics.TotalTokens
		}
	}

	return totalTokens, nil
}

func (m *MockMonitoringService) SetAlertThreshold(ctx context.Context, service domain.AIService, metric string, threshold float64) error {
	return nil
}

func (m *MockMonitoringService) AggregateMetrics(ctx context.Context, query *ports.AggregationQuery) (*ports.AggregatedMetrics, error) {
	return nil, nil
}

func (m *MockMonitoringService) CheckAlerts(ctx context.Context) ([]map[string]interface{}, error) {
	return []map[string]interface{}{}, nil
}
