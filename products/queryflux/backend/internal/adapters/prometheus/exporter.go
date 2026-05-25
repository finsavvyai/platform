package prometheus

import (
	"context"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/queryflux/backend/internal/domain"
	"go.uber.org/zap"
)

// PrometheusExporter implements actual Prometheus metrics export
type PrometheusExporter struct {
	logger     *zap.Logger
	registry   *prometheus.Registry
	server     *http.Server
	mu         sync.RWMutex
	metrics    map[string]prometheus.Metric
	gauges     map[string]prometheus.Gauge
	counters   map[string]prometheus.Counter
	histograms map[string]prometheus.Histogram
	summaries  map[string]prometheus.Summary
	enabled    bool
	endpoint   string
}

// Config for Prometheus exporter
type Config struct {
	Enabled       bool                  `json:"enabled"`
	ListenAddress string                `json:"listen_address"`
	Port          int                   `json:"port"`
	Endpoint      string                `json:"endpoint"`
	Namespace     string                `json:"namespace"`
	Subsystem     string                `json:"subsystem"`
	Registry      prometheus.Registerer `json:"-"`
}

// NewPrometheusExporter creates a new Prometheus exporter
func NewPrometheusExporter(logger *zap.Logger, config Config) *PrometheusExporter {
	if config.Registry == nil {
		config.Registry = prometheus.NewRegistry()
	}

	exporter := &PrometheusExporter{
		logger:     logger,
		registry:   config.Registry.(*prometheus.Registry),
		metrics:    make(map[string]prometheus.Metric),
		gauges:     make(map[string]prometheus.Gauge),
		counters:   make(map[string]prometheus.Counter),
		histograms: make(map[string]prometheus.Histogram),
		summaries:  make(map[string]prometheus.Summary),
		enabled:    config.Enabled,
		endpoint:   config.Endpoint,
	}

	if config.Enabled {
		exporter.startServer(config)
	}

	return exporter
}

// RegisterMetric registers a metric for export
func (e *PrometheusExporter) RegisterMetric(ctx context.Context, metric *domain.Metric) error {
	if !e.enabled {
		return nil
	}

	e.mu.Lock()
	defer e.mu.Unlock()

	switch metric.Type {
	case domain.MetricTypeGauge:
		return e.registerGauge(metric)
	case domain.MetricTypeCounter:
		return e.registerCounter(metric)
	case domain.MetricTypeHistogram:
		return e.registerHistogram(metric)
	case domain.MetricTypeSummary:
		return e.registerSummary(metric)
	default:
		return fmt.Errorf("unsupported metric type: %s", metric.Type)
	}
}

// UnregisterMetric unregisters a metric
func (e *PrometheusExporter) UnregisterMetric(ctx context.Context, name string) error {
	if !e.enabled {
		return nil
	}

	e.mu.Lock()
	defer e.mu.Unlock()

	if gauge, exists := e.gauges[name]; exists {
		e.registry.Unregister(gauge)
		delete(e.gauges, name)
	}

	if counter, exists := e.counters[name]; exists {
		e.registry.Unregister(counter)
		delete(e.counters, name)
	}

	if histogram, exists := e.histograms[name]; exists {
		e.registry.Unregister(histogram)
		delete(e.histograms, name)
	}

	if summary, exists := e.summaries[name]; exists {
		e.registry.Unregister(summary)
		delete(e.summaries, name)
	}

	return nil
}

