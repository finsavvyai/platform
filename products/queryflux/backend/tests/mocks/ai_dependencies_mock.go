package mocks

import (
	"context"
	"time"

	"github.com/queryflux/backend/internal/application/ports"
	"github.com/queryflux/backend/internal/domain"
	"github.com/stretchr/testify/mock"
)

// MockPromptTemplateManager implements a mock prompt template manager
type MockPromptTemplateManager struct {
	mock.Mock
}

func NewMockPromptTemplateManager() *MockPromptTemplateManager {
	return &MockPromptTemplateManager{}
}

func (m *MockPromptTemplateManager) LoadTemplate(ctx context.Context, service domain.AIService, operation string) (*domain.AIPromptTemplate, error) {
	args := m.Called(ctx, service, operation)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.AIPromptTemplate), args.Error(1)
}

func (m *MockPromptTemplateManager) RenderTemplate(ctx context.Context, template *domain.AIPromptTemplate, variables map[string]interface{}) (string, error) {
	args := m.Called(ctx, template, variables)
	return args.String(0), args.Error(1)
}

func (m *MockPromptTemplateManager) ValidateTemplate(ctx context.Context, template *domain.AIPromptTemplate) error {
	args := m.Called(ctx, template)
	return args.Error(0)
}

func (m *MockPromptTemplateManager) UpdateTemplate(ctx context.Context, template *domain.AIPromptTemplate) error {
	args := m.Called(ctx, template)
	return args.Error(0)
}

// MockCacheManager implements a mock cache manager
type MockCacheManager struct {
	mock.Mock
}

func NewMockCacheManager() *MockCacheManager {
	return &MockCacheManager{}
}

func (m *MockCacheManager) Get(ctx context.Context, key string) (interface{}, error) {
	args := m.Called(ctx, key)
	return args.Get(0), args.Error(1)
}

func (m *MockCacheManager) Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	args := m.Called(ctx, key, value, ttl)
	return args.Error(0)
}

func (m *MockCacheManager) Delete(ctx context.Context, key string) error {
	args := m.Called(ctx, key)
	return args.Error(0)
}

func (m *MockCacheManager) Clear(ctx context.Context, pattern string) error {
	args := m.Called(ctx, pattern)
	return args.Error(0)
}

func (m *MockCacheManager) GetStats(ctx context.Context) (map[string]interface{}, error) {
	args := m.Called(ctx)
	return args.Get(0).(map[string]interface{}), args.Error(1)
}

// MockAIHealthChecker implements a mock AI health checker
type MockAIHealthChecker struct {
	mock.Mock
}

func NewMockAIHealthChecker() *MockAIHealthChecker {
	return &MockAIHealthChecker{}
}

func (m *MockAIHealthChecker) CheckHealth(ctx context.Context, service domain.AIService) error {
	args := m.Called(ctx, service)
	return args.Error(0)
}

func (m *MockAIHealthChecker) GetHealthStatus(ctx context.Context) (map[domain.AIService]error, error) {
	args := m.Called(ctx)
	return args.Get(0).(map[domain.AIService]error), args.Error(1)
}

func (m *MockAIHealthChecker) SetHealthCallback(ctx context.Context, service domain.AIService, callback func(error)) error {
	args := m.Called(ctx, service, callback)
	return args.Error(0)
}

func (m *MockAIHealthChecker) SetHealthStatus(service domain.AIService, err error) {
	// Helper for testing scenarios, not part of interface but used in tests
	// No-op for mock.Mock version unless we want to track it
}

// MockMonitoringService implements a mock monitoring service
type MockMonitoringService struct {
	mock.Mock
}

func NewMockMonitoringService() *MockMonitoringService {
	return &MockMonitoringService{}
}

func (m *MockMonitoringService) RecordRequest(ctx context.Context, service domain.AIService, operation string, duration time.Duration, tokensUsed int, success bool) {
	m.Called(ctx, service, operation, duration, tokensUsed, success)
}

