package metrics

import (
	"net/http"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// Metrics holds all application metrics
type Metrics struct {
	// HTTP metrics
	httpRequestsTotal     *prometheus.CounterVec
	httpRequestDuration   *prometheus.HistogramVec
	httpRequestSize       *prometheus.HistogramVec
	httpResponseSize      *prometheus.HistogramVec
	httpConnectionsActive prometheus.Gauge

	// Database metrics
	dbConnectionsActive prometheus.Gauge
	dbConnectionsIdle   prometheus.Gauge
	dbQueryDuration     *prometheus.HistogramVec
	dbQueryTotal        *prometheus.CounterVec
	dbErrorsTotal       *prometheus.CounterVec

	// Business metrics
	usersTotal         prometheus.Gauge
	connectionsTotal   prometheus.Gauge
	queriesTotal       prometheus.CounterVec
	queryExecutionTime *prometheus.HistogramVec

	// AI service metrics
	aiRequestsTotal   *prometheus.CounterVec
	aiRequestDuration *prometheus.HistogramVec
	aiErrorsTotal     *prometheus.CounterVec
	aiTokensUsed      *prometheus.CounterVec

	// System metrics
	memoryUsage prometheus.Gauge
	goroutines  prometheus.Gauge
	gcDuration  prometheus.Histogram

	// Application specific
	alertsTotal        *prometheus.CounterVec
	subscriptionsTotal prometheus.Gauge
}

// New creates a new metrics instance
func New() *Metrics {
	return &Metrics{
		httpRequestsTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "http_requests_total",
				Help: "Total number of HTTP requests",
			},
			[]string{"method", "endpoint", "status_code"},
		),
		httpRequestDuration: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "http_request_duration_seconds",
				Help:    "HTTP request duration in seconds",
				Buckets: prometheus.DefBuckets,
			},
			[]string{"method", "endpoint"},
		),
		httpRequestSize: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "http_request_size_bytes",
				Help:    "HTTP request size in bytes",
				Buckets: []float64{100, 1000, 10000, 100000, 1000000},
			},
			[]string{"method", "endpoint"},
		),
		httpResponseSize: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "http_response_size_bytes",
				Help:    "HTTP response size in bytes",
				Buckets: []float64{100, 1000, 10000, 100000, 1000000},
			},
			[]string{"method", "endpoint"},
		),
		httpConnectionsActive: prometheus.NewGauge(
			prometheus.GaugeOpts{
				Name: "http_connections_active",
				Help: "Number of active HTTP connections",
			},
		),

		dbConnectionsActive: prometheus.NewGauge(
			prometheus.GaugeOpts{
				Name: "db_connections_active",
				Help: "Number of active database connections",
			},
		),
		dbConnectionsIdle: prometheus.NewGauge(
			prometheus.GaugeOpts{
				Name: "db_connections_idle",
				Help: "Number of idle database connections",
			},
		),
		dbQueryDuration: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "db_query_duration_seconds",
				Help:    "Database query duration in seconds",
				Buckets: prometheus.DefBuckets,
			},
			[]string{"database_type", "operation"},
		),
		dbQueryTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "db_queries_total",
				Help: "Total number of database queries",
			},
			[]string{"database_type", "operation", "status"},
		),
		dbErrorsTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "db_errors_total",
				Help: "Total number of database errors",
			},
			[]string{"database_type", "error_type"},
		),

		usersTotal: prometheus.NewGauge(
			prometheus.GaugeOpts{
				Name: "users_total",
				Help: "Total number of registered users",
			},
		),
		connectionsTotal: prometheus.NewGauge(
			prometheus.GaugeOpts{
				Name: "connections_total",
				Help: "Total number of database connections",
			},
		),
		queriesTotal: *prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "queries_total",
				Help: "Total number of queries executed",
			},
			[]string{"user_id", "database_type", "status"},
		),
		queryExecutionTime: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "query_execution_time_seconds",
				Help:    "Query execution time in seconds",
				Buckets: []float64{0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 30, 60},
			},
			[]string{"database_type", "query_type"},
		),

		aiRequestsTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "ai_requests_total",
				Help: "Total number of AI requests",
			},
			[]string{"provider", "model", "operation"},
		),
		aiRequestDuration: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "ai_request_duration_seconds",
				Help:    "AI request duration in seconds",
				Buckets: []float64{0.5, 1, 2, 5, 10, 20, 30, 60},
			},
			[]string{"provider", "model"},
		),
		aiErrorsTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "ai_errors_total",
				Help: "Total number of AI errors",
			},
			[]string{"provider", "error_type"},
		),
		aiTokensUsed: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "ai_tokens_used_total",
				Help: "Total number of AI tokens used",
			},
			[]string{"provider", "model", "type"}, // type: input, output
		),

		memoryUsage: prometheus.NewGauge(
			prometheus.GaugeOpts{
				Name: "memory_usage_bytes",
				Help: "Memory usage in bytes",
			},
		),
		goroutines: prometheus.NewGauge(
			prometheus.GaugeOpts{
				Name: "goroutines_total",
				Help: "Number of goroutines",
			},
		),
		gcDuration: prometheus.NewHistogram(
			prometheus.HistogramOpts{
				Name:    "gc_duration_seconds",
				Help:    "Garbage collection duration in seconds",
				Buckets: []float64{0.001, 0.01, 0.1, 1},
			},
		),

		alertsTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "alerts_total",
				Help: "Total number of alerts triggered",
			},
			[]string{"severity", "type"},
		),
		subscriptionsTotal: prometheus.NewGauge(
			prometheus.GaugeOpts{
				Name: "subscriptions_total",
				Help: "Total number of active subscriptions",
			},
		),
	}
}

