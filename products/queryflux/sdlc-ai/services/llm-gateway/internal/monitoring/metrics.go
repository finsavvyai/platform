//go:build ignore

package monitoring

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/SDLC/llm-gateway/internal/config"
	"github.com/prometheus/client_golang/api"
	v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/prometheus/common/model"
	"github.com/sirupsen/logrus"
)

// Metrics provides metrics collection for the LLM Gateway
type Metrics struct {
	registry *prometheus.Registry

	// Request metrics
	requestsTotal   *prometheus.CounterVec
	requestDuration *prometheus.HistogramVec

	// Provider metrics
	providerRequests *prometheus.CounterVec
	providerErrors   *prometheus.CounterVec
	providerLatency  *prometheus.HistogramVec

	// Token metrics
	tokensTotal *prometheus.CounterVec
	tokensCost  *prometheus.CounterVec

	// System metrics
	activeConnections prometheus.Gauge
	queueSize         prometheus.Gauge

	// Budget metrics
	budgetUsage  *prometheus.GaugeVec
	budgetAlerts *prometheus.CounterVec

	logger *logrus.Logger
}

// NewMetrics creates a new metrics instance
func NewMetrics() *Metrics {
	m := &Metrics{
		registry: prometheus.NewRegistry(),
		logger:   logrus.New(),
	}

	m.initMetrics()

	// Register default metrics
	m.registry.MustRegister(prometheus.NewGoCollector())
	m.registry.MustRegister(prometheus.NewProcessCollector(prometheus.ProcessCollectorOpts{}))

	return m
}

// initMetrics initializes all metrics
func (m *Metrics) initMetrics() {
	// Request metrics
	m.requestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "llm_gateway_requests_total",
			Help: "Total number of requests processed by the LLM Gateway",
		},
		[]string{"method", "endpoint", "status", "tenant_id", "user_id"},
	)

	m.requestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "llm_gateway_request_duration_seconds",
			Help:    "Request duration in seconds",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "endpoint", "provider", "model"},
	)

	// Provider metrics
	m.providerRequests = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "llm_gateway_provider_requests_total",
			Help: "Total number of requests to each provider",
		},
		[]string{"provider", "model", "status"},
	)

	m.providerErrors = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "llm_gateway_provider_errors_total",
			Help: "Total number of errors from each provider",
		},
		[]string{"provider", "error_type"},
	)

	m.providerLatency = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "llm_gateway_provider_latency_seconds",
			Help:    "Latency of requests to providers",
			Buckets: []float64{0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60},
		},
		[]string{"provider", "model"},
	)

	// Token metrics
	m.tokensTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "llm_gateway_tokens_total",
			Help: "Total number of tokens processed",
		},
		[]string{"provider", "model", "type"}, // type: prompt, completion, total
	)

	m.tokensCost = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "llm_gateway_tokens_cost_dollars",
			Help: "Total cost of tokens in USD",
		},
		[]string{"provider", "model", "tenant_id"},
	)

	// System metrics
	m.activeConnections = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "llm_gateway_active_connections",
			Help: "Number of active connections",
		},
	)

	m.queueSize = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "llm_gateway_queue_size",
			Help: "Number of requests in queue",
		},
	)

	// Budget metrics
	m.budgetUsage = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "llm_gateway_budget_usage_dollars",
			Help: "Current budget usage in USD",
		},
		[]string{"tenant_id", "period"},
	)

	m.budgetAlerts = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "llm_gateway_budget_alerts_total",
			Help: "Total number of budget alerts",
		},
		[]string{"tenant_id", "alert_type", "threshold"},
	)

	// Register metrics
	m.registry.MustRegister(
		m.requestsTotal,
		m.requestDuration,
		m.providerRequests,
		m.providerErrors,
		m.providerLatency,
		m.tokensTotal,
		m.tokensCost,
		m.activeConnections,
		m.queueSize,
		m.budgetUsage,
		m.budgetAlerts,
	)
}

// RecordRequest records a request metric
func (m *Metrics) RecordRequest(method, endpoint, status, tenantID, userID string, duration time.Duration) {
	m.requestsTotal.WithLabelValues(method, endpoint, status, tenantID, userID).Inc()
	m.requestDuration.WithLabelValues(method, endpoint, "", "").Observe(duration.Seconds())
}

// RecordProviderRequest records a provider request
func (m *Metrics) RecordProviderRequest(provider, model, status string, duration time.Duration) {
	m.providerRequests.WithLabelValues(provider, model, status).Inc()
	m.providerLatency.WithLabelValues(provider, model).Observe(duration.Seconds())
}

// IncCounter increments a counter metric
func (m *Metrics) IncCounter(name string) {
	switch name {
	case "llm.errors.validation":
		m.providerErrors.WithLabelValues("gateway", "validation").Inc()
	case "llm.errors.all_providers_failed":
		m.providerErrors.WithLabelValues("gateway", "all_providers_failed").Inc()
	default:
		// Try to parse as provider error
		m.providerErrors.WithLabelValues(name, "unknown").Inc()
	}
}

