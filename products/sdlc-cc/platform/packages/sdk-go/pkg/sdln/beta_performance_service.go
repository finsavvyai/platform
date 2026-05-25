package sdln

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

// ========================================
// Beta Performance Service
// ========================================

// BetaPerformanceService handles performance monitoring for beta testing
type BetaPerformanceService struct {
	client *Client
}

// NewBetaPerformanceService creates a new beta performance service
func NewBetaPerformanceService(client *Client) *BetaPerformanceService {
	return &BetaPerformanceService{client: client}
}

// ========================================
// Performance Metrics Collection
// ========================================

// CollectMetrics collects performance metrics for beta testing
func (s *BetaPerformanceService) CollectMetrics(ctx context.Context, req *CollectMetricsRequest) (*BetaMetrics, error) {
	resp, err := s.client.doRequest(ctx, http.MethodPost, "/api/v1/beta/performance/metrics/collect", req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var metrics BetaMetrics
	if err := json.NewDecoder(resp.Body).Decode(&metrics); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &metrics, nil
}

// GetMetrics retrieves performance metrics
func (s *BetaPerformanceService) GetMetrics(ctx context.Context, opts *BetaMetricsOptions) (*BetaMetricsReport, error) {
	resp, err := s.client.doRequestWithQuery(ctx, http.MethodGet, "/api/v1/beta/performance/metrics", nil, opts)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var report BetaMetricsReport
	if err := json.NewDecoder(resp.Body).Decode(&report); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &report, nil
}

// GetUserPerformanceMetrics retrieves performance metrics for a specific user
func (s *BetaPerformanceService) GetUserPerformanceMetrics(ctx context.Context, userID, programID string, timeRange *TimestampRange) (*UserPerformanceMetrics, error) {
	path := fmt.Sprintf("/api/v1/beta/users/%s/programs/%s/performance", userID, programID)
	resp, err := s.client.doRequestWithQuery(ctx, http.MethodGet, path, nil, map[string]interface{}{
		"timeRange": timeRange,
	})
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var metrics UserPerformanceMetrics
	if err := json.NewDecoder(resp.Body).Decode(&metrics); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &metrics, nil
}

// ========================================
// Performance Benchmarks
// ========================================

// CreateBenchmark creates a performance benchmark
func (s *BetaPerformanceService) CreateBenchmark(ctx context.Context, req *CreateBenchmarkRequest) (*BetaBenchmark, error) {
	resp, err := s.client.doRequest(ctx, http.MethodPost, "/api/v1/beta/performance/benchmarks", req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var benchmark BetaBenchmark
	if err := json.NewDecoder(resp.Body).Decode(&benchmark); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &benchmark, nil
}

// GetBenchmark retrieves a performance benchmark
func (s *BetaPerformanceService) GetBenchmark(ctx context.Context, benchmarkID string) (*BetaBenchmark, error) {
	path := fmt.Sprintf("/api/v1/beta/performance/benchmarks/%s", benchmarkID)
	resp, err := s.client.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var benchmark BetaBenchmark
	if err := json.NewDecoder(resp.Body).Decode(&benchmark); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &benchmark, nil
}

// RunBenchmark runs a performance benchmark
func (s *BetaPerformanceService) RunBenchmark(ctx context.Context, benchmarkID string, req *RunBenchmarkRequest) (*BenchmarkResult, error) {
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

// CompareBenchmark compares benchmark results
func (s *BetaPerformanceService) CompareBenchmark(ctx context.Context, req *CompareBenchmarkRequest) (*BenchmarkComparison, error) {
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
// Performance Optimization
// ========================================

// AnalyzePerformance analyzes performance data for optimization opportunities
func (s *BetaPerformanceService) AnalyzePerformance(ctx context.Context, programID string, timeRange *TimestampRange) (*PerformanceAnalysis, error) {
	path := fmt.Sprintf("/api/v1/beta/programs/%s/performance/analyze", programID)
	resp, err := s.client.doRequestWithQuery(ctx, http.MethodGet, path, nil, map[string]interface{}{
		"timeRange": timeRange,
	})
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var analysis PerformanceAnalysis
	if err := json.NewDecoder(resp.Body).Decode(&analysis); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &analysis, nil
}

// GetOptimizationRecommendations retrieves optimization recommendations
func (s *BetaPerformanceService) GetOptimizationRecommendations(ctx context.Context, programID string) ([]OptimizationRecommendation, error) {
	path := fmt.Sprintf("/api/v1/beta/programs/%s/performance/recommendations", programID)
	resp, err := s.client.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var recommendations []OptimizationRecommendation
	if err := json.NewDecoder(resp.Body).Decode(&recommendations); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return recommendations, nil
}

// ApplyOptimization applies performance optimization
func (s *BetaPerformanceService) ApplyOptimization(ctx context.Context, programID string, req *ApplyOptimizationRequest) (*OptimizationResult, error) {
	path := fmt.Sprintf("/api/v1/beta/programs/%s/performance/optimize", programID)
	resp, err := s.client.doRequest(ctx, http.MethodPost, path, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result OptimizationResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

// ========================================
// Performance Alerts
// ========================================

// CreateAlertRule creates a performance alert rule
func (s *BetaPerformanceService) CreateAlertRule(ctx context.Context, programID string, req *CreatePerformanceAlertRequest) (*PerformanceAlertRule, error) {
	path := fmt.Sprintf("/api/v1/beta/programs/%s/performance/alerts", programID)
	resp, err := s.client.doRequest(ctx, http.MethodPost, path, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var rule PerformanceAlertRule
	if err := json.NewDecoder(resp.Body).Decode(&rule); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &rule, nil
}

// GetAlertRules retrieves performance alert rules
func (s *BetaPerformanceService) GetAlertRules(ctx context.Context, programID string) ([]PerformanceAlertRule, error) {
	path := fmt.Sprintf("/api/v1/beta/programs/%s/performance/alerts", programID)
	resp, err := s.client.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var rules []PerformanceAlertRule
	if err := json.NewDecoder(resp.Body).Decode(&rules); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return rules, nil
}

// GetAlerts retrieves performance alerts
func (s *BetaPerformanceService) GetAlerts(ctx context.Context, programID string, opts *AlertListOptions) (*PaginatedResponse[PerformanceAlert], error) {
	path := fmt.Sprintf("/api/v1/beta/programs/%s/performance/alerts/active", programID)
	resp, err := s.client.doRequestWithQuery(ctx, http.MethodGet, path, nil, opts)
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
func (s *BetaPerformanceService) AcknowledgeAlert(ctx context.Context, alertID string, comment string) error {
	path := fmt.Sprintf("/api/v1/beta/performance/alerts/%s/acknowledge", alertID)
	req := &AcknowledgeAlertRequest{Comment: comment}
	_, err := s.client.doRequest(ctx, http.MethodPost, path, req)
	return err
}

// ========================================
// Performance Reports
// ========================================

// GenerateReport generates a performance report
func (s *BetaPerformanceService) GenerateReport(ctx context.Context, programID string, req *GeneratePerformanceReportRequest) (*PerformanceReport, error) {
	path := fmt.Sprintf("/api/v1/beta/programs/%s/performance/reports", programID)
	resp, err := s.client.doRequest(ctx, http.MethodPost, path, req)
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

// GetReport retrieves a performance report
func (s *BetaPerformanceService) GetReport(ctx context.Context, reportID string) (*PerformanceReport, error) {
	path := fmt.Sprintf("/api/v1/beta/performance/reports/%s", reportID)
	resp, err := s.client.doRequest(ctx, http.MethodGet, path, nil)
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

// ScheduleReport schedules a performance report
func (s *BetaPerformanceService) ScheduleReport(ctx context.Context, programID string, req *SchedulePerformanceReportRequest) (*ScheduledPerformanceReport, error) {
	path := fmt.Sprintf("/api/v1/beta/programs/%s/performance/reports/schedule", programID)
	resp, err := s.client.doRequest(ctx, http.MethodPost, path, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var scheduled ScheduledPerformanceReport
	if err := json.NewDecoder(resp.Body).Decode(&scheduled); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &scheduled, nil
}

// ========================================
// Performance Tracking
// ========================================

// TrackFeaturePerformance tracks performance of specific features
func (s *BetaPerformanceService) TrackFeaturePerformance(ctx context.Context, req *TrackFeaturePerformanceRequest) (*FeaturePerformance, error) {
	resp, err := s.client.doRequest(ctx, http.MethodPost, "/api/v1/beta/performance/features/track", req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var performance FeaturePerformance
	if err := json.NewDecoder(resp.Body).Decode(&performance); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &performance, nil
}

// GetFeaturePerformance retrieves feature performance data
func (s *BetaPerformanceService) GetFeaturePerformance(ctx context.Context, featureID string, timeRange *TimestampRange) (*FeaturePerformanceReport, error) {
	path := fmt.Sprintf("/api/v1/beta/performance/features/%s", featureID)
	resp, err := s.client.doRequestWithQuery(ctx, http.MethodGet, path, nil, map[string]interface{}{
		"timeRange": timeRange,
	})
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var report FeaturePerformanceReport
	if err := json.NewDecoder(resp.Body).Decode(&report); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &report, nil
}

// CompareFeaturePerformance compares performance across features
func (s *BetaPerformanceService) CompareFeaturePerformance(ctx context.Context, req *CompareFeaturePerformanceRequest) (*FeatureComparisonReport, error) {
	resp, err := s.client.doRequest(ctx, http.MethodPost, "/api/v1/beta/performance/features/compare", req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var report FeatureComparisonReport
	if err := json.NewDecoder(resp.Body).Decode(&report); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &report, nil
}

// ========================================
// Performance Baselines
// ========================================

// EstablishBaseline establishes a performance baseline
func (s *BetaPerformanceService) EstablishBaseline(ctx context.Context, programID string, req *EstablishBaselineRequest) (*PerformanceBaseline, error) {
	path := fmt.Sprintf("/api/v1/beta/programs/%s/performance/baseline", programID)
	resp, err := s.client.doRequest(ctx, http.MethodPost, path, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var baseline PerformanceBaseline
	if err := json.NewDecoder(resp.Body).Decode(&baseline); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &baseline, nil
}

// GetBaseline retrieves a performance baseline
func (s *BetaPerformanceService) GetBaseline(ctx context.Context, baselineID string) (*PerformanceBaseline, error) {
	path := fmt.Sprintf("/api/v1/beta/performance/baselines/%s", baselineID)
	resp, err := s.client.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var baseline PerformanceBaseline
	if err := json.NewDecoder(resp.Body).Decode(&baseline); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &baseline, nil
}

// CompareToBaseline compares current performance to baseline
func (s *BetaPerformanceService) CompareToBaseline(ctx context.Context, baselineID string, req *CompareToBaselineRequest) (*BaselineComparison, error) {
	path := fmt.Sprintf("/api/v1/beta/performance/baselines/%s/compare", baselineID)
	resp, err := s.client.doRequest(ctx, http.MethodPost, path, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var comparison BaselineComparison
	if err := json.NewDecoder(resp.Body).Decode(&comparison); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &comparison, nil
}

// ========================================
// Performance Thresholds
// ========================================

// SetThreshold sets performance thresholds
func (s *BetaPerformanceService) SetThreshold(ctx context.Context, programID string, req *SetPerformanceThresholdRequest) (*PerformanceThreshold, error) {
	path := fmt.Sprintf("/api/v1/beta/programs/%s/performance/thresholds", programID)
	resp, err := s.client.doRequest(ctx, http.MethodPost, path, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var threshold PerformanceThreshold
	if err := json.NewDecoder(resp.Body).Decode(&threshold); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &threshold, nil
}

// GetThresholds retrieves performance thresholds
func (s *BetaPerformanceService) GetThresholds(ctx context.Context, programID string) ([]PerformanceThreshold, error) {
	path := fmt.Sprintf("/api/v1/beta/programs/%s/performance/thresholds", programID)
	resp, err := s.client.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var thresholds []PerformanceThreshold
	if err := json.NewDecoder(resp.Body).Decode(&thresholds); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return thresholds, nil
}

// CheckThresholds checks if performance meets thresholds
func (s *BetaPerformanceService) CheckThresholds(ctx context.Context, programID string) (*ThresholdCheckResult, error) {
	path := fmt.Sprintf("/api/v1/beta/programs/%s/performance/thresholds/check", programID)
	resp, err := s.client.doRequest(ctx, http.MethodPost, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result ThresholdCheckResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

// AcknowledgeAlertRequest represents a request to acknowledge a performance alert
type AcknowledgeAlertRequest struct {
	Comment string `json:"comment"`
}
