package metrics

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/sirupsen/logrus"

	"github.com/sdlc-ai/platform/services/gateway/internal/domain/services"
)

// RateLimitMetricsCollector implements MetricsCollector interface
type RateLimitMetricsCollector struct {
	// In-memory metrics storage
	metrics *services.RateLimitMetrics
	mutex   sync.RWMutex

	// Time-series data for detailed analytics
	timeSeriesData map[string][]*TimeSeriesPoint
	tsMutex        sync.RWMutex

	// Real-time metrics
	realtimeMetrics map[string]*RealtimeMetric
	rtMutex         sync.RWMutex

	// Alert thresholds
	alertThresholds *AlertThresholds

	// Prometheus metrics
	promMetrics *RateLimitPrometheusMetrics

	// Configuration
	config *RateLimitMetricsConfig

	// Logger
	logger *logrus.Logger

	// Storage
	storage MetricsStorage
}

// TimeSeriesPoint represents a single data point in time series
type TimeSeriesPoint struct {
	Timestamp time.Time              `json:"timestamp"`
	Value     float64                `json:"value"`
	Tags      map[string]string      `json:"tags"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// RealtimeMetric represents real-time metric data
type RealtimeMetric struct {
	Name        string            `json:"name"`
	Current     float64           `json:"current"`
	Previous    float64           `json:"previous"`
	Trend       string            `json:"trend"`       // up, down, stable
	ChangeRate  float64           `json:"change_rate"` // percentage change
	LastUpdated time.Time         `json:"last_updated"`
	AlertLevel  string            `json:"alert_level"` // normal, warning, critical
	Tags        map[string]string `json:"tags"`
	Alerts      []Alert           `json:"alerts,omitempty"`
}

// Alert represents a metric alert
type Alert struct {
	ID           string                 `json:"id"`
	MetricName   string                 `json:"metric_name"`
	Level        string                 `json:"level"` // warning, critical
	Message      string                 `json:"message"`
	Threshold    float64                `json:"threshold"`
	CurrentValue float64                `json:"current_value"`
	Timestamp    time.Time              `json:"timestamp"`
	Acknowledged bool                   `json:"acknowledged"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

// AlertThresholds defines alert thresholds
type AlertThresholds struct {
	HighErrorRate          float64       `json:"high_error_rate"`          // > 5%
	CriticalErrorRate      float64       `json:"critical_error_rate"`      // > 10%
	HighLatency            time.Duration `json:"high_latency"`             // > 1s
	CriticalLatency        time.Duration `json:"critical_latency"`         // > 5s
	LowCacheHitRate        float64       `json:"low_cache_hit_rate"`       // < 70%
	CriticalCacheHitRate   float64       `json:"critical_cache_hit_rate"`  // < 50%
	HighAbuseDetection     float64       `json:"high_abuse_detection"`     // > 10/min
	CriticalAbuseDetection float64       `json:"critical_abuse_detection"` // > 50/min
}

// RateLimitPrometheusMetrics wraps Prometheus metric collectors for rate limiting
type RateLimitPrometheusMetrics struct {
	RequestsTotal     *prometheus.CounterVec
	RequestsAllowed   *prometheus.CounterVec
	RequestsBlocked   *prometheus.CounterVec
	RequestsQueued    *prometheus.CounterVec
	LatencyHistogram  *prometheus.HistogramVec
	CacheHitRate      *prometheus.GaugeVec
	AbuseDetections   *prometheus.CounterVec
	IPBlocks          *prometheus.CounterVec
	QuotaConsumption  *prometheus.CounterVec
	PolicyEvaluations *prometheus.CounterVec
}

// RateLimitMetricsConfig defines metrics configuration for rate limiting
type RateLimitMetricsConfig struct {
	Enabled             bool          `json:"enabled"`
	RetentionPeriod     time.Duration `json:"retention_period"`
	ScrapeInterval      time.Duration `json:"scrape_interval"`
	TimeSeriesEnabled   bool          `json:"time_series_enabled"`
	RealtimeEnabled     bool          `json:"realtime_enabled"`
	AlertsEnabled       bool          `json:"alerts_enabled"`
	PrometheusEnabled   bool          `json:"prometheus_enabled"`
	ExportFormat        string        `json:"export_format"` // json, prometheus, influxdb
	ExportURL           string        `json:"export_url,omitempty"`
	ExportInterval      time.Duration `json:"export_interval"`
	MaxTimeSeriesPoints int           `json:"max_time_series_points"`
}

// MetricsStorage interface for persisting metrics
type MetricsStorage interface {
	StoreMetrics(ctx context.Context, timestamp time.Time, metrics *services.RateLimitMetrics) error
	GetMetrics(ctx context.Context, startTime, endTime time.Time) ([]*services.RateLimitMetrics, error)
	StoreTimeSeries(ctx context.Context, metricName string, points []*TimeSeriesPoint) error
	GetTimeSeries(ctx context.Context, metricName string, startTime, endTime time.Time) ([]*TimeSeriesPoint, error)
	StoreAlert(ctx context.Context, alert *Alert) error
	GetAlerts(ctx context.Context, level string, acknowledged bool) ([]*Alert, error)
}

// MetricsSummary provides a summary of metrics
type MetricsSummary struct {
	Period              time.Duration   `json:"period"`
	TotalRequests       int64           `json:"total_requests"`
	AllowedRequests     int64           `json:"allowed_requests"`
	BlockedRequests     int64           `json:"blocked_requests"`
	QueuedRequests      int64           `json:"queued_requests"`
	BlockRate           float64         `json:"block_rate"`
	AverageLatency      time.Duration   `json:"average_latency"`
	P95Latency          time.Duration   `json:"p95_latency"`
	P99Latency          time.Duration   `json:"p99_latency"`
	CacheHitRate        float64         `json:"cache_hit_rate"`
	AbuseDetectionCount int64           `json:"abuse_detection_count"`
	IPBlockCount        int64           `json:"ip_block_count"`
	TopBlockedIPs       []IPBlockStat   `json:"top_blocked_ips"`
	TopViolations       []ViolationStat `json:"top_violations"`
	Alerts              []Alert         `json:"alerts,omitempty"`
	Timestamp           time.Time       `json:"timestamp"`
}

// IPBlockStat represents IP blocking statistics
type IPBlockStat struct {
	IPAddress   string    `json:"ip_address"`
	BlockCount  int64     `json:"block_count"`
	LastBlocked time.Time `json:"last_blocked"`
	Reason      string    `json:"reason"`
}

// ViolationStat represents violation statistics
type ViolationStat struct {
	Type     string    `json:"type"`
	Count    int64     `json:"count"`
	LastSeen time.Time `json:"last_seen"`
	Severity string    `json:"severity"`
}

// NewRateLimitMetricsCollector creates a new metrics collector
func NewRateLimitMetricsCollector(config *RateLimitMetricsConfig, storage MetricsStorage, logger *logrus.Logger) *RateLimitMetricsCollector {
	collector := &RateLimitMetricsCollector{
		metrics:         &services.RateLimitMetrics{},
		timeSeriesData:  make(map[string][]*TimeSeriesPoint),
		realtimeMetrics: make(map[string]*RealtimeMetric),
		alertThresholds: &AlertThresholds{
			HighErrorRate:          0.05,
			CriticalErrorRate:      0.10,
			HighLatency:            time.Second,
			CriticalLatency:        5 * time.Second,
			LowCacheHitRate:        0.70,
			CriticalCacheHitRate:   0.50,
			HighAbuseDetection:     10,
			CriticalAbuseDetection: 50,
		},
		config:  config,
		logger:  logger,
		storage: storage,
	}

	// Initialize Prometheus metrics if enabled
	if config.PrometheusEnabled {
		collector.promMetrics = collector.initPrometheusMetrics()
	}

	// Start background tasks
	if config.RealtimeEnabled {
		go collector.startRealtimeUpdates()
	}
	if config.TimeSeriesEnabled {
		go collector.startTimeSeriesCollection()
	}
	if config.AlertsEnabled {
		go collector.startAlertMonitoring()
	}
	if config.ExportInterval > 0 {
		go collector.startMetricsExport()
	}

	return collector
}

// RecordRequest implements MetricsCollector interface
func (rmc *RateLimitMetricsCollector) RecordRequest(req *services.RateLimitRequest, result *services.RateLimitResult) {
	rmc.mutex.Lock()
	defer rmc.mutex.Unlock()

	// Update core metrics
	rmc.metrics.TotalRequests++

	if result.Allowed {
		rmc.metrics.AllowedRequests++
	} else {
		rmc.metrics.BlockedRequests++
	}

	// Update latency metrics
	if result.Metrics != nil {
		if rmc.metrics.TotalRequests == 1 {
			rmc.metrics.AverageLatency = result.Metrics.ProcessingTime
		} else {
			// Simple running average
			rmc.metrics.AverageLatency = time.Duration(
				(int64(rmc.metrics.AverageLatency)*(rmc.metrics.TotalRequests-1) + int64(result.Metrics.ProcessingTime)) / rmc.metrics.TotalRequests,
			)
		}
	}

	// Update cache hit rate
	if result.Metrics != nil && result.Metrics.CacheHit {
		if rmc.metrics.TotalRequests == 1 {
			rmc.metrics.CacheHitRate = 1.0
		} else {
			// Update running average
			hitRate := float64(rmc.metrics.AllowedRequests) / float64(rmc.metrics.TotalRequests)
			rmc.metrics.CacheHitRate = hitRate
		}
	}

	rmc.metrics.LastUpdated = time.Now()

	// Update Prometheus metrics
	if rmc.promMetrics != nil {
		labels := prometheus.Labels{
			"tenant_id": req.TenantID,
			"endpoint":  req.Endpoint,
			"method":    req.Method,
		}

		rmc.promMetrics.RequestsTotal.With(labels).Inc()
		if result.Allowed {
			rmc.promMetrics.RequestsAllowed.With(labels).Inc()
		} else {
			rmc.promMetrics.RequestsBlocked.With(labels).Inc()
		}

		if result.Metrics != nil {
			rmc.promMetrics.LatencyHistogram.With(labels).Observe(result.Metrics.ProcessingTime.Seconds())
		}
	}

	// Log significant events
	if !result.Allowed {
		rmc.logger.WithFields(logrus.Fields{
			"tenant_id": req.TenantID,
			"endpoint":  req.Endpoint,
			"key":       req.Key,
			"reason":    "rate_limited",
		}).Info("Request blocked by rate limiter")
	}
}

// RecordQuotaConsumption implements MetricsCollector interface
func (rmc *RateLimitMetricsCollector) RecordQuotaConsumption(req *services.QuotaRequest, result *services.QuotaResult) {
	rmc.mutex.Lock()
	defer rmc.mutex.Unlock()

	// Update Prometheus quota metrics
	if rmc.promMetrics != nil {
		labels := prometheus.Labels{
			"tenant_id":     req.TenantID,
			"resource_type": req.ResourceType,
			"status":        "consumed",
		}

		rmc.promMetrics.QuotaConsumption.With(labels).Add(float64(result.Consumed))
		if !result.Success {
			rmc.promMetrics.QuotaConsumption.With(prometheus.Labels{
				"tenant_id":     req.TenantID,
				"resource_type": req.ResourceType,
				"status":        "exceeded",
			}).Add(float64(result.Consumed))
		}
	}

	if !result.Success {
		rmc.logger.WithFields(logrus.Fields{
			"tenant_id":     req.TenantID,
			"resource_type": req.ResourceType,
			"amount":        result.Consumed,
			"limit":         result.Limit,
		}).Warn("Quota limit exceeded")
	}
}

// RecordPolicyMatch implements MetricsCollector interface
func (rmc *RateLimitMetricsCollector) RecordPolicyMatch(policyID string, matchTime time.Duration) {
	rmc.mutex.Lock()
	defer rmc.mutex.Unlock()

	// Update Prometheus policy metrics
	if rmc.promMetrics != nil {
		labels := prometheus.Labels{
			"policy_id": policyID,
		}

		rmc.promMetrics.PolicyEvaluations.With(labels).Inc()
	}
}

// RecordAbuseDetection implements MetricsCollector interface
func (rmc *RateLimitMetricsCollector) RecordAbuseDetection(analysis *services.AbuseAnalysis) {
	rmc.mutex.Lock()
	defer rmc.mutex.Unlock()

	rmc.metrics.AbuseDetectionCount++

	// Update Prometheus abuse metrics
	if rmc.promMetrics != nil {
		for _, threatType := range analysis.ThreatTypes {
			labels := prometheus.Labels{
				"threat_type": threatType,
				"risk_level":  analysis.RiskLevel,
			}

			rmc.promMetrics.AbuseDetections.With(labels).Inc()
		}
	}

	if analysis.BlockSuggested {
		rmc.logger.WithFields(logrus.Fields{
			"score":      analysis.Score,
			"risk_level": analysis.RiskLevel,
			"threats":    analysis.ThreatTypes,
		}).Warn("Abuse detection suggests IP blocking")
	}
}

// RecordIPBlock implements MetricsCollector interface
func (rmc *RateLimitMetricsCollector) RecordIPBlock(blockInfo *services.BlockInfo) {
	rmc.mutex.Lock()
	defer rmc.mutex.Unlock()

	rmc.metrics.IPBlockCount++

	// Update Prometheus IP block metrics
	if rmc.promMetrics != nil {
		labels := prometheus.Labels{
			"block_type": blockInfo.BlockType,
			"reason":     blockInfo.Reason,
			"severity":   blockInfo.Severity,
		}

		rmc.promMetrics.IPBlocks.With(labels).Inc()
	}

	rmc.logger.WithFields(logrus.Fields{
		"ip_address": blockInfo.IPAddress,
		"block_type": blockInfo.BlockType,
		"reason":     blockInfo.Reason,
		"severity":   blockInfo.Severity,
	}).Info("IP address blocked")
}

// GetMetrics implements MetricsCollector interface
func (rmc *RateLimitMetricsCollector) GetMetrics() *services.RateLimitMetrics {
	rmc.mutex.RLock()
	defer rmc.mutex.RUnlock()

	// Return a copy to prevent modification
	metricsCopy := *rmc.metrics
	return &metricsCopy
}

// GetTimeSeriesData returns time series data for a metric
func (rmc *RateLimitMetricsCollector) GetTimeSeriesData(metricName string, startTime, endTime time.Time) ([]*TimeSeriesPoint, error) {
	rmc.tsMutex.RLock()
	defer rmc.tsMutex.RUnlock()

	points, exists := rmc.timeSeriesData[metricName]
	if !exists {
		return []*TimeSeriesPoint{}, nil
	}

	// Filter by time range
	var filteredPoints []*TimeSeriesPoint
	for _, point := range points {
		if point.Timestamp.After(startTime) && point.Timestamp.Before(endTime) {
			filteredPoints = append(filteredPoints, point)
		}
	}

	return filteredPoints, nil
}

// GetRealtimeMetrics returns current real-time metrics
func (rmc *RateLimitMetricsCollector) GetRealtimeMetrics() map[string]*RealtimeMetric {
	rmc.rtMutex.RLock()
	defer rmc.rtMutex.RUnlock()

	// Return copies to prevent modification
	metricsCopy := make(map[string]*RealtimeMetric)
	for name, metric := range rmc.realtimeMetrics {
		metricCopy := *metric
		metricsCopy[name] = &metricCopy
	}

	return metricsCopy
}

// GetMetricsSummary returns a metrics summary for a time period
func (rmc *RateLimitMetricsCollector) GetMetricsSummary(period time.Duration) (*MetricsSummary, error) {
	rmc.mutex.RLock()
	defer rmc.mutex.RUnlock()

	total := rmc.metrics.TotalRequests
	summary := &MetricsSummary{
		Period:              period,
		TotalRequests:       total,
		AllowedRequests:     rmc.metrics.AllowedRequests,
		BlockedRequests:     rmc.metrics.BlockedRequests,
		QueuedRequests:      rmc.metrics.QueuedRequests,
		BlockRate:           float64(rmc.metrics.BlockedRequests) / float64(total),
		AverageLatency:      rmc.metrics.AverageLatency,
		P95Latency:          rmc.metrics.AverageLatency, // Would need actual p95 calculation
		P99Latency:          rmc.metrics.AverageLatency, // Would need actual p99 calculation
		CacheHitRate:        rmc.metrics.CacheHitRate,
		AbuseDetectionCount: rmc.metrics.AbuseDetectionCount,
		IPBlockCount:        rmc.metrics.IPBlockCount,
		Timestamp:           time.Now(),
	}

	// Get alerts if enabled
	if rmc.config.AlertsEnabled {
		summary.Alerts = rmc.getActiveAlerts()
	}

	return summary, nil
}

// CreateAlert creates a new alert
func (rmc *RateLimitMetricsCollector) CreateAlert(metricName, level, message string, threshold, currentValue float64) *Alert {
	alert := &Alert{
		ID:           fmt.Sprintf("alert_%d", time.Now().UnixNano()),
		MetricName:   metricName,
		Level:        level,
		Message:      message,
		Threshold:    threshold,
		CurrentValue: currentValue,
		Timestamp:    time.Now(),
		Acknowledged: false,
		Metadata:     make(map[string]interface{}),
	}

	// Store alert
	if rmc.storage != nil {
		if err := rmc.storage.StoreAlert(context.Background(), alert); err != nil {
			rmc.logger.WithError(err).Error("Failed to store alert")
		}
	}

	rmc.logger.WithFields(logrus.Fields{
		"alert_id":    alert.ID,
		"metric_name": metricName,
		"level":       level,
		"message":     message,
	}).Warn("Alert created")

	return alert
}

// Helper methods

func (rmc *RateLimitMetricsCollector) initPrometheusMetrics() *RateLimitPrometheusMetrics {
	return &RateLimitPrometheusMetrics{
		RequestsTotal: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "rate_limit_requests_total",
				Help: "Total number of rate limit requests",
			},
			[]string{"tenant_id", "endpoint", "method"},
		),
		RequestsAllowed: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "rate_limit_requests_allowed_total",
				Help: "Total number of allowed rate limit requests",
			},
			[]string{"tenant_id", "endpoint", "method"},
		),
		RequestsBlocked: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "rate_limit_requests_blocked_total",
				Help: "Total number of blocked rate limit requests",
			},
			[]string{"tenant_id", "endpoint", "method"},
		),
		RequestsQueued: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "rate_limit_requests_queued_total",
				Help: "Total number of queued rate limit requests",
			},
			[]string{"tenant_id", "endpoint"},
		),
		LatencyHistogram: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "rate_limit_latency_seconds",
				Help:    "Rate limit processing latency",
				Buckets: prometheus.DefBuckets,
			},
			[]string{"tenant_id", "endpoint", "method"},
		),
		CacheHitRate: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "rate_limit_cache_hit_rate",
				Help: "Rate limit cache hit rate",
			},
			[]string{"tenant_id"},
		),
		AbuseDetections: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "rate_limit_abuse_detections_total",
				Help: "Total number of abuse detections",
			},
			[]string{"threat_type", "risk_level"},
		),
		IPBlocks: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "rate_limit_ip_blocks_total",
				Help: "Total number of IP blocks",
			},
			[]string{"block_type", "reason", "severity"},
		),
		QuotaConsumption: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "rate_limit_quota_consumed_total",
				Help: "Total quota consumption",
			},
			[]string{"tenant_id", "resource_type", "status"},
		),
		PolicyEvaluations: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "rate_limit_policy_evaluations_total",
				Help: "Total number of policy evaluations",
			},
			[]string{"policy_id"},
		),
	}
}

