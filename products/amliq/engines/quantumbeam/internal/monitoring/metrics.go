//go:build legacy_migrated
// +build legacy_migrated

package monitoring

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.uber.org/zap"
)

// MetricsCollector collects and manages application metrics
type MetricsCollector struct {
	logger      *zap.Logger
	config      *MetricsConfig
	redisClient *redis.Client
	registry    *prometheus.Registry
	metrics     map[string]*Metric
	mu          sync.RWMutex
	ctx         context.Context
	cancel      context.CancelFunc
}

// MetricsConfig holds metrics configuration
type MetricsConfig struct {
	Enabled            bool                `yaml:"enabled" json:"enabled"`
	Port               int                 `yaml:"port" json:"port"`
	Path               string              `yaml:"path" json:"path"`
	Namespace          string              `yaml:"namespace" json:"namespace"`
	Subsystem          string              `yaml:"subsystem" json:"subsystem"`
	CollectionInterval time.Duration       `yaml:"collection_interval" json:"collection_interval"`
	RetentionPeriod    time.Duration       `yaml:"retention_period" json:"retention_period"`
	MaxMetrics         int                 `yaml:"max_metrics" json:"max_metrics"`
	EnableHistograms   bool                `yaml:"enable_histograms" json:"enable_histograms"`
	EnableSummaries    bool                `yaml:"enable_summaries" json:"enable_summaries"`
	EnableGauges       bool                `yaml:"enable_gauges" json:"enable_gauges"`
	EnableCounters     bool                `yaml:"enable_counters" json:"enable_counters"`
	Buckets            []float64           `yaml:"buckets" json:"buckets"`
	Objectives         map[float64]float64 `yaml:"objectives" json:"objectives"`
	Labels             []string            `yaml:"labels" json:"labels"`
}

// Metric represents a metric
type Metric struct {
	Name        string              `json:"name"`
	Type        MetricType          `json:"type"`
	Description string              `json:"description"`
	Labels      map[string]string   `json:"labels"`
	Value       float64             `json:"value"`
	Timestamp   time.Time           `json:"timestamp"`
	Help        string              `json:"help"`
	Buckets     []float64           `json:"buckets,omitempty"`
	Objectives  map[float64]float64 `json:"objectives,omitempty"`
}

// MetricType represents metric types
type MetricType string

const (
	TypeCounter   MetricType = "counter"
	TypeGauge     MetricType = "gauge"
	TypeHistogram MetricType = "histogram"
	TypeSummary   MetricType = "summary"
	TypeUntyped   MetricType = "untyped"
)

// MetricValue represents a metric value with labels
type MetricValue struct {
	Value  float64           `json:"value"`
	Labels map[string]string `json:"labels"`
	Time   time.Time         `json:"time"`
}

// MetricSeries represents a time series of metric values
type MetricSeries struct {
	Name   string        `json:"name"`
	Type   MetricType    `json:"type"`
	Values []MetricValue `json:"values"`
}

// Default metrics configuration
var (
	DefaultMetricsConfig = MetricsConfig{
		Enabled:            true,
		Port:               9090,
		Path:               "/metrics",
		Namespace:          "quantumbeam",
		Subsystem:          "api",
		CollectionInterval: 15 * time.Second,
		RetentionPeriod:    24 * time.Hour,
		MaxMetrics:         10000,
		EnableHistograms:   true,
		EnableSummaries:    true,
		EnableGauges:       true,
		EnableCounters:     true,
		Buckets:            []float64{0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 25, 50, 100},
		Objectives:         map[float64]float64{0.5: 0.05, 0.9: 0.01, 0.95: 0.005, 0.99: 0.001},
		Labels:             []string{"method", "path", "status", "service", "environment"},
	}
)

