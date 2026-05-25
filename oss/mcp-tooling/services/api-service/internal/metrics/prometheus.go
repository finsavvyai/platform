package metrics

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	// HTTP Metrics
	httpRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total number of HTTP requests",
		},
		[]string{"method", "path", "status"},
	)

	httpRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "HTTP request latency in seconds",
			Buckets: []float64{0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10},
		},
		[]string{"method", "path"},
	)

	httpRequestSize = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_size_bytes",
			Help:    "HTTP request size in bytes",
			Buckets: prometheus.ExponentialBuckets(100, 10, 7),
		},
		[]string{"method", "path"},
	)

	httpResponseSize = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_response_size_bytes",
			Help:    "HTTP response size in bytes",
			Buckets: prometheus.ExponentialBuckets(100, 10, 7),
		},
		[]string{"method", "path"},
	)

	// Business Metrics
	connectorsTotal = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "connectors_total",
			Help: "Total number of connectors",
		},
		[]string{"status"},
	)

	deploymentsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "deployments_total",
			Help: "Total number of deployments",
		},
		[]string{"status"},
	)

	generationJobsQueued = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "generation_jobs_queued",
			Help: "Number of generation jobs in queue",
		},
	)

	generationJobDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "generation_job_duration_seconds",
			Help:    "Duration of generation jobs in seconds",
			Buckets: []float64{0.5, 1, 2, 5, 10, 30, 60, 120, 300},
		},
		[]string{"spec_type", "status"},
	)

	activeUsers = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "active_users",
			Help: "Number of active users in the last 24 hours",
		},
	)

	// Database Metrics
	dbConnectionPool = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "db_connection_pool",
			Help: "Database connection pool status",
		},
		[]string{"state"},
	)

	dbQueryDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "db_query_duration_seconds",
			Help:    "Database query duration in seconds",
			Buckets: []float64{0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.5, 1},
		},
		[]string{"operation"},
	)

	// Redis Metrics
	redisOperations = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "redis_operations_total",
			Help: "Total Redis operations",
		},
		[]string{"operation", "status"},
	)

	redisLatency = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "redis_operation_duration_seconds",
			Help:    "Redis operation duration in seconds",
			Buckets: []float64{0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05, 0.1},
		},
		[]string{"operation"},
	)
)

// PrometheusMiddleware returns a Gin middleware for Prometheus metrics
func PrometheusMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.FullPath()
		if path == "" {
			path = c.Request.URL.Path
		}

		// Skip metrics endpoint
		if path == "/metrics" {
			c.Next()
			return
		}

		// Process request
		c.Next()

		// Record metrics
		duration := time.Since(start).Seconds()
		status := strconv.Itoa(c.Writer.Status())
		method := c.Request.Method

		httpRequestsTotal.WithLabelValues(method, path, status).Inc()
		httpRequestDuration.WithLabelValues(method, path).Observe(duration)
		httpResponseSize.WithLabelValues(method, path).Observe(float64(c.Writer.Size()))

		if c.Request.ContentLength > 0 {
			httpRequestSize.WithLabelValues(method, path).Observe(float64(c.Request.ContentLength))
		}
	}
}

// MetricsHandler returns the Prometheus metrics handler
func MetricsHandler() gin.HandlerFunc {
	h := promhttp.Handler()
	return func(c *gin.Context) {
		h.ServeHTTP(c.Writer, c.Request)
	}
}

// Business Metrics Functions

// RecordConnectorCount updates the connector gauge
func RecordConnectorCount(status string, count int) {
	connectorsTotal.WithLabelValues(status).Set(float64(count))
}

// RecordDeployment increments the deployment counter
func RecordDeployment(status string) {
	deploymentsTotal.WithLabelValues(status).Inc()
}

// RecordJobQueued updates the queued jobs gauge
func RecordJobQueued(count int) {
	generationJobsQueued.Set(float64(count))
}

// RecordJobDuration records job completion time
func RecordJobDuration(specType, status string, duration time.Duration) {
	generationJobDuration.WithLabelValues(specType, status).Observe(duration.Seconds())
}

// RecordActiveUsers updates active user count
func RecordActiveUsers(count int) {
	activeUsers.Set(float64(count))
}

// Database Metrics Functions

// RecordDBConnectionPool updates connection pool metrics
func RecordDBConnectionPool(open, idle, inUse int) {
	dbConnectionPool.WithLabelValues("open").Set(float64(open))
	dbConnectionPool.WithLabelValues("idle").Set(float64(idle))
	dbConnectionPool.WithLabelValues("in_use").Set(float64(inUse))
}

// RecordDBQuery records database query duration
func RecordDBQuery(operation string, duration time.Duration) {
	dbQueryDuration.WithLabelValues(operation).Observe(duration.Seconds())
}

// Redis Metrics Functions

// RecordRedisOp records a Redis operation
func RecordRedisOp(operation, status string, duration time.Duration) {
	redisOperations.WithLabelValues(operation, status).Inc()
	redisLatency.WithLabelValues(operation).Observe(duration.Seconds())
}
