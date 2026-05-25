package monitoring

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/sirupsen/logrus"
)

// MetricsCollector collects and aggregates OPA-related metrics
type MetricsCollector struct {
	logger        *logrus.Logger
	redis         *redis.Client
	metrics       *OPAMetrics
	mu            sync.RWMutex
	flushInterval time.Duration

	// Prometheus metrics
	policyEvaluationsTotal   *prometheus.CounterVec
	policyEvaluationDuration *prometheus.HistogramVec
	cacheHitsTotal           *prometheus.CounterVec
	cacheMissesTotal         *prometheus.CounterVec
	policyLoadDuration       *prometheus.HistogramVec
	bundleDeploymentTotal    *prometheus.CounterVec
	bundleDeploymentDuration *prometheus.HistogramVec
	activeConnections        prometheus.Gauge
}

// OPAMetrics holds OPA metrics
type OPAMetrics struct {
	// Policy evaluation metrics
	EvaluationsTotal      int64         `json:"evaluations_total"`
	EvaluationsSucceeded  int64         `json:"evaluations_succeeded"`
	EvaluationsFailed     int64         `json:"evaluations_failed"`
	AverageEvaluationTime time.Duration `json:"average_evaluation_time_ms"`
	MaxEvaluationTime     time.Duration `json:"max_evaluation_time_ms"`
	MinEvaluationTime     time.Duration `json:"min_evaluation_time_ms"`

	// Cache metrics
	CacheHits        int64   `json:"cache_hits"`
	CacheMisses      int64   `json:"cache_misses"`
	CacheHitRatio    float64 `json:"cache_hit_ratio"`
	CacheSize        int64   `json:"cache_size"`
	CacheMemoryUsage int64   `json:"cache_memory_usage_bytes"`

	// Policy metrics
	ActivePolicies         int   `json:"active_policies"`
	TotalPolicies          int   `json:"total_policies"`
	PolicyLoadErrors       int64 `json:"policy_load_errors"`
	PolicyValidationErrors int64 `json:"policy_validation_errors"`

	// Bundle metrics
	BundleDeploymentsTotal    int64         `json:"bundle_deployments_total"`
	BundleDeploymentSuccesses int64         `json:"bundle_deployment_successes"`
	BundleDeploymentFailures  int64         `json:"bundle_deployment_failures"`
	BundleSize                int64         `json:"bundle_size_bytes"`
	BundleDeploymentTime      time.Duration `json:"bundle_deployment_time_ms"`

	// Performance metrics
	RequestRate     float64       `json:"requests_per_second"`
	ErrorRate       float64       `json:"error_rate"`
	Throughput      int64         `json:"throughput_operations_per_second"`
	ResponseTimeP95 time.Duration `json:"response_time_p95_ms"`
	ResponseTimeP99 time.Duration `json:"response_time_p99_ms"`

	// Resource metrics
	CPUUsage            float64 `json:"cpu_usage_percent"`
	MemoryUsage         int64   `json:"memory_usage_bytes"`
	NetworkIO           int64   `json:"network_io_bytes"`
	OpenFileDescriptors int     `json:"open_file_descriptors"`

	// Security metrics
	AuthorizationDenials   int64 `json:"authorization_denials"`
	AuthenticationFailures int64 `json:"authentication_failures"`
	SuspiciousActivities   int64 `json:"suspicious_activities"`
	SecurityViolations     int64 `json:"security_violations"`

	// Timestamps
	LastUpdated          time.Time `json:"last_updated"`
	LastEvaluation       time.Time `json:"last_evaluation"`
	LastBundleDeployment time.Time `json:"last_bundle_deployment"`

	// Historical data
	HistoricalMetrics []MetricsSnapshot `json:"historical_metrics"`
}

// MetricsSnapshot represents a point-in-time metrics snapshot
type MetricsSnapshot struct {
	Timestamp time.Time  `json:"timestamp"`
	Metrics   OPAMetrics `json:"metrics"`
}

