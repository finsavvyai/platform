package metrics

import (
	"context"
	"net/http"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// MetricsCollector holds all Prometheus metrics for the fraud detection system
type MetricsCollector struct {
	// HTTP metrics
	httpRequestsTotal    *prometheus.CounterVec
	httpRequestDuration  *prometheus.HistogramVec
	httpRequestSize      *prometheus.HistogramVec
	httpResponseSize     *prometheus.HistogramVec

	// Fraud detection metrics
	fraudDetectionsTotal       *prometheus.CounterVec
	fraudDetectionDuration     *prometheus.HistogramVec
	quantumProcessingTotal     *prometheus.CounterVec
	classicalProcessingTotal   *prometheus.CounterVec
	quantumAdvantageScore      *prometheus.GaugeVec
	accuracyScore              *prometheus.GaugeVec
	falsePositiveRate          *prometheus.GaugeVec
	falseNegativeRate          *prometheus.GaugeVec

	// Quantum system metrics
	quantumCircuitExecutions   *prometheus.CounterVec
	quantumCircuitDuration     *prometheus.HistogramVec
	quantumBackendAvailability *prometheus.GaugeVec
	quantumQueueTime           *prometheus.HistogramVec
	quantumNoiseLevel          *prometheus.GaugeVec

	// Business metrics
	activeUsers              *prometheus.GaugeVec
	apiKeysIssued            *prometheus.CounterVec
	subscriptionsActive      *prometheus.GaugeVec
	revenueMonthly           *prometheus.GaugeVec
	transactionsProcessed    *prometheus.CounterVec

	// System metrics
	cpuUsage                 *prometheus.GaugeVec
	memoryUsage              *prometheus.GaugeVec
	databaseConnections      *prometheus.GaugeVec
	redisConnections         *prometheus.GaugeVec
	messageQueueSize         *prometheus.GaugeVec

	// Security metrics
	loginAttemptsTotal       *prometheus.CounterVec
	failedAuthAttemptsTotal  *prometheus.CounterVec
	rateLimitViolationsTotal *prometheus.CounterVec
	securityAlertsTotal      *prometheus.CounterVec
}

// NewMetricsCollector creates a new metrics collector with all Prometheus metrics
func NewMetricsCollector() *MetricsCollector {
	return &MetricsCollector{
		// HTTP metrics
		httpRequestsTotal: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "http_requests_total",
				Help: "Total number of HTTP requests",
			},
			[]string{"method", "endpoint", "status_code", "user_id"},
		),

		httpRequestDuration: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "http_request_duration_seconds",
				Help:    "HTTP request duration in seconds",
				Buckets: prometheus.DefBuckets,
			},
			[]string{"method", "endpoint", "status_code"},
		),

		httpRequestSize: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "http_request_size_bytes",
				Help:    "HTTP request size in bytes",
				Buckets: []float64{100, 1000, 10000, 100000, 1000000},
			},
			[]string{"method", "endpoint"},
		),

		httpResponseSize: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "http_response_size_bytes",
				Help:    "HTTP response size in bytes",
				Buckets: []float64{100, 1000, 10000, 100000, 1000000},
			},
			[]string{"method", "endpoint"},
		),

		// Fraud detection metrics
		fraudDetectionsTotal: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "fraud_detections_total",
				Help: "Total number of fraud detections",
			},
			[]string{"user_id", "transaction_type", "processing_method", "result"},
		),

		fraudDetectionDuration: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "fraud_detection_duration_seconds",
				Help:    "Fraud detection processing duration in seconds",
				Buckets: []float64{0.001, 0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0},
			},
			[]string{"processing_method", "user_id"},
		),

		quantumProcessingTotal: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "quantum_processing_total",
				Help: "Total number of quantum processing requests",
			},
			[]string{"backend", "algorithm", "user_id"},
		),

		classicalProcessingTotal: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "classical_processing_total",
				Help: "Total number of classical processing requests",
			},
			[]string{"algorithm", "user_id"},
		),

		quantumAdvantageScore: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "quantum_advantage_score",
				Help: "Quantum advantage score (0-1, higher is better)",
			},
			[]string{"algorithm", "backend"},
		),

		accuracyScore: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "accuracy_score",
				Help: "Fraud detection accuracy score (0-1)",
			},
			[]string{"processing_method", "algorithm"},
		),

		falsePositiveRate: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "false_positive_rate",
				Help: "False positive rate (0-1)",
			},
			[]string{"processing_method", "algorithm"},
		),

		falseNegativeRate: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "false_negative_rate",
				Help: "False negative rate (0-1)",
			},
			[]string{"processing_method", "algorithm"},
		),

		// Quantum system metrics
		quantumCircuitExecutions: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "quantum_circuit_executions_total",
				Help: "Total number of quantum circuit executions",
			},
			[]string{"backend", "algorithm", "qubits", "depth"},
		),

		quantumCircuitDuration: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "quantum_circuit_duration_seconds",
				Help:    "Quantum circuit execution duration in seconds",
				Buckets: []float64{0.01, 0.1, 0.5, 1.0, 5.0, 10.0, 30.0, 60.0},
			},
			[]string{"backend", "algorithm", "qubits"},
		),

		quantumBackendAvailability: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "quantum_backend_availability",
				Help: "Quantum backend availability (0-1)",
			},
			[]string{"backend", "provider"},
		),

		quantumQueueTime: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "quantum_queue_time_seconds",
				Help:    "Time spent in quantum backend queue",
				Buckets: []float64{1.0, 5.0, 10.0, 30.0, 60.0, 300.0, 900.0, 3600.0},
			},
			[]string{"backend", "provider"},
		),

		quantumNoiseLevel: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "quantum_noise_level",
				Help: "Quantum noise level (0-1, lower is better)",
			},
			[]string{"backend", "noise_type"},
		),

		// Business metrics
		activeUsers: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "active_users_total",
				Help: "Number of active users",
			},
			[]string{"plan", "status"},
		),

		apiKeysIssued: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "api_keys_issued_total",
				Help: "Total number of API keys issued",
			},
			[]string{"plan", "key_type"},
		),

		subscriptionsActive: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "subscriptions_active_total",
				Help: "Number of active subscriptions",
			},
			[]string{"plan", "status"},
		),

		revenueMonthly: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "revenue_monthly_usd",
				Help: "Monthly revenue in USD",
			},
			[]string{"plan", "currency"},
		),

		transactionsProcessed: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "transactions_processed_total",
				Help: "Total number of transactions processed",
			},
			[]string{"user_id", "processing_method", "result"},
		),

		// System metrics
		cpuUsage: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "cpu_usage_percent",
				Help: "CPU usage percentage",
			},
			[]string{"instance", "core"},
		),

		memoryUsage: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "memory_usage_bytes",
				Help: "Memory usage in bytes",
			},
			[]string{"instance", "type"},
		),

		databaseConnections: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "database_connections_active",
				Help: "Number of active database connections",
			},
			[]string{"database", "pool"},
		),

		redisConnections: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "redis_connections_active",
				Help: "Number of active Redis connections",
			},
			[]string{"instance", "pool"},
		),

		messageQueueSize: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "message_queue_size",
				Help: "Size of message queues",
			},
			[]string{"queue", "instance"},
		),

		// Security metrics
		loginAttemptsTotal: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "login_attempts_total",
				Help: "Total number of login attempts",
			},
			[]string{"user_id", "result", "method"},
		),

		failedAuthAttemptsTotal: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "failed_auth_attempts_total",
				Help: "Total number of failed authentication attempts",
			},
			[]string{"user_id", "reason", "method"},
		),

		rateLimitViolationsTotal: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "rate_limit_violations_total",
				Help: "Total number of rate limit violations",
			},
			[]string{"user_id", "endpoint", "limit_type"},
		),

		securityAlertsTotal: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "security_alerts_total",
				Help: "Total number of security alerts",
			},
			[]string{"alert_type", "severity", "user_id"},
		),
	}
}