// Predefined metrics
var (
	// HTTP metrics
	httpRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total number of HTTP requests",
		},
		[]string{"method", "path", "status", "service"},
	)

	httpRequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "HTTP request duration in seconds",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "path", "status", "service"},
	)

	httpRequestSize = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_size_bytes",
			Help:    "HTTP request size in bytes",
			Buckets: []float64{100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000},
		},
		[]string{"method", "path", "service"},
	)

	httpResponseSize = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_response_size_bytes",
			Help:    "HTTP response size in bytes",
			Buckets: []float64{100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000},
		},
		[]string{"method", "path", "status", "service"},
	)

	// Application metrics
	activeConnections = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "active_connections",
			Help: "Number of active connections",
		},
	)

	authenticatedRequests = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "authenticated_requests_total",
			Help: "Total number of authenticated requests",
		},
		[]string{"method", "service", "user_type"},
	)

	// Database metrics
	dbConnectionsActive = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "db_connections_active",
			Help: "Number of active database connections",
		},
		[]string{"database"},
	)

	dbQueryDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "db_query_duration_seconds",
			Help:    "Database query duration in seconds",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"database", "operation", "table"},
	)

	// Cache metrics
	cacheHits = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "cache_hits_total",
			Help: "Total number of cache hits",
		},
		[]string{"cache", "operation"},
	)

	cacheMisses = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "cache_misses_total",
			Help: "Total number of cache misses",
		},
		[]string{"cache", "operation"},
	)

	// Fraud detection metrics
	fraudAnalysisTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "fraud_analysis_total",
			Help: "Total number of fraud analysis requests",
		},
		[]string{"service", "model", "result"},
	)

	fraudScores = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "fraud_scores",
			Help:    "Fraud scores distribution",
			Buckets: []float64{0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0},
		},
		[]string{"service", "model"},
	)

	// AI/ML metrics
	aiRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "ai_requests_total",
			Help: "Total number of AI requests",
		},
		[]string{"provider", "model", "operation"},
	)

	aiRequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "ai_request_duration_seconds",
			Help:    "AI request duration in seconds",
			Buckets: []float64{0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300},
		},
		[]string{"provider", "model", "operation"},
	)

	// Quantum computing metrics
	quantumJobsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "quantum_jobs_total",
			Help: "Total number of quantum computing jobs",
		},
		[]string{"backend", "status", "qubits"},
	)

	quantumJobDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "quantum_job_duration_seconds",
			Help:    "Quantum job duration in seconds",
			Buckets: []float64{1, 5, 10, 30, 60, 300, 600, 1800, 3600},
		},
		[]string{"backend", "qubits"},
	)
)

// NewMetricsCollector creates a new metrics collector
func NewMetricsCollector(redisClient *redis.Client, logger *zap.Logger, config *MetricsConfig) *MetricsCollector {
	if config == nil {
		config = &DefaultMetricsConfig
	}

	ctx, cancel := context.WithCancel(context.Background())

	mc := &MetricsCollector{
		logger:      logger,
		config:      config,
		redisClient: redisClient,
		registry:    prometheus.NewRegistry(),
		metrics:     make(map[string]*Metric),
		ctx:         ctx,
		cancel:      cancel,
	}

	// Register default metrics
	mc.registerDefaultMetrics()

	return mc
}

// Start starts the metrics collector
func (mc *MetricsCollector) Start() error {
	if !mc.config.Enabled {
		mc.logger.Info("Metrics collector is disabled")
		return nil
	}

	mc.logger.Info("Starting metrics collector")

	// Start HTTP server for metrics endpoint
	go mc.startMetricsServer()

	// Start collection loop
	go mc.collectionLoop()

	// Start cleanup loop
	go mc.cleanupLoop()

	mc.logger.Info("Metrics collector started successfully")
	return nil
}

// Stop stops the metrics collector
func (mc *MetricsCollector) Stop() error {
	mc.logger.Info("Stopping metrics collector")
	mc.cancel()
	return nil
}

// RecordCounter records a counter metric
func (mc *MetricsCollector) RecordCounter(name string, value float64, labels map[string]string) {
	mc.mu.Lock()
	defer mc.mu.Unlock()

	key := mc.buildKey(name, labels)
	metric, exists := mc.metrics[key]
	if !exists {
		metric = &Metric{
			Name:        name,
			Type:        TypeCounter,
			Description: "Counter metric",
			Labels:      labels,
			Help:        "Counter metric",
		}
		mc.metrics[key] = metric
	}

	metric.Value += value
	metric.Timestamp = time.Now()

	// Store in Redis
	mc.storeMetric(metric)
}

