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
	"github.com/prometheus/common/model"
)

// MetricType represents the type of Prometheus metric
type MetricType string

const (
	CounterType   MetricType = "counter"
	GaugeType     MetricType = "gauge"
	HistogramType MetricType = "histogram"
	SummaryType   MetricType = "summary"
)

// MetricsCollector manages Prometheus metrics collection
type MetricsCollector struct {
	registry   *prometheus.Registry
	namespace  string
	subsystem  string
	metrics    map[string]prometheus.Collector
	labels     []string
	httpServer *http.Server
}

// Config holds configuration for the metrics collector
type Config struct {
	Namespace       string              `json:"namespace" yaml:"namespace"`
	Subsystem       string              `json:"subsystem" yaml:"subsystem"`
	Port            int                 `json:"port" yaml:"port"`
	Path            string              `json:"path" yaml:"path"`
	CommonLabels    []string            `json:"common_labels" yaml:"common_labels"`
	Buckets         []float64           `json:"buckets" yaml:"buckets"`
	Objectives      map[float64]float64 `json:"objectives" yaml:"objectives"`
	EnableHistogram bool                `json:"enable_histogram" yaml:"enable_histogram"`
	EnableSummary   bool                `json:"enable_summary" yaml:"enable_summary"`
}

// DefaultConfig returns default metrics configuration
func DefaultConfig() *Config {
	return &Config{
		Namespace: "sdlc",
		Subsystem: "platform",
		Port:      9090,
		Path:      "/metrics",
		CommonLabels: []string{
			"service", "version", "environment", "tenant_id",
			"user_id", "correlation_id", "trace_id",
		},
		Buckets: prometheus.DefBuckets,
		Objectives: map[float64]float64{
			0.5:  0.05,
			0.9:  0.01,
			0.95: 0.005,
			0.99: 0.001,
		},
		EnableHistogram: true,
		EnableSummary:   true,
	}
}

// NewMetricsCollector creates a new metrics collector
func NewMetricsCollector(config *Config) *MetricsCollector {
	if config == nil {
		config = DefaultConfig()
	}

	collector := &MetricsCollector{
		registry:  prometheus.NewRegistry(),
		namespace: config.Namespace,
		subsystem: config.Subsystem,
		metrics:   make(map[string]prometheus.Collector),
		labels:    config.CommonLabels,
	}

	// Register default metrics
	collector.registry.MustRegister(prometheus.NewGoCollector())
	collector.registry.MustRegister(prometheus.NewProcessCollector(prometheus.ProcessCollectorOpts{}))

	return collector
}

// Counter creates and registers a new counter metric
func (mc *MetricsCollector) Counter(name, help string, labelNames ...string) prometheus.Counter {
	fullyQualifiedName := mc.getFullyQualifiedName(name)

	if _, exists := mc.metrics[fullyQualifiedName]; exists {
		panic(fmt.Sprintf("metric %s already registered", fullyQualifiedName))
	}

	counter := prometheus.NewCounter(prometheus.CounterOpts{
		Namespace: mc.namespace,
		Subsystem: mc.subsystem,
		Name:      name,
		Help:      help,
	})

	mc.registry.MustRegister(counter)
	mc.metrics[fullyQualifiedName] = counter

	return counter
}

// CounterVec creates and registers a new counter vector metric
func (mc *MetricsCollector) CounterVec(name, help string, labelNames ...string) *prometheus.CounterVec {
	fullyQualifiedName := mc.getFullyQualifiedName(name)

	if _, exists := mc.metrics[fullyQualifiedName]; exists {
		panic(fmt.Sprintf("metric %s already registered", fullyQualifiedName))
	}

	counterVec := prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: mc.namespace,
		Subsystem: mc.subsystem,
		Name:      name,
		Help:      help,
	}, labelNames)

	mc.registry.MustRegister(counterVec)
	mc.metrics[fullyQualifiedName] = counterVec

	return counterVec
}

// Gauge creates and registers a new gauge metric
func (mc *MetricsCollector) Gauge(name, help string, labelNames ...string) prometheus.Gauge {
	fullyQualifiedName := mc.getFullyQualifiedName(name)

	if _, exists := mc.metrics[fullyQualifiedName]; exists {
		panic(fmt.Sprintf("metric %s already registered", fullyQualifiedName))
	}

	gauge := prometheus.NewGauge(prometheus.GaugeOpts{
		Namespace: mc.namespace,
		Subsystem: mc.subsystem,
		Name:      name,
		Help:      help,
	})

	mc.registry.MustRegister(gauge)
	mc.metrics[fullyQualifiedName] = gauge

	return gauge
}