// PolicyEvaluationMetrics represents metrics for a specific policy evaluation
type PolicyEvaluationMetrics struct {
	PolicyID      string        `json:"policy_id"`
	TenantID      string        `json:"tenant_id"`
	UserID        string        `json:"user_id"`
	Action        string        `json:"action"`
	Resource      string        `json:"resource"`
	Decision      bool          `json:"decision"`
	ExecutionTime time.Duration `json:"execution_time_ms"`
	CacheHit      bool          `json:"cache_hit"`
	Error         string        `json:"error,omitempty"`
	Timestamp     time.Time     `json:"timestamp"`
}

// BundleDeploymentMetrics represents metrics for bundle deployment
type BundleDeploymentMetrics struct {
	BundleID       string        `json:"bundle_id"`
	Name           string        `json:"name"`
	Version        int           `json:"version"`
	PoliciesCount  int           `json:"policies_count"`
	Size           int64         `json:"size_bytes"`
	DeploymentTime time.Duration `json:"deployment_time_ms"`
	Success        bool          `json:"success"`
	Error          string        `json:"error,omitempty"`
	Timestamp      time.Time     `json:"timestamp"`
}

// NewMetricsCollector creates a new metrics collector
func NewMetricsCollector(redisClient *redis.Client, logger *logrus.Logger) *MetricsCollector {
	if logger == nil {
		logger = logrus.New()
	}

	collector := &MetricsCollector{
		logger:        logger,
		redis:         redisClient,
		metrics:       &OPAMetrics{},
		flushInterval: 30 * time.Second,
		mu:            sync.RWMutex{},
	}

	// Initialize Prometheus metrics
	collector.initPrometheusMetrics()

	// Start background collection
	go collector.startMetricsCollection()

	return collector
}

// RecordPolicyEvaluation records a policy evaluation
func (mc *MetricsCollector) RecordPolicyEvaluation(metrics *PolicyEvaluationMetrics) {
	mc.mu.Lock()
	defer mc.mu.Unlock()

	mc.metrics.EvaluationsTotal++
	mc.metrics.LastEvaluation = metrics.Timestamp

	if metrics.Error != "" {
		mc.metrics.EvaluationsFailed++
	} else {
		mc.metrics.EvaluationsSucceeded++
	}

	// Update timing metrics
	if mc.metrics.MaxEvaluationTime < metrics.ExecutionTime {
		mc.metrics.MaxEvaluationTime = metrics.ExecutionTime
	}

	if mc.metrics.MinEvaluationTime == 0 || mc.metrics.MinEvaluationTime > metrics.ExecutionTime {
		mc.metrics.MinEvaluationTime = metrics.ExecutionTime
	}

	// Update average evaluation time
	totalTime := time.Duration(mc.metrics.EvaluationsTotal) * mc.metrics.AverageEvaluationTime
	totalTime += metrics.ExecutionTime
	mc.metrics.AverageEvaluationTime = totalTime / time.Duration(mc.metrics.EvaluationsTotal)

	// Update cache metrics
	if metrics.CacheHit {
		mc.metrics.CacheHits++
	} else {
		mc.metrics.CacheMisses++
	}

	// Update cache hit ratio
	if mc.metrics.CacheHits+mc.metrics.CacheMisses > 0 {
		mc.metrics.CacheHitRatio = float64(mc.metrics.CacheHits) / float64(mc.metrics.CacheHits+mc.metrics.CacheMisses)
	}

	// Update Prometheus metrics
	mc.policyEvaluationsTotal.WithLabelValues(
		metrics.PolicyID,
		fmt.Sprintf("%t", metrics.Decision),
		fmt.Sprintf("%t", metrics.CacheHit),
	).Inc()

	mc.policyEvaluationDuration.WithLabelValues(metrics.PolicyID).Observe(metrics.ExecutionTime.Seconds())

	if metrics.CacheHit {
		mc.cacheHitsTotal.WithLabelValues(metrics.PolicyID).Inc()
	} else {
		mc.cacheMissesTotal.WithLabelValues(metrics.PolicyID).Inc()
	}

	// Store detailed metrics in Redis for analysis
	mc.storeDetailedMetrics(metrics)
}

