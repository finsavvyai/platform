package prometheus

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

// HTTPMetricsMiddleware provides Prometheus metrics collection for HTTP requests
type HTTPMetricsMiddleware struct {
	requestsTotal   *prometheus.CounterVec
	requestDuration *prometheus.HistogramVec
	responseSize    *prometheus.HistogramVec
	activeRequests  *prometheus.GaugeVec
}

// NewHTTPMetricsMiddleware creates a new HTTP metrics middleware
func NewHTTPMetricsMiddleware(metrics *BusinessMetrics) *HTTPMetricsMiddleware {
	return &HTTPMetricsMiddleware{
		requestsTotal:   metrics.RequestsTotal,
		requestDuration: metrics.RequestDuration,
		responseSize:    metrics.ResponseSize,
		activeRequests:  metrics.ActiveConnections,
	}
}

// Middleware returns an HTTP middleware function
func (hmm *HTTPMetricsMiddleware) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		// Extract labels from context or request
		labels := hmm.extractLabels(r.Context(), r)

		// Increment active requests
		hmm.activeRequests.WithLabelValues(labels...).Inc()
		defer hmm.activeRequests.WithLabelValues(labels...).Dec()

		// Wrap response writer to capture status code and response size
		rw := &responseWriter{
			ResponseWriter: w,
			statusCode:     http.StatusOK,
		}

		// Serve the request
		next.ServeHTTP(rw, r)

		// Calculate duration
		duration := time.Since(start).Seconds()

		// Update metrics
		statusCodeStr := strconv.Itoa(rw.statusCode)
		requestLabels := append([]string{r.Method, r.URL.Path, statusCodeStr}, labels...)
		durationLabels := append([]string{r.Method, r.URL.Path}, labels...)
		sizeLabels := append([]string{r.Method, r.URL.Path}, labels...)

		hmm.requestsTotal.WithLabelValues(requestLabels...).Inc()
		hmm.requestDuration.WithLabelValues(durationLabels...).Observe(duration)

		if rw.size > 0 {
			hmm.responseSize.WithLabelValues(sizeLabels...).Observe(float64(rw.size))
		}
	})
}

// extractLabels extracts metric labels from context and request
func (hmm *HTTPMetricsMiddleware) extractLabels(ctx context.Context, r *http.Request) []string {
	// This would extract correlation data from context
	// For now, return default values
	return []string{
		hmm.getStringFromContext(ctx, "service", "unknown"),
		hmm.getStringFromContext(ctx, "version", "unknown"),
		hmm.getStringFromContext(ctx, "environment", "development"),
		hmm.getStringFromContext(ctx, "tenant_id", "unknown"),
		hmm.getStringFromContext(ctx, "user_id", "unknown"),
		hmm.getStringFromContext(ctx, "correlation_id", "unknown"),
		hmm.getStringFromContext(ctx, "trace_id", "unknown"),
	}
}

func (hmm *HTTPMetricsMiddleware) getStringFromContext(ctx context.Context, key, defaultValue string) string {
	// Implementation would depend on context key structure
	// For now, return default
	return defaultValue
}

// responseWriter wraps http.ResponseWriter to capture status code and response size
type responseWriter struct {
	http.ResponseWriter
	statusCode int
	size       int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

func (rw *responseWriter) Write(b []byte) (int, error) {
	n, err := rw.ResponseWriter.Write(b)
	rw.size += n
	return n, err
}

// DatabaseMetricsMiddleware provides metrics collection for database operations
type DatabaseMetricsMiddleware struct {
	queriesTotal      *prometheus.CounterVec
	queryDuration     *prometheus.HistogramVec
	activeConnections *prometheus.GaugeVec
	connectionErrors  *prometheus.CounterVec
}

// NewDatabaseMetricsMiddleware creates a new database metrics middleware
func NewDatabaseMetricsMiddleware(metrics *BusinessMetrics) *DatabaseMetricsMiddleware {
	return &DatabaseMetricsMiddleware{
		queriesTotal:      metrics.ErrorsTotal,     // Reuse error metrics for DB errors
		queryDuration:     metrics.RequestDuration, // Reuse duration metrics
		activeConnections: metrics.ActiveConnections,
		connectionErrors:  metrics.ErrorsTotal,
	}
}

// DatabaseOperation represents a database operation with metrics collection
type DatabaseOperation struct {
	middleware *DatabaseMetricsMiddleware
	operation  string
	database   string
	table      string
	startTime  time.Time
	labels     []string
}

// NewDatabaseOperation starts tracking a database operation
func (dbm *DatabaseMetricsMiddleware) NewDatabaseOperation(ctx context.Context, operation, database, table string) *DatabaseOperation {
	labels := dbm.extractDatabaseLabels(ctx, operation, database, table)

	dbm.activeConnections.WithLabelValues(labels...).Inc()

	return &DatabaseOperation{
		middleware: dbm,
		operation:  operation,
		database:   database,
		table:      table,
		startTime:  time.Now(),
		labels:     labels,
	}
}

// Finish completes the database operation and records metrics
func (dbo *DatabaseOperation) Finish(err error) {
	duration := time.Since(dbo.startTime).Seconds()

	dbo.middleware.queryDuration.WithLabelValues(dbo.labels...).Observe(duration)
	dbo.middleware.activeConnections.WithLabelValues(dbo.labels...).Dec()

	if err != nil {
		errorLabels := append([]string{"database_error", dbo.operation}, dbo.labels...)
		dbo.middleware.queriesTotal.WithLabelValues(errorLabels...).Inc()
	}
}

// extractDatabaseLabels extracts database operation labels
func (dbm *DatabaseMetricsMiddleware) extractDatabaseLabels(ctx context.Context, operation, database, table string) []string {
	return []string{
		database,
		table,
		operation,
		dbm.getStringFromContext(ctx, "service", "unknown"),
		dbm.getStringFromContext(ctx, "version", "unknown"),
		dbm.getStringFromContext(ctx, "environment", "development"),
		dbm.getStringFromContext(ctx, "tenant_id", "unknown"),
		dbm.getStringFromContext(ctx, "user_id", "unknown"),
		dbm.getStringFromContext(ctx, "correlation_id", "unknown"),
		dbm.getStringFromContext(ctx, "trace_id", "unknown"),
	}
}

func (dbm *DatabaseMetricsMiddleware) getStringFromContext(ctx context.Context, key, defaultValue string) string {
	// Implementation would depend on context key structure
	return defaultValue
}
