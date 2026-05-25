package observability

import (
	"fmt"
	"net/http"
	"runtime"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/sirupsen/logrus"
)

// MetricsCollector holds all Prometheus metrics
type MetricsCollector struct {
	registry *prometheus.Registry

	// HTTP metrics
	httpRequestsTotal     *prometheus.CounterVec
	httpRequestDuration   *prometheus.HistogramVec
	httpRequestSize       *prometheus.HistogramVec
	httpResponseSize      *prometheus.HistogramVec
	httpActiveConnections prometheus.Gauge

	// Application metrics
	operationsTotal   *prometheus.CounterVec
	operationDuration *prometheus.HistogramVec
	activeOperations  prometheus.Gauge
	operationErrors   *prometheus.CounterVec

	// Business metrics
	userRequestsTotal      *prometheus.CounterVec
	tenantRequestsTotal    *prometheus.CounterVec
	apiUsageByEndpoint     *prometheus.CounterVec
	documentProcessingTime *prometheus.HistogramVec
	vectorSearchLatency    *prometheus.HistogramVec
	llmResponseTime        *prometheus.HistogramVec

	// Database metrics
	dbConnectionsActive prometheus.Gauge
	dbConnectionsIdle   prometheus.Gauge
	dbQueryDuration     *prometheus.HistogramVec
	dbQueryTotal        *prometheus.CounterVec
	dbConnectionErrors  prometheus.Counter

	// Cache metrics
	cacheHits      *prometheus.CounterVec
	cacheMisses    *prometheus.CounterVec
	cacheEvictions *prometheus.CounterVec
	cacheSize      prometheus.Gauge

	// Security metrics
	authAttemptsTotal  *prometheus.CounterVec
	authSuccessesTotal *prometheus.CounterVec
	authFailuresTotal  *prometheus.CounterVec
	rateLimitHits      *prometheus.CounterVec
	blockedRequests    *prometheus.CounterVec
	dlpViolations      *prometheus.CounterVec

	// System metrics
	goRoutines      prometheus.Gauge
	memoryAllocated prometheus.Gauge
	memoryTotal     prometheus.Gauge
	gcCollections   *prometheus.CounterVec
	gcPauseDuration *prometheus.HistogramVec

	// Custom metrics
	customMetrics      map[string]prometheus.Metric
	customMetricsMutex sync.RWMutex

	config MetricsConfig
	logger *logrus.Logger
}

// MetricsConfig holds configuration for metrics collection
type MetricsConfig struct {
	Enabled               bool          `yaml:"enabled"`
	Port                  int           `yaml:"port"`
	Path                  string        `yaml:"path"`
	Namespace             string        `yaml:"namespace"`
	Subsystem             string        `yaml:"subsystem"`
	Buckets               []float64     `yaml:"buckets"`
	Percentiles           []float64     `yaml:"percentiles"`
	CollectInterval       time.Duration `yaml:"collect_interval"`
	EnableRuntimeMetrics  bool          `yaml:"enable_runtime_metrics"`
	EnableAPIMetrics      bool          `yaml:"enable_api_metrics"`
	EnableBusinessMetrics bool          `yaml:"enable_business_metrics"`
	EnableDatabaseMetrics bool          `yaml:"enable_database_metrics"`
	EnableCacheMetrics    bool          `yaml:"enable_cache_metrics"`
	EnableSecurityMetrics bool          `yaml:"enable_security_metrics"`
	EnableCustomMetrics   bool          `yaml:"enable_custom_metrics"`
	PushgatewayURL        string        `yaml:"pushgateway_url"`
	PushgatewayInterval   time.Duration `yaml:"pushgateway_interval"`
}

