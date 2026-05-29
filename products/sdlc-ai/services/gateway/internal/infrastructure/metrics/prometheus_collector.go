//go:build ignore

package metrics

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/sirupsen/logrus"
)

// PrometheusMetrics holds all Prometheus metrics
type PrometheusMetrics struct {
	// HTTP metrics
	HTTPRequestsTotal   *prometheus.CounterVec
	HTTPRequestDuration *prometheus.HistogramVec
	HTTPResponseSize    *prometheus.HistogramVec
	HTTPRequestSize     *prometheus.HistogramVec

	// Business metrics
	ActiveUsers        prometheus.Gauge
	ActiveTenants      prometheus.Gauge
	DocumentsProcessed prometheus.Counter
	QueriesPerformed   prometheus.Counter
	TokensGenerated    prometheus.Counter

	// System metrics
	DatabaseConnections *prometheus.GaugeVec
	CacheHitRatio       *prometheus.GaugeVec
	RateLimitHits       *prometheus.CounterVec
	ErrorRate           *prometheus.GaugeVec

	// Security metrics
	AuthenticationAttempts *prometheus.CounterVec
	AuthorizationFailures  *prometheus.CounterVec
	SecurityViolations     *prometheus.CounterVec

	// DLP metrics
	DLPScans      prometheus.Counter
	DLPViolations prometheus.Counter
	PIIDetections prometheus.Counter

	// Custom metrics
	CustomMetrics map[string]prometheus.Metric
}

// MetricsConfig holds configuration for metrics collection
type MetricsConfig struct {
	Enabled   bool                 `yaml:"enabled"`
	Port      int                  `yaml:"port"`
	Path      string               `yaml:"path"`
	Namespace string               `yaml:"namespace"`
	Subsystem string               `yaml:"subsystem"`
	Registry  *prometheus.Registry `yaml:"-"`
	buckets   []float64            `yaml:"buckets"`
	Labels    []string             `yaml:"labels"`
}

// MetricsCollector handles Prometheus metrics collection
type MetricsCollector struct {
	config  *MetricsConfig
	metrics *PrometheusMetrics
	logger  *logrus.Logger
	server  *http.Server
}

// NewMetricsCollector creates a new metrics collector
func NewMetricsCollector(config *MetricsConfig, logger *logrus.Logger) *MetricsCollector {
	if config == nil {
		config = &MetricsConfig{
			Enabled:   true,
			Port:      9090,
			Path:      "/metrics",
			Namespace: "sdlc",
			Subsystem: "gateway",
			buckets:   prometheus.DefBuckets,
		}
	}

	if logger == nil {
		logger = logrus.New()
	}

	// Use default registry if not provided
	if config.Registry == nil {
		config.Registry = prometheus.DefaultRegisterer
	}

	collector := &MetricsCollector{
		config: config,
		logger: logger,
	}

	collector.initMetrics()

	if config.Enabled {
		collector.startServer()
	}

	return collector
}