// RecordBundleDeployment records a bundle deployment
func (mc *MetricsCollector) RecordBundleDeployment(metrics *BundleDeploymentMetrics) {
	mc.mu.Lock()
	defer mc.mu.Unlock()

	mc.metrics.BundleDeploymentsTotal++
	mc.metrics.LastBundleDeployment = metrics.Timestamp

	if metrics.Success {
		mc.metrics.BundleDeploymentSuccesses++
	} else {
		mc.metrics.BundleDeploymentFailures++
	}

	mc.metrics.BundleSize = metrics.Size
	mc.metrics.BundleDeploymentTime = metrics.DeploymentTime

	// Update Prometheus metrics
	status := "success"
	if !metrics.Success {
		status = "failure"
	}

	mc.bundleDeploymentTotal.WithLabelValues(metrics.BundleID, status).Inc()
	mc.bundleDeploymentDuration.WithLabelValues(metrics.BundleID).Observe(metrics.DeploymentTime.Seconds())

	// Store detailed metrics in Redis
	mc.storeBundleMetrics(metrics)
}

// RecordPolicyLoad records a policy load operation
func (mc *MetricsCollector) RecordPolicyLoad(policyID string, success bool, duration time.Duration, err error) {
	mc.mu.Lock()
	defer mc.mu.Unlock()

	if success {
		mc.metrics.ActivePolicies++
	} else {
		mc.metrics.PolicyLoadErrors++
	}

	// Update Prometheus metrics
	status := "success"
	if !success {
		status = "failure"
	}

	mc.policyLoadDuration.WithLabelValues(policyID, status).Observe(duration.Seconds())
}

// RecordSecurityEvent records a security-related event
func (mc *MetricsCollector) RecordSecurityEvent(eventType string, tenantID string, details map[string]interface{}) {
	mc.mu.Lock()
	defer mc.mu.Unlock()

	switch eventType {
	case "authorization_denied":
		mc.metrics.AuthorizationDenials++
	case "authentication_failed":
		mc.metrics.AuthenticationFailures++
	case "suspicious_activity":
		mc.metrics.SuspiciousActivities++
	case "security_violation":
		mc.metrics.SecurityViolations++
	}

	mc.logger.WithFields(logrus.Fields{
		"event_type": eventType,
		"tenant_id":  tenantID,
		"details":    details,
	}).Info("Security event recorded")
}

// UpdateSystemMetrics updates system resource metrics
func (mc *MetricsCollector) UpdateSystemMetrics(cpuUsage float64, memoryUsage int64, networkIO int64, openFDs int) {
	mc.mu.Lock()
	defer mc.mu.Unlock()

	mc.metrics.CPUUsage = cpuUsage
	mc.metrics.MemoryUsage = memoryUsage
	mc.metrics.NetworkIO = networkIO
	mc.metrics.OpenFileDescriptors = openFDs
	mc.metrics.LastUpdated = time.Now()

	// Update Prometheus metrics
	mc.activeConnections.Set(float64(openFDs))
}

// UpdateCacheMetrics updates cache-related metrics
func (mc *MetricsCollector) UpdateCacheMetrics(size int64, memoryUsage int64) {
	mc.mu.Lock()
	defer mc.mu.Unlock()

	mc.metrics.CacheSize = size
	mc.metrics.CacheMemoryUsage = memoryUsage
}

// GetMetrics returns current metrics
func (mc *MetricsCollector) GetMetrics() OPAMetrics {
	mc.mu.RLock()
	defer mc.mu.RUnlock()

	return *mc.metrics
}