// NewMetricsCollector creates a new metrics collector
func NewMetricsCollector(config MetricsConfig, logger *logrus.Logger) *MetricsCollector {
	if config.Namespace == "" {
		config.Namespace = "sdlc_platform"
	}
	if config.Subsystem == "" {
		config.Subsystem = "gateway"
	}
	if len(config.Buckets) == 0 {
		config.Buckets = []float64{0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10}
	}

	registry := prometheus.NewRegistry()

	mc := &MetricsCollector{
		registry:      registry,
		config:        config,
		logger:        logger,
		customMetrics: make(map[string]prometheus.Metric),
	}

	// Register default metrics
	registry.MustRegister(prometheus.NewGoCollector())
	registry.MustRegister(prometheus.NewProcessCollector(prometheus.ProcessCollectorOpts{}))

	mc.initializeHTTPMetrics()
	mc.initializeApplicationMetrics()
	mc.initializeBusinessMetrics()
	mc.initializeDatabaseMetrics()
	mc.initializeCacheMetrics()
	mc.initializeSecurityMetrics()
	mc.initializeSystemMetrics()

	return mc
}

// initializeHTTPMetrics sets up HTTP-related metrics
func (mc *MetricsCollector) initializeHTTPMetrics() {
	mc.httpRequestsTotal = promauto.With(mc.registry).NewCounterVec(
		prometheus.CounterOpts{
			Namespace: mc.config.Namespace,
			Subsystem: mc.config.Subsystem,
			Name:      "http_requests_total",
			Help:      "Total number of HTTP requests",
		},
		[]string{"method", "endpoint", "status_code", "version", "tenant_id"},
	)

	mc.httpRequestDuration = promauto.With(mc.registry).NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: mc.config.Namespace,
			Subsystem: mc.config.Subsystem,
			Name:      "http_request_duration_seconds",
			Help:      "HTTP request duration in seconds",
			Buckets:   mc.config.Buckets,
		},
		[]string{"method", "endpoint", "status_code", "version"},
	)

	mc.httpRequestSize = promauto.With(mc.registry).NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: mc.config.Namespace,
			Subsystem: mc.config.Subsystem,
			Name:      "http_request_size_bytes",
			Help:      "HTTP request size in bytes",
			Buckets:   prometheus.ExponentialBuckets(100, 2, 10),
		},
		[]string{"method", "endpoint"},
	)

	mc.httpResponseSize = promauto.With(mc.registry).NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: mc.config.Namespace,
			Subsystem: mc.config.Subsystem,
			Name:      "http_response_size_bytes",
			Help:      "HTTP response size in bytes",
			Buckets:   prometheus.ExponentialBuckets(100, 2, 10),
		},
		[]string{"method", "endpoint"},
	)

	mc.httpActiveConnections = promauto.With(mc.registry).NewGauge(
		prometheus.GaugeOpts{
			Namespace: mc.config.Namespace,
			Subsystem: mc.config.Subsystem,
			Name:      "http_active_connections",
			Help:      "Number of active HTTP connections",
		},
	)
}

// initializeApplicationMetrics sets up application-level metrics
func (mc *MetricsCollector) initializeApplicationMetrics() {
	mc.operationsTotal = promauto.With(mc.registry).NewCounterVec(
		prometheus.CounterOpts{
			Namespace: mc.config.Namespace,
			Subsystem: mc.config.Subsystem,
			Name:      "operations_total",
			Help:      "Total number of operations",
		},
		[]string{"operation", "status", "component"},
	)

	mc.operationDuration = promauto.With(mc.registry).NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: mc.config.Namespace,
			Subsystem: mc.config.Subsystem,
			Name:      "operation_duration_seconds",
			Help:      "Operation duration in seconds",
			Buckets:   mc.config.Buckets,
		},
		[]string{"operation", "component"},
	)

	mc.activeOperations = promauto.With(mc.registry).NewGauge(
		prometheus.GaugeOpts{
			Namespace: mc.config.Namespace,
			Subsystem: mc.config.Subsystem,
			Name:      "active_operations",
			Help:      "Number of currently active operations",
		},
	)

	mc.operationErrors = promauto.With(mc.registry).NewCounterVec(
		prometheus.CounterOpts{
			Namespace: mc.config.Namespace,
			Subsystem: mc.config.Subsystem,
			Name:      "operation_errors_total",
			Help:      "Total number of operation errors",
		},
		[]string{"operation", "error_type", "component"},
	)
}

