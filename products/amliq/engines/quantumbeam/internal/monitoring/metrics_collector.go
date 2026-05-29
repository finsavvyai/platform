//go:build legacy_migrated
// +build legacy_migrated

package monitoring

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"runtime"
	"sync"
	"time"

	"github.com/prometheus/client_golang/api"
	v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// MetricsCollector handles comprehensive metrics collection
type MetricsCollector struct {
	logger          *log.Logger
	registry        *prometheus.Registry
	httpRequests    *prometheus.CounterVec
	httpDuration    *prometheus.HistogramVec
	httpErrors      *prometheus.CounterVec
	quantumMetrics  *QuantumMetrics
	businessMetrics *BusinessMetrics
	systemMetrics   *SystemMetrics
	customMetrics   *prometheus.GaugeVec
	mu              sync.RWMutex
	config          MetricsConfig
}

// MetricsConfig holds metrics configuration
type MetricsConfig struct {
	Enabled        bool                `json:"enabled"`
	Port           int                 `json:"port"`
	Path           string              `json:"path"`
	Namespace      string              `json:"namespace"`
	Subsystem      string              `json:"subsystem"`
	Buckets        []float64           `json:"buckets"`
	Objectives     map[float64]float64 `json:"objectives"`
	ScrapeInterval time.Duration       `json:"scrape_interval"`
	ExportInterval time.Duration       `json:"export_interval"`
}

// QuantumMetrics tracks quantum processing metrics
type QuantumMetrics struct {
	ProcessingTime      *prometheus.HistogramVec
	ProcessingCount     *prometheus.CounterVec
	ProcessingErrors    *prometheus.CounterVec
	QueueSize           *prometheus.GaugeVec
	CircuitDepth        *prometheus.HistogramVec
	SuccessRate         *prometheus.GaugeVec
	HardwareUtilization *prometheus.GaugeVec
	FallbackRate        *prometheus.GaugeVec
}

// BusinessMetrics tracks business KPIs
type BusinessMetrics struct {
	TransactionVolume    *prometheus.CounterVec
	FraudDetectionRate   *prometheus.GaugeVec
	FalsePositiveRate    *prometheus.GaugeVec
	ProcessingCost       *prometheus.GaugeVec
	CustomerSatisfaction *prometheus.GaugeVec
	ResponseTime         *prometheus.HistogramVec
	BillingEvents        *prometheus.CounterVec
	APIKeyUsage          *prometheus.CounterVec
}

// SystemMetrics tracks system performance
type SystemMetrics struct {
	CPUUsage            *prometheus.GaugeVec
	MemoryUsage         *prometheus.GaugeVec
	DiskUsage           *prometheus.GaugeVec
	NetworkIO           *prometheus.CounterVec
	GoroutineCount      *prometheus.GaugeVec
	GCCollections       *prometheus.CounterVec
	DatabaseConnections *prometheus.GaugeVec
	CacheHitRate        *prometheus.GaugeVec
}

// MetricRecord represents a single metric record
type MetricRecord struct {
	Name        string            `json:"name"`
	Value       float64           `json:"value"`
	Labels      map[string]string `json:"labels"`
	Timestamp   time.Time         `json:"timestamp"`
	Type        MetricType        `json:"type"`
	Unit        string            `json:"unit"`
	Description string            `json:"description"`
}

// MetricType represents the type of metric
type MetricType string

const (
	MetricTypeCounter   MetricType = "counter"
	MetricTypeGauge     MetricType = "gauge"
	MetricTypeHistogram MetricType = "histogram"
	MetricTypeSummary   MetricType = "summary"
)