// RecordGauge records a gauge metric
func (mc *MetricsCollector) RecordGauge(name string, value float64, labels map[string]string) {
	mc.mu.Lock()
	defer mc.mu.Unlock()

	key := mc.buildKey(name, labels)
	metric, exists := mc.metrics[key]
	if !exists {
		metric = &Metric{
			Name:        name,
			Type:        TypeGauge,
			Description: "Gauge metric",
			Labels:      labels,
			Help:        "Gauge metric",
		}
		mc.metrics[key] = metric
	}

	metric.Value = value
	metric.Timestamp = time.Now()

	// Store in Redis
	mc.storeMetric(metric)
}

// RecordHistogram records a histogram metric
func (mc *MetricsCollector) RecordHistogram(name string, value float64, labels map[string]string) {
	mc.mu.Lock()
	defer mc.mu.Unlock()

	key := mc.buildKey(name, labels)
	metric, exists := mc.metrics[key]
	if !exists {
		metric = &Metric{
			Name:        name,
			Type:        TypeHistogram,
			Description: "Histogram metric",
			Labels:      labels,
			Help:        "Histogram metric",
			Buckets:     mc.config.Buckets,
		}
		mc.metrics[key] = metric
	}

	metric.Timestamp = time.Now()

	// Store histogram observation
	mc.storeHistogramObservation(metric, value)
}

// RecordSummary records a summary metric
func (mc *MetricsCollector) RecordSummary(name string, value float64, labels map[string]string) {
	mc.mu.Lock()
	defer mc.mu.Unlock()

	key := mc.buildKey(name, labels)
	metric, exists := mc.metrics[key]
	if !exists {
		metric = &Metric{
			Name:        name,
			Type:        TypeSummary,
			Description: "Summary metric",
			Labels:      labels,
			Help:        "Summary metric",
			Objectives:  mc.config.Objectives,
		}
		mc.metrics[key] = metric
	}

	metric.Timestamp = time.Now()

	// Store summary observation
	mc.storeSummaryObservation(metric, value)
}

// IncrementCounter increments a counter metric
func (mc *MetricsCollector) IncrementCounter(name string, labels map[string]string) {
	mc.RecordCounter(name, 1, labels)
}

// SetGauge sets a gauge metric value
func (mc *MetricsCollector) SetGauge(name string, value float64, labels map[string]string) {
	mc.RecordGauge(name, value, labels)
}

// GetMetric gets a metric by name and labels
func (mc *MetricsCollector) GetMetric(name string, labels map[string]string) (*Metric, error) {
	mc.mu.RLock()
	defer mc.mu.RUnlock()

	key := mc.buildKey(name, labels)
	metric, exists := mc.metrics[key]
	if !exists {
		return nil, fmt.Errorf("metric %s not found", key)
	}

	return metric, nil
}

// GetMetrics gets all metrics
func (mc *MetricsCollector) GetMetrics() map[string]*Metric {
	mc.mu.RLock()
	defer mc.mu.RUnlock()

	result := make(map[string]*Metric)
	for k, v := range mc.metrics {
		result[k] = v
	}

	return result
}

// GetMetricSeries gets a time series for a metric
func (mc *MetricsCollector) GetMetricSeries(name string, labels map[string]string, duration time.Duration) (*MetricSeries, error) {
	// This would retrieve historical data from Redis or time series database
	// For now, return current value
	metric, err := mc.GetMetric(name, labels)
	if err != nil {
		return nil, err
	}

	return &MetricSeries{
		Name: name,
		Type: metric.Type,
		Values: []MetricValue{
			{
				Value:  metric.Value,
				Labels: metric.Labels,
				Time:   metric.Timestamp,
			},
		},
	}, nil
}

// DeleteMetric deletes a metric
func (mc *MetricsCollector) DeleteMetric(name string, labels map[string]string) error {
	mc.mu.Lock()
	defer mc.mu.Unlock()

	key := mc.buildKey(name, labels)
	delete(mc.metrics, key)

	// Remove from Redis
	return mc.redisClient.Del(mc.ctx, fmt.Sprintf("metric:%s", key)).Err()
}

// buildKey builds a unique key for a metric with labels
func (mc *MetricsCollector) buildKey(name string, labels map[string]string) string {
	if len(labels) == 0 {
		return name
	}

	var labelPairs []string
	for k, v := range labels {
		labelPairs = append(labelPairs, fmt.Sprintf("%s=%s", k, v))
	}
	sort.Strings(labelPairs)

	return fmt.Sprintf("%s{%s}", name, strings.Join(labelPairs, ","))
}