// initializeBusinessMetrics sets up business-level metrics
func (mc *MetricsCollector) initializeBusinessMetrics() {
	mc.userRequestsTotal = promauto.With(mc.registry).NewCounterVec(
		prometheus.CounterOpts{
			Namespace: mc.config.Namespace,
			Subsystem: mc.config.Subsystem,
			Name:      "user_requests_total",
			Help:      "Total number of requests per user",
		},
		[]string{"user_id", "endpoint", "method"},
	)

	mc.tenantRequestsTotal = promauto.With(mc.registry).NewCounterVec(
		prometheus.CounterOpts{
			Namespace: mc.config.Namespace,
			Subsystem: mc.config.Subsystem,
			Name:      "tenant_requests_total",
			Help:      "Total number of requests per tenant",
		},
		[]string{"tenant_id", "endpoint", "method"},
	)

	mc.apiUsageByEndpoint = promauto.With(mc.registry).NewCounterVec(
		prometheus.CounterOpts{
			Namespace: mc.config.Namespace,
			Subsystem: mc.config.Subsystem,
			Name:      "api_usage_by_endpoint",
			Help:      "API usage count by endpoint",
		},
		[]string{"endpoint", "method", "version", "tenant_id"},
	)

	mc.documentProcessingTime = promauto.With(mc.registry).NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: mc.config.Namespace,
			Subsystem: mc.config.Subsystem,
			Name:      "document_processing_duration_seconds",
			Help:      "Document processing duration in seconds",
			Buckets:   []float64{0.1, 0.5, 1, 2.5, 5, 10, 30, 60, 120, 300},
		},
		[]string{"document_type", "processing_stage", "tenant_id"},
	)

	mc.vectorSearchLatency = promauto.With(mc.registry).NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: mc.config.Namespace,
			Subsystem: mc.config.Subsystem,
			Name:      "vector_search_latency_seconds",
			Help:      "Vector search latency in seconds",
			Buckets:   []float64{0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5},
		},
		[]string{"search_type", "vector_count", "tenant_id"},
	)

	mc.llmResponseTime = promauto.With(mc.registry).NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: mc.config.Namespace,
			Subsystem: mc.config.Subsystem,
			Name:      "llm_response_time_seconds",
			Help:      "LLM response time in seconds",
			Buckets:   []float64{0.5, 1, 2.5, 5, 10, 20, 30, 60},
		},
		[]string{"provider", "model", "prompt_tokens", "tenant_id"},
	)
}

// initializeDatabaseMetrics sets up database-related metrics
func (mc *MetricsCollector) initializeDatabaseMetrics() {
	mc.dbConnectionsActive = promauto.With(mc.registry).NewGauge(
		prometheus.GaugeOpts{
			Namespace: mc.config.Namespace,
			Subsystem: mc.config.Subsystem,
			Name:      "db_connections_active",
			Help:      "Number of active database connections",
		},
	)

	mc.dbConnectionsIdle = promauto.With(mc.registry).NewGauge(
		prometheus.GaugeOpts{
			Namespace: mc.config.Namespace,
			Subsystem: mc.config.Subsystem,
			Name:      "db_connections_idle",
			Help:      "Number of idle database connections",
		},
	)

	mc.dbQueryDuration = promauto.With(mc.registry).NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: mc.config.Namespace,
			Subsystem: mc.config.Subsystem,
			Name:      "db_query_duration_seconds",
			Help:      "Database query duration in seconds",
			Buckets:   []float64{0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5},
		},
		[]string{"query_type", "table", "operation"},
	)

	mc.dbQueryTotal = promauto.With(mc.registry).NewCounterVec(
		prometheus.CounterOpts{
			Namespace: mc.config.Namespace,
			Subsystem: mc.config.Subsystem,
			Name:      "db_queries_total",
			Help:      "Total number of database queries",
		},
		[]string{"query_type", "table", "operation", "status"},
	)

	mc.dbConnectionErrors = promauto.With(mc.registry).NewCounter(
		prometheus.CounterOpts{
			Namespace: mc.config.Namespace,
			Subsystem: mc.config.Subsystem,
			Name:      "db_connection_errors_total",
			Help:      "Total number of database connection errors",
		},
	)
}