// NewMetricsCollector creates a new metrics collector
func NewMetricsCollector(config MetricsConfig) *MetricsCollector {
	registry := prometheus.NewRegistry()

	// Default buckets for histograms
	defaultBuckets := []float64{0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10}
	if len(config.Buckets) > 0 {
		defaultBuckets = config.Buckets
	}

	mc := &MetricsCollector{
		logger:    log.New(log.Writer(), "[METRICS] ", log.LstdFlags|log.Lmsgprefix),
		registry:  registry,
		config:    config,
		Namespace: config.Namespace,
		Subsystem: config.Subsystem,
	}

	// Initialize HTTP metrics
	mc.httpRequests = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: config.Namespace,
			Subsystem: config.Subsystem,
			Name:      "http_requests_total",
			Help:      "Total number of HTTP requests",
		},
		[]string{"method", "endpoint", "status", "api_key", "user_agent"},
	)

	mc.httpDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: config.Namespace,
			Subsystem: config.Subsystem,
			Name:      "http_request_duration_seconds",
			Help:      "HTTP request duration in seconds",
			Buckets:   defaultBuckets,
		},
		[]string{"method", "endpoint", "status", "api_key"},
	)

	mc.httpErrors = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: config.Namespace,
			Subsystem: config.Subsystem,
			Name:      "http_errors_total",
			Help:      "Total number of HTTP errors",
		},
		[]string{"method", "endpoint", "status", "error_type"},
	)

	// Initialize quantum metrics
	mc.quantumMetrics = &QuantumMetrics{
		ProcessingTime: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: config.Namespace,
				Subsystem: "quantum",
				Name:      "processing_duration_seconds",
				Help:      "Quantum processing duration in seconds",
				Buckets:   []float64{0.1, 0.5, 1, 2.5, 5, 10, 30, 60, 120, 300},
			},
			[]string{"algorithm", "backend", "qubits", "success"},
		),
		ProcessingCount: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: config.Namespace,
				Subsystem: "quantum",
				Name:      "processing_total",
				Help:      "Total number of quantum processing operations",
			},
			[]string{"algorithm", "backend", "success"},
		),
		ProcessingErrors: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: config.Namespace,
				Subsystem: "quantum",
				Name:      "processing_errors_total",
				Help:      "Total number of quantum processing errors",
			},
			[]string{"algorithm", "backend", "error_type"},
		),
		QueueSize: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Namespace: config.Namespace,
				Subsystem: "quantum",
				Name:      "queue_size",
				Help:      "Current quantum processing queue size",
			},
			[]string{"algorithm", "backend"},
		),
		CircuitDepth: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: config.Namespace,
				Subsystem: "quantum",
				Name:      "circuit_depth",
				Help:      "Quantum circuit depth",
				Buckets:   []float64{1, 5, 10, 25, 50, 100, 250, 500, 1000},
			},
			[]string{"algorithm", "backend"},
		),
		SuccessRate: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Namespace: config.Namespace,
				Subsystem: "quantum",
				Name:      "success_rate",
				Help:      "Quantum processing success rate",
			},
			[]string{"algorithm", "backend"},
		),
		HardwareUtilization: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Namespace: config.Namespace,
				Subsystem: "quantum",
				Name:      "hardware_utilization_percent",
				Help:      "Quantum hardware utilization percentage",
			},
			[]string{"backend", "resource_type"},
		),
		FallbackRate: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Namespace: config.Namespace,
				Subsystem: "quantum",
				Name:      "fallback_rate",
				Help:      "Rate of falling back to classical processing",
			},
			[]string{"algorithm", "reason"},
		),
	}

	// Initialize business metrics
	mc.businessMetrics = &BusinessMetrics{
		TransactionVolume: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: config.Namespace,
				Subsystem: "business",
				Name:      "transaction_volume_total",
				Help:      "Total transaction volume processed",
			},
			[]string{"customer", "region", "transaction_type"},
		),
		FraudDetectionRate: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Namespace: config.Namespace,
				Subsystem: "business",
				Name:      "fraud_detection_rate",
				Help:      "Fraud detection rate",
			},
			[]string{"customer", "model", "time_window"},
		),
		FalsePositiveRate: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Namespace: config.Namespace,
				Subsystem: "business",
				Name:      "false_positive_rate",
				Help:      "False positive rate",
			},
			[]string{"customer", "model", "time_window"},
		),
		ProcessingCost: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Namespace: config.Namespace,
				Subsystem: "business",
				Name:      "processing_cost_dollars",
				Help:      "Processing cost in dollars",
			},
			[]string{"customer", "processor_type", "currency"},
		),
		CustomerSatisfaction: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Namespace: config.Namespace,
				Subsystem: "business",
				Name:      "customer_satisfaction_score",
				Help:      "Customer satisfaction score",
			},
			[]string{"customer", "metric_type"},
		),
		ResponseTime: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: config.Namespace,
				Subsystem: "business",
				Name:      "response_time_seconds",
				Help:      "Business response time",
				Buckets:   defaultBuckets,
			},
			[]string{"customer", "operation", "processor_type"},
		),
		BillingEvents: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: config.Namespace,
				Subsystem: "business",
				Name:      "billing_events_total",
				Help:      "Total number of billing events",
			},
			[]string{"customer", "event_type", "tier"},
		),
		APIKeyUsage: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: config.Namespace,
				Subsystem: "business",
				Name:      "api_key_usage_total",
				Help:      "Total API key usage",
			},
			[]string{"customer", "api_key", "endpoint"},
		),
	}

	// Initialize system metrics
	mc.systemMetrics = &SystemMetrics{
		CPUUsage: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Namespace: config.Namespace,
				Subsystem: "system",
				Name:      "cpu_usage_percent",
				Help:      "CPU usage percentage",
			},
			[]string{"instance", "core"},
		),
		MemoryUsage: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Namespace: config.Namespace,
				Subsystem: "system",
				Name:      "memory_usage_bytes",
				Help:      "Memory usage in bytes",
			},
			[]string{"instance", "type"},
		),
		DiskUsage: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Namespace: config.Namespace,
				Subsystem: "system",
				Name:      "disk_usage_bytes",
				Help:      "Disk usage in bytes",
			},
			[]string{"instance", "mount_point"},
		),
		NetworkIO: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: config.Namespace,
				Subsystem: "system",
				Name:      "network_io_bytes_total",
				Help:      "Network I/O in bytes",
			},
			[]string{"instance", "interface", "direction"},
		),
		GoroutineCount: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Namespace: config.Namespace,
				Subsystem: "system",
				Name:      "goroutines",
				Help:      "Number of goroutines",
			},
			[]string{"instance"},
		),
		GCCollections: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: config.Namespace,
				Subsystem: "system",
				Name:      "gc_collections_total",
				Help:      "Total number of garbage collections",
			},
			[]string{"instance", "gc_type"},
		),
		DatabaseConnections: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Namespace: config.Namespace,
				Subsystem: "system",
				Name:      "database_connections",
				Help:      "Number of database connections",
			},
			[]string{"instance", "database"},
		),
		CacheHitRate: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Namespace: config.Namespace,
				Subsystem: "system",
				Name:      "cache_hit_rate",
				Help:      "Cache hit rate",
			},
			[]string{"instance", "cache_type"},
		),
	}

	// Initialize custom metrics
	mc.customMetrics = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Namespace: config.Namespace,
			Subsystem: config.Subsystem,
			Name:      "custom_metric",
			Help:      "Custom application metrics",
		},
		[]string{"metric_name", "instance"},
	)

	// Register all metrics
	mc.registerMetrics()

	// Start system metrics collection
	go mc.collectSystemMetrics(context.Background())

	return mc
}