// GetMetricsHistory returns historical metrics
func (mc *MetricsCollector) GetMetricsHistory(limit int) ([]MetricsSnapshot, error) {
	ctx := context.Background()

	// Get historical metrics from Redis
	pattern := "opa:metrics:snapshot:*"
	keys, err := mc.redis.Keys(ctx, pattern).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to get metrics keys: %w", err)
	}

	var snapshots []MetricsSnapshot

	// Sort keys by timestamp (most recent first)
	// Note: In a real implementation, you'd want to sort properly
	for i, key := range keys {
		if i >= limit {
			break
		}

		data, err := mc.redis.Get(ctx, key).Result()
		if err != nil {
			mc.logger.WithError(err).Warnf("Failed to get metrics snapshot: %s", key)
			continue
		}

		var snapshot MetricsSnapshot
		if err := json.Unmarshal([]byte(data), &snapshot); err != nil {
			mc.logger.WithError(err).Warnf("Failed to unmarshal metrics snapshot: %s", key)
			continue
		}

		snapshots = append(snapshots, snapshot)
	}

	return snapshots, nil
}

// GenerateReport generates a comprehensive metrics report
func (mc *MetricsCollector) GenerateReport(timeRange time.Duration) (*MetricsReport, error) {
	mc.mu.RLock()
	currentMetrics := *mc.metrics
	mc.mu.RUnlock()

	// Get historical data
	snapshots, err := mc.GetMetricsHistory(100)
	if err != nil {
		mc.logger.WithError(err).Warn("Failed to get historical metrics for report")
		snapshots = []MetricsSnapshot{}
	}

	// Calculate trends and statistics
	report := &MetricsReport{
		GeneratedAt:     time.Now().UTC(),
		TimeRange:       timeRange,
		Current:         currentMetrics,
		Historical:      snapshots,
		Trends:          mc.calculateTrends(snapshots),
		Alerts:          mc.checkAlerts(currentMetrics),
		Recommendations: mc.generateRecommendations(currentMetrics),
	}

	return report, nil
}

// Private methods

func (mc *MetricsCollector) initPrometheusMetrics() {
	// Policy evaluation metrics
	mc.policyEvaluationsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "opa_policy_evaluations_total",
			Help: "Total number of policy evaluations",
		},
		[]string{"policy_id", "decision", "cache_hit"},
	)

	mc.policyEvaluationDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "opa_policy_evaluation_duration_seconds",
			Help:    "Time taken to evaluate policies",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"policy_id"},
	)

	// Cache metrics
	mc.cacheHitsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "opa_cache_hits_total",
			Help: "Total number of cache hits",
		},
		[]string{"policy_id"},
	)

	mc.cacheMissesTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "opa_cache_misses_total",
			Help: "Total number of cache misses",
		},
		[]string{"policy_id"},
	)

	// Bundle deployment metrics
	mc.bundleDeploymentTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "opa_bundle_deployments_total",
			Help: "Total number of bundle deployments",
		},
		[]string{"bundle_id", "status"},
	)

	mc.bundleDeploymentDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "opa_bundle_deployment_duration_seconds",
			Help:    "Time taken to deploy bundles",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"bundle_id"},
	)

	// Policy load metrics
	mc.policyLoadDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "opa_policy_load_duration_seconds",
			Help:    "Time taken to load policies",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"policy_id", "status"},
	)

	// Resource metrics
	mc.activeConnections = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "opa_active_connections",
			Help: "Number of active connections",
		},
	)
}

func (mc *MetricsCollector) startMetricsCollection() {
	ticker := time.NewTicker(mc.flushInterval)
	defer ticker.Stop()

	for range ticker.C {
		mc.collectAndFlushMetrics()
	}
}

