package monitoring

import (
	"github.com/prometheus/client_golang/prometheus"
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