// registerMetrics registers all metrics with the registry
func (mc *MetricsCollector) registerMetrics() {
	// HTTP metrics
	mc.registry.MustRegister(mc.httpRequests)
	mc.registry.MustRegister(mc.httpDuration)
	mc.registry.MustRegister(mc.httpErrors)

	// Quantum metrics
	mc.registry.MustRegister(mc.quantumMetrics.ProcessingTime)
	mc.registry.MustRegister(mc.quantumMetrics.ProcessingCount)
	mc.registry.MustRegister(mc.quantumMetrics.ProcessingErrors)
	mc.registry.MustRegister(mc.quantumMetrics.QueueSize)
	mc.registry.MustRegister(mc.quantumMetrics.CircuitDepth)
	mc.registry.MustRegister(mc.quantumMetrics.SuccessRate)
	mc.registry.MustRegister(mc.quantumMetrics.HardwareUtilization)
	mc.registry.MustRegister(mc.quantumMetrics.FallbackRate)

	// Business metrics
	mc.registry.MustRegister(mc.businessMetrics.TransactionVolume)
	mc.registry.MustRegister(mc.businessMetrics.FraudDetectionRate)
	mc.registry.MustRegister(mc.businessMetrics.FalsePositiveRate)
	mc.registry.MustRegister(mc.businessMetrics.ProcessingCost)
	mc.registry.MustRegister(mc.businessMetrics.CustomerSatisfaction)
	mc.registry.MustRegister(mc.businessMetrics.ResponseTime)
	mc.registry.MustRegister(mc.businessMetrics.BillingEvents)
	mc.registry.MustRegister(mc.businessMetrics.APIKeyUsage)

	// System metrics
	mc.registry.MustRegister(mc.systemMetrics.CPUUsage)
	mc.registry.MustRegister(mc.systemMetrics.MemoryUsage)
	mc.registry.MustRegister(mc.systemMetrics.DiskUsage)
	mc.registry.MustRegister(mc.systemMetrics.NetworkIO)
	mc.registry.MustRegister(mc.systemMetrics.GoroutineCount)
	mc.registry.MustRegister(mc.systemMetrics.GCCollections)
	mc.registry.MustRegister(mc.systemMetrics.DatabaseConnections)
	mc.registry.MustRegister(mc.systemMetrics.CacheHitRate)

	// Custom metrics
	mc.registry.MustRegister(mc.customMetrics)
}

