package metrics

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/prometheus/client_golang/prometheus/push"

	"github.com/prometheus/client_golang/api"
	v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	dto "github.com/prometheus/client_model/go"
)

// PrometheusMetrics handles Prometheus metrics collection
type PrometheusMetrics struct {
	registry      *prometheus.Registry
	config        PrometheusConfig
	httpAPI       v1.API
	mu            sync.RWMutex
	customMetrics map[string]prometheus.Collector
}

// PrometheusConfig contains configuration for Prometheus metrics
type PrometheusConfig struct {
	Enabled        bool          `json:"enabled"`
	Address        string        `json:"address"`
	Port           int           `json:"port"`
	Path           string        `json:"path"`
	Namespace      string        `json:"namespace"`
	Subsystem      string        `json:"subsystem"`
	Buckets        []float64     `json:"buckets"`
	Labels         []string      `json:"labels"`
	PushGateway    string        `json:"push_gateway"`
	PushInterval   time.Duration `json:"push_interval"`
	RemoteReadURL  string        `json:"remote_read_url"`
	RemoteWriteURL string        `json:"remote_write_url"`
}

// Metric definitions
var (
	// HTTP metrics
	httpRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total number of HTTP requests",
		},
		[]string{"method", "endpoint", "status_code", "service"},
	)

	httpRequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "HTTP request duration in seconds",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "endpoint", "service"},
	)

	httpRequestSize = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_size_bytes",
			Help:    "HTTP request size in bytes",
			Buckets: []float64{100, 1000, 10000, 100000, 1000000, 10000000},
		},
		[]string{"method", "endpoint", "service"},
	)

	httpResponseSize = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_response_size_bytes",
			Help:    "HTTP response size in bytes",
			Buckets: []float64{100, 1000, 10000, 100000, 1000000, 10000000},
		},
		[]string{"method", "endpoint", "service"},
	)

	// Application metrics
	fraudDetectionsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "fraud_detections_total",
			Help: "Total number of fraud detections",
		},
		[]string{"model_type", "confidence_level", "result"},
	)

	fraudDetectionDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "fraud_detection_duration_seconds",
			Help:    "Time taken to perform fraud detection",
			Buckets: []float64{0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0},
		},
		[]string{"model_type", "quantum_enabled"},
	)

	modelAccuracy = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "model_accuracy_score",
			Help: "Accuracy score of fraud detection models",
		},
		[]string{"model_type", "version"},
	)

	// Database metrics
	dbConnectionsActive = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "db_connections_active",
			Help: "Number of active database connections",
		},
	)

	dbConnectionsIdle = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "db_connections_idle",
			Help: "Number of idle database connections",
		},
	)

	dbQueryDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "db_query_duration_seconds",
			Help:    "Database query duration in seconds",
			Buckets: []float64{0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0, 2.0},
		},
		[]string{"operation", "table"},
	)

	// Cache metrics
	cacheHits = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "cache_hits_total",
			Help: "Total number of cache hits",
		},
		[]string{"cache_type", "key_prefix"},
	)

	cacheMisses = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "cache_misses_total",
			Help: "Total number of cache misses",
		},
		[]string{"cache_type", "key_prefix"},
	)

	cacheOperations = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "cache_operations_total",
			Help: "Total number of cache operations",
		},
		[]string{"cache_type", "operation"},
	)

	// Business metrics
	transactionsProcessed = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "transactions_processed_total",
			Help: "Total number of transactions processed",
		},
		[]string{"status", "risk_level"},
	)

	apiKeyUsage = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "api_key_usage_total",
			Help: "Total API key usage count",
		},
		[]string{"key_id", "plan_type"},
	)

	quantumCircuitExecutions = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "quantum_circuit_executions_total",
			Help: "Total number of quantum circuit executions",
		},
		[]string{"backend", "circuit_type", "success"},
	)

	// System metrics
	memoryUsage = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "memory_usage_bytes",
			Help: "Memory usage in bytes",
		},
		[]string{"type"},
	)

	cpuUsage = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "cpu_usage_percent",
			Help: "CPU usage percentage",
		},
	)

	goroutines = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "goroutines_count",
			Help: "Number of goroutines",
		},
	)
)

// NewPrometheusMetrics creates a new Prometheus metrics instance
func NewPrometheusMetrics(config PrometheusConfig) *PrometheusMetrics {
	// Set default values
	if config.Namespace == "" {
		config.Namespace = "quantumbeam"
	}
	if config.Subsystem == "" {
		config.Subsystem = "api"
	}
	if config.Path == "" {
		config.Path = "/metrics"
	}
	if config.Port == 0 {
		config.Port = 9090
	}

	registry := prometheus.NewRegistry()
	metrics := &PrometheusMetrics{
		registry:      registry,
		config:        config,
		customMetrics: make(map[string]prometheus.Collector),
	}

	// Register default metrics
	metrics.registerDefaultMetrics()

	// Initialize Prometheus client if remote URL is provided
	if config.RemoteReadURL != "" {
		metrics.initializePrometheusClient()
	}

	return metrics
}