// initMetrics initializes all Prometheus metrics
func (m *MetricsCollector) initMetrics() {
	m.metrics = &PrometheusMetrics{
		// HTTP metrics
		HTTPRequestsTotal: promauto.With(m.config.Registry).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: m.config.Namespace,
				Subsystem: m.config.Subsystem,
				Name:      "http_requests_total",
				Help:      "Total number of HTTP requests",
			},
			[]string{"method", "endpoint", "status_code", "tenant_id"},
		),
		HTTPRequestDuration: promauto.With(m.config.Registry).NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: m.config.Namespace,
				Subsystem: m.config.Subsystem,
				Name:      "http_request_duration_seconds",
				Help:      "HTTP request duration in seconds",
				Buckets:   m.config.buckets,
			},
			[]string{"method", "endpoint", "tenant_id"},
		),
		HTTPResponseSize: promauto.With(m.config.Registry).NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: m.config.Namespace,
				Subsystem: m.config.Subsystem,
				Name:      "http_response_size_bytes",
				Help:      "HTTP response size in bytes",
				Buckets:   []float64{100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000},
			},
			[]string{"method", "endpoint"},
		),
		HTTPRequestSize: promauto.With(m.config.Registry).NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: m.config.Namespace,
				Subsystem: m.config.Subsystem,
				Name:      "http_request_size_bytes",
				Help:      "HTTP request size in bytes",
				Buckets:   []float64{100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000},
			},
			[]string{"method", "endpoint"},
		),

		// Business metrics
		ActiveUsers: promauto.With(m.config.Registry).NewGauge(
			prometheus.GaugeOpts{
				Namespace: m.config.Namespace,
				Subsystem: m.config.Subsystem,
				Name:      "active_users_total",
				Help:      "Number of currently active users",
			},
		),
		ActiveTenants: promauto.With(m.config.Registry).NewGauge(
			prometheus.GaugeOpts{
				Namespace: m.config.Namespace,
				Subsystem: m.config.Subsystem,
				Name:      "active_tenants_total",
				Help:      "Number of currently active tenants",
			},
		),
		DocumentsProcessed: promauto.With(m.config.Registry).NewCounter(
			prometheus.CounterOpts{
				Namespace: m.config.Namespace,
				Subsystem: m.config.Subsystem,
				Name:      "documents_processed_total",
				Help:      "Total number of documents processed",
			},
		),
		QueriesPerformed: promauto.With(m.config.Registry).NewCounter(
			prometheus.CounterOpts{
				Namespace: m.config.Namespace,
				Subsystem: m.config.Subsystem,
				Name:      "queries_performed_total",
				Help:      "Total number of queries performed",
			},
		),
		TokensGenerated: promauto.With(m.config.Registry).NewCounter(
			prometheus.CounterOpts{
				Namespace: m.config.Namespace,
				Subsystem: m.config.Subsystem,
				Name:      "tokens_generated_total",
				Help:      "Total number of tokens generated",
			},
		),

		// System metrics
		DatabaseConnections: promauto.With(m.config.Registry).NewGaugeVec(
			prometheus.GaugeOpts{
				Namespace: m.config.Namespace,
				Subsystem: m.config.Subsystem,
				Name:      "database_connections_active",
				Help:      "Number of active database connections",
			},
			[]string{"database", "tenant_id"},
		),
		CacheHitRatio: promauto.With(m.config.Registry).NewGaugeVec(
			prometheus.GaugeOpts{
				Namespace: m.config.Namespace,
				Subsystem: m.config.Subsystem,
				Name:      "cache_hit_ratio",
				Help:      "Cache hit ratio",
			},
			[]string{"cache_type", "tenant_id"},
		),
		RateLimitHits: promauto.With(m.config.Registry).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: m.config.Namespace,
				Subsystem: m.config.Subsystem,
				Name:      "rate_limit_hits_total",
				Help:      "Total number of rate limit hits",
			},
			[]string{"endpoint", "tenant_id", "user_id"},
		),
		ErrorRate: promauto.With(m.config.Registry).NewGaugeVec(
			prometheus.GaugeOpts{
				Namespace: m.config.Namespace,
				Subsystem: m.config.Subsystem,
				Name:      "error_rate",
				Help:      "Error rate (errors per minute)",
			},
			[]string{"error_type", "endpoint", "tenant_id"},
		),

		// Security metrics
		AuthenticationAttempts: promauto.With(m.config.Registry).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: m.config.Namespace,
				Subsystem: m.config.Subsystem,
				Name:      "authentication_attempts_total",
				Help:      "Total number of authentication attempts",
			},
			[]string{"method", "status", "tenant_id"},
		),
		AuthorizationFailures: promauto.With(m.config.Registry).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: m.config.Namespace,
				Subsystem: m.config.Subsystem,
				Name:      "authorization_failures_total",
				Help:      "Total number of authorization failures",
			},
			[]string{"reason", "endpoint", "tenant_id"},
		),
		SecurityViolations: promauto.With(m.config.Registry).NewCounterVec(
			prometheus.CounterOpts{
				Namespace: m.config.Namespace,
				Subsystem: m.config.Subsystem,
				Name:      "security_violations_total",
				Help:      "Total number of security violations",
			},
			[]string{"violation_type", "severity", "tenant_id"},
		),

		// DLP metrics
		DLPScans: promauto.With(m.config.Registry).NewCounter(
			prometheus.CounterOpts{
				Namespace: m.config.Namespace,
				Subsystem: m.config.Subsystem,
				Name:      "dlp_scans_total",
				Help:      "Total number of DLP scans performed",
			},
		),
		DLPViolations: promauto.With(m.config.Registry).NewCounter(
			prometheus.CounterOpts{
				Namespace: m.config.Namespace,
				Subsystem: m.config.Subsystem,
				Name:      "dlp_violations_total",
				Help:      "Total number of DLP violations detected",
			},
		),
		PIIDetections: promauto.With(m.config.Registry).NewCounter(
			prometheus.CounterOpts{
				Namespace: m.config.Namespace,
				Subsystem: m.config.Subsystem,
				Name:      "pii_detections_total",
				Help:      "Total number of PII detections",
			},
		),

		// Initialize custom metrics map
		CustomMetrics: make(map[string]prometheus.Metric),
	}
}

