package observability

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/sdlc-platform/observability/logging"
	"github.com/sdlc-platform/observability/logging/shared"
	"github.com/sdlc-platform/observability/metrics/prometheus"
	"github.com/sdlc-platform/observability/tracing/opentelemetry"
)

// ObservabilityManager combines logging, metrics, and tracing
type ObservabilityManager struct {
	logger           *logging.StructuredLogger
	metricsCollector *prometheus.MetricsCollector
	tracerManager    *opentelemetry.TracerManager
	businessMetrics  *prometheus.BusinessMetrics
	config           *Config
}

// Config holds configuration for the observability stack
type Config struct {
	// Logging configuration
	Logging *logging.LoggerConfig `json:"logging" yaml:"logging"`

	// Metrics configuration
	Metrics *prometheus.Config `json:"metrics" yaml:"metrics"`

	// Tracing configuration
	Tracing *opentelemetry.TracerConfig `json:"tracing" yaml:"tracing"`

	// Service information
	ServiceName    string `json:"service_name" yaml:"service_name"`
	ServiceVersion string `json:"service_version" yaml:"service_version"`
	Environment    string `json:"environment" yaml:"environment"`
}

// DefaultConfig returns default observability configuration
func DefaultConfig() *Config {
	return &Config{
		Logging:        logging.DefaultLoggerConfig(),
		Metrics:        prometheus.DefaultConfig(),
		Tracing:        opentelemetry.DefaultTracerConfig(),
		ServiceName:    "sdlc-service",
		ServiceVersion: "1.0.0",
		Environment:    "development",
	}
}

// NewObservabilityManager creates a new observability manager
func NewObservabilityManager(config *Config) (*ObservabilityManager, error) {
	if config == nil {
		config = DefaultConfig()
	}

	// Override service configuration in sub-configs
	config.Logging.Service = config.ServiceName
	config.Logging.Version = config.ServiceVersion
	config.Logging.Environment = config.Environment
	config.Metrics.Namespace = "sdlc"
	config.Metrics.Subsystem = "platform"
	config.Tracing.ServiceName = config.ServiceName
	config.Tracing.ServiceVersion = config.ServiceVersion
	config.Tracing.Environment = config.Environment

	// Initialize logging
	logger, err := logging.NewStructuredLogger(config.Logging)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize logging: %w", err)
	}

	// Initialize metrics
	metricsCollector := prometheus.NewMetricsCollector(config.Metrics)
	businessMetrics := prometheus.NewBusinessMetrics(metricsCollector)

	// Initialize tracing
	tracerManager, err := opentelemetry.NewTracerManager(config.Tracing)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize tracing: %w", err)
	}

	return &ObservabilityManager{
		logger:           logger,
		metricsCollector: metricsCollector,
		tracerManager:    tracerManager,
		businessMetrics:  businessMetrics,
		config:           config,
	}, nil
}

// GetLogger returns the structured logger
func (om *ObservabilityManager) GetLogger() *logging.StructuredLogger {
	return om.logger
}

// GetMetricsCollector returns the metrics collector
func (om *ObservabilityManager) GetMetricsCollector() *prometheus.MetricsCollector {
	return om.metricsCollector
}

// GetBusinessMetrics returns the business metrics
func (om *ObservabilityManager) GetBusinessMetrics() *prometheus.BusinessMetrics {
	return om.businessMetrics
}

// GetTracerManager returns the tracer manager
func (om *ObservabilityManager) GetTracerManager() *opentelemetry.TracerManager {
	return om.tracerManager
}

// StartMetricsServer starts the metrics HTTP server
func (om *ObservabilityManager) StartMetricsServer() error {
	return om.metricsCollector.StartServer(om.config.Metrics)
}