// registerDefaultMetrics registers all default metrics
func (pm *PrometheusMetrics) registerDefaultMetrics() {
	pm.registry.MustRegister(httpRequestsTotal)
	pm.registry.MustRegister(httpRequestDuration)
	pm.registry.MustRegister(httpRequestSize)
	pm.registry.MustRegister(httpResponseSize)

	pm.registry.MustRegister(fraudDetectionsTotal)
	pm.registry.MustRegister(fraudDetectionDuration)
	pm.registry.MustRegister(modelAccuracy)

	pm.registry.MustRegister(dbConnectionsActive)
	pm.registry.MustRegister(dbConnectionsIdle)
	pm.registry.MustRegister(dbQueryDuration)

	pm.registry.MustRegister(cacheHits)
	pm.registry.MustRegister(cacheMisses)
	pm.registry.MustRegister(cacheOperations)

	pm.registry.MustRegister(transactionsProcessed)
	pm.registry.MustRegister(apiKeyUsage)
	pm.registry.MustRegister(quantumCircuitExecutions)

	pm.registry.MustRegister(memoryUsage)
	pm.registry.MustRegister(cpuUsage)
	pm.registry.MustRegister(goroutines)

	// Register Go runtime metrics
	pm.registry.MustRegister(prometheus.NewGoCollector())
	pm.registry.MustRegister(prometheus.NewProcessCollector(prometheus.ProcessCollectorOpts{}))
}

// initializePrometheusClient initializes the Prometheus client for remote queries
func (pm *PrometheusMetrics) initializePrometheusClient() {
	client, err := api.NewClient(api.Config{
		Address: pm.config.RemoteReadURL,
	})
	if err != nil {
		// Log error but don't fail
		return
	}

	pm.httpAPI = v1.NewAPI(client)
}

// StartMetricsServer starts the Prometheus metrics server
func (pm *PrometheusMetrics) StartMetricsServer() error {
	if !pm.config.Enabled {
		return nil
	}

	mux := http.NewServeMux()
	mux.Handle(pm.config.Path, promhttp.HandlerFor(pm.registry, promhttp.HandlerOpts{
		EnableOpenMetrics: true,
	}))

	addr := pm.config.Address + ":" + strconv.Itoa(pm.config.Port)
	server := &http.Server{
		Addr:    addr,
		Handler: mux,
	}

	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			// Log error
		}
	}()

	return nil
}

// GinMiddleware returns a Gin middleware for collecting HTTP metrics
func (pm *PrometheusMetrics) GinMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		method := c.Request.Method

		// Process request
		c.Next()

		// Record metrics
		duration := time.Since(start).Seconds()
		status := strconv.Itoa(c.Writer.Status())
		service := pm.config.Subsystem

		httpRequestsTotal.WithLabelValues(method, path, status, service).Inc()
		httpRequestDuration.WithLabelValues(method, path, service).Observe(duration)

		// Record request/response sizes if available
		if c.Request.ContentLength > 0 {
			httpRequestSize.WithLabelValues(method, path, service).Observe(float64(c.Request.ContentLength))
		}
		if c.Writer.Size() > 0 {
			httpResponseSize.WithLabelValues(method, path, service).Observe(float64(c.Writer.Size()))
		}
	}
}

// RecordFraudDetection records a fraud detection event
func (pm *PrometheusMetrics) RecordFraudDetection(modelType, confidenceLevel, result string, duration time.Duration, quantumEnabled bool) {
	fraudDetectionsTotal.WithLabelValues(modelType, confidenceLevel, result).Inc()
	fraudDetectionDuration.WithLabelValues(modelType, strconv.FormatBool(quantumEnabled)).Observe(duration.Seconds())
}

// UpdateModelAccuracy updates the model accuracy metric
func (pm *PrometheusMetrics) UpdateModelAccuracy(modelType, version string, accuracy float64) {
	modelAccuracy.WithLabelValues(modelType, version).Set(accuracy)
}

// UpdateDatabaseMetrics updates database connection metrics
func (pm *PrometheusMetrics) UpdateDatabaseMetrics(active, idle int) {
	dbConnectionsActive.Set(float64(active))
	dbConnectionsIdle.Set(float64(idle))
}

// RecordDatabaseQuery records a database query metric
func (pm *PrometheusMetrics) RecordDatabaseQuery(operation, table string, duration time.Duration) {
	dbQueryDuration.WithLabelValues(operation, table).Observe(duration.Seconds())
}

// RecordCacheHit records a cache hit
func (pm *PrometheusMetrics) RecordCacheHit(cacheType, keyPrefix string) {
	cacheHits.WithLabelValues(cacheType, keyPrefix).Inc()
}