// Register registers all metrics with the default registry
func (m *Metrics) Register() error {
	// HTTP metrics
	prometheus.MustRegister(m.httpRequestsTotal)
	prometheus.MustRegister(m.httpRequestDuration)
	prometheus.MustRegister(m.httpRequestSize)
	prometheus.MustRegister(m.httpResponseSize)
	prometheus.MustRegister(m.httpConnectionsActive)

	// Database metrics
	prometheus.MustRegister(m.dbConnectionsActive)
	prometheus.MustRegister(m.dbConnectionsIdle)
	prometheus.MustRegister(m.dbQueryDuration)
	prometheus.MustRegister(m.dbQueryTotal)
	prometheus.MustRegister(m.dbErrorsTotal)

	// Business metrics
	prometheus.MustRegister(m.usersTotal)
	prometheus.MustRegister(m.connectionsTotal)
	prometheus.MustRegister(m.queriesTotal)
	prometheus.MustRegister(m.queryExecutionTime)

	// AI metrics
	prometheus.MustRegister(m.aiRequestsTotal)
	prometheus.MustRegister(m.aiRequestDuration)
	prometheus.MustRegister(m.aiErrorsTotal)
	prometheus.MustRegister(m.aiTokensUsed)

	// System metrics
	prometheus.MustRegister(m.memoryUsage)
	prometheus.MustRegister(m.goroutines)
	prometheus.MustRegister(m.gcDuration)

	// Application metrics
	prometheus.MustRegister(m.alertsTotal)
	prometheus.MustRegister(m.subscriptionsTotal)

	return nil
}

// Unregister unregisters all metrics
func (m *Metrics) Unregister() {
	// HTTP metrics
	prometheus.Unregister(m.httpRequestsTotal)
	prometheus.Unregister(m.httpRequestDuration)
	prometheus.Unregister(m.httpRequestSize)
	prometheus.Unregister(m.httpResponseSize)
	prometheus.Unregister(m.httpConnectionsActive)

	// Database metrics
	prometheus.Unregister(m.dbConnectionsActive)
	prometheus.Unregister(m.dbConnectionsIdle)
	prometheus.Unregister(m.dbQueryDuration)
	prometheus.Unregister(m.dbQueryTotal)
	prometheus.Unregister(m.dbErrorsTotal)

	// Business metrics
	prometheus.Unregister(m.usersTotal)
	prometheus.Unregister(m.connectionsTotal)
	prometheus.Unregister(m.queriesTotal)
	prometheus.Unregister(m.queryExecutionTime)

	// AI metrics
	prometheus.Unregister(m.aiRequestsTotal)
	prometheus.Unregister(m.aiRequestDuration)
	prometheus.Unregister(m.aiErrorsTotal)
	prometheus.Unregister(m.aiTokensUsed)

	// System metrics
	prometheus.Unregister(m.memoryUsage)
	prometheus.Unregister(m.goroutines)
	prometheus.Unregister(m.gcDuration)

	// Application metrics
	prometheus.Unregister(m.alertsTotal)
	prometheus.Unregister(m.subscriptionsTotal)
}