// Shutdown gracefully shuts down the observability stack
func (om *ObservabilityManager) Shutdown(ctx context.Context) error {
	var errors []error

	// Shutdown tracing
	if err := om.tracerManager.Shutdown(ctx); err != nil {
		errors = append(errors, fmt.Errorf("failed to shutdown tracing: %w", err))
	}

	// Shutdown metrics server
	if err := om.metricsCollector.StopServer(ctx); err != nil {
		errors = append(errors, fmt.Errorf("failed to shutdown metrics server: %w", err))
	}

	if len(errors) > 0 {
		return fmt.Errorf("shutdown errors: %v", errors)
	}

	return nil
}

// ObservabilityMiddleware provides HTTP middleware for observability
type ObservabilityMiddleware struct {
	manager        *ObservabilityManager
	businessHelper *opentelemetry.BusinessTraceHelper
}

// NewObservabilityMiddleware creates new observability middleware
func NewObservabilityMiddleware(manager *ObservabilityManager) *ObservabilityMiddleware {
	return &ObservabilityMiddleware{
		manager:        manager,
		businessHelper: opentelemetry.NewBusinessTraceHelper(manager.tracerManager),
	}
}

// Middleware returns an HTTP middleware function
func (om *ObservabilityMiddleware) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		// Extract correlation data from headers and set in context
		correlationData := shared.ExtractFromHTTP(r)
		ctx := shared.SetCorrelationData(r.Context(), correlationData)
		r = r.WithContext(ctx)

		// Add correlation headers to response
		shared.InjectIntoHTTP(correlationData, w.Header())

		// Start tracing span
		ctx, span := om.manager.tracerManager.StartSpanWithAttributes(
			ctx,
			fmt.Sprintf("HTTP %s %s", r.Method, r.URL.Path),
			[]attribute.KeyValue{
				attribute.String("http.method", r.Method),
				attribute.String("http.url", r.URL.String()),
				attribute.String("http.user_agent", r.UserAgent()),
				attribute.String("http.remote_addr", r.RemoteAddr),
			},
		)
		defer span.End()

		// Wrap response writer to capture status code and response size
		wrapped := &responseWriter{ResponseWriter: w, statusCode: 200}

		// Log request start
		om.manager.logger.Info(ctx, "HTTP request started",
			map[string]interface{}{
				"method": r.Method,
				"path":   r.URL.Path,
				"query":  r.URL.RawQuery,
				"ua":     r.UserAgent(),
			},
		)

		// Process request
		next.ServeHTTP(wrapped, r.WithContext(ctx))

		// Calculate duration
		duration := time.Since(start)

		// Record metrics
		labels := prometheus.Labels{
			"method":   r.Method,
			"endpoint": r.URL.Path,
			"status":   fmt.Sprintf("%d", wrapped.statusCode),
		}

		// Add correlation labels if available
		if correlationData.TenantID != "" {
			labels["tenant_id"] = correlationData.TenantID
		}
		if correlationData.UserID != "" {
			labels["user_id"] = correlationData.UserID
		}
		if correlationData.CorrelationID != "" {
			labels["correlation_id"] = correlationData.CorrelationID
		}
		if correlationData.TraceID != "" {
			labels["trace_id"] = correlationData.TraceID
		}

		om.manager.businessMetrics.RequestsTotal.With(labels).Inc()
		om.manager.businessMetrics.RequestDuration.With(labels).Observe(duration.Seconds())

		// Log request completion
		logLevel := logging.LevelInfo
		if wrapped.statusCode >= 400 {
			logLevel = logging.LevelWarn
			if wrapped.statusCode >= 500 {
				logLevel = logging.LevelError
			}
		}

		om.manager.logger.WithFields(map[string]interface{}{
			"method":      r.Method,
			"path":        r.URL.Path,
			"status_code": wrapped.statusCode,
			"duration":    duration,
		}).Log(ctx, logLevel, "HTTP request completed")

		// Add tracing attributes
		om.manager.tracerManager.SetAttributes(ctx,
			attribute.Int("http.status_code", wrapped.statusCode),
			attribute.Float64("http.duration_ms", duration.Seconds()*1000),
		)

		// Set span status based on status code
		if wrapped.statusCode >= 500 {
			om.manager.tracerManager.SetStatus(ctx, codes.Error, "Server error")
		} else if wrapped.statusCode >= 400 {
			om.manager.tracerManager.SetStatus(ctx, codes.Error, "Client error")
		} else {
			om.manager.tracerManager.SetStatus(ctx, codes.Ok, "Request successful")
		}
	})
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
	size, err := rw.ResponseWriter.Write(b)
	rw.size += size
	return size, err
}