// storeMetric stores a metric in Redis
func (mc *MetricsCollector) storeMetric(metric *Metric) {
	data, err := json.Marshal(metric)
	if err != nil {
		mc.logger.Error("Failed to marshal metric", zap.Error(err))
		return
	}

	key := fmt.Sprintf("metric:%s", mc.buildKey(metric.Name, metric.Labels))
	mc.redisClient.Set(mc.ctx, key, data, mc.config.RetentionPeriod)
}

// storeHistogramObservation stores a histogram observation
func (mc *MetricsCollector) storeHistogramObservation(metric *Metric, value float64) {
	observationKey := fmt.Sprintf("histogram:%s:observations", mc.buildKey(metric.Name, metric.Labels))
	mc.redisClient.LPush(mc.ctx, observationKey, value)
	mc.redisClient.LTrim(mc.ctx, observationKey, 0, 9999) // Keep last 10k observations
	mc.redisClient.Expire(mc.ctx, observationKey, mc.config.RetentionPeriod)
}

// storeSummaryObservation stores a summary observation
func (mc *MetricsCollector) storeSummaryObservation(metric *Metric, value float64) {
	observationKey := fmt.Sprintf("summary:%s:observations", mc.buildKey(metric.Name, metric.Labels))
	mc.redisClient.LPush(mc.ctx, observationKey, value)
	mc.redisClient.LTrim(mc.ctx, observationKey, 0, 9999) // Keep last 10k observations
	mc.redisClient.Expire(mc.ctx, observationKey, mc.config.RetentionPeriod)
}

// registerDefaultMetrics registers default Prometheus metrics
func (mc *MetricsCollector) registerDefaultMetrics() {
	mc.registry.MustRegister(httpRequestsTotal)
	mc.registry.MustRegister(httpRequestDuration)
	mc.registry.MustRegister(httpRequestSize)
	mc.registry.MustRegister(httpResponseSize)
	mc.registry.MustRegister(activeConnections)
	mc.registry.MustRegister(authenticatedRequests)
	mc.registry.MustRegister(dbConnectionsActive)
	mc.registry.MustRegister(dbQueryDuration)
	mc.registry.MustRegister(cacheHits)
	mc.registry.MustRegister(cacheMisses)
	mc.registry.MustRegister(fraudAnalysisTotal)
	mc.registry.MustRegister(fraudScores)
	mc.registry.MustRegister(aiRequestsTotal)
	mc.registry.MustRegister(aiRequestDuration)
	mc.registry.MustRegister(quantumJobsTotal)
	mc.registry.MustRegister(quantumJobDuration)
}

// startMetricsServer starts the HTTP server for metrics
func (mc *MetricsCollector) startMetricsServer() {
	mux := http.NewServeMux()
	mux.Handle(mc.config.Path, promhttp.HandlerFor(mc.registry, promhttp.HandlerOpts{}))

	server := &http.Server{
		Addr:    fmt.Sprintf(":%d", mc.config.Port),
		Handler: mux,
	}

	mc.logger.Info("Starting metrics server",
		zap.Int("port", mc.config.Port),
		zap.String("path", mc.config.Path))

	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		mc.logger.Error("Metrics server failed", zap.Error(err))
	}
}

// collectionLoop runs the metrics collection loop
func (mc *MetricsCollector) collectionLoop() {
	ticker := time.NewTicker(mc.config.CollectionInterval)
	defer ticker.Stop()

	for {
		select {
		case <-mc.ctx.Done():
			return
		case <-ticker.C:
			mc.collectSystemMetrics()
		}
	}
}

// collectSystemMetrics collects system-level metrics
func (mc *MetricsCollector) collectSystemMetrics() {
	// Collect system metrics like CPU, memory, disk usage
	// This would use system libraries to get actual metrics

	// Example: Memory usage
	mc.RecordGauge("system_memory_bytes", 1000000, map[string]string{"type": "used"})
	mc.RecordGauge("system_memory_bytes", 2000000, map[string]string{"type": "available"})

	// Example: CPU usage
	mc.RecordGauge("system_cpu_usage_percent", 75.5, map[string]string{})

	// Example: Disk usage
	mc.RecordGauge("system_disk_bytes", 50000000, map[string]string{"type": "used", "device": "/dev/sda1"})
}