// initializeCacheMetrics sets up cache-related metrics
func (mc *MetricsCollector) initializeCacheMetrics() {
	mc.cacheHits = promauto.With(mc.registry).NewCounterVec(
		prometheus.CounterOpts{
			Namespace: mc.config.Namespace,
			Subsystem: mc.config.Subsystem,
			Name:      "cache_hits_total",
			Help:      "Total number of cache hits",
		},
		[]string{"cache_type", "key_prefix"},
	)

	mc.cacheMisses = promauto.With(mc.registry).NewCounterVec(
		prometheus.CounterOpts{
			Namespace: mc.config.Namespace,
			Subsystem: mc.config.Subsystem,
			Name:      "cache_misses_total",
			Help:      "Total number of cache misses",
		},
		[]string{"cache_type", "key_prefix"},
	)

	mc.cacheEvictions = promauto.With(mc.registry).NewCounterVec(
		prometheus.CounterOpts{
			Namespace: mc.config.Namespace,
			Subsystem: mc.config.Subsystem,
			Name:      "cache_evictions_total",
			Help:      "Total number of cache evictions",
		},
		[]string{"cache_type", "reason"},
	)

	mc.cacheSize = promauto.With(mc.registry).NewGauge(
		prometheus.GaugeOpts{
			Namespace: mc.config.Namespace,
			Subsystem: mc.config.Subsystem,
			Name:      "cache_size_bytes",
			Help:      "Current cache size in bytes",
		},
	)
}

// initializeSecurityMetrics sets up security-related metrics
func (mc *MetricsCollector) initializeSecurityMetrics() {
	mc.authAttemptsTotal = promauto.With(mc.registry).NewCounterVec(
		prometheus.CounterOpts{
			Namespace: mc.config.Namespace,
			Subsystem: mc.config.Subsystem,
			Name:      "auth_attempts_total",
			Help:      "Total number of authentication attempts",
		},
		[]string{"method", "user_type", "tenant_id"},
	)

	mc.authSuccessesTotal = promauto.With(mc.registry).NewCounterVec(
		prometheus.CounterOpts{
			Namespace: mc.config.Namespace,
			Subsystem: mc.config.Subsystem,
			Name:      "auth_successes_total",
			Help:      "Total number of successful authentications",
		},
		[]string{"method", "user_type", "tenant_id"},
	)

	mc.authFailuresTotal = promauto.With(mc.registry).NewCounterVec(
		prometheus.CounterOpts{
			Namespace: mc.config.Namespace,
			Subsystem: mc.config.Subsystem,
			Name:      "auth_failures_total",
			Help:      "Total number of failed authentications",
		},
		[]string{"method", "reason", "user_type", "tenant_id"},
	)

	mc.rateLimitHits = promauto.With(mc.registry).NewCounterVec(
		prometheus.CounterOpts{
			Namespace: mc.config.Namespace,
			Subsystem: mc.config.Subsystem,
			Name:      "rate_limit_hits_total",
			Help:      "Total number of rate limit hits",
		},
		[]string{"endpoint", "limit_type", "tenant_id", "user_id"},
	)

	mc.blockedRequests = promauto.With(mc.registry).NewCounterVec(
		prometheus.CounterOpts{
			Namespace: mc.config.Namespace,
			Subsystem: mc.config.Subsystem,
			Name:      "blocked_requests_total",
			Help:      "Total number of blocked requests",
		},
		[]string{"reason", "ip", "user_id", "tenant_id"},
	)

	mc.dlpViolations = promauto.With(mc.registry).NewCounterVec(
		prometheus.CounterOpts{
			Namespace: mc.config.Namespace,
			Subsystem: mc.config.Subsystem,
			Name:      "dlp_violations_total",
			Help:      "Total number of DLP violations detected",
		},
		[]string{"violation_type", "severity", "tenant_id"},
	)
}

