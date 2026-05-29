package prometheus

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

// MetricsConfig holds configuration for Prometheus metrics
type MetricsConfig struct {
	Service        string              `json:"service" yaml:"service"`
	Version        string              `json:"version" yaml:"version"`
	Environment    string              `json:"environment" yaml:"environment"`
	Port           int                 `json:"port" yaml:"port"`
	Path           string              `json:"path" yaml:"path"`
	Namespace      string              `json:"namespace" yaml:"namespace"`
	Subsystem      string              `json:"subsystem" yaml:"subsystem"`
	Enabled        bool                `json:"enabled" yaml:"enabled"`
	Labels         map[string]string   `json:"labels" yaml:"labels"`
	Buckets        []float64           `json:"buckets" yaml:"buckets"`
	Objectives     map[float64]float64 `json:"objectives" yaml:"objectives"`
	PrometheusURL  string              `json:"prometheus_url" yaml:"prometheus_url"`
	ScrapeInterval string              `json:"scrape_interval" yaml:"scrape_interval"`
}

// DefaultMetricsConfig returns default metrics configuration
func DefaultMetricsConfig() *MetricsConfig {
	return &MetricsConfig{
		Service:        "sdlc-platform",
		Version:        "1.0.0",
		Environment:    "development",
		Port:           9090,
		Path:           "/metrics",
		Namespace:      "sdlc",
		Subsystem:      "",
		Enabled:        true,
		Labels:         make(map[string]string),
		Buckets:        prometheus.DefBuckets,
		Objectives:     map[float64]float64{0.5: 0.05, 0.9: 0.01, 0.99: 0.001},
		ScrapeInterval: "15s",
	}
}

// MetricsCollector manages Prometheus metrics collection
type MetricsCollector struct {
	config     *MetricsConfig
	registry   *prometheus.Registry
	server     *http.Server
	httpClient api.Client
	v1api      v1.API

	// HTTP metrics
	httpRequestsTotal   *prometheus.CounterVec
	httpRequestDuration *prometheus.HistogramVec
	httpRequestSize     *prometheus.HistogramVec
	httpResponseSize    *prometheus.HistogramVec
	httpActiveRequests  *prometheus.GaugeVec

	// Business metrics
	operationsTotal   *prometheus.CounterVec
	operationDuration *prometheus.HistogramVec
	operationErrors   *prometheus.CounterVec

	// Resource metrics
	cpuUsage    *prometheus.GaugeVec
	memoryUsage *prometheus.GaugeVec
	diskUsage   *prometheus.GaugeVec
	networkIO   *prometheus.GaugeVec

	// Database metrics
	dbConnectionsActive *prometheus.GaugeVec
	dbConnectionsIdle   *prometheus.GaugeVec
	dbQueryDuration     *prometheus.HistogramVec
	dbQueryTotal        *prometheus.CounterVec
	dbErrors            *prometheus.CounterVec

	// Custom metrics
	customCounters   map[string]*prometheus.CounterVec
	customGauges     map[string]*prometheus.GaugeVec
	customHistograms map[string]*prometheus.HistogramVec
	customSummaries  map[string]*prometheus.SummaryVec
}