// cleanupLoop performs periodic cleanup
func (mc *MetricsCollector) cleanupLoop() {
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()

	for {
		select {
		case <-mc.ctx.Done():
			return
		case <-ticker.C:
			mc.performCleanup()
		}
	}
}

// performCleanup performs cleanup tasks
func (mc *MetricsCollector) performCleanup() {
	mc.mu.Lock()
	defer mc.mu.Unlock()

	// Remove old metrics
	cutoff := time.Now().Add(-mc.config.RetentionPeriod)
	for key, metric := range mc.metrics {
		if metric.Timestamp.Before(cutoff) {
			delete(mc.metrics, key)
			mc.redisClient.Del(mc.ctx, fmt.Sprintf("metric:%s", key))
		}
	}

	// Limit total number of metrics
	if len(mc.metrics) > mc.config.MaxMetrics {
		mc.limitMetrics()
	}
}

// limitMetrics limits the number of metrics to the configured maximum
func (mc *MetricsCollector) limitMetrics() {
	// Sort metrics by timestamp and keep the most recent ones
	var metrics []*Metric
	for _, metric := range mc.metrics {
		metrics = append(metrics, metric)
	}

	sort.Slice(metrics, func(i, j int) bool {
		return metrics[i].Timestamp.After(metrics[j].Timestamp)
	})

	// Keep only the newest metrics
	for i := mc.config.MaxMetrics; i < len(metrics); i++ {
		key := mc.buildKey(metrics[i].Name, metrics[i].Labels)
		delete(mc.metrics, key)
		mc.redisClient.Del(mc.ctx, fmt.Sprintf("metric:%s", key))
	}
}

// Helper functions for recording HTTP metrics
func (mc *MetricsCollector) RecordHTTPRequest(method, path, status, service string, duration time.Duration, requestSize, responseSize int) {
	httpRequestsTotal.WithLabelValues(method, path, status, service).Inc()
	httpRequestDuration.WithLabelValues(method, path, status, service).Observe(duration.Seconds())
	httpRequestSize.WithLabelValues(method, path, service).Observe(float64(requestSize))
	httpResponseSize.WithLabelValues(method, path, status, service).Observe(float64(responseSize))
}

// Helper functions for database metrics
func (mc *MetricsCollector) RecordDBQuery(database, operation, table string, duration time.Duration) {
	dbQueryDuration.WithLabelValues(database, operation, table).Observe(duration.Seconds())
}

func (mc *MetricsCollector) SetDBConnections(database string, active int) {
	dbConnectionsActive.WithLabelValues(database).Set(float64(active))
}

// Helper functions for cache metrics
func (mc *MetricsCollector) RecordCacheHit(cache, operation string) {
	cacheHits.WithLabelValues(cache, operation).Inc()
}

func (mc *MetricsCollector) RecordCacheMiss(cache, operation string) {
	cacheMisses.WithLabelValues(cache, operation).Inc()
}

// Helper functions for fraud detection metrics
func (mc *MetricsCollector) RecordFraudAnalysis(service, model, result string, score float64) {
	fraudAnalysisTotal.WithLabelValues(service, model, result).Inc()
	fraudScores.WithLabelValues(service, model).Observe(score)
}

// Helper functions for AI metrics
func (mc *MetricsCollector) RecordAIRequest(provider, model, operation string, duration time.Duration) {
	aiRequestsTotal.WithLabelValues(provider, model, operation).Inc()
	aiRequestDuration.WithLabelValues(provider, model, operation).Observe(duration.Seconds())
}

// Helper functions for quantum metrics
func (mc *MetricsCollector) RecordQuantumJob(backend, status string, qubits int, duration time.Duration) {
	quantumJobsTotal.WithLabelValues(backend, status, strconv.Itoa(qubits)).Inc()
	quantumJobDuration.WithLabelValues(backend, strconv.Itoa(qubits)).Observe(duration.Seconds())
}

// SetActiveConnections sets the number of active connections
func (mc *MetricsCollector) SetActiveConnections(count int) {
	activeConnections.Set(float64(count))
}

// RecordAuthenticatedRequest records an authenticated request
func (mc *MetricsCollector) RecordAuthenticatedRequest(method, service, userType string) {
	authenticatedRequests.WithLabelValues(method, service, userType).Inc()
}