// GaugeVec creates and registers a new gauge vector metric
func (mc *MetricsCollector) GaugeVec(name, help string, labelNames ...string) *prometheus.GaugeVec {
	fullyQualifiedName := mc.getFullyQualifiedName(name)

	if _, exists := mc.metrics[fullyQualifiedName]; exists {
		panic(fmt.Sprintf("metric %s already registered", fullyQualifiedName))
	}

	gaugeVec := prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Namespace: mc.namespace,
		Subsystem: mc.subsystem,
		Name:      name,
		Help:      help,
	}, labelNames)

	mc.registry.MustRegister(gaugeVec)
	mc.metrics[fullyQualifiedName] = gaugeVec

	return gaugeVec
}

// Histogram creates and registers a new histogram metric
func (mc *MetricsCollector) Histogram(name, help string, buckets []float64, labelNames ...string) prometheus.Histogram {
	fullyQualifiedName := mc.getFullyQualifiedName(name)

	if _, exists := mc.metrics[fullyQualifiedName]; exists {
		panic(fmt.Sprintf("metric %s already registered", fullyQualifiedName))
	}

	histogram := prometheus.NewHistogram(prometheus.HistogramOpts{
		Namespace: mc.namespace,
		Subsystem: mc.subsystem,
		Name:      name,
		Help:      help,
		Buckets:   buckets,
	})

	mc.registry.MustRegister(histogram)
	mc.metrics[fullyQualifiedName] = histogram

	return histogram
}

// HistogramVec creates and registers a new histogram vector metric
func (mc *MetricsCollector) HistogramVec(name, help string, buckets []float64, labelNames ...string) *prometheus.HistogramVec {
	fullyQualifiedName := mc.getFullyQualifiedName(name)

	if _, exists := mc.metrics[fullyQualifiedName]; exists {
		panic(fmt.Sprintf("metric %s already registered", fullyQualifiedName))
	}

	histogramVec := prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: mc.namespace,
		Subsystem: mc.subsystem,
		Name:      name,
		Help:      help,
		Buckets:   buckets,
	}, labelNames)

	mc.registry.MustRegister(histogramVec)
	mc.metrics[fullyQualifiedName] = histogramVec

	return histogramVec
}

// Summary creates and registers a new summary metric
func (mc *MetricsCollector) Summary(name, help string, objectives map[float64]float64, labelNames ...string) prometheus.Summary {
	fullyQualifiedName := mc.getFullyQualifiedName(name)

	if _, exists := mc.metrics[fullyQualifiedName]; exists {
		panic(fmt.Sprintf("metric %s already registered", fullyQualifiedName))
	}

	summary := prometheus.NewSummary(prometheus.SummaryOpts{
		Namespace:  mc.namespace,
		Subsystem:  mc.subsystem,
		Name:       name,
		Help:       help,
		Objectives: objectives,
	})

	mc.registry.MustRegister(summary)
	mc.metrics[fullyQualifiedName] = summary

	return summary
}

// SummaryVec creates and registers a new summary vector metric
func (mc *MetricsCollector) SummaryVec(name, help string, objectives map[float64]float64, labelNames ...string) *prometheus.SummaryVec {
	fullyQualifiedName := mc.getFullyQualifiedName(name)

	if _, exists := mc.metrics[fullyQualifiedName]; exists {
		panic(fmt.Sprintf("metric %s already registered", fullyQualifiedName))
	}

	summaryVec := prometheus.NewSummaryVec(prometheus.SummaryOpts{
		Namespace:  mc.namespace,
		Subsystem:  mc.subsystem,
		Name:       name,
		Help:       help,
		Objectives: objectives,
	}, labelNames)

	mc.registry.MustRegister(summaryVec)
	mc.metrics[fullyQualifiedName] = summaryVec

	return summaryVec
}

// getFullyQualifiedName constructs the fully qualified metric name
func (mc *MetricsCollector) getFullyQualifiedName(name string) string {
	if mc.subsystem != "" {
		return fmt.Sprintf("%s_%s_%s", mc.namespace, mc.subsystem, name)
	}
	return fmt.Sprintf("%s_%s", mc.namespace, name)
}

// StartServer starts the HTTP server for metrics exposure
func (mc *MetricsCollector) StartServer(config *Config) error {
	if config == nil {
		config = DefaultConfig()
	}

	mux := http.NewServeMux()
	mux.Handle(config.Path, promhttp.HandlerFor(mc.registry, promhttp.HandlerOpts{
		EnableOpenMetrics: true,
	}))

	mc.httpServer = &http.Server{
		Addr:    fmt.Sprintf(":%d", config.Port),
		Handler: mux,
	}

	return mc.httpServer.ListenAndServe()
}