// ExportMetrics exports all metrics in Prometheus format
func (e *PrometheusExporter) ExportMetrics(ctx context.Context) (string, error) {
	if !e.enabled {
		return "", fmt.Errorf("Prometheus exporter is disabled")
	}

	metricFamilies, err := e.registry.Gather()
	if err != nil {
		return "", fmt.Errorf("failed to gather metrics: %w", err)
	}

	// This is a simplified version - in practice you'd use the Prometheus text formatter
	var output string
	for _, family := range metricFamilies {
		output += fmt.Sprintf("# HELP %s %s\n", *family.Name, *family.Help)
		output += fmt.Sprintf("# TYPE %s %s\n", *family.Name, family.GetType().String())

		for _, metric := range family.Metric {
			output += fmt.Sprintf("%s", *family.Name)

			if len(metric.Label) > 0 {
				output += "{"
				for i, label := range metric.Label {
					if i > 0 {
						output += ","
					}
					output += fmt.Sprintf("%s=\"%s\"", *label.Name, *label.Value)
				}
				output += "}"
			}

			if metric.Gauge != nil {
				output += fmt.Sprintf(" %f\n", *metric.Gauge.Value)
			} else if metric.Counter != nil {
				output += fmt.Sprintf(" %f\n", *metric.Counter.Value)
			} else if metric.Histogram != nil {
				output += fmt.Sprintf(" %f\n", *metric.Histogram.SampleSum)
			} else if metric.Summary != nil {
				output += fmt.Sprintf(" %f\n", *metric.Summary.SampleSum)
			}
		}
	}

	return output, nil
}

// GetMetricsEndpoint returns the metrics endpoint URL
func (e *PrometheusExporter) GetMetricsEndpoint(ctx context.Context) (string, error) {
	if !e.enabled {
		return "", fmt.Errorf("Prometheus exporter is disabled")
	}
	return e.endpoint, nil
}

// EnableScraping enables the metrics scraping endpoint
func (e *PrometheusExporter) EnableScraping(ctx context.Context, path string) error {
	if !e.enabled {
		return fmt.Errorf("Prometheus exporter is disabled")
	}

	e.mu.Lock()
	e.endpoint = path
	e.mu.Unlock()

	e.logger.Info("Prometheus scraping enabled", zap.String("path", path))
	return nil
}

// DisableScraping disables the metrics scraping endpoint
func (e *PrometheusExporter) DisableScraping(ctx context.Context) error {
	e.mu.Lock()
	e.endpoint = ""
	e.mu.Unlock()

	e.logger.Info("Prometheus scraping disabled")
	return nil
}

// Stop stops the Prometheus exporter
func (e *PrometheusExporter) Stop(ctx context.Context) error {
	if e.server != nil {
		shutdownCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
		defer cancel()

		if err := e.server.Shutdown(shutdownCtx); err != nil {
			return fmt.Errorf("failed to shutdown Prometheus server: %w", err)
		}

		e.logger.Info("Prometheus exporter stopped")
	}
	return nil
}

// Private helper methods

func (e *PrometheusExporter) startServer(config Config) {
	mux := http.NewServeMux()
	mux.Handle(config.Endpoint, promhttp.HandlerFor(e.registry, promhttp.HandlerOpts{
		EnableOpenMetrics: true,
	}))

	e.server = &http.Server{
		Addr:    fmt.Sprintf("%s:%d", config.ListenAddress, config.Port),
		Handler: mux,
	}

	go func() {
		if err := e.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			e.logger.Error("Prometheus server failed", zap.Error(err))
		}
	}()

	e.logger.Info("Prometheus exporter started",
		zap.String("address", config.ListenAddress),
		zap.Int("port", config.Port),
		zap.String("endpoint", config.Endpoint))
}

func (e *PrometheusExporter) registerGauge(metric *domain.Metric) error {
	if gauge, exists := e.gauges[metric.Name]; exists {
		gauge.Set(metric.Value)
		return nil
	}

	opts := prometheus.GaugeOpts{
		Name:        e.sanitizeMetricName(metric.Name),
		Help:        metric.Description,
		ConstLabels: e.labelsToPrometheusLabels(metric.Labels),
	}

	gauge := prometheus.NewGauge(opts)
	if err := e.registry.Register(gauge); err != nil {
		return fmt.Errorf("failed to register gauge: %w", err)
	}

	gauge.Set(metric.Value)
	e.gauges[metric.Name] = gauge
	return nil
}

