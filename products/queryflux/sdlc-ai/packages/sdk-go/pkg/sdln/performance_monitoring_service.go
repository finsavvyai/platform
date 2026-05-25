package sdln

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

// ========================================
// Performance Monitoring Service for Beta
// ========================================

// PerformanceMonitoringService handles performance monitoring and optimization for beta
type PerformanceMonitoringService struct {
	client *Client
}

// NewPerformanceMonitoringService creates a new performance monitoring service
func NewPerformanceMonitoringService(client *Client) *PerformanceMonitoringService {
	return &PerformanceMonitoringService{client: client}
}

// ========================================
// Performance Metrics Collection
// ========================================

// CreateMetric creates a new performance metric
func (s *PerformanceMonitoringService) CreateMetric(ctx context.Context, req *CreatePerformanceMetricRequest) (*PerformanceMetric, error) {
	resp, err := s.client.doRequest(ctx, http.MethodPost, "/api/v1/beta/performance/metrics", req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var metric PerformanceMetric
	if err := json.NewDecoder(resp.Body).Decode(&metric); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &metric, nil
}

// GetMetric retrieves a performance metric
func (s *PerformanceMonitoringService) GetMetric(ctx context.Context, metricID string) (*PerformanceMetric, error) {
	path := fmt.Sprintf("/api/v1/beta/performance/metrics/%s", metricID)
	resp, err := s.client.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var metric PerformanceMetric
	if err := json.NewDecoder(resp.Body).Decode(&metric); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &metric, nil
}

// ListMetrics lists performance metrics
func (s *PerformanceMonitoringService) ListMetrics(ctx context.Context, opts *PerformanceMetricListOptions) (*PaginatedResponse[PerformanceMetric], error) {
	resp, err := s.client.doRequestWithQuery(ctx, http.MethodGet, "/api/v1/beta/performance/metrics", nil, opts)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var response PaginatedResponse[PerformanceMetric]
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &response, nil
}

// RecordMetric records a performance metric value
func (s *PerformanceMonitoringService) RecordMetric(ctx context.Context, metricID string, req *RecordMetricRequest) (*MetricRecord, error) {
	path := fmt.Sprintf("/api/v1/beta/performance/metrics/%s/record", metricID)
	resp, err := s.client.doRequest(ctx, http.MethodPost, path, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var record MetricRecord
	if err := json.NewDecoder(resp.Body).Decode(&record); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &record, nil
}

// BatchRecordMetrics records multiple metric values
func (s *PerformanceMonitoringService) BatchRecordMetrics(ctx context.Context, req *BatchRecordMetricsRequest) ([]*MetricRecord, error) {
	resp, err := s.client.doRequest(ctx, http.MethodPost, "/api/v1/beta/performance/metrics/batch-record", req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var records []*MetricRecord
	if err := json.NewDecoder(resp.Body).Decode(&records); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return records, nil
}

// ========================================
// Performance Monitoring
// ========================================

// CreateMonitor creates a performance monitor
func (s *PerformanceMonitoringService) CreateMonitor(ctx context.Context, req *CreatePerformanceMonitorRequest) (*PerformanceMonitor, error) {
	resp, err := s.client.doRequest(ctx, http.MethodPost, "/api/v1/beta/performance/monitors", req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var monitor PerformanceMonitor
	if err := json.NewDecoder(resp.Body).Decode(&monitor); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &monitor, nil
}

// GetMonitor retrieves a performance monitor
func (s *PerformanceMonitoringService) GetMonitor(ctx context.Context, monitorID string) (*PerformanceMonitor, error) {
	path := fmt.Sprintf("/api/v1/beta/performance/monitors/%s", monitorID)
	resp, err := s.client.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var monitor PerformanceMonitor
	if err := json.NewDecoder(resp.Body).Decode(&monitor); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &monitor, nil
}

// ListMonitors lists performance monitors
func (s *PerformanceMonitoringService) ListMonitors(ctx context.Context, opts *ListOptions) (*PaginatedResponse[PerformanceMonitor], error) {
	resp, err := s.client.doRequestWithQuery(ctx, http.MethodGet, "/api/v1/beta/performance/monitors", nil, opts)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var response PaginatedResponse[PerformanceMonitor]
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &response, nil
}

// StartMonitor starts a performance monitor
func (s *PerformanceMonitoringService) StartMonitor(ctx context.Context, monitorID string) error {
	path := fmt.Sprintf("/api/v1/beta/performance/monitors/%s/start", monitorID)
	_, err := s.client.doRequest(ctx, http.MethodPost, path, nil)
	return err
}

// StopMonitor stops a performance monitor
func (s *PerformanceMonitoringService) StopMonitor(ctx context.Context, monitorID string) error {
	path := fmt.Sprintf("/api/v1/beta/performance/monitors/%s/stop", monitorID)
	_, err := s.client.doRequest(ctx, http.MethodPost, path, nil)
	return err
}

// ========================================
// Performance Alerts
// ========================================

// CreateAlert creates a performance alert
func (s *PerformanceMonitoringService) CreateAlert(ctx context.Context, req *CreatePerformanceAlertRequest) (*PerformanceAlert, error) {
	resp, err := s.client.doRequest(ctx, http.MethodPost, "/api/v1/beta/performance/alerts", req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var alert PerformanceAlert
	if err := json.NewDecoder(resp.Body).Decode(&alert); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &alert, nil
}

// GetAlert retrieves a performance alert
func (s *PerformanceMonitoringService) GetAlert(ctx context.Context, alertID string) (*PerformanceAlert, error) {
	path := fmt.Sprintf("/api/v1/beta/performance/alerts/%s", alertID)
	resp, err := s.client.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var alert PerformanceAlert
	if err := json.NewDecoder(resp.Body).Decode(&alert); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &alert, nil
}

// ListAlerts lists performance alerts
func (s *PerformanceMonitoringService) ListAlerts(ctx context.Context, opts *AlertListOptions) (*PaginatedResponse[PerformanceAlert], error) {
	resp, err := s.client.doRequestWithQuery(ctx, http.MethodGet, "/api/v1/beta/performance/alerts", nil, opts)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var response PaginatedResponse[PerformanceAlert]
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &response, nil
}

// AcknowledgeAlert acknowledges a performance alert
func (s *PerformanceMonitoringService) AcknowledgeAlert(ctx context.Context, alertID string, comment string) error {
	path := fmt.Sprintf("/api/v1/beta/performance/alerts/%s/acknowledge", alertID)
	req := &AcknowledgeAlertRequest{Comment: comment}
	_, err := s.client.doRequest(ctx, http.MethodPost, path, req)
	return err
}

// ResolveAlert resolves a performance alert
func (s *PerformanceMonitoringService) ResolveAlert(ctx context.Context, alertID string, resolution string) error {
	path := fmt.Sprintf("/api/v1/beta/performance/alerts/%s/resolve", alertID)
	req := &ResolveAlertRequest{Resolution: resolution}
	_, err := s.client.doRequest(ctx, http.MethodPost, path, req)
	return err
}

// ========================================
// Performance Analysis
// ========================================

// AnalyzePerformance analyzes performance data
func (s *PerformanceMonitoringService) AnalyzePerformance(ctx context.Context, req *PerformanceAnalysisRequest) (*PerformanceAnalysisResult, error) {
	resp, err := s.client.doRequest(ctx, http.MethodPost, "/api/v1/beta/performance/analyze", req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result PerformanceAnalysisResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

// GetBottlenecks identifies performance bottlenecks
func (s *PerformanceMonitoringService) GetBottlenecks(ctx context.Context, opts *BottleneckAnalysisOptions) (*BottleneckAnalysis, error) {
	resp, err := s.client.doRequestWithQuery(ctx, http.MethodGet, "/api/v1/beta/performance/bottlenecks", nil, opts)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var analysis BottleneckAnalysis
	if err := json.NewDecoder(resp.Body).Decode(&analysis); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &analysis, nil
}

// GetPerformanceReport generates a performance report
func (s *PerformanceMonitoringService) GetPerformanceReport(ctx context.Context, req *PerformanceReportRequest) (*PerformanceReport, error) {
	resp, err := s.client.doRequest(ctx, http.MethodPost, "/api/v1/beta/performance/reports", req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var report PerformanceReport
	if err := json.NewDecoder(resp.Body).Decode(&report); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &report, nil
}

// ========================================
// Performance Optimization
// ========================================

// CreateOptimization creates a performance optimization
func (s *PerformanceMonitoringService) CreateOptimization(ctx context.Context, req *CreatePerformanceOptimizationRequest) (*PerformanceOptimization, error) {
	resp, err := s.client.doRequest(ctx, http.MethodPost, "/api/v1/beta/performance/optimizations", req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var optimization PerformanceOptimization
	if err := json.NewDecoder(resp.Body).Decode(&optimization); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &optimization, nil
}

// GetOptimization retrieves a performance optimization
func (s *PerformanceMonitoringService) GetOptimization(ctx context.Context, optimizationID string) (*PerformanceOptimization, error) {
	path := fmt.Sprintf("/api/v1/beta/performance/optimizations/%s", optimizationID)
	resp, err := s.client.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var optimization PerformanceOptimization
	if err := json.NewDecoder(resp.Body).Decode(&optimization); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &optimization, nil
}

// ListOptimizations lists performance optimizations
func (s *PerformanceMonitoringService) ListOptimizations(ctx context.Context, opts *ListOptions) (*PaginatedResponse[PerformanceOptimization], error) {
	resp, err := s.client.doRequestWithQuery(ctx, http.MethodGet, "/api/v1/beta/performance/optimizations", nil, opts)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var response PaginatedResponse[PerformanceOptimization]
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &response, nil
}

// ApplyOptimization applies a performance optimization
func (s *PerformanceMonitoringService) ApplyOptimization(ctx context.Context, optimizationID string) error {
	path := fmt.Sprintf("/api/v1/beta/performance/optimizations/%s/apply", optimizationID)
	_, err := s.client.doRequest(ctx, http.MethodPost, path, nil)
	return err
}

// RollbackOptimization rolls back a performance optimization
func (s *PerformanceMonitoringService) RollbackOptimization(ctx context.Context, optimizationID string) error {
	path := fmt.Sprintf("/api/v1/beta/performance/optimizations/%s/rollback", optimizationID)
	_, err := s.client.doRequest(ctx, http.MethodPost, path, nil)
	return err
}

// ========================================
// Performance Benchmarks
// ========================================

// CreateBenchmark creates a performance benchmark
func (s *PerformanceMonitoringService) CreateBenchmark(ctx context.Context, req *CreatePerformanceBenchmarkRequest) (*PerformanceBenchmark, error) {
	resp, err := s.client.doRequest(ctx, http.MethodPost, "/api/v1/beta/performance/benchmarks", req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var benchmark PerformanceBenchmark
	if err := json.NewDecoder(resp.Body).Decode(&benchmark); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &benchmark, nil
}

// RunBenchmark runs a performance benchmark
func (s *PerformanceMonitoringService) RunBenchmark(ctx context.Context, benchmarkID string, req *RunBenchmarkRequest) (*BenchmarkResult, error) {
	path := fmt.Sprintf("/api/v1/beta/performance/benchmarks/%s/run", benchmarkID)
	resp, err := s.client.doRequest(ctx, http.MethodPost, path, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result BenchmarkResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

// GetBenchmarkResult retrieves a benchmark result
func (s *PerformanceMonitoringService) GetBenchmarkResult(ctx context.Context, resultID string) (*BenchmarkResult, error) {
	path := fmt.Sprintf("/api/v1/beta/performance/benchmark-results/%s", resultID)
	resp, err := s.client.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result BenchmarkResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

// CompareBenchmarks compares benchmark results
func (s *PerformanceMonitoringService) CompareBenchmarks(ctx context.Context, req *CompareBenchmarksRequest) (*BenchmarkComparison, error) {
	resp, err := s.client.doRequest(ctx, http.MethodPost, "/api/v1/beta/performance/benchmarks/compare", req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var comparison BenchmarkComparison
	if err := json.NewDecoder(resp.Body).Decode(&comparison); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &comparison, nil
}

// ========================================
// Performance Trends
// ========================================

// GetPerformanceTrends retrieves performance trends
func (s *PerformanceMonitoringService) GetPerformanceTrends(ctx context.Context, opts *PerformanceTrendOptions) (*PerformanceTrendReport, error) {
	resp, err := s.client.doRequestWithQuery(ctx, http.MethodGet, "/api/v1/beta/performance/trends", nil, opts)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var report PerformanceTrendReport
	if err := json.NewDecoder(resp.Body).Decode(&report); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &report, nil
}

// GetPerformanceForecast forecasts performance metrics
func (s *PerformanceMonitoringService) GetPerformanceForecast(ctx context.Context, req *PerformanceForecastRequest) (*PerformanceForecast, error) {
	resp, err := s.client.doRequest(ctx, http.MethodPost, "/api/v1/beta/performance/forecast", req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var forecast PerformanceForecast
	if err := json.NewDecoder(resp.Body).Decode(&forecast); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &forecast, nil
}

// ========================================
// Performance Health Score
// ========================================

// GetHealthScore retrieves performance health score
func (s *PerformanceMonitoringService) GetHealthScore(ctx context.Context, opts *HealthScoreOptions) (*PerformanceHealthScore, error) {
	resp, err := s.client.doRequestWithQuery(ctx, http.MethodGet, "/api/v1/beta/performance/health-score", nil, opts)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var score PerformanceHealthScore
	if err := json.NewDecoder(resp.Body).Decode(&score); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &score, nil
}

// GetHealthScoreHistory retrieves health score history
func (s *PerformanceMonitoringService) GetHealthScoreHistory(ctx context.Context, timeRange *TimestampRange) ([]*PerformanceHealthScore, error) {
	resp, err := s.client.doRequestWithQuery(ctx, http.MethodGet, "/api/v1/beta/performance/health-score/history", nil, map[string]interface{}{
		"timeRange": timeRange,
	})
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var scores []*PerformanceHealthScore
	if err := json.NewDecoder(resp.Body).Decode(&scores); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return scores, nil
}

// ========================================
// Performance Profiling
// ========================================

// StartProfiling starts performance profiling
func (s *PerformanceMonitoringService) StartProfiling(ctx context.Context, req *StartProfilingRequest) (*ProfilingSession, error) {
	resp, err := s.client.doRequest(ctx, http.MethodPost, "/api/v1/beta/performance/profiling/start", req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var session ProfilingSession
	if err := json.NewDecoder(resp.Body).Decode(&session); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &session, nil
}

// StopProfiling stops performance profiling
func (s *PerformanceMonitoringService) StopProfiling(ctx context.Context, sessionID string) (*ProfilingResult, error) {
	path := fmt.Sprintf("/api/v1/beta/performance/profiling/%s/stop", sessionID)
	resp, err := s.client.doRequest(ctx, http.MethodPost, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result ProfilingResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

// GetProfilingResult retrieves a profiling result
func (s *PerformanceMonitoringService) GetProfilingResult(ctx context.Context, resultID string) (*ProfilingResult, error) {
	path := fmt.Sprintf("/api/v1/beta/performance/profiling-results/%s", resultID)
	resp, err := s.client.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result ProfilingResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}