// RecordCacheMiss records a cache miss
func (pm *PrometheusMetrics) RecordCacheMiss(cacheType, keyPrefix string) {
	cacheMisses.WithLabelValues(cacheType, keyPrefix).Inc()
}

// RecordCacheOperation records a cache operation
func (pm *PrometheusMetrics) RecordCacheOperation(cacheType, operation string) {
	cacheOperations.WithLabelValues(cacheType, operation).Inc()
}

// RecordTransaction records a processed transaction
func (pm *PrometheusMetrics) RecordTransaction(status, riskLevel string) {
	transactionsProcessed.WithLabelValues(status, riskLevel).Inc()
}

// RecordAPIKeyUsage records API key usage
func (pm *PrometheusMetrics) RecordAPIKeyUsage(keyID, planType string) {
	apiKeyUsage.WithLabelValues(keyID, planType).Inc()
}

// RecordQuantumCircuitExecution records a quantum circuit execution
func (pm *PrometheusMetrics) RecordQuantumCircuitExecution(backend, circuitType string, success bool) {
	quantumCircuitExecutions.WithLabelValues(backend, circuitType, strconv.FormatBool(success)).Inc()
}

// UpdateSystemMetrics updates system resource metrics
func (pm *PrometheusMetrics) UpdateSystemMetrics(memUsed, memTotal float64, cpuPercent float64, goroutineCount int) {
	memoryUsage.WithLabelValues("used").Set(memUsed)
	memoryUsage.WithLabelValues("total").Set(memTotal)
	cpuUsage.Set(cpuPercent)
	goroutines.Set(float64(goroutineCount))
}

// RegisterCustomMetric registers a custom metric
func (pm *PrometheusMetrics) RegisterCustomMetric(name string, metric prometheus.Collector) error {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	if err := pm.registry.Register(metric); err != nil {
		return err
	}

	pm.customMetrics[name] = metric
	return nil
}

// UnregisterMetric unregisters a metric
func (pm *PrometheusMetrics) UnregisterMetric(name string) {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	if metric, exists := pm.customMetrics[name]; exists {
		pm.registry.Unregister(metric)
		delete(pm.customMetrics, name)
	}
}

// QueryMetrics queries metrics from Prometheus (if remote client is configured)
func (pm *PrometheusMetrics) QueryMetrics(ctx context.Context, query string, time time.Time) (interface{}, error) {
	if pm.httpAPI == nil {
		return nil, fmt.Errorf("Prometheus client not initialized")
	}

	result, warnings, err := pm.httpAPI.Query(ctx, query, time)
	if err != nil {
		return nil, err
	}

	if len(warnings) > 0 {
		// Log warnings
	}

	return result, nil
}

// GetMetricFamilies returns all registered metric families
func (pm *PrometheusMetrics) GetMetricFamilies() ([]*dto.MetricFamily, error) {
	return pm.registry.Gather()
}

// Reset resets all metrics
func (pm *PrometheusMetrics) Reset() {
	httpRequestsTotal.Reset()
	httpRequestDuration.Reset()
	httpRequestSize.Reset()
	httpResponseSize.Reset()

	fraudDetectionsTotal.Reset()
	fraudDetectionDuration.Reset()
	modelAccuracy.Reset()

	dbConnectionsActive.Set(0)
	dbConnectionsIdle.Set(0)
	dbQueryDuration.Reset()

	cacheHits.Reset()
	cacheMisses.Reset()
	cacheOperations.Reset()

	transactionsProcessed.Reset()
	apiKeyUsage.Reset()
	quantumCircuitExecutions.Reset()

	memoryUsage.Reset()
	cpuUsage.Set(0)
	goroutines.Set(0)

	// Reset custom metrics
	pm.mu.Lock()
	for _, metric := range pm.customMetrics {
		if _, ok := metric.(prometheus.Counter); ok {
			// Counters cannot be reset
		}
		if gaugeVec, ok := metric.(*prometheus.GaugeVec); ok {
			gaugeVec.Reset()
		}
		if histogramVec, ok := metric.(*prometheus.HistogramVec); ok {
			histogramVec.Reset()
		}
	}
	pm.mu.Unlock()
}

// GetConfig returns the current configuration
func (pm *PrometheusMetrics) GetConfig() PrometheusConfig {
	return pm.config
}

// HealthCheck performs a health check on the metrics system
func (pm *PrometheusMetrics) HealthCheck() error {
	if !pm.config.Enabled {
		return nil
	}

	// Try to gather metrics
	_, err := pm.registry.Gather()
	if err != nil {
		return fmt.Errorf("failed to gather metrics: %w", err)
	}

	return nil
}

// PushMetrics pushes metrics to Prometheus Pushgateway (if configured)
func (pm *PrometheusMetrics) PushMetrics(jobName string) error {
	if pm.config.PushGateway == "" {
		return nil
	}

	push := push.New(pm.config.PushGateway, jobName).
		Gatherer(pm.registry)

	return push.Add()
}