// Handler returns the Prometheus HTTP handler
func (m *Metrics) Handler() http.Handler {
	return promhttp.Handler()
}

// HTTP metric methods
func (m *Metrics) RecordHTTPRequest(method, endpoint, statusCode string, duration time.Duration, requestSize, responseSize int64) {
	m.httpRequestsTotal.WithLabelValues(method, endpoint, statusCode).Inc()
	m.httpRequestDuration.WithLabelValues(method, endpoint).Observe(duration.Seconds())

	if requestSize > 0 {
		m.httpRequestSize.WithLabelValues(method, endpoint).Observe(float64(requestSize))
	}
	if responseSize > 0 {
		m.httpResponseSize.WithLabelValues(method, endpoint).Observe(float64(responseSize))
	}
}

func (m *Metrics) IncrementActiveConnections() {
	m.httpConnectionsActive.Inc()
}

func (m *Metrics) DecrementActiveConnections() {
	m.httpConnectionsActive.Dec()
}

// Database metric methods
func (m *Metrics) SetDBConnections(active, idle int) {
	m.dbConnectionsActive.Set(float64(active))
	m.dbConnectionsIdle.Set(float64(idle))
}

func (m *Metrics) RecordDBQuery(dbType, operation, status string, duration time.Duration) {
	m.dbQueryTotal.WithLabelValues(dbType, operation, status).Inc()
	m.dbQueryDuration.WithLabelValues(dbType, operation).Observe(duration.Seconds())
}

func (m *Metrics) RecordDBError(dbType, errorType string) {
	m.dbErrorsTotal.WithLabelValues(dbType, errorType).Inc()
}

// Business metric methods
func (m *Metrics) SetUsersTotal(count int) {
	m.usersTotal.Set(float64(count))
}

func (m *Metrics) SetConnectionsTotal(count int) {
	m.connectionsTotal.Set(float64(count))
}

func (m *Metrics) RecordQuery(userID, dbType, status string, duration time.Duration) {
	m.queriesTotal.WithLabelValues(userID, dbType, status).Inc()
	m.queryExecutionTime.WithLabelValues(dbType, "query").Observe(duration.Seconds())
}

// AI metric methods
func (m *Metrics) RecordAIRequest(provider, model, operation string, duration time.Duration) {
	m.aiRequestsTotal.WithLabelValues(provider, model, operation).Inc()
	m.aiRequestDuration.WithLabelValues(provider, model).Observe(duration.Seconds())
}

func (m *Metrics) RecordAIError(provider, errorType string) {
	m.aiErrorsTotal.WithLabelValues(provider, errorType).Inc()
}

func (m *Metrics) RecordAITokens(provider, model, tokenType string, count int) {
	m.aiTokensUsed.WithLabelValues(provider, model, tokenType).Add(float64(count))
}

// System metric methods
func (m *Metrics) SetMemoryUsage(bytes int64) {
	m.memoryUsage.Set(float64(bytes))
}

func (m *Metrics) SetGoroutines(count int) {
	m.goroutines.Set(float64(count))
}

func (m *Metrics) RecordGCDuration(duration time.Duration) {
	m.gcDuration.Observe(duration.Seconds())
}

// Application metric methods
func (m *Metrics) RecordAlert(severity, alertType string) {
	m.alertsTotal.WithLabelValues(severity, alertType).Inc()
}

func (m *Metrics) SetSubscriptionsTotal(count int) {
	m.subscriptionsTotal.Set(float64(count))
}

// Global metrics instance
var globalMetrics *Metrics

// InitGlobal initializes the global metrics
func InitGlobal() error {
	metrics := New()
	if err := metrics.Register(); err != nil {
		return err
	}
	globalMetrics = metrics
	return nil
}

// GetGlobal returns the global metrics
func GetGlobal() *Metrics {
	if globalMetrics == nil {
		InitGlobal()
	}
	return globalMetrics
}
