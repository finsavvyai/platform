//go:build legacy_migrated
// +build legacy_migrated

package monitoring

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/prometheus/client_golang/api"
	v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

const (
	namespace = "quantumbeam"
	subsystem = "fraud_detection"
)

// MetricsCollector holds all application metrics
type MetricsCollector struct {
	// HTTP request metrics
	httpRequestsTotal   *prometheus.CounterVec
	httpRequestDuration *prometheus.HistogramVec
	httpRequestSize     *prometheus.HistogramVec
	httpResponseSize    *prometheus.HistogramVec

	// Fraud detection metrics
	fraudDetectionsTotal     *prometheus.CounterVec
	fraudDetectionDuration   *prometheus.HistogramVec
	quantumProcessingTotal   *prometheus.CounterVec
	classicalProcessingTotal *prometheus.CounterVec
	quantumAdvantageScore    *prometheus.GaugeVec

	// Authentication metrics
	authTotal         *prometheus.CounterVec
	authDuration      *prometheus.HistogramVec
	apiKeyValidations *prometheus.CounterVec
	jwtValidations    *prometheus.CounterVec

	// Billing metrics
	billingEventsTotal *prometheus.CounterVec
	usageTracking      *prometheus.CounterVec
	costCalculation    *prometheus.HistogramVec

	// System metrics
	activeConnections    *prometheus.GaugeVec
	databaseConnections  *prometheus.GaugeVec
	redisConnections     *prometheus.GaugeVec
	quantumBackendStatus *prometheus.GaugeVec

	// AI/ML metrics
	aiProcessingTotal     *prometheus.CounterVec
	aiProcessingDuration  *prometheus.HistogramVec
	providerFailures      *prometheus.CounterVec
	explanationGeneration *prometheus.CounterVec
}