// startServer starts the Prometheus metrics server
func (m *MetricsCollector) startServer() {
	if !m.config.Enabled {
		return
	}

	mux := http.NewServeMux()
	mux.Handle(m.config.Path, promhttp.Handler())

	m.server = &http.Server{
		Addr:         fmt.Sprintf(":%d", m.config.Port),
		Handler:      mux,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 5 * time.Second,
	}

	go func() {
		m.logger.WithFields(logrus.Fields{
			"port": m.config.Port,
			"path": m.config.Path,
		}).Info("Starting Prometheus metrics server")

		if err := m.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			m.logger.WithError(err).Error("Failed to start Prometheus metrics server")
		}
	}()
}

// HTTP metrics methods

// RecordHTTPRequest records an HTTP request
func (m *MetricsCollector) RecordHTTPRequest(method, endpoint, statusCode, tenantID string) {
	m.metrics.HTTPRequestsTotal.WithLabelValues(method, endpoint, statusCode, tenantID).Inc()
}

// RecordHTTPRequestDuration records HTTP request duration
func (m *MetricsCollector) RecordHTTPRequestDuration(method, endpoint, tenantID string, duration time.Duration) {
	m.metrics.HTTPRequestDuration.WithLabelValues(method, endpoint, tenantID).Observe(duration.Seconds())
}

// RecordHTTPResponseSize records HTTP response size
func (m *MetricsCollector) RecordHTTPResponseSize(method, endpoint string, size int64) {
	m.metrics.HTTPResponseSize.WithLabelValues(method, endpoint).Observe(float64(size))
}

// RecordHTTPRequestSize records HTTP request size
func (m *MetricsCollector) RecordHTTPRequestSize(method, endpoint string, size int64) {
	m.metrics.HTTPRequestSize.WithLabelValues(method, endpoint).Observe(float64(size))
}

// Business metrics methods

// SetActiveUsers sets the number of active users
func (m *MetricsCollector) SetActiveUsers(count float64) {
	m.metrics.ActiveUsers.Set(count)
}

// SetActiveTenants sets the number of active tenants
func (m *MetricsCollector) SetActiveTenants(count float64) {
	m.metrics.ActiveTenants.Set(count)
}

// IncrementDocumentsProcessed increments the documents processed counter
func (m *MetricsCollector) IncrementDocumentsProcessed() {
	m.metrics.DocumentsProcessed.Inc()
}

// IncrementQueriesPerformed increments the queries performed counter
func (m *MetricsCollector) IncrementQueriesPerformed() {
	m.metrics.QueriesPerformed.Inc()
}

// IncrementTokensGenerated increments the tokens generated counter
func (m *MetricsCollector) IncrementTokensGenerated(count float64) {
	m.metrics.TokensGenerated.Add(count)
}

// System metrics methods

// SetDatabaseConnections sets the number of active database connections
func (m *MetricsCollector) SetDatabaseConnections(database, tenantID string, count float64) {
	m.metrics.DatabaseConnections.WithLabelValues(database, tenantID).Set(count)
}

// SetCacheHitRatio sets the cache hit ratio
func (m *MetricsCollector) SetCacheHitRatio(cacheType, tenantID string, ratio float64) {
	m.metrics.CacheHitRatio.WithLabelValues(cacheType, tenantID).Set(ratio)
}

// IncrementRateLimitHit increments the rate limit hit counter
func (m *MetricsCollector) IncrementRateLimitHit(endpoint, tenantID, userID string) {
	m.metrics.RateLimitHits.WithLabelValues(endpoint, tenantID, userID).Inc()
}