// NewMetricsCollector creates a new metrics collector
func NewMetricsCollector(config *MetricsConfig) (*MetricsCollector, error) {
	if config == nil {
		config = DefaultMetricsConfig()
	}

	mc := &MetricsCollector{
		config:           config,
		registry:         prometheus.NewRegistry(),
		customCounters:   make(map[string]*prometheus.CounterVec),
		customGauges:     make(map[string]*prometheus.GaugeVec),
		customHistograms: make(map[string]*prometheus.HistogramVec),
		customSummaries:  make(map[string]*prometheus.SummaryVec),
	}

	// Initialize Prometheus client if URL is provided
	if config.PrometheusURL != "" {
		client, err := api.NewClient(api.Config{
			Address: config.PrometheusURL,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to create Prometheus client: %w", err)
		}
		mc.httpClient = client
		mc.v1api = v1.NewAPI(client)
	}

	// Initialize built-in metrics
	mc.initializeMetrics()

	// Register metrics with registry
	mc.registerMetrics()

	return mc, nil
}

func (mc *MetricsCollector) initializeMetrics() {
	constLabels := mc.getConstLabels()

	// HTTP metrics
	mc.httpRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace:   mc.config.Namespace,
			Subsystem:   mc.config.Subsystem,
			Name:        "http_requests_total",
			Help:        "Total number of HTTP requests",
			ConstLabels: constLabels,
		},
		[]string{"method", "endpoint", "status_code", "tenant_id"},
	)

	mc.httpRequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace:   mc.config.Namespace,
			Subsystem:   mc.config.Subsystem,
			Name:        "http_request_duration_seconds",
			Help:        "HTTP request duration in seconds",
			Buckets:     mc.config.Buckets,
			ConstLabels: constLabels,
		},
		[]string{"method", "endpoint", "status_code", "tenant_id"},
	)

	mc.httpRequestSize = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace:   mc.config.Namespace,
			Subsystem:   mc.config.Subsystem,
			Name:        "http_request_size_bytes",
			Help:        "HTTP request size in bytes",
			Buckets:     []float64{100, 1000, 10000, 100000, 1000000},
			ConstLabels: constLabels,
		},
		[]string{"method", "endpoint", "tenant_id"},
	)

	mc.httpResponseSize = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace:   mc.config.Namespace,
			Subsystem:   mc.config.Subsystem,
			Name:        "http_response_size_bytes",
			Help:        "HTTP response size in bytes",
			Buckets:     []float64{100, 1000, 10000, 100000, 1000000},
			ConstLabels: constLabels,
		},
		[]string{"method", "endpoint", "status_code", "tenant_id"},
	)

	mc.httpActiveRequests = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Namespace:   mc.config.Namespace,
			Subsystem:   mc.config.Subsystem,
			Name:        "http_active_requests",
			Help:        "Number of active HTTP requests",
			ConstLabels: constLabels,
		},
		[]string{"method", "endpoint", "tenant_id"},
	)

	// Business metrics
	mc.operationsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace:   mc.config.Namespace,
			Subsystem:   mc.config.Subsystem,
			Name:        "operations_total",
			Help:        "Total number of business operations",
			ConstLabels: constLabels,
		},
		[]string{"operation", "status", "tenant_id"},
	)

	mc.operationDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace:   mc.config.Namespace,
			Subsystem:   mc.config.Subsystem,
			Name:        "operation_duration_seconds",
			Help:        "Business operation duration in seconds",
			Buckets:     mc.config.Buckets,
			ConstLabels: constLabels,
		},
		[]string{"operation", "tenant_id"},
	)

	mc.operationErrors = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace:   mc.config.Namespace,
			Subsystem:   mc.config.Subsystem,
			Name:        "operation_errors_total",
			Help:        "Total number of business operation errors",
			ConstLabels: constLabels,
		},
		[]string{"operation", "error_type", "tenant_id"},
	)

	// Resource metrics
	mc.cpuUsage = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Namespace:   mc.config.Namespace,
			Subsystem:   mc.config.Subsystem,
			Name:        "cpu_usage_percent",
			Help:        "CPU usage percentage",
			ConstLabels: constLabels,
		},
		[]string{"core", "tenant_id"},
	)

	mc.memoryUsage = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Namespace:   mc.config.Namespace,
			Subsystem:   mc.config.Subsystem,
			Name:        "memory_usage_bytes",
			Help:        "Memory usage in bytes",
			ConstLabels: constLabels,
		},
		[]string{"type", "tenant_id"},
	)

	mc.diskUsage = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Namespace:   mc.config.Namespace,
			Subsystem:   mc.config.Subsystem,
			Name:        "disk_usage_bytes",
			Help:        "Disk usage in bytes",
			ConstLabels: constLabels,
		},
		[]string{"mount_point", "tenant_id"},
	)

	mc.networkIO = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Namespace:   mc.config.Namespace,
			Subsystem:   mc.config.Subsystem,
			Name:        "network_io_bytes",
			Help:        "Network I/O in bytes",
			ConstLabels: constLabels,
		},
		[]string{"direction", "interface", "tenant_id"},
	)

	// Database metrics
	mc.dbConnectionsActive = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Namespace:   mc.config.Namespace,
			Subsystem:   mc.config.Subsystem,
			Name:        "db_connections_active",
			Help:        "Number of active database connections",
			ConstLabels: constLabels,
		},
		[]string{"database", "tenant_id"},
	)

	mc.dbConnectionsIdle = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Namespace:   mc.config.Namespace,
			Subsystem:   mc.config.Subsystem,
			Name:        "db_connections_idle",
			Help:        "Number of idle database connections",
			ConstLabels: constLabels,
		},
		[]string{"database", "tenant_id"},
	)

	mc.dbQueryDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace:   mc.config.Namespace,
			Subsystem:   mc.config.Subsystem,
			Name:        "db_query_duration_seconds",
			Help:        "Database query duration in seconds",
			Buckets:     []float64{0.001, 0.01, 0.1, 1, 10},
			ConstLabels: constLabels,
		},
		[]string{"database", "operation", "table", "tenant_id"},
	)

	mc.dbQueryTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace:   mc.config.Namespace,
			Subsystem:   mc.config.Subsystem,
			Name:        "db_queries_total",
			Help:        "Total number of database queries",
			ConstLabels: constLabels,
		},
		[]string{"database", "operation", "table", "status", "tenant_id"},
	)

	mc.dbErrors = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace:   mc.config.Namespace,
			Subsystem:   mc.config.Subsystem,
			Name:        "db_errors_total",
			Help:        "Total number of database errors",
			ConstLabels: constLabels,
		},
		[]string{"database", "error_type", "tenant_id"},
	)
}

func (mc *MetricsCollector) registerMetrics() {
	// Register built-in metrics
	mc.registry.MustRegister(mc.httpRequestsTotal)
	mc.registry.MustRegister(mc.httpRequestDuration)
	mc.registry.MustRegister(mc.httpRequestSize)
	mc.registry.MustRegister(mc.httpResponseSize)
	mc.registry.MustRegister(mc.httpActiveRequests)

	mc.registry.MustRegister(mc.operationsTotal)
	mc.registry.MustRegister(mc.operationDuration)
	mc.registry.MustRegister(mc.operationErrors)

	mc.registry.MustRegister(mc.cpuUsage)
	mc.registry.MustRegister(mc.memoryUsage)
	mc.registry.MustRegister(mc.diskUsage)
	mc.registry.MustRegister(mc.networkIO)

	mc.registry.MustRegister(mc.dbConnectionsActive)
	mc.registry.MustRegister(mc.dbConnectionsIdle)
	mc.registry.MustRegister(mc.dbQueryDuration)
	mc.registry.MustRegister(mc.dbQueryTotal)
	mc.registry.MustRegister(mc.dbErrors)

	// Register default Go metrics
	mc.registry.MustRegister(prometheus.NewGoCollector())
	mc.registry.MustRegister(prometheus.NewProcessCollector(prometheus.ProcessCollectorOpts{}))
}

func (mc *MetricsCollector) getConstLabels() prometheus.Labels {
	labels := prometheus.Labels{
		"service":     mc.config.Service,
		"version":     mc.config.Version,
		"environment": mc.config.Environment,
	}

	// Add custom labels
	for k, v := range mc.config.Labels {
		labels[k] = v
	}

	return labels
}

// Start starts the metrics HTTP server
func (mc *MetricsCollector) Start() error {
	if !mc.config.Enabled {
		return nil
	}

	mux := http.NewServeMux()
	mux.Handle(mc.config.Path, promhttp.HandlerFor(mc.registry, promhttp.HandlerOpts{}))

	mc.server = &http.Server{
		Addr:    fmt.Sprintf(":%d", mc.config.Port),
		Handler: mux,
	}

	return mc.server.ListenAndServe()
}

// Stop stops the metrics HTTP server
func (mc *MetricsCollector) Stop() error {
	if mc.server != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		return mc.server.Shutdown(ctx)
	}
	return nil
}

// HTTP metrics methods
func (mc *MetricsCollector) RecordHTTPRequest(method, endpoint, statusCode, tenantID string) {
	mc.httpRequestsTotal.WithLabelValues(method, endpoint, statusCode, tenantID).Inc()
}

func (mc *MetricsCollector) RecordHTTPRequestDuration(method, endpoint, statusCode, tenantID string, duration time.Duration) {
	mc.httpRequestDuration.WithLabelValues(method, endpoint, statusCode, tenantID).Observe(duration.Seconds())
}

func (mc *MetricsCollector) RecordHTTPRequestSize(method, endpoint, tenantID string, size float64) {
	mc.httpRequestSize.WithLabelValues(method, endpoint, tenantID).Observe(size)
}

func (mc *MetricsCollector) RecordHTTPResponseSize(method, endpoint, statusCode, tenantID string, size float64) {
	mc.httpResponseSize.WithLabelValues(method, endpoint, statusCode, tenantID).Observe(size)
}

func (mc *MetricsCollector) IncActiveHTTPRequests(method, endpoint, tenantID string) {
	mc.httpActiveRequests.WithLabelValues(method, endpoint, tenantID).Inc()
}

func (mc *MetricsCollector) DecActiveHTTPRequests(method, endpoint, tenantID string) {
	mc.httpActiveRequests.WithLabelValues(method, endpoint, tenantID).Dec()
}

// Business metrics methods
func (mc *MetricsCollector) RecordOperation(operation, status, tenantID string) {
	mc.operationsTotal.WithLabelValues(operation, status, tenantID).Inc()
}

func (mc *MetricsCollector) RecordOperationDuration(operation, tenantID string, duration time.Duration) {
	mc.operationDuration.WithLabelValues(operation, tenantID).Observe(duration.Seconds())
}

func (mc *MetricsCollector) RecordOperationError(operation, errorType, tenantID string) {
	mc.operationErrors.WithLabelValues(operation, errorType, tenantID).Inc()
}

// Resource metrics methods
func (mc *MetricsCollector) SetCPUUsage(core, tenantID string, usage float64) {
	mc.cpuUsage.WithLabelValues(core, tenantID).Set(usage)
}