func (m *MockMonitoringService) RecordError(ctx context.Context, service domain.AIService, operation string, error string) {
	m.Called(ctx, service, operation, error)
}

func (m *MockMonitoringService) RecordLatency(ctx context.Context, service domain.AIService, operation string, latency time.Duration) {
	m.Called(ctx, service, operation, latency)
}

func (m *MockMonitoringService) GetAIMetrics(ctx context.Context, service domain.AIService, timeRange time.Duration) (map[string]interface{}, error) {
	args := m.Called(ctx, service, timeRange)
	return args.Get(0).(map[string]interface{}), args.Error(1)
}

func (m *MockMonitoringService) Start(ctx context.Context) error {
	args := m.Called(ctx)
	return args.Error(0)
}

func (m *MockMonitoringService) Stop(ctx context.Context) error {
	args := m.Called(ctx)
	return args.Error(0)
}

func (m *MockMonitoringService) CollectMetric(ctx context.Context, metric *domain.Metric) error {
	args := m.Called(ctx, metric)
	return args.Error(0)
}

func (m *MockMonitoringService) CollectMetrics(ctx context.Context, metrics []*domain.Metric) error {
	args := m.Called(ctx, metrics)
	return args.Error(0)
}

func (m *MockMonitoringService) GetMetrics(ctx context.Context, query *ports.MetricsQuery) ([]*domain.Metric, error) {
	args := m.Called(ctx, query)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*domain.Metric), args.Error(1)
}

func (m *MockMonitoringService) GetMetricSeries(ctx context.Context, query *ports.MetricsQuery) ([]*domain.MetricSeries, error) {
	args := m.Called(ctx, query)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*domain.MetricSeries), args.Error(1)
}

func (m *MockMonitoringService) CreateAlert(ctx context.Context, alert *domain.Alert) error {
	args := m.Called(ctx, alert)
	return args.Error(0)
}

func (m *MockMonitoringService) GetAlerts(ctx context.Context, filters ports.AlertFilters) ([]*domain.Alert, error) {
	args := m.Called(ctx, filters)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*domain.Alert), args.Error(1)
}

func (m *MockMonitoringService) CreateDashboard(ctx context.Context, dashboard *domain.MonitoringDashboard) error {
	args := m.Called(ctx, dashboard)
	return args.Error(0)
}

func (m *MockMonitoringService) GetDashboard(ctx context.Context, id string) (*domain.MonitoringDashboard, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.MonitoringDashboard), args.Error(1)
}

func (m *MockMonitoringService) GetDashboards(ctx context.Context, filters ports.DashboardFilters) ([]*domain.MonitoringDashboard, error) {
	args := m.Called(ctx, filters)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*domain.MonitoringDashboard), args.Error(1)
}

func (m *MockMonitoringService) GetHealthChecks(ctx context.Context) ([]*domain.HealthCheck, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*domain.HealthCheck), args.Error(1)
}

func (m *MockMonitoringService) AggregateMetrics(ctx context.Context, query *ports.AggregationQuery) (*ports.AggregatedMetrics, error) {
	args := m.Called(ctx, query)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*ports.AggregatedMetrics), args.Error(1)
}

func (m *MockMonitoringService) ExportPrometheusMetrics(ctx context.Context) (string, error) {
	args := m.Called(ctx)
	return args.String(0), args.Error(1)
}

func (m *MockMonitoringService) ResolveAlert(ctx context.Context, alertID string) error {
	args := m.Called(ctx, alertID)
	return args.Error(0)
}

func (m *MockMonitoringService) GetErrorRate(ctx context.Context, service domain.AIService, timeRange time.Duration) (float64, error) {
	args := m.Called(ctx, service, timeRange)
	return args.Get(0).(float64), args.Error(1)
}

func (m *MockMonitoringService) GetAverageLatency(ctx context.Context, service domain.AIService, operation string, timeRange time.Duration) (time.Duration, error) {
	args := m.Called(ctx, service, operation, timeRange)
	return args.Get(0).(time.Duration), args.Error(1)
}