// RecordHTTPRequest records HTTP request metrics
func (m *MetricsCollector) RecordHTTPRequest(method, endpoint, statusCode, userID string, duration time.Duration, requestSize, responseSize int) {
	m.httpRequestsTotal.WithLabelValues(method, endpoint, statusCode, userID).Inc()
	m.httpRequestDuration.WithLabelValues(method, endpoint, statusCode).Observe(duration.Seconds())
	m.httpRequestSize.WithLabelValues(method, endpoint).Observe(float64(requestSize))
	m.httpResponseSize.WithLabelValues(method, endpoint).Observe(float64(responseSize))
}

// RecordFraudDetection records fraud detection metrics
func (m *MetricsCollector) RecordFraudDetection(userID, transactionType, processingMethod, result string, duration time.Duration) {
	m.fraudDetectionsTotal.WithLabelValues(userID, transactionType, processingMethod, result).Inc()
	m.fraudDetectionDuration.WithLabelValues(processingMethod, userID).Observe(duration.Seconds())
	m.transactionsProcessed.WithLabelValues(userID, processingMethod, result).Inc()
}

// RecordQuantumProcessing records quantum processing metrics
func (m *MetricsCollector) RecordQuantumProcessing(backend, algorithm, userID string, duration time.Duration) {
	m.quantumProcessingTotal.WithLabelValues(backend, algorithm, userID).Inc()
}