// StopServer stops the HTTP server
func (mc *MetricsCollector) StopServer(ctx context.Context) error {
	if mc.httpServer != nil {
		return mc.httpServer.Shutdown(ctx)
	}
	return nil
}

// GetRegistry returns the Prometheus registry
func (mc *MetricsCollector) GetRegistry() *prometheus.Registry {
	return mc.registry
}

// GetMetric returns a registered metric by name
func (mc *MetricsCollector) GetMetric(name string) (prometheus.Collector, bool) {
	fullyQualifiedName := mc.getFullyQualifiedName(name)
	metric, exists := mc.metrics[fullyQualifiedName]
	return metric, exists
}

// BusinessMetrics holds common business metrics
type BusinessMetrics struct {
	// Request metrics
	RequestsTotal     *prometheus.CounterVec
	RequestDuration   *prometheus.HistogramVec
	ResponseSize      *prometheus.HistogramVec
	ActiveConnections *prometheus.GaugeVec

	// Error metrics
	ErrorsTotal *prometheus.CounterVec
	ErrorRate   *prometheus.GaugeVec

	// Authentication metrics
	AuthAttempts  *prometheus.CounterVec
	AuthSuccesses *prometheus.CounterVec
	AuthFailures  *prometheus.CounterVec

	// Document metrics
	DocumentsTotal         *prometheus.CounterVec
	DocumentSize           *prometheus.HistogramVec
	DocumentProcessingTime *prometheus.HistogramVec

	// RAG metrics
	RAGQueriesTotal  *prometheus.CounterVec
	RAGQueryTime     *prometheus.HistogramVec
	RAGRetrievedDocs *prometheus.HistogramVec

	// Vector database metrics
	VectorSearchesTotal *prometheus.CounterVec
	VectorSearchTime    *prometheus.HistogramVec
	VectorIndexSize     *prometheus.GaugeVec

	// Tenant metrics
	ActiveTenants  *prometheus.GaugeVec
	TenantRequests *prometheus.CounterVec
	TenantStorage  *prometheus.GaugeVec

	// System metrics
	CPUUsage    *prometheus.GaugeVec
	MemoryUsage *prometheus.GaugeVec
	DiskUsage   *prometheus.GaugeVec
	NetworkIO   *prometheus.CounterVec
}