func (mc *MetricsCollector) collectAndFlushMetrics() {
	ctx := context.Background()

	// Create snapshot
	snapshot := MetricsSnapshot{
		Timestamp: time.Now().UTC(),
		Metrics:   mc.GetMetrics(),
	}

	// Store snapshot in Redis
	data, err := json.Marshal(snapshot)
	if err != nil {
		mc.logger.WithError(err).Error("Failed to marshal metrics snapshot")
		return
	}

	key := fmt.Sprintf("opa:metrics:snapshot:%d", snapshot.Timestamp.Unix())

	if err := mc.redis.Set(ctx, key, data, 24*time.Hour).Err(); err != nil {
		mc.logger.WithError(err).Error("Failed to store metrics snapshot")
	}

	// Clean up old snapshots
	mc.cleanupOldSnapshots(ctx)

	// Add to historical data (keep last 1000 snapshots)
	mc.mu.Lock()
	mc.metrics.HistoricalMetrics = append(mc.metrics.HistoricalMetrics, snapshot)
	if len(mc.metrics.HistoricalMetrics) > 1000 {
		mc.metrics.HistoricalMetrics = mc.metrics.HistoricalMetrics[1:]
	}
	mc.mu.Unlock()
}

func (mc *MetricsCollector) storeDetailedMetrics(metrics *PolicyEvaluationMetrics) {
	ctx := context.Background()

	data, err := json.Marshal(metrics)
	if err != nil {
		mc.logger.WithError(err).Error("Failed to marshal detailed metrics")
		return
	}

	key := fmt.Sprintf("opa:metrics:evaluation:%s:%d", metrics.PolicyID, metrics.Timestamp.Unix())

	if err := mc.redis.Set(ctx, key, data, 7*24*time.Hour).Err(); err != nil {
		mc.logger.WithError(err).Error("Failed to store detailed metrics")
	}
}

func (mc *MetricsCollector) storeBundleMetrics(metrics *BundleDeploymentMetrics) {
	ctx := context.Background()

	data, err := json.Marshal(metrics)
	if err != nil {
		mc.logger.WithError(err).Error("Failed to marshal bundle metrics")
		return
	}

	key := fmt.Sprintf("opa:metrics:bundle:%s:%d", metrics.BundleID, metrics.Timestamp.Unix())

	if err := mc.redis.Set(ctx, key, data, 30*24*time.Hour).Err(); err != nil {
		mc.logger.WithError(err).Error("Failed to store bundle metrics")
	}
}

func (mc *MetricsCollector) cleanupOldSnapshots(ctx context.Context) {
	// Delete snapshots older than 7 days
	cutoff := time.Now().Add(-7 * 24 * time.Hour).Unix()

	pattern := "opa:metrics:snapshot:*"
	keys, err := mc.redis.Keys(ctx, pattern).Result()
	if err != nil {
		return
	}

	for _, key := range keys {
		// Extract timestamp from key
		parts := strings.Split(key, ":")
		if len(parts) < 3 {
			continue
		}

		timestamp, err := strconv.ParseInt(parts[len(parts)-1], 10, 64)
		if err != nil {
			continue
		}

		if timestamp < cutoff {
			mc.redis.Del(ctx, key)
		}
	}
}

func (mc *MetricsCollector) calculateTrends(snapshots []MetricsSnapshot) map[string]interface{} {
	if len(snapshots) < 2 {
		return map[string]interface{}{}
	}

	// Calculate trends based on historical data
	latest := snapshots[len(snapshots)-1].Metrics
	earliest := snapshots[0].Metrics

	trends := map[string]interface{}{
		"evaluation_rate_trend": mc.calculateTrendValue(earliest.EvaluationsTotal, latest.EvaluationsTotal),
		"error_rate_trend":      mc.calculateTrendValue(earliest.EvaluationsFailed, latest.EvaluationsFailed),
		"cache_hit_ratio_trend": mc.calculateTrendValue(earliest.CacheHitRatio, latest.CacheHitRatio),
		"response_time_trend":   mc.calculateTrendValue(earliest.AverageEvaluationTime, latest.AverageEvaluationTime),
		"throughput_trend":      mc.calculateTrendValue(earliest.Throughput, latest.Throughput),
	}

	return trends
}