func (rmc *RateLimitMetricsCollector) startRealtimeUpdates() {
	ticker := time.NewTicker(time.Second * 10) // Update every 10 seconds
	defer ticker.Stop()

	for range ticker.C {
		rmc.updateRealtimeMetrics()
	}
}

func (rmc *RateLimitMetricsCollector) startTimeSeriesCollection() {
	ticker := time.NewTicker(time.Minute) // Collect every minute
	defer ticker.Stop()

	for range ticker.C {
		rmc.collectTimeSeriesData()
	}
}

func (rmc *RateLimitMetricsCollector) startAlertMonitoring() {
	ticker := time.NewTicker(time.Minute * 5) // Check every 5 minutes
	defer ticker.Stop()

	for range ticker.C {
		rmc.checkAlerts()
	}
}

func (rmc *RateLimitMetricsCollector) startMetricsExport() {
	ticker := time.NewTicker(rmc.config.ExportInterval)
	defer ticker.Stop()

	for range ticker.C {
		rmc.exportMetrics()
	}
}

func (rmc *RateLimitMetricsCollector) updateRealtimeMetrics() {
	rmc.mutex.RLock()
	metrics := *rmc.metrics
	rmc.mutex.RUnlock()

	rmc.rtMutex.Lock()
	defer rmc.rtMutex.Unlock()

	// Update request rate metrics
	requestRate := float64(metrics.TotalRequests) / time.Since(time.Now().Add(-time.Hour)).Seconds()

	rmc.realtimeMetrics["requests_per_second"] = &RealtimeMetric{
		Name:        "requests_per_second",
		Current:     requestRate,
		LastUpdated: time.Now(),
		Tags: map[string]string{
			"unit": "rps",
		},
	}

	// Update block rate
	blockRate := float64(metrics.BlockedRequests) / float64(metrics.TotalRequests)
	rmc.realtimeMetrics["block_rate"] = &RealtimeMetric{
		Name:        "block_rate",
		Current:     blockRate,
		LastUpdated: time.Now(),
		Tags: map[string]string{
			"unit": "percentage",
		},
	}

	// Update cache hit rate
	rmc.realtimeMetrics["cache_hit_rate"] = &RealtimeMetric{
		Name:        "cache_hit_rate",
		Current:     metrics.CacheHitRate,
		LastUpdated: time.Now(),
		Tags: map[string]string{
			"unit": "percentage",
		},
	}
}