func (mc *MetricsCollector) SetMemoryUsage(memType, tenantID string, usage float64) {
	mc.memoryUsage.WithLabelValues(memType, tenantID).Set(usage)
}

func (mc *MetricsCollector) SetDiskUsage(mountPoint, tenantID string, usage float64) {
	mc.diskUsage.WithLabelValues(mountPoint, tenantID).Set(usage)
}

func (mc *MetricsCollector) SetNetworkIO(direction, iface, tenantID string, bytes float64) {
	mc.networkIO.WithLabelValues(direction, iface, tenantID).Set(bytes)
}

// Database metrics methods
func (mc *MetricsCollector) SetDBConnectionsActive(database, tenantID string, count float64) {
	mc.dbConnectionsActive.WithLabelValues(database, tenantID).Set(count)
}

func (mc *MetricsCollector) SetDBConnectionsIdle(database, tenantID string, count float64) {
	mc.dbConnectionsIdle.WithLabelValues(database, tenantID).Set(count)
}

func (mc *MetricsCollector) RecordDBQueryDuration(database, operation, table, tenantID string, duration time.Duration) {
	mc.dbQueryDuration.WithLabelValues(database, operation, table, tenantID).Observe(duration.Seconds())
}

func (mc *MetricsCollector) RecordDBQuery(database, operation, table, status, tenantID string) {
	mc.dbQueryTotal.WithLabelValues(database, operation, table, status, tenantID).Inc()
}

func (mc *MetricsCollector) RecordDBError(database, errorType, tenantID string) {
	mc.dbErrors.WithLabelValues(database, errorType, tenantID).Inc()
}

// Custom metrics methods
func (mc *MetricsCollector) RegisterCounter(name, help string, labels []string) (*prometheus.CounterVec, error) {
	if _, exists := mc.customCounters[name]; exists {
		return nil, fmt.Errorf("counter %s already registered", name)
	}

	counter := prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace:   mc.config.Namespace,
			Subsystem:   mc.config.Subsystem,
			Name:        name,
			Help:        help,
			ConstLabels: mc.getConstLabels(),
		},
		labels,
	)

	mc.customCounters[name] = counter
	mc.registry.MustRegister(counter)
	return counter, nil
}

func (mc *MetricsCollector) RegisterGauge(name, help string, labels []string) (*prometheus.GaugeVec, error) {
	if _, exists := mc.customGauges[name]; exists {
		return nil, fmt.Errorf("gauge %s already registered", name)
	}

	gauge := prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Namespace:   mc.config.Namespace,
			Subsystem:   mc.config.Subsystem,
			Name:        name,
			Help:        help,
			ConstLabels: mc.getConstLabels(),
		},
		labels,
	)

	mc.customGauges[name] = gauge
	mc.registry.MustRegister(gauge)
	return gauge, nil
}

func (mc *MetricsCollector) RegisterHistogram(name, help string, labels []string, buckets []float64) (*prometheus.HistogramVec, error) {
	if _, exists := mc.customHistograms[name]; exists {
		return nil, fmt.Errorf("histogram %s already registered", name)
	}

	histogram := prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace:   mc.config.Namespace,
			Subsystem:   mc.config.Subsystem,
			Name:        name,
			Help:        help,
			Buckets:     buckets,
			ConstLabels: mc.getConstLabels(),
		},
		labels,
	)

	mc.customHistograms[name] = histogram
	mc.registry.MustRegister(histogram)
	return histogram, nil
}

func (mc *MetricsCollector) GetCounter(name string) *prometheus.CounterVec {
	return mc.customCounters[name]
}

func (mc *MetricsCollector) GetGauge(name string) *prometheus.GaugeVec {
	return mc.customGauges[name]
}

func (mc *MetricsCollector) GetHistogram(name string) *prometheus.HistogramVec {
	return mc.customHistograms[name]
}

// Query methods for Prometheus API
func (mc *MetricsCollector) Query(ctx context.Context, query string) (interface{}, error) {
	if mc.v1api == nil {
		return nil, fmt.Errorf("Prometheus API not configured")
	}

	result, warnings, err := mc.v1api.Query(ctx, query, time.Now())
	if err != nil {
		return nil, err
	}

	if len(warnings) > 0 {
		// Log warnings
	}

	return result, nil
}

func (mc *MetricsCollector) QueryRange(ctx context.Context, query string, r v1.Range) (interface{}, error) {
	if mc.v1api == nil {
		return nil, fmt.Errorf("Prometheus API not configured")
	}

	result, warnings, err := mc.v1api.QueryRange(ctx, query, r)
	if err != nil {
		return nil, err
	}

	if len(warnings) > 0 {
		// Log warnings
	}

	return result, nil
}