func (mc *MetricsCollector) calculateTrendValue(earliest, latest interface{}) string {
	// Simple trend calculation
	// In a real implementation, you'd want more sophisticated trend analysis
	return "stable"
}

func (mc *MetricsCollector) checkAlerts(metrics OPAMetrics) []Alert {
	var alerts []Alert

	// Check error rate
	if metrics.EvaluationsTotal > 0 {
		errorRate := float64(metrics.EvaluationsFailed) / float64(metrics.EvaluationsTotal)
		if errorRate > 0.05 { // 5% error rate threshold
			alerts = append(alerts, Alert{
				Level:   "warning",
				Message: fmt.Sprintf("High error rate: %.2f%%", errorRate*100),
				Metric:  "error_rate",
				Value:   errorRate,
			})
		}
	}

	// Check response time
	if metrics.AverageEvaluationTime > 100*time.Millisecond {
		alerts = append(alerts, Alert{
			Level:   "warning",
			Message: fmt.Sprintf("High average response time: %v", metrics.AverageEvaluationTime),
			Metric:  "response_time",
			Value:   metrics.AverageEvaluationTime.Milliseconds(),
		})
	}

	// Check cache hit ratio
	if metrics.CacheHitRatio < 0.8 { // 80% cache hit ratio threshold
		alerts = append(alerts, Alert{
			Level:   "warning",
			Message: fmt.Sprintf("Low cache hit ratio: %.2f%%", metrics.CacheHitRatio*100),
			Metric:  "cache_hit_ratio",
			Value:   metrics.CacheHitRatio,
		})
	}

	// Check resource usage
	if metrics.CPUUsage > 80 { // 80% CPU usage threshold
		alerts = append(alerts, Alert{
			Level:   "critical",
			Message: fmt.Sprintf("High CPU usage: %.2f%%", metrics.CPUUsage),
			Metric:  "cpu_usage",
			Value:   metrics.CPUUsage,
		})
	}

	return alerts
}

func (mc *MetricsCollector) generateRecommendations(metrics OPAMetrics) []string {
	var recommendations []string

	// Performance recommendations
	if metrics.CacheHitRatio < 0.8 {
		recommendations = append(recommendations, "Consider increasing cache TTL or cache size to improve hit ratio")
	}

	if metrics.AverageEvaluationTime > 50*time.Millisecond {
		recommendations = append(recommendations, "Optimize policy rules or consider policy preprocessing to reduce evaluation time")
	}

	// Resource recommendations
	if metrics.CPUUsage > 70 {
		recommendations = append(recommendations, "Consider scaling OPA instances or optimizing resource usage")
	}

	if metrics.MemoryUsage > 1024*1024*1024 { // 1GB
		recommendations = append(recommendations, "Monitor memory usage and consider memory optimization or scaling")
	}

	// Security recommendations
	if metrics.AuthorizationDenials > 100 {
		recommendations = append(recommendations, "High number of authorization denials detected - review policies and user permissions")
	}

	return recommendations
}

// MetricsReport represents a comprehensive metrics report
type MetricsReport struct {
	GeneratedAt     time.Time              `json:"generated_at"`
	TimeRange       time.Duration          `json:"time_range"`
	Current         OPAMetrics             `json:"current"`
	Historical      []MetricsSnapshot      `json:"historical"`
	Trends          map[string]interface{} `json:"trends"`
	Alerts          []Alert                `json:"alerts"`
	Recommendations []string               `json:"recommendations"`
}

// Alert represents a metrics alert
type Alert struct {
	Level   string      `json:"level"` // info, warning, critical
	Message string      `json:"message"`
	Metric  string      `json:"metric"`
	Value   interface{} `json:"value"`
}