// NewMetricsCollector creates a new metrics collector with all registered metrics
func NewMetricsCollector() *MetricsCollector {
	mc := &MetricsCollector{
		// HTTP metrics
		httpRequestsTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Subsystem: subsystem,
				Name:      "http_requests_total",
				Help:      "Total number of HTTP requests",
			},
			[]string{"method", "endpoint", "status_code"},
		),
		httpRequestDuration: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: namespace,
				Subsystem: subsystem,
				Name:      "http_request_duration_seconds",
				Help:      "HTTP request duration in seconds",
				Buckets:   prometheus.DefBuckets,
			},
			[]string{"method", "endpoint"},
		),
		httpRequestSize: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: namespace,
				Subsystem: subsystem,
				Name:      "http_request_size_bytes",
				Help:      "HTTP request size in bytes",
				Buckets:   prometheus.ExponentialBuckets(100, 10, 8),
			},
			[]string{"method", "endpoint"},
		),
		httpResponseSize: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: namespace,
				Subsystem: subsystem,
				Name:      "http_response_size_bytes",
				Help:      "HTTP response size in bytes",
				Buckets:   prometheus.ExponentialBuckets(100, 10, 8),
			},
			[]string{"method", "endpoint"},
		),

		// Fraud detection metrics
		fraudDetectionsTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Subsystem: subsystem,
				Name:      "fraud_detections_total",
				Help:      "Total number of fraud detections",
			},
			[]string{"processing_type", "result", "confidence_level"},
		),
		fraudDetectionDuration: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: namespace,
				Subsystem: subsystem,
				Name:      "fraud_detection_duration_seconds",
				Help:      "Fraud detection processing duration in seconds",
				Buckets:   []float64{0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10},
			},
			[]string{"processing_type"},
		),
		quantumProcessingTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Subsystem: subsystem,
				Name:      "quantum_processing_total",
				Help:      "Total number of quantum processing requests",
			},
			[]string{"backend", "algorithm", "status"},
		),
		classicalProcessingTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Subsystem: subsystem,
				Name:      "classical_processing_total",
				Help:      "Total number of classical processing requests",
			},
			[]string{"algorithm", "status"},
		),
		quantumAdvantageScore: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Namespace: namespace,
				Subsystem: subsystem,
				Name:      "quantum_advantage_score",
				Help:      "Quantum advantage score compared to classical processing",
			},
			[]string{"algorithm", "metric_type"},
		),

		// Authentication metrics
		authTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Subsystem: subsystem,
				Name:      "auth_operations_total",
				Help:      "Total number of authentication operations",
			},
			[]string{"method", "status"},
		),
		authDuration: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: namespace,
				Subsystem: subsystem,
				Name:      "auth_duration_seconds",
				Help:      "Authentication processing duration in seconds",
				Buckets:   prometheus.DefBuckets,
			},
			[]string{"method"},
		),
		apiKeyValidations: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Subsystem: subsystem,
				Name:      "api_key_validations_total",
				Help:      "Total number of API key validations",
			},
			[]string{"status"},
		),
		jwtValidations: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Subsystem: subsystem,
				Name:      "jwt_validations_total",
				Help:      "Total number of JWT validations",
			},
			[]string{"status"},
		),

		// Billing metrics
		billingEventsTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Subsystem: subsystem,
				Name:      "billing_events_total",
				Help:      "Total number of billing events",
			},
			[]string{"event_type", "status"},
		),
		usageTracking: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Subsystem: subsystem,
				Name:      "usage_tracking_total",
				Help:      "Total usage tracking events",
			},
			[]string{"usage_type", "tier"},
		),
		costCalculation: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: namespace,
				Subsystem: subsystem,
				Name:      "cost_calculation_duration_seconds",
				Help:      "Cost calculation processing duration in seconds",
				Buckets:   prometheus.DefBuckets,
			},
			[]string{"calculation_type"},
		),

		// System metrics
		activeConnections: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Namespace: namespace,
				Subsystem: subsystem,
				Name:      "active_connections",
				Help:      "Number of active connections",
			},
			[]string{"connection_type"},
		),
		databaseConnections: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Namespace: namespace,
				Subsystem: subsystem,
				Name:      "database_connections",
				Help:      "Number of database connections",
			},
			[]string{"database_type"},
		),
		redisConnections: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Namespace: namespace,
				Subsystem: subsystem,
				Name:      "redis_connections",
				Help:      "Number of Redis connections",
			},
			[]string{"connection_pool"},
		),
		quantumBackendStatus: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Namespace: namespace,
				Subsystem: subsystem,
				Name:      "quantum_backend_status",
				Help:      "Quantum backend status (1=up, 0=down)",
			},
			[]string{"backend_name", "provider"},
		),

		// AI/ML metrics
		aiProcessingTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Subsystem: subsystem,
				Name:      "ai_processing_total",
				Help:      "Total number of AI processing requests",
			},
			[]string{"provider", "model", "status"},
		),
		aiProcessingDuration: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: namespace,
				Subsystem: subsystem,
				Name:      "ai_processing_duration_seconds",
				Help:      "AI processing duration in seconds",
				Buckets:   []float64{0.1, 0.5, 1, 2.5, 5, 10, 30, 60},
			},
			[]string{"provider", "model"},
		),
		providerFailures: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Subsystem: subsystem,
				Name:      "provider_failures_total",
				Help:      "Total number of provider failures",
			},
			[]string{"provider", "failure_type"},
		),
		explanationGeneration: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: namespace,
				Subsystem: subsystem,
				Name:      "explanation_generation_total",
				Help:      "Total number of explanation generations",
			},
			[]string{"status", "explanation_type"},
		),
	}

	// Register all metrics with the default registry
	mc.RegisterMetrics()

	return mc
}