// RecordHTTPRequest records an HTTP request
func (mc *MetricsCollector) RecordHTTPRequest(method, endpoint, status, apiKey, userAgent string) {
	mc.httpRequests.WithLabelValues(method, endpoint, status, apiKey, userAgent).Inc()
}

// RecordHTTPRequestDuration records HTTP request duration
func (mc *MetricsCollector) RecordHTTPRequestDuration(method, endpoint, status, apiKey string, duration time.Duration) {
	mc.httpDuration.WithLabelValues(method, endpoint, status, apiKey).Observe(duration.Seconds())
}

// RecordHTTPError records an HTTP error
func (mc *MetricsCollector) RecordHTTPError(method, endpoint, status, errorType string) {
	mc.httpErrors.WithLabelValues(method, endpoint, status, errorType).Inc()
}

// RecordQuantumProcessing records quantum processing metrics
func (mc *MetricsCollector) RecordQuantumProcessing(algorithm, backend string, qubits int, duration time.Duration, success bool, circuitDepth int) {
	labels := []string{algorithm, backend}
	if success {
		labels = append(labels, "true")
	} else {
		labels = append(labels, "false")
	}

	mc.quantumMetrics.ProcessingTime.WithLabelValues(labels...).Observe(duration.Seconds())
	mc.quantumMetrics.ProcessingCount.WithLabelValues(algorithm, backend, fmt.Sprintf("%t", success)).Inc()
	mc.quantumMetrics.CircuitDepth.WithLabelValues(algorithm, backend).Observe(float64(circuitDepth))
}

// RecordQuantumError records a quantum processing error
func (mc *MetricsCollector) RecordQuantumError(algorithm, backend, errorType string) {
	mc.quantumMetrics.ProcessingErrors.WithLabelValues(algorithm, backend, errorType).Inc()
}

// UpdateQuantumQueueSize updates the quantum processing queue size
func (mc *MetricsCollector) UpdateQuantumQueueSize(algorithm, backend string, size float64) {
	mc.quantumMetrics.QueueSize.WithLabelValues(algorithm, backend).Set(size)
}

// UpdateQuantumSuccessRate updates quantum processing success rate
func (mc *MetricsCollector) UpdateQuantumSuccessRate(algorithm, backend string, rate float64) {
	mc.quantumMetrics.SuccessRate.WithLabelValues(algorithm, backend).Set(rate)
}