// initializeSystemMetrics sets up system-level metrics
func (mc *MetricsCollector) initializeSystemMetrics() {
	mc.goRoutines = promauto.With(mc.registry).NewGauge(
		prometheus.GaugeOpts{
			Namespace: mc.config.Namespace,
			Subsystem: mc.config.Subsystem,
			Name:      "go_goroutines",
			Help:      "Number of goroutines",
		},
	)

	mc.memoryAllocated = promauto.With(mc.registry).NewGauge(
		prometheus.GaugeOpts{
			Namespace: mc.config.Namespace,
			Subsystem: mc.config.Subsystem,
			Name:      "memory_allocated_bytes",
			Help:      "Memory allocated in bytes",
		},
	)

	mc.memoryTotal = promauto.With(mc.registry).NewGauge(
		prometheus.GaugeOpts{
			Namespace: mc.config.Namespace,
			Subsystem: mc.config.Subsystem,
			Name:      "memory_total_bytes",
			Help:      "Total memory in bytes",
		},
	)

	mc.gcCollections = promauto.With(mc.registry).NewCounterVec(
		prometheus.CounterOpts{
			Namespace: mc.config.Namespace,
			Subsystem: mc.config.Subsystem,
			Name:      "gc_collections_total",
			Help:      "Total number of garbage collections",
		},
		[]string{"gc_type"},
	)

	mc.gcPauseDuration = promauto.With(mc.registry).NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: mc.config.Namespace,
			Subsystem: mc.config.Subsystem,
			Name:      "gc_pause_duration_seconds",
			Help:      "GC pause duration in seconds",
			Buckets:   []float64{0.000001, 0.00001, 0.0001, 0.001, 0.01, 0.1},
		},
		[]string{"gc_type"},
	)
}

// StartMetricsServer starts the Prometheus metrics server
func (mc *MetricsCollector) StartMetricsServer() error {
	if !mc.config.Enabled {
		mc.logger.Info("Metrics collection is disabled")
		return nil
	}

	mux := http.NewServeMux()
	mux.Handle(mc.config.Path, promhttp.HandlerFor(mc.registry, promhttp.HandlerOpts{
		EnableOpenMetrics: true,
	}))

	server := &http.Server{
		Addr:              fmt.Sprintf(":%d", mc.config.Port),
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second, // mitigate Slowloris
	}

	mc.logger.WithFields(logrus.Fields{
		"port": mc.config.Port,
		"path": mc.config.Path,
	}).Info("Starting metrics server")

	return server.ListenAndServe()
}

// InstrumentHTTPMiddleware creates middleware for HTTP metrics
func (mc *MetricsCollector) InstrumentHTTPMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		// Wrap response writer to capture status code and size
		wrapped := &responseWriter{
			ResponseWriter: w,
			statusCode:     http.StatusOK,
		}

		// Increment active connections
		mc.httpActiveConnections.Inc()
		defer mc.httpActiveConnections.Dec()

		// Process request
		next.ServeHTTP(wrapped, r)

		// Record metrics
		duration := time.Since(start).Seconds()

		mc.httpRequestsTotal.WithLabelValues(
			r.Method,
			r.URL.Path,
			fmt.Sprintf("%d", wrapped.statusCode),
			getAPIVersion(r),
			getTenantID(r),
		).Inc()

		mc.httpRequestDuration.WithLabelValues(
			r.Method,
			r.URL.Path,
			fmt.Sprintf("%d", wrapped.statusCode),
			getAPIVersion(r),
		).Observe(duration)

		// Record request/response sizes if available
		if r.ContentLength > 0 {
			mc.httpRequestSize.WithLabelValues(r.Method, r.URL.Path).Observe(float64(r.ContentLength))
		}

		if wrapped.responseSize > 0 {
			mc.httpResponseSize.WithLabelValues(r.Method, r.URL.Path).Observe(float64(wrapped.responseSize))
		}
	})
}

// Custom metric methods

func (mc *MetricsCollector) RegisterCustomMetric(name string, metric prometheus.Metric) error {
	mc.customMetricsMutex.Lock()
	defer mc.customMetricsMutex.Unlock()

	if _, exists := mc.customMetrics[name]; exists {
		return fmt.Errorf("metric %s already registered", name)
	}

	mc.customMetrics[name] = metric

	if collector, ok := metric.(prometheus.Collector); ok {
		return mc.registry.Register(collector)
	}

	return nil
}