// SetErrorRate sets the error rate
func (m *MetricsCollector) SetErrorRate(errorType, endpoint, tenantID string, rate float64) {
	m.metrics.ErrorRate.WithLabelValues(errorType, endpoint, tenantID).Set(rate)
}

// Security metrics methods

// RecordAuthenticationAttempt records an authentication attempt
func (m *MetricsCollector) RecordAuthenticationAttempt(method, status, tenantID string) {
	m.metrics.AuthenticationAttempts.WithLabelValues(method, status, tenantID).Inc()
}

// RecordAuthorizationFailure records an authorization failure
func (m *MetricsCollector) RecordAuthorizationFailure(reason, endpoint, tenantID string) {
	m.metrics.AuthorizationFailures.WithLabelValues(reason, endpoint, tenantID).Inc()
}

// RecordSecurityViolation records a security violation
func (m *MetricsCollector) RecordSecurityViolation(violationType, severity, tenantID string) {
	m.metrics.SecurityViolations.WithLabelValues(violationType, severity, tenantID).Inc()
}

// DLP metrics methods

// IncrementDLPScans increments the DLP scans counter
func (m *MetricsCollector) IncrementDLPScans() {
	m.metrics.DLPScans.Inc()
}

// IncrementDLPViolations increments the DLP violations counter
func (m *MetricsCollector) IncrementDLPViolations() {
	m.metrics.DLPViolations.Inc()
}

// IncrementPIIDetections increments the PII detections counter
func (m *MetricsCollector) IncrementPIIDetections() {
	m.metrics.PIIDetections.Inc()
}

// Custom metrics methods

// RegisterCustomMetric registers a custom metric
func (m *MetricsCollector) RegisterCustomMetric(name string, metric prometheus.Metric) error {
	if _, exists := m.metrics.CustomMetrics[name]; exists {
		return fmt.Errorf("custom metric %s already exists", name)
	}

	if err := m.config.Registry.Register(metric); err != nil {
		return fmt.Errorf("failed to register custom metric %s: %w", name, err)
	}

	m.metrics.CustomMetrics[name] = metric
	m.logger.WithField("metric", name).Info("Registered custom metric")
	return nil
}

// UnregisterCustomMetric unregisters a custom metric
func (m *MetricsCollector) UnregisterCustomMetric(name string) {
	if metric, exists := m.metrics.CustomMetrics[name]; exists {
		m.config.Registry.Unregister(metric)
		delete(m.metrics.CustomMetrics, name)
		m.logger.WithField("metric", name).Info("Unregistered custom metric")
	}
}

// GetMetrics returns all current metrics
func (m *MetricsCollector) GetMetrics() *PrometheusMetrics {
	return m.metrics
}

// Shutdown gracefully shuts down the metrics server
func (m *MetricsCollector) Shutdown(ctx context.Context) error {
	if m.server != nil {
		m.logger.Info("Shutting down Prometheus metrics server")

		shutdownCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
		defer cancel()

		return m.server.Shutdown(shutdownCtx)
	}
	return nil
}

// MetricsMiddleware creates HTTP middleware for metrics collection
func (m *MetricsCollector) MetricsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		// Wrap response writer to capture status code and size
		wrapped := &responseWriter{
			ResponseWriter: w,
			statusCode:     http.StatusOK,
		}

		// Process request
		next.ServeHTTP(wrapped, r)

		// Calculate duration
		duration := time.Since(start)

		// Extract tenant ID from context
		tenantID := "unknown"
		if t, ok := r.Context().Value("tenant_id").(string); ok {
			tenantID = t
		}

		// Record metrics
		m.RecordHTTPRequest(r.Method, r.URL.Path, fmt.Sprintf("%d", wrapped.statusCode), tenantID)
		m.RecordHTTPRequestDuration(r.Method, r.URL.Path, tenantID, duration)
		m.RecordHTTPResponseSize(r.Method, r.URL.Path, wrapped.responseSize)

		// Get request size from Content-Length header
		if contentLength := r.Header.Get("Content-Length"); contentLength != "" {
			if size, err := strconv.ParseInt(contentLength, 10, 64); err == nil {
				m.RecordHTTPRequestSize(r.Method, r.URL.Path, size)
			}
		}
	})
}

// responseWriter wraps http.ResponseWriter to capture status code and response size
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