// RecordClassicalProcessing records classical processing metrics
func (m *MetricsCollector) RecordClassicalProcessing(algorithm, userID string) {
	m.classicalProcessingTotal.WithLabelValues(algorithm, userID).Inc()
}

// UpdateQuantumAdvantage updates quantum advantage score
func (m *MetricsCollector) UpdateQuantumAdvantage(algorithm, backend string, score float64) {
	m.quantumAdvantageScore.WithLabelValues(algorithm, backend).Set(score)
}

// UpdateAccuracy updates accuracy metrics
func (m *MetricsCollector) UpdateAccuracy(processingMethod, algorithm string, accuracy, falsePositiveRate, falseNegativeRate float64) {
	m.accuracyScore.WithLabelValues(processingMethod, algorithm).Set(accuracy)
	m.falsePositiveRate.WithLabelValues(processingMethod, algorithm).Set(falsePositiveRate)
	m.falseNegativeRate.WithLabelValues(processingMethod, algorithm).Set(falseNegativeRate)
}

// RecordQuantumCircuitExecution records quantum circuit execution metrics
func (m *MetricsCollector) RecordQuantumCircuitExecution(backend, algorithm string, qubits, depth int, duration time.Duration) {
	m.quantumCircuitExecutions.WithLabelValues(backend, algorithm, string(rune(qubits)), string(rune(depth))).Inc()
	m.quantumCircuitDuration.WithLabelValues(backend, algorithm, string(rune(qubits))).Observe(duration.Seconds())
}

// UpdateQuantumBackendAvailability updates quantum backend availability
func (m *MetricsCollector) UpdateQuantumBackendAvailability(backend, provider string, availability float64) {
	m.quantumBackendAvailability.WithLabelValues(backend, provider).Set(availability)
}

// RecordQuantumQueueTime records quantum backend queue time
func (m *MetricsCollector) RecordQuantumQueueTime(backend, provider string, queueTime time.Duration) {
	m.quantumQueueTime.WithLabelValues(backend, provider).Observe(queueTime.Seconds())
}

// UpdateQuantumNoiseLevel updates quantum noise level
func (m *MetricsCollector) UpdateQuantumNoiseLevel(backend, noiseType string, noiseLevel float64) {
	m.quantumNoiseLevel.WithLabelValues(backend, noiseType).Set(noiseLevel)
}

// UpdateBusinessMetrics updates business-related metrics
func (m *MetricsCollector) UpdateBusinessMetrics(activeUsers, subscriptions, revenue map[string]float64) {
	for plan, count := range activeUsers {
		m.activeUsers.WithLabelValues(plan, "active").Set(count)
	}
	for plan, count := range subscriptions {
		m.subscriptionsActive.WithLabelValues(plan, "active").Set(count)
	}
	for plan, amount := range revenue {
		m.revenueMonthly.WithLabelValues(plan, "USD").Set(amount)
	}
}

// UpdateSystemMetrics updates system resource metrics
func (m *MetricsCollector) UpdateSystemMetrics(cpu, memory map[string]float64, dbConnections, redisConnections, queueSize map[string]float64) {
	for instance, usage := range cpu {
		m.cpuUsage.WithLabelValues(instance, "total").Set(usage)
	}
	for instance, usage := range memory {
		m.memoryUsage.WithLabelValues(instance, "used").Set(usage)
	}
	for pool, count := range dbConnections {
		m.databaseConnections.WithLabelValues("postgres", pool).Set(count)
	}
	for pool, count := range redisConnections {
		m.redisConnections.WithLabelValues("redis", pool).Set(count)
	}
	for queue, size := range queueSize {
		m.messageQueueSize.WithLabelValues(queue, "main").Set(size)
	}
}

// RecordSecurityEvent records security-related events
func (m *MetricsCollector) RecordSecurityEvent(eventType, userID, result, reason string) {
	switch eventType {
	case "login":
		m.loginAttemptsTotal.WithLabelValues(userID, result, "password").Inc()
	case "auth_failure":
		m.failedAuthAttemptsTotal.WithLabelValues(userID, reason, "api_key").Inc()
	case "rate_limit":
		m.rateLimitViolationsTotal.WithLabelValues(userID, "api", "requests_per_minute").Inc()
	case "security_alert":
		m.securityAlertsTotal.WithLabelValues(reason, "high", userID).Inc()
	}
}

// Server starts the Prometheus metrics server
func (m *MetricsCollector) Server(ctx context.Context, addr string) error {
	mux := http.NewServeMux()
	mux.Handle("/metrics", promhttp.Handler())

	server := &http.Server{
		Addr:    addr,
		Handler: mux,
	}

	go func() {
		<-ctx.Done()
		server.Shutdown(ctx)
	}()

	return server.ListenAndServe()
}