// RegisterMetrics registers all metrics with the Prometheus default registry
func (mc *MetricsCollector) RegisterMetrics() {
	prometheus.MustRegister(
		mc.httpRequestsTotal,
		mc.httpRequestDuration,
		mc.httpRequestSize,
		mc.httpResponseSize,
		mc.fraudDetectionsTotal,
		mc.fraudDetectionDuration,
		mc.quantumProcessingTotal,
		mc.classicalProcessingTotal,
		mc.quantumAdvantageScore,
		mc.authTotal,
		mc.authDuration,
		mc.apiKeyValidations,
		mc.jwtValidations,
		mc.billingEventsTotal,
		mc.usageTracking,
		mc.costCalculation,
		mc.activeConnections,
		mc.databaseConnections,
		mc.redisConnections,
		mc.quantumBackendStatus,
		mc.aiProcessingTotal,
		mc.aiProcessingDuration,
		mc.providerFailures,
		mc.explanationGeneration,
	)
}

// HTTP monitoring methods
func (mc *MetricsCollector) RecordHTTPRequest(method, endpoint, statusCode string) {
	mc.httpRequestsTotal.WithLabelValues(method, endpoint, statusCode).Inc()
}

func (mc *MetricsCollector) RecordHTTPRequestDuration(method, endpoint string, duration time.Duration) {
	mc.httpRequestDuration.WithLabelValues(method, endpoint).Observe(duration.Seconds())
}

func (mc *MetricsCollector) RecordHTTPRequestSize(method, endpoint string, size int) {
	mc.httpRequestSize.WithLabelValues(method, endpoint).Observe(float64(size))
}

func (mc *MetricsCollector) RecordHTTPResponseSize(method, endpoint string, size int) {
	mc.httpResponseSize.WithLabelValues(method, endpoint).Observe(float64(size))
}

// Fraud detection monitoring methods
func (mc *MetricsCollector) RecordFraudDetection(processingType, result, confidenceLevel string) {
	mc.fraudDetectionsTotal.WithLabelValues(processingType, result, confidenceLevel).Inc()
}

func (mc *MetricsCollector) RecordFraudDetectionDuration(processingType string, duration time.Duration) {
	mc.fraudDetectionDuration.WithLabelValues(processingType).Observe(duration.Seconds())
}

func (mc *MetricsCollector) RecordQuantumProcessing(backend, algorithm, status string) {
	mc.quantumProcessingTotal.WithLabelValues(backend, algorithm, status).Inc()
}

func (mc *MetricsCollector) RecordClassicalProcessing(algorithm, status string) {
	mc.classicalProcessingTotal.WithLabelValues(algorithm, status).Inc()
}

func (mc *MetricsCollector) SetQuantumAdvantageScore(algorithm, metricType string, score float64) {
	mc.quantumAdvantageScore.WithLabelValues(algorithm, metricType).Set(score)
}

// Authentication monitoring methods
func (mc *MetricsCollector) RecordAuth(method, status string) {
	mc.authTotal.WithLabelValues(method, status).Inc()
}

func (mc *MetricsCollector) RecordAuthDuration(method string, duration time.Duration) {
	mc.authDuration.WithLabelValues(method).Observe(duration.Seconds())
}

func (mc *MetricsCollector) RecordAPIKeyValidation(status string) {
	mc.apiKeyValidations.WithLabelValues(status).Inc()
}

func (mc *MetricsCollector) RecordJWTValidation(status string) {
	mc.jwtValidations.WithLabelValues(status).Inc()
}

// Billing monitoring methods
func (mc *MetricsCollector) RecordBillingEvent(eventType, status string) {
	mc.billingEventsTotal.WithLabelValues(eventType, status).Inc()
}

func (mc *MetricsCollector) RecordUsage(usageType, tier string) {
	mc.usageTracking.WithLabelValues(usageType, tier).Inc()
}

func (mc *MetricsCollector) RecordCostCalculationDuration(calculationType string, duration time.Duration) {
	mc.costCalculation.WithLabelValues(calculationType).Observe(duration.Seconds())
}