func (rmc *RateLimitMetricsCollector) collectTimeSeriesData() {
	if !rmc.config.TimeSeriesEnabled {
		return
	}

	rmc.mutex.RLock()
	metrics := *rmc.metrics
	rmc.mutex.RUnlock()

	now := time.Now()

	// Create time series points
	points := []*TimeSeriesPoint{
		{
			Timestamp: now,
			Value:     float64(metrics.TotalRequests),
			Tags: map[string]string{
				"metric": "total_requests",
			},
		},
		{
			Timestamp: now,
			Value:     float64(metrics.BlockedRequests),
			Tags: map[string]string{
				"metric": "blocked_requests",
			},
		},
		{
			Timestamp: now,
			Value:     metrics.CacheHitRate,
			Tags: map[string]string{
				"metric": "cache_hit_rate",
			},
		},
		{
			Timestamp: now,
			Value:     metrics.AverageLatency.Seconds(),
			Tags: map[string]string{
				"metric": "average_latency_seconds",
			},
		},
	}

	// Store time series data
	rmc.tsMutex.Lock()
	for _, point := range points {
		metricName := point.Tags["metric"]
		if _, exists := rmc.timeSeriesData[metricName]; !exists {
			rmc.timeSeriesData[metricName] = make([]*TimeSeriesPoint, 0)
		}

		rmc.timeSeriesData[metricName] = append(rmc.timeSeriesData[metricName], point)

		// Limit the number of points to prevent memory bloat
		if len(rmc.timeSeriesData[metricName]) > rmc.config.MaxTimeSeriesPoints {
			rmc.timeSeriesData[metricName] = rmc.timeSeriesData[metricName][1:]
		}
	}
	rmc.tsMutex.Unlock()

	// Persist to storage if available
	if rmc.storage != nil {
		for _, point := range points {
			if err := rmc.storage.StoreTimeSeries(context.Background(), point.Tags["metric"], []*TimeSeriesPoint{point}); err != nil {
				rmc.logger.WithError(err).Error("Failed to store time series data")
			}
		}
	}
}