func (e *PrometheusExporter) registerCounter(metric *domain.Metric) error {
	if counter, exists := e.counters[metric.Name]; exists {
		counter.Add(metric.Value)
		return nil
	}

	opts := prometheus.CounterOpts{
		Name:        e.sanitizeMetricName(metric.Name),
		Help:        metric.Description,
		ConstLabels: e.labelsToPrometheusLabels(metric.Labels),
	}

	counter := prometheus.NewCounter(opts)
	if err := e.registry.Register(counter); err != nil {
		return fmt.Errorf("failed to register counter: %w", err)
	}

	counter.Add(metric.Value)
	e.counters[metric.Name] = counter
	return nil
}

func (e *PrometheusExporter) registerHistogram(metric *domain.Metric) error {
	if histogram, exists := e.histograms[metric.Name]; exists {
		histogram.Observe(metric.Value)
		return nil
	}

	opts := prometheus.HistogramOpts{
		Name:        e.sanitizeMetricName(metric.Name),
		Help:        metric.Description,
		ConstLabels: e.labelsToPrometheusLabels(metric.Labels),
		Buckets:     []float64{0.1, 0.5, 1.0, 2.5, 5.0, 10.0},
	}

	histogram := prometheus.NewHistogram(opts)
	if err := e.registry.Register(histogram); err != nil {
		return fmt.Errorf("failed to register histogram: %w", err)
	}

	histogram.Observe(metric.Value)
	e.histograms[metric.Name] = histogram
	return nil
}

func (e *PrometheusExporter) registerSummary(metric *domain.Metric) error {
	if summary, exists := e.summaries[metric.Name]; exists {
		summary.Observe(metric.Value)
		return nil
	}

	opts := prometheus.SummaryOpts{
		Name:        e.sanitizeMetricName(metric.Name),
		Help:        metric.Description,
		ConstLabels: e.labelsToPrometheusLabels(metric.Labels),
		Objectives:  map[float64]float64{0.5: 0.05, 0.9: 0.01, 0.99: 0.001},
	}

	summary := prometheus.NewSummary(opts)
	if err := e.registry.Register(summary); err != nil {
		return fmt.Errorf("failed to register summary: %w", err)
	}

	summary.Observe(metric.Value)
	e.summaries[metric.Name] = summary
	return nil
}

func (e *PrometheusExporter) sanitizeMetricName(name string) string {
	// Prometheus metric names must match the regex: ^[a-zA-Z_:][a-zA-Z0-9_:]*$
	// Replace invalid characters with underscores
	result := ""
	for _, char := range name {
		if (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || char == '_' || char == ':' ||
			(char >= '0' && char <= '9') {
			result += string(char)
		} else {
			result += "_"
		}
	}

	// Ensure the name starts with a letter or underscore
	if len(result) > 0 && ((result[0] >= '0' && result[0] <= '9') || result[0] == ':') {
		result = "_" + result
	}

	return result
}

func (e *PrometheusExporter) labelsToPrometheusLabels(labels map[string]string) prometheus.Labels {
	if labels == nil {
		return prometheus.Labels{}
	}

	result := make(prometheus.Labels)
	for k, v := range labels {
		result[e.sanitizeLabelName(k)] = v
	}
	return result
}

func (e *PrometheusExporter) sanitizeLabelName(name string) string {
	// Prometheus label names must match the regex: ^[a-zA-Z_][a-zA-Z0-9_]*$
	result := ""
	for _, char := range name {
		if (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || char == '_' ||
			(char >= '0' && char <= '9') {
			result += string(char)
		} else {
			result += "_"
		}
	}

	// Ensure the name starts with a letter or underscore
	if len(result) > 0 && result[0] >= '0' && result[0] <= '9' {
		result = "_" + result
	}

	return result
}