// DatabaseHelper provides observability helpers for database operations
type DatabaseHelper struct {
	manager        *ObservabilityManager
	businessHelper *opentelemetry.BusinessTraceHelper
}

// NewDatabaseHelper creates a new database helper
func NewDatabaseHelper(manager *ObservabilityManager) *DatabaseHelper {
	return &DatabaseHelper{
		manager:        manager,
		businessHelper: opentelemetry.NewBusinessTraceHelper(manager.tracerManager),
	}
}

// TraceOperation traces a database operation
func (dh *DatabaseHelper) TraceOperation(
	ctx context.Context,
	operation, table string,
	fn func(context.Context) error,
) error {
	return dh.businessHelper.TraceDatabaseOperation(ctx, operation, table, fn)
}

// TraceOperationResult traces a database operation that returns a result
func TraceOperationResult[T any](
	ctx context.Context,
	dh *DatabaseHelper,
	operation, table string,
	fn func(context.Context) (T, error),
) (T, error) {
	return opentelemetry.WithSpanResult(ctx, dh.manager.tracerManager,
		fmt.Sprintf("DB %s %s", operation, table),
		func(ctx context.Context) (T, error) {
			return fn(ctx)
		},
		attribute.String("db.operation", operation),
		attribute.String("db.table", table),
	)
}

// ErrorHandler provides observability helpers for error handling
type ErrorHandler struct {
	manager *ObservabilityManager
}

// NewErrorHandler creates a new error handler
func NewErrorHandler(manager *ObservabilityManager) *ErrorHandler {
	return &ErrorHandler{
		manager: manager,
	}
}

// HandleError logs and records an error with observability data
func (eh *ErrorHandler) HandleError(ctx context.Context, err error, context map[string]interface{}) {
	// Record error in metrics
	eh.manager.businessMetrics.ErrorsTotal.With(prometheus.Labels{
		"error_type": fmt.Sprintf("%T", err),
		"component":  context["component"].(string),
	}).Inc()

	// Log error with structured data
	fields := make(map[string]interface{})
	for k, v := range context {
		fields[k] = v
	}
	fields["error"] = err

	eh.manager.logger.Error(ctx, "Error occurred", fields...)

	// Record error in tracing
	eh.manager.tracerManager.RecordError(ctx, err,
		attribute.String("error.component", context["component"].(string)),
		attribute.String("error.type", fmt.Sprintf("%T", err)),
	)
}

// Global observability manager instance
var globalObservabilityManager *ObservabilityManager

// InitGlobalObservability initializes the global observability manager
func InitGlobalObservability(config *Config) error {
	var err error
	globalObservabilityManager, err = NewObservabilityManager(config)
	return err
}

// GetGlobalObservability returns the global observability manager
func GetGlobalObservability() *ObservabilityManager {
	if globalObservabilityManager == nil {
		globalObservabilityManager, _ = NewObservabilityManager(DefaultConfig())
	}
	return globalObservabilityManager
}

// Convenience functions using global observability manager
func GlobalLogger() *logging.StructuredLogger {
	return GetGlobalObservability().GetLogger()
}

func GlobalMetricsCollector() *prometheus.MetricsCollector {
	return GetGlobalObservability().GetMetricsCollector()
}

func GlobalBusinessMetrics() *prometheus.BusinessMetrics {
	return GetGlobalObservability().GetBusinessMetrics()
}

func GlobalTracerManager() *opentelemetry.TracerManager {
	return GetGlobalObservability().GetTracerManager()
}