// NewBusinessMetrics creates standard business metrics
func NewBusinessMetrics(collector *MetricsCollector) *BusinessMetrics {
	config := DefaultConfig()

	return &BusinessMetrics{
		RequestsTotal: collector.CounterVec(
			"http_requests_total",
			"Total number of HTTP requests",
			append([]string{"method", "endpoint", "status_code"}, config.CommonLabels...),
		),
		RequestDuration: collector.HistogramVec(
			"http_request_duration_seconds",
			"HTTP request duration in seconds",
			config.Buckets,
			append([]string{"method", "endpoint"}, config.CommonLabels...),
		),
		ResponseSize: collector.HistogramVec(
			"http_response_size_bytes",
			"HTTP response size in bytes",
			[]float64{100, 1000, 10000, 100000, 1000000, 10000000},
			append([]string{"method", "endpoint"}, config.CommonLabels...),
		),
		ActiveConnections: collector.GaugeVec(
			"active_connections",
			"Number of active connections",
			config.CommonLabels,
		),

		ErrorsTotal: collector.CounterVec(
			"errors_total",
			"Total number of errors",
			append([]string{"error_type", "component"}, config.CommonLabels...),
		),
		ErrorRate: collector.GaugeVec(
			"error_rate",
			"Error rate per minute",
			append([]string{"error_type", "component"}, config.CommonLabels...),
		),

		AuthAttempts: collector.CounterVec(
			"auth_attempts_total",
			"Total number of authentication attempts",
			append([]string{"auth_type", "result"}, config.CommonLabels...),
		),
		AuthSuccesses: collector.CounterVec(
			"auth_successes_total",
			"Total number of successful authentications",
			append([]string{"auth_type"}, config.CommonLabels...),
		),
		AuthFailures: collector.CounterVec(
			"auth_failures_total",
			"Total number of failed authentications",
			append([]string{"auth_type", "failure_reason"}, config.CommonLabels...),
		),

		DocumentsTotal: collector.CounterVec(
			"documents_total",
			"Total number of documents processed",
			append([]string{"operation", "document_type"}, config.CommonLabels...),
		),
		DocumentSize: collector.HistogramVec(
			"document_size_bytes",
			"Document size in bytes",
			[]float64{1000, 10000, 100000, 1000000, 10000000, 100000000},
			append([]string{"document_type"}, config.CommonLabels...),
		),
		DocumentProcessingTime: collector.HistogramVec(
			"document_processing_duration_seconds",
			"Document processing duration in seconds",
			config.Buckets,
			append([]string{"document_type", "operation"}, config.CommonLabels...),
		),

		RAGQueriesTotal: collector.CounterVec(
			"rag_queries_total",
			"Total number of RAG queries",
			append([]string{"query_type", "result_type"}, config.CommonLabels...),
		),
		RAGQueryTime: collector.HistogramVec(
			"rag_query_duration_seconds",
			"RAG query duration in seconds",
			config.Buckets,
			append([]string{"query_type"}, config.CommonLabels...),
		),
		RAGRetrievedDocs: collector.HistogramVec(
			"rag_retrieved_documents_count",
			"Number of documents retrieved in RAG queries",
			[]float64{1, 5, 10, 25, 50, 100},
			append([]string{"query_type"}, config.CommonLabels...),
		),

		VectorSearchesTotal: collector.CounterVec(
			"vector_searches_total",
			"Total number of vector searches",
			append([]string{"search_type", "index_name"}, config.CommonLabels...),
		),
		VectorSearchTime: collector.HistogramVec(
			"vector_search_duration_seconds",
			"Vector search duration in seconds",
			config.Buckets,
			append([]string{"search_type", "index_name"}, config.CommonLabels...),
		),
		VectorIndexSize: collector.GaugeVec(
			"vector_index_size",
			"Size of vector index in number of vectors",
			append([]string{"index_name"}, config.CommonLabels...),
		),

		ActiveTenants: collector.GaugeVec(
			"active_tenants",
			"Number of active tenants",
			[]string{"tenant_type"},
		),
		TenantRequests: collector.CounterVec(
			"tenant_requests_total",
			"Total number of requests per tenant",
			append([]string{"tenant_id", "endpoint"}, config.CommonLabels...),
		),
		TenantStorage: collector.GaugeVec(
			"tenant_storage_bytes",
			"Storage usage per tenant in bytes",
			append([]string{"tenant_id", "storage_type"}, config.CommonLabels...),
		),

		CPUUsage: collector.GaugeVec(
			"cpu_usage_percent",
			"CPU usage percentage",
			append([]string{"core"}, config.CommonLabels...),
		),
		MemoryUsage: collector.GaugeVec(
			"memory_usage_bytes",
			"Memory usage in bytes",
			append([]string{"memory_type"}, config.CommonLabels...),
		),
		DiskUsage: collector.GaugeVec(
			"disk_usage_bytes",
			"Disk usage in bytes",
			append([]string{"mount_point"}, config.CommonLabels...),
		),
		NetworkIO: collector.CounterVec(
			"network_io_bytes_total",
			"Network I/O in bytes",
			append([]string{"direction", "interface"}, config.CommonLabels...),
		),
	}
}

// PrometheusClient provides a client for querying Prometheus
type PrometheusClient struct {
	api    v1.API
	client api.Client
}

// NewPrometheusClient creates a new Prometheus client
func NewPrometheusClient(address string) (*PrometheusClient, error) {
	client, err := api.NewClient(api.Config{
		Address: address,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create Prometheus client: %w", err)
	}

	return &PrometheusClient{
		api:    v1.NewAPI(client),
		client: client,
	}, nil
}

// Query executes a PromQL query
func (pc *PrometheusClient) Query(ctx context.Context, query string) (model.Value, error) {
	result, _, err := pc.api.Query(ctx, query, time.Now())
	if err != nil {
		return nil, fmt.Errorf("failed to execute query: %w", err)
	}
	return result, nil
}

// QueryRange executes a range query
func (pc *PrometheusClient) QueryRange(ctx context.Context, query string, r v1.Range) (model.Value, error) {
	result, _, err := pc.api.QueryRange(ctx, query, r)
	if err != nil {
		return nil, fmt.Errorf("failed to execute range query: %w", err)
	}
	return result, nil
}

// GetMetricValue gets the current value of a metric
func (pc *PrometheusClient) GetMetricValue(ctx context.Context, metricName string, labels map[string]string) (float64, error) {
	query := metricName
	if len(labels) > 0 {
		labelStr := ""
		for k, v := range labels {
			if labelStr != "" {
				labelStr += ","
			}
			labelStr += fmt.Sprintf(`%s="%s"`, k, v)
		}
		query = fmt.Sprintf("%s{%s}", metricName, labelStr)
	}

	result, err := pc.Query(ctx, query)
	if err != nil {
		return 0, err
	}

	switch result.Type() {
	case model.ValVector:
		vector := result.(model.Vector)
		if len(vector) > 0 {
			return float64(vector[0].Value), nil
		}
		return 0, fmt.Errorf("no data found for metric %s", query)
	default:
		return 0, fmt.Errorf("unexpected result type: %s", result.Type())
	}
}