func (m *MockMonitoringService) GetTokenUsage(ctx context.Context, service domain.AIService, timeRange time.Duration) (int, error) {
	args := m.Called(ctx, service, timeRange)
	return args.Int(0), args.Error(1)
}

func (m *MockMonitoringService) SetAlertThreshold(ctx context.Context, service domain.AIService, metric string, threshold float64) error {
	args := m.Called(ctx, service, metric, threshold)
	return args.Error(0)
}

func (m *MockMonitoringService) CheckAlerts(ctx context.Context) ([]map[string]interface{}, error) {
	args := m.Called(ctx)
	return args.Get(0).([]map[string]interface{}), args.Error(1)
}

// MockAuditLogger implements a mock audit logger
type MockAuditLogger struct {
	mock.Mock
}

func NewMockAuditLogger() *MockAuditLogger {
	return &MockAuditLogger{}
}

func (m *MockAuditLogger) LogRequest(ctx context.Context, request *domain.AIRequest) error {
	args := m.Called(ctx, request)
	return args.Error(0)
}

func (m *MockAuditLogger) LogResponse(ctx context.Context, response *domain.AIResponse) error {
	args := m.Called(ctx, response)
	return args.Error(0)
}

func (m *MockAuditLogger) LogError(ctx context.Context, requestID string, error error) error {
	args := m.Called(ctx, requestID, error)
	return args.Error(0)
}

func (m *MockAuditLogger) LogDataAccess(ctx context.Context, userID string, operation string, dataAccessed interface{}) error {
	args := m.Called(ctx, userID, operation, dataAccessed)
	return args.Error(0)
}

func (m *MockAuditLogger) GetAuditLogs(ctx context.Context, userID string, startDate, endDate time.Time) ([]interface{}, error) {
	args := m.Called(ctx, userID, startDate, endDate)
	return args.Get(0).([]interface{}), args.Error(1)
}

func (m *MockAuditLogger) GetAuditLogsByOperation(ctx context.Context, operation string, startDate, endDate time.Time) ([]interface{}, error) {
	args := m.Called(ctx, operation, startDate, endDate)
	return args.Get(0).([]interface{}), args.Error(1)
}

func (m *MockAuditLogger) GetAuditLogsByService(ctx context.Context, service domain.AIService, startDate, endDate time.Time) ([]interface{}, error) {
	args := m.Called(ctx, service, startDate, endDate)
	return args.Get(0).([]interface{}), args.Error(1)
}

// MockEncryptionService implements a mock encryption service
type MockEncryptionService struct {
	mock.Mock
}

func NewMockEncryptionService() *MockEncryptionService {
	return &MockEncryptionService{}
}

func (m *MockEncryptionService) EncryptAPIKey(ctx context.Context, apiKey string) (string, error) {
	args := m.Called(ctx, apiKey)
	return args.String(0), args.Error(1)
}

func (m *MockEncryptionService) DecryptAPIKey(ctx context.Context, encryptedKey string) (string, error) {
	args := m.Called(ctx, encryptedKey)
	return args.String(0), args.Error(1)
}

func (m *MockEncryptionService) EncryptRequest(ctx context.Context, request interface{}) (string, error) {
	args := m.Called(ctx, request)
	return args.String(0), args.Error(1)
}

func (m *MockEncryptionService) DecryptRequest(ctx context.Context, encryptedRequest string) (interface{}, error) {
	args := m.Called(ctx, encryptedRequest)
	return args.Get(0), args.Error(1)
}

func (m *MockEncryptionService) EncryptResponse(ctx context.Context, response interface{}) (string, error) {
	args := m.Called(ctx, response)
	return args.String(0), args.Error(1)
}

func (m *MockEncryptionService) DecryptResponse(ctx context.Context, encryptedResponse string) (interface{}, error) {
	args := m.Called(ctx, encryptedResponse)
	return args.Get(0), args.Error(1)
}