// System monitoring methods
func (mc *MetricsCollector) SetActiveConnections(connectionType string, count float64) {
	mc.activeConnections.WithLabelValues(connectionType).Set(count)
}

func (mc *MetricsCollector) SetDatabaseConnections(databaseType string, count float64) {
	mc.databaseConnections.WithLabelValues(databaseType).Set(count)
}

func (mc *MetricsCollector) SetRedisConnections(connectionPool string, count float64) {
	mc.redisConnections.WithLabelValues(connectionPool).Set(count)
}

func (mc *MetricsCollector) SetQuantumBackendStatus(backendName, provider string, status float64) {
	mc.quantumBackendStatus.WithLabelValues(backendName, provider).Set(status)
}

// AI/ML monitoring methods
func (mc *MetricsCollector) RecordAIProcessing(provider, model, status string) {
	mc.aiProcessingTotal.WithLabelValues(provider, model, status).Inc()
}

func (mc *MetricsCollector) RecordAIProcessingDuration(provider, model string, duration time.Duration) {
	mc.aiProcessingDuration.WithLabelValues(provider, model).Observe(duration.Seconds())
}

func (mc *MetricsCollector) RecordProviderFailure(provider, failureType string) {
	mc.providerFailures.WithLabelValues(provider, failureType).Inc()
}

func (mc *MetricsCollector) RecordExplanationGeneration(status, explanationType string) {
	mc.explanationGeneration.WithLabelValues(status, explanationType).Inc()
}

// MonitoringService provides the main monitoring functionality
type MonitoringService struct {
	metricsCollector *MetricsCollector
	prometheusClient v1.API
	server           *http.Server
	metricsPath      string
}

// MonitoringConfig holds configuration for the monitoring service
type MonitoringConfig struct {
	PrometheusURL  string
	MetricsPort    string
	MetricsPath    string
	Enabled        bool
	ReportInterval time.Duration
}

// NewMonitoringService creates a new monitoring service
func NewMonitoringService(config MonitoringConfig) (*MonitoringService, error) {
	mc := NewMetricsCollector()

	var prometheusClient v1.API
	var err error

	if config.PrometheusURL != "" {
		client, err := api.NewClient(api.Config{
			Address: config.PrometheusURL,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to create Prometheus client: %w", err)
		}
		prometheusClient = v1.NewAPI(client)
	}

	if config.MetricsPath == "" {
		config.MetricsPath = "/metrics"
	}

	mux := http.NewServeMux()
	mux.Handle(config.MetricsPath, promhttp.Handler())

	server := &http.Server{
		Addr:    ":" + config.MetricsPort,
		Handler: mux,
	}

	return &MonitoringService{
		metricsCollector: mc,
		prometheusClient: prometheusClient,
		server:           server,
		metricsPath:      config.MetricsPath,
	}, nil
}

// Start starts the monitoring HTTP server
func (ms *MonitoringService) Start() error {
	return ms.server.ListenAndServe()
}

// Stop stops the monitoring HTTP server
func (ms *MonitoringService) Stop(ctx context.Context) error {
	return ms.server.Shutdown(ctx)
}

// GetMetricsCollector returns the metrics collector
func (ms *MonitoringService) GetMetricsCollector() *MetricsCollector {
	return ms.metricsCollector
}

// QueryPrometheus queries the Prometheus server for metrics
func (ms *MonitoringService) QueryPrometheus(ctx context.Context, query string) (interface{}, error) {
	if ms.prometheusClient == nil {
		return nil, fmt.Errorf("Prometheus client not configured")
	}

	result, warnings, err := ms.prometheusClient.Query(ctx, query, time.Now())
	if err != nil {
		return nil, fmt.Errorf("failed to query Prometheus: %w", err)
	}

	if len(warnings) > 0 {
		// Log warnings but don't fail the query
		fmt.Printf("Prometheus query warnings: %v\n", warnings)
	}

	return result, nil
}