// RecordTokens records token usage
func (m *Metrics) RecordTokens(provider, model string, promptTokens, completionTokens int) {
	m.tokensTotal.WithLabelValues(provider, model, "prompt").Add(float64(promptTokens))
	m.tokensTotal.WithLabelValues(provider, model, "completion").Add(float64(completionTokens))
	m.tokensTotal.WithLabelValues(provider, model, "total").Add(float64(promptTokens + completionTokens))
}

// RecordCost records cost in USD
func (m *Metrics) RecordCost(provider, model, tenantID string, cost float64) {
	m.tokensCost.WithLabelValues(provider, model, tenantID).Add(cost)
}

// UpdateActiveConnections updates the active connections gauge
func (m *Metrics) UpdateActiveConnections(count float64) {
	m.activeConnections.Set(count)
}

// UpdateQueueSize updates the queue size gauge
func (m *Metrics) UpdateQueueSize(size float64) {
	m.queueSize.Set(size)
}

// UpdateBudgetUsage updates the budget usage gauge
func (m *Metrics) UpdateBudgetUsage(tenantID, period string, usage float64) {
	m.budgetUsage.WithLabelValues(tenantID, period).Set(usage)
}

// RecordBudgetAlert records a budget alert
func (m *Metrics) RecordBudgetAlert(tenantID, alertType string, threshold float64) {
	m.budgetAlerts.WithLabelValues(tenantID, alertType, fmt.Sprintf("%.0f", threshold)).Inc()
}

// RecordLatency records latency for a specific operation
func (m *Metrics) RecordLatency(operation string, duration time.Duration) {
	if strings.HasPrefix(operation, "llm.") {
		m.requestDuration.WithLabelValues("", "", "", "").Observe(duration.Seconds())
	}
}

// GetHandler returns the Prometheus metrics handler
func (m *Metrics) GetHandler() http.Handler {
	return promhttp.HandlerFor(m.registry, promhttp.HandlerOpts{})
}

// GetRegistry returns the Prometheus registry
func (m *Metrics) GetRegistry() *prometheus.Registry {
	return m.registry
}

// PrometheusQuery wraps Prometheus querying functionality
type PrometheusQuery struct {
	client v1.API
}

// NewPrometheusQuery creates a new Prometheus query client
func NewPrometheusQuery(address string) (*PrometheusQuery, error) {
	client, err := api.NewClient(api.Config{
		Address: address,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create Prometheus client: %w", err)
	}

	return &PrometheusQuery{
		client: v1.NewAPI(client),
	}, nil
}

// QueryCostByTenant queries cost metrics by tenant
func (p *PrometheusQuery) QueryCostByTenant(ctx context.Context, tenantID string, timeRange time.Duration) (float64, error) {
	query := fmt.Sprintf(
		`sum(increase(llm_gateway_tokens_cost_dollars{tenant_id="%s"}[%s]))`,
		tenantID,
		timeRange.String(),
	)

	result, _, err := p.client.Query(ctx, query, time.Now())
	if err != nil {
		return 0, fmt.Errorf("failed to query Prometheus: %w", err)
	}

	if result.Type() == model.ValVector {
		vector := result.(model.Vector)
		if len(vector) > 0 {
			return float64(vector[0].Value), nil
		}
	}

	return 0, nil
}

// QueryErrorRate queries error rate for a provider
func (p *PrometheusQuery) QueryErrorRate(ctx context.Context, provider string, timeRange time.Duration) (float64, error) {
	query := fmt.Sprintf(
		`rate(llm_gateway_provider_errors_total{provider="%s"}[%s]) / rate(llm_gateway_provider_requests_total{provider="%s"}[%s]) * 100`,
		provider,
		timeRange.String(),
		provider,
		timeRange.String(),
	)

	result, _, err := p.client.Query(ctx, query, time.Now())
	if err != nil {
		return 0, fmt.Errorf("failed to query Prometheus: %w", err)
	}

	if result.Type() == model.ValVector {
		vector := result.(model.Vector)
		if len(vector) > 0 {
			return float64(vector[0].Value), nil
		}
	}

	return 0, nil
}

// Init initializes monitoring with the given configuration
func Init(cfg *config.Config) error {
	// Initialize metrics
	metrics := NewMetrics()

	// Store metrics instance globally if needed
	// This could be replaced with dependency injection

	// Log monitoring initialization
	if cfg.Monitoring.Prometheus.Enabled {
		logrus.WithFields(logrus.Fields{
			"port": cfg.Monitoring.Prometheus.Port,
			"path": cfg.Monitoring.Prometheus.Path,
		}).Info("Prometheus metrics enabled")
	}

	if cfg.Monitoring.Jaeger.Enabled {
		logrus.WithFields(logrus.Fields{
			"endpoint": cfg.Monitoring.Jaeger.Endpoint,
			"service":  cfg.Monitoring.Jaeger.ServiceName,
		}).Info("Jaeger tracing enabled")
	}

	return nil
}