// UpdateHardwareUtilization updates hardware utilization metrics
func (mc *MetricsCollector) UpdateHardwareUtilization(backend, resourceType string, utilization float64) {
	mc.quantumMetrics.HardwareUtilization.WithLabelValues(backend, resourceType).Set(utilization)
}

// UpdateFallbackRate updates fallback rate metrics
func (mc *MetricsCollector) UpdateFallbackRate(algorithm, reason string, rate float64) {
	mc.quantumMetrics.FallbackRate.WithLabelValues(algorithm, reason).Set(rate)
}

// RecordTransactionVolume records transaction volume
func (mc *MetricsCollector) RecordTransactionVolume(customer, region, transactionType string, amount float64) {
	mc.businessMetrics.TransactionVolume.WithLabelValues(customer, region, transactionType).Add(amount)
}

// UpdateFraudDetectionRate updates fraud detection rate
func (mc *MetricsCollector) UpdateFraudDetectionRate(customer, model, timeWindow string, rate float64) {
	mc.businessMetrics.FraudDetectionRate.WithLabelValues(customer, model, timeWindow).Set(rate)
}

// UpdateFalsePositiveRate updates false positive rate
func (mc *MetricsCollector) UpdateFalsePositiveRate(customer, model, timeWindow string, rate float64) {
	mc.businessMetrics.FalsePositiveRate.WithLabelValues(customer, model, timeWindow).Set(rate)
}

// UpdateProcessingCost updates processing cost
func (mc *MetricsCollector) UpdateProcessingCost(customer, processorType, currency string, cost float64) {
	mc.businessMetrics.ProcessingCost.WithLabelValues(customer, processorType, currency).Set(cost)
}

// UpdateCustomerSatisfaction updates customer satisfaction metrics
func (mc *MetricsCollector) UpdateCustomerSatisfaction(customer, metricType string, score float64) {
	mc.businessMetrics.CustomerSatisfaction.WithLabelValues(customer, metricType).Set(score)
}

// RecordBusinessResponseTime records business response time
func (mc *MetricsCollector) RecordBusinessResponseTime(customer, operation, processorType string, duration time.Duration) {
	mc.businessMetrics.ResponseTime.WithLabelValues(customer, operation, processorType).Observe(duration.Seconds())
}

// RecordBillingEvent records billing events
func (mc *MetricsCollector) RecordBillingEvent(customer, eventType, tier string) {
	mc.businessMetrics.BillingEvents.WithLabelValues(customer, eventType, tier).Inc()
}

// RecordAPIKeyUsage records API key usage
func (mc *MetricsCollector) RecordAPIKeyUsage(customer, apiKey, endpoint string) {
	mc.businessMetrics.APIKeyUsage.WithLabelValues(customer, apiKey, endpoint).Inc()
}

// SetCustomMetric sets a custom metric value
func (mc *MetricsCollector) SetCustomMetric(metricName, instance string, value float64) {
	mc.customMetrics.WithLabelValues(metricName, instance).Set(value)
}

// GetMetricHandler returns the HTTP handler for metrics
func (mc *MetricsCollector) GetMetricHandler() http.Handler {
	return promhttp.HandlerFor(mc.registry, promhttp.HandlerOpts{
		EnableOpenMetrics: true,
	})
}

// StartMetricsServer starts the metrics HTTP server
func (mc *MetricsCollector) StartMetricsServer() error {
	if !mc.config.Enabled {
		mc.logger.Println("Metrics collection is disabled")
		return nil
	}

	mux := http.NewServeMux()
	mux.Handle(mc.config.Path, mc.GetMetricHandler())

	server := &http.Server{
		Addr:         fmt.Sprintf(":%d", mc.config.Port),
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	mc.logger.Printf("Starting metrics server on port %d", mc.config.Port)
	return server.ListenAndServe()
}

// collectSystemMetrics collects system metrics periodically
func (mc *MetricsCollector) collectSystemMetrics(ctx context.Context) {
	ticker := time.NewTicker(mc.config.ScrapeInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			mc.updateSystemMetrics()
		}
	}
}