func (rmc *RateLimitMetricsCollector) checkAlerts() {
	if !rmc.config.AlertsEnabled {
		return
	}

	rmc.mutex.RLock()
	metrics := *rmc.metrics
	rmc.mutex.RUnlock()

	// Check error rate (blocked requests as proxy)
	if metrics.TotalRequests > 0 {
		errorRate := float64(metrics.BlockedRequests) / float64(metrics.TotalRequests)
		if errorRate > rmc.alertThresholds.CriticalErrorRate {
			rmc.CreateAlert("error_rate", "critical",
				fmt.Sprintf("Error rate (%.2f%%) exceeds critical threshold (%.2f%%)",
					errorRate*100, rmc.alertThresholds.CriticalErrorRate*100),
				rmc.alertThresholds.CriticalErrorRate, errorRate)
		} else if errorRate > rmc.alertThresholds.HighErrorRate {
			rmc.CreateAlert("error_rate", "warning",
				fmt.Sprintf("Error rate (%.2f%%) exceeds warning threshold (%.2f%%)",
					errorRate*100, rmc.alertThresholds.HighErrorRate*100),
				rmc.alertThresholds.HighErrorRate, errorRate)
		}
	}

	// Check cache hit rate
	if metrics.CacheHitRate < rmc.alertThresholds.CriticalCacheHitRate {
		rmc.CreateAlert("cache_hit_rate", "critical",
			fmt.Sprintf("Cache hit rate (%.2f%%) below critical threshold (%.2f%%)",
				metrics.CacheHitRate*100, rmc.alertThresholds.CriticalCacheHitRate*100),
			rmc.alertThresholds.CriticalCacheHitRate, metrics.CacheHitRate)
	} else if metrics.CacheHitRate < rmc.alertThresholds.LowCacheHitRate {
		rmc.CreateAlert("cache_hit_rate", "warning",
			fmt.Sprintf("Cache hit rate (%.2f%%) below warning threshold (%.2f%%)",
				metrics.CacheHitRate*100, rmc.alertThresholds.LowCacheHitRate*100),
			rmc.alertThresholds.LowCacheHitRate, metrics.CacheHitRate)
	}

	// Check latency
	if metrics.AverageLatency > rmc.alertThresholds.CriticalLatency {
		rmc.CreateAlert("latency", "critical",
			fmt.Sprintf("Average latency (%s) exceeds critical threshold (%s)",
				metrics.AverageLatency, rmc.alertThresholds.CriticalLatency),
			float64(rmc.alertThresholds.CriticalLatency.Seconds()), float64(metrics.AverageLatency.Seconds()))
	} else if metrics.AverageLatency > rmc.alertThresholds.HighLatency {
		rmc.CreateAlert("latency", "warning",
			fmt.Sprintf("Average latency (%s) exceeds warning threshold (%s)",
				metrics.AverageLatency, rmc.alertThresholds.HighLatency),
			float64(rmc.alertThresholds.HighLatency.Seconds()), float64(metrics.AverageLatency.Seconds()))
	}
}

func (rmc *RateLimitMetricsCollector) exportMetrics() {
	if rmc.config.ExportURL == "" {
		return
	}

	rmc.mutex.RLock()
	metrics := *rmc.metrics
	rmc.mutex.RUnlock()

	// Convert metrics to export format
	exportData := map[string]interface{}{
		"timestamp":             time.Now().UTC().Format(time.RFC3339),
		"total_requests":        metrics.TotalRequests,
		"allowed_requests":      metrics.AllowedRequests,
		"blocked_requests":      metrics.BlockedRequests,
		"queued_requests":       metrics.QueuedRequests,
		"average_latency_ms":    metrics.AverageLatency.Milliseconds(),
		"p95_latency_ms":        metrics.P95Latency.Milliseconds(),
		"p99_latency_ms":        metrics.P99Latency.Milliseconds(),
		"cache_hit_rate":        metrics.CacheHitRate,
		"abuse_detection_count": metrics.AbuseDetectionCount,
		"ip_block_count":        metrics.IPBlockCount,
	}

	// Serialize and export (simplified - would need HTTP client implementation)
	data, err := json.Marshal(exportData)
	if err != nil {
		rmc.logger.WithError(err).Error("Failed to marshal metrics for export")
		return
	}

	rmc.logger.WithFields(logrus.Fields{
		"export_url": rmc.config.ExportURL,
		"data_size":  len(data),
	}).Debug("Metrics export data prepared")
	// In a real implementation, you would send this data to the export URL
}

func (rmc *RateLimitMetricsCollector) getActiveAlerts() []Alert {
	// This would query storage for active alerts
	return []Alert{}
}