func (mc *MetricsCollector) UnregisterCustomMetric(name string) error {
	mc.customMetricsMutex.Lock()
	defer mc.customMetricsMutex.Unlock()

	metric, exists := mc.customMetrics[name]
	if !exists {
		return fmt.Errorf("metric %s not found", name)
	}

	delete(mc.customMetrics, name)

	if collector, ok := metric.(prometheus.Collector); ok {
		mc.registry.Unregister(collector)
	}

	return nil
}

// Helper methods for updating metrics

func (mc *MetricsCollector) RecordOperation(operation, status, component string, duration time.Duration) {
	mc.operationsTotal.WithLabelValues(operation, status, component).Inc()
	mc.operationDuration.WithLabelValues(operation, component).Observe(duration.Seconds())

	if status == "error" {
		mc.operationErrors.WithLabelValues(operation, "unknown", component).Inc()
	}
}

func (mc *MetricsCollector) IncrementActiveOperations() {
	mc.activeOperations.Inc()
}

func (mc *MetricsCollector) DecrementActiveOperations() {
	mc.activeOperations.Dec()
}

func (mc *MetricsCollector) RecordCacheHit(cacheType, keyPrefix string) {
	mc.cacheHits.WithLabelValues(cacheType, keyPrefix).Inc()
}

func (mc *MetricsCollector) RecordCacheMiss(cacheType, keyPrefix string) {
	mc.cacheMisses.WithLabelValues(cacheType, keyPrefix).Inc()
}

func (mc *MetricsCollector) UpdateCacheSize(size float64) {
	mc.cacheSize.Set(size)
}

func (mc *MetricsCollector) RecordAuthAttempt(method, userType, tenantID string) {
	mc.authAttemptsTotal.WithLabelValues(method, userType, tenantID).Inc()
}

func (mc *MetricsCollector) RecordAuthSuccess(method, userType, tenantID string) {
	mc.authSuccessesTotal.WithLabelValues(method, userType, tenantID).Inc()
}

func (mc *MetricsCollector) RecordAuthFailure(method, reason, userType, tenantID string) {
	mc.authFailuresTotal.WithLabelValues(method, reason, userType, tenantID).Inc()
}

func (mc *MetricsCollector) UpdateSystemMetrics() {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	mc.goRoutines.Set(float64(runtime.NumGoroutine()))
	mc.memoryAllocated.Set(float64(m.Alloc))
	mc.memoryTotal.Set(float64(m.Sys))

	mc.gcCollections.WithLabelValues("heap").Add(float64(m.NumGC))

	// Calculate GC pause duration
	if len(m.PauseNs) > 0 {
		totalPause := uint64(0)
		for _, pause := range m.PauseNs[:m.NumGC] {
			totalPause += pause
		}
		avgPause := float64(totalPause) / float64(m.NumGC) / 1e9
		mc.gcPauseDuration.WithLabelValues("heap").Observe(avgPause)
	}
}

// responseWriter is a wrapper to capture response details
type responseWriter struct {
	http.ResponseWriter
	statusCode   int
	responseSize int64
}

func (rw *responseWriter) WriteHeader(statusCode int) {
	rw.statusCode = statusCode
	rw.ResponseWriter.WriteHeader(statusCode)
}

func (rw *responseWriter) Write(b []byte) (int, error) {
	n, err := rw.ResponseWriter.Write(b)
	rw.responseSize += int64(n)
	return n, err
}

// Helper functions

func getAPIVersion(r *http.Request) string {
	if version := r.Header.Get("API-Version"); version != "" {
		return version
	}
	if version := r.URL.Query().Get("version"); version != "" {
		return version
	}
	return "unknown"
}

func getTenantID(r *http.Request) string {
	if tenantID := r.Header.Get("X-Tenant-ID"); tenantID != "" {
		return tenantID
	}
	if tenantID := r.URL.Query().Get("tenant_id"); tenantID != "" {
		return tenantID
	}
	return "unknown"
}

// GetRegistry returns the Prometheus registry
func (mc *MetricsCollector) GetRegistry() *prometheus.Registry {
	return mc.registry
}

// GetMetricsHandler returns the Prometheus metrics HTTP handler
func (mc *MetricsCollector) GetMetricsHandler() http.Handler {
	return promhttp.HandlerFor(mc.registry, promhttp.HandlerOpts{
		EnableOpenMetrics: true,
	})
}