// updateSystemMetrics updates system metrics
func (mc *MetricsCollector) updateSystemMetrics() {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	// Update memory metrics
	instance := "default"
	mc.systemMetrics.MemoryUsage.WithLabelValues(instance, "heap").Set(float64(m.HeapInuse))
	mc.systemMetrics.MemoryUsage.WithLabelValues(instance, "stack").Set(float64(m.StackInuse))
	mc.systemMetrics.MemoryUsage.WithLabelValues(instance, "gc").Set(float64(m.GCSys))

	// Update goroutine count
	mc.systemMetrics.GoroutineCount.WithLabelValues(instance).Set(float64(runtime.NumGoroutine()))

	// Update GC metrics
	mc.systemMetrics.GCCollections.WithLabelValues(instance, "heap").Set(float64(m.NumGC))
	mc.systemMetrics.GCCollections.WithLabelValues(instance, "stack").Set(float64(m.NumGC))
}

// QueryPrometheus queries Prometheus for metrics
func (mc *MetricsCollector) QueryPrometheus(ctx context.Context, query string, timeRange time.Time) (interface{}, error) {
	if mc.config.PrometheusURL == "" {
		return nil, fmt.Errorf("Prometheus URL not configured")
	}

	client, err := api.NewClient(api.Config{
		Address: mc.config.PrometheusURL,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create Prometheus client: %w", err)
	}

	v1api := v1.NewAPI(client)
	result, _, err := v1api.Query(ctx, query, timeRange)
	if err != nil {
		return nil, fmt.Errorf("failed to query Prometheus: %w", err)
	}

	return result, nil
}

// GetMetricSummary returns a summary of all metrics
func (mc *MetricsCollector) GetMetricSummary() map[string]interface{} {
	mc.mu.RLock()
	defer mc.mu.RUnlock()

	summary := make(map[string]interface{})

	// Add HTTP metrics summary
	summary["http_requests"] = mc.httpRequests.Desc()
	summary["http_duration"] = mc.httpDuration.Desc()

	// Add quantum metrics summary
	summary["quantum_processing"] = mc.quantumMetrics.ProcessingTime.Desc()
	summary["quantum_queue_size"] = mc.quantumMetrics.QueueSize.Desc()

	// Add business metrics summary
	summary["transaction_volume"] = mc.businessMetrics.TransactionVolume.Desc()
	summary["fraud_detection_rate"] = mc.businessMetrics.FraudDetectionRate.Desc()

	// Add system metrics summary
	summary["system_memory"] = mc.systemMetrics.MemoryUsage.Desc()
	summary["system_goroutines"] = mc.systemMetrics.GoroutineCount.Desc()

	return summary
}

// ResetMetrics resets all metrics
func (mc *MetricsCollector) ResetMetrics() {
	mc.httpRequests.Reset()
	mc.httpDuration.Reset()
	mc.httpErrors.Reset()
	mc.quantumMetrics.ProcessingCount.Reset()
	mc.quantumMetrics.ProcessingErrors.Reset()
	mc.businessMetrics.TransactionVolume.Reset()
	mc.businessMetrics.BillingEvents.Reset()
	mc.businessMetrics.APIKeyUsage.Reset()
	mc.systemMetrics.GCCollections.Reset()
	mc.systemMetrics.NetworkIO.Reset()
}

// ExportMetrics exports metrics in various formats
func (mc *MetricsCollector) ExportMetrics(format string) ([]byte, error) {
	switch format {
	case "prometheus":
		handler := mc.GetMetricHandler()
		// This would need to be called in an HTTP context
		return nil, fmt.Errorf("prometheus format requires HTTP handler")
	case "json":
		summary := mc.GetMetricSummary()
		return json.Marshal(summary)
	default:
		return nil, fmt.Errorf("unsupported format: %s", format)
	}
}