package integration

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
	"go.opentelemetry.io/otel/trace"

	"quantumbeam/internal/monitoring/anomaly"
	"quantumbeam/internal/monitoring/dashboards"
	"quantumbeam/internal/monitoring/tracing"
)

// MonitoringConfig holds configuration for monitoring integration
type MonitoringConfig struct {
	// Metrics configuration
	MetricsEnabled bool   `json:"metrics_enabled"`
	MetricsPort    int    `json:"metrics_port"`
	MetricsPath    string `json:"metrics_path"`

	// Tracing configuration
	TracingEnabled     bool    `json:"tracing_enabled"`
	TracingServiceName string  `json:"tracing_service_name"`
	TracingEndpoint    string  `json:"tracing_endpoint"`
	TracingSampleRate  float64 `json:"tracing_sample_rate"`

	// Anomaly detection configuration
	AnomalyEnabled bool                          `json:"anomaly_enabled"`
	AnomalyConfig  anomaly.AnomalyDetectorConfig `json:"anomaly_config"`

	// Health check configuration
	HealthCheckEnabled bool   `json:"health_check_enabled"`
	HealthCheckPath    string `json:"health_check_path"`
	ReadinessCheckPath string `json:"readiness_check_path"`

	// Dashboard configuration
	DashboardEnabled bool                       `json:"dashboard_enabled"`
	DashboardConfig  dashboards.DashboardConfig `json:"dashboard_config"`
}

// DefaultMonitoringConfig returns default monitoring configuration
func DefaultMonitoringConfig() MonitoringConfig {
	return MonitoringConfig{
		MetricsEnabled:     true,
		MetricsPort:        9090,
		MetricsPath:        "/metrics",
		TracingEnabled:     true,
		TracingServiceName: "quantumbeam-api",
		TracingSampleRate:  0.1,
		AnomalyEnabled:     true,
		HealthCheckEnabled: true,
		HealthCheckPath:    "/health",
		ReadinessCheckPath: "/ready",
		DashboardEnabled:   true,
	}
}

// MonitoringIntegration handles integration of monitoring components
type MonitoringIntegration struct {
	config     MonitoringConfig
	httpClient *http.Client

	// Components
	anomalyDetector  *anomaly.AnomalyDetector
	alertManager     *anomaly.AlertManager
	traceAnalytics   *tracing.TraceAnalytics
	dashboardManager *dashboards.DashboardManager

	// Metrics
	httpRequestsTotal    *prometheus.CounterVec
	httpRequestDuration  *prometheus.HistogramVec
	httpRequestsInFlight *prometheus.GaugeVec

	// OpenTelemetry
	tracer                   trace.Tracer
	meter                    metric.Meter
	requestCounter           metric.Int64Counter
	requestDurationHistogram metric.Float64Histogram
}

// NewMonitoringIntegration creates a new monitoring integration
func NewMonitoringIntegration(config MonitoringConfig) (*MonitoringIntegration, error) {
	mi := &MonitoringIntegration{
		config:     config,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}

	// Initialize metrics
	if err := mi.initMetrics(); err != nil {
		return nil, fmt.Errorf("failed to initialize metrics: %w", err)
	}

	// Initialize OpenTelemetry
	if config.TracingEnabled {
		if err := mi.initTracing(); err != nil {
			return nil, fmt.Errorf("failed to initialize tracing: %w", err)
		}
	}

	// Initialize anomaly detection
	if config.AnomalyEnabled {
		if err := mi.initAnomalyDetection(); err != nil {
			return nil, fmt.Errorf("failed to initialize anomaly detection: %w", err)
		}
	}

	// Initialize dashboards
	if config.DashboardEnabled {
		if err := mi.initDashboards(); err != nil {
			return nil, fmt.Errorf("failed to initialize dashboards: %w", err)
		}
	}

	return mi, nil
}

// initMetrics initializes Prometheus metrics
func (mi *MonitoringIntegration) initMetrics() error {
	// HTTP metrics
	mi.httpRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total number of HTTP requests",
		},
		[]string{"method", "path", "status_code", "service"},
	)

	mi.httpRequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "HTTP request duration in seconds",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "path", "status_code", "service"},
	)

	mi.httpRequestsInFlight = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "http_requests_in_flight",
			Help: "Number of HTTP requests currently in flight",
		},
		[]string{"service"},
	)

	// Register metrics
	metrics := []prometheus.Collector{
		mi.httpRequestsTotal,
		mi.httpRequestDuration,
		mi.httpRequestsInFlight,
	}

	for _, m := range metrics {
		if err := prometheus.Register(m); err != nil {
			if _, ok := err.(prometheus.AlreadyRegisteredError); !ok {
				return err
			}
		}
	}

	return nil
}

// initTracing initializes OpenTelemetry tracing
func (mi *MonitoringIntegration) initTracing() error {
	// Create tracing service
	tracingConfig := tracing.TracingConfig{
		Enabled:        mi.config.TracingEnabled,
		ServiceName:    mi.config.TracingServiceName,
		Environment:    "production", // Or from config
		Sampler:        "ratio",
		SamplerRatio:   mi.config.TracingSampleRate,
		OTLPEndpoint:   mi.config.TracingEndpoint,
		MetricsEnabled: mi.config.MetricsEnabled,
	}

	tracingService, err := tracing.NewTracingService(tracingConfig)
	if err != nil {
		return fmt.Errorf("failed to create tracing service: %w", err)
	}

	// Create trace analytics
	// Using default max size and age for now
	mi.traceAnalytics = tracing.NewTraceAnalytics(tracingService, 10000, 24*time.Hour)
	if err != nil {
		return fmt.Errorf("failed to create trace analytics: %w", err)
	}

	// Get tracer and meter
	mi.tracer = otel.Tracer(mi.config.TracingServiceName)
	mi.meter = otel.Meter(mi.config.TracingServiceName)

	// Create metrics
	var err2 error
	mi.requestCounter, err2 = mi.meter.Int64Counter(
		"http_requests_total",
		metric.WithDescription("Total number of HTTP requests"),
	)
	if err2 != nil {
		return fmt.Errorf("failed to create request counter: %w", err2)
	}

	mi.requestDurationHistogram, err2 = mi.meter.Float64Histogram(
		"http_request_duration_seconds",
		metric.WithDescription("HTTP request duration in seconds"),
		metric.WithUnit("s"),
	)
	if err2 != nil {
		return fmt.Errorf("failed to create request duration histogram: %w", err2)
	}

	return nil
}

// initAnomalyDetection initializes anomaly detection components
func (mi *MonitoringIntegration) initAnomalyDetection() error {
	// Create anomaly detector
	var err error
	mi.anomalyDetector, err = anomaly.NewAnomalyDetector(mi.config.AnomalyConfig)
	if err != nil {
		return fmt.Errorf("failed to create anomaly detector: %w", err)
	}

	// Create alert manager
	amConfig := anomaly.AlertManagerConfig{
		Enabled: true,
		Notification: anomaly.NotificationConfig{
			Slack: anomaly.SlackConfig{
				WebhookURL: "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK",
				Channel:    "#anomaly-alerts",
				Enabled:    true,
			},
			Email: anomaly.EmailConfig{
				Enabled: false,
			},
		},
	}

	mi.alertManager, err = anomaly.NewAlertManager(amConfig)
	if err != nil {
		return fmt.Errorf("failed to create alert manager: %w", err)
	}

	return nil
}

// initDashboards initializes dashboard manager
func (mi *MonitoringIntegration) initDashboards() error {
	var err error
	mi.dashboardManager, err = dashboards.NewDashboardManager(mi.config.DashboardConfig)
	if err != nil {
		return fmt.Errorf("failed to create dashboard manager: %w", err)
	}

	return nil
}

// Middleware returns monitoring middleware for chi router
func (mi *MonitoringIntegration) Middleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()

			// Get request context for tracing
			ctx := r.Context()

			// Start span if tracing is enabled
			var span trace.Span
			if mi.config.TracingEnabled {
				ctx, span = mi.tracer.Start(ctx, fmt.Sprintf("%s %s", r.Method, r.URL.Path),
					trace.WithAttributes(
						attribute.String("http.method", r.Method),
						attribute.String("http.url", r.URL.String()),
						attribute.String("http.scheme", r.URL.Scheme),
						attribute.String("http.host", r.Host),
						attribute.String("http.user_agent", r.UserAgent()),
						attribute.String("http.remote_addr", r.RemoteAddr),
					),
				)
				defer span.End()
			}

			// Increment in-flight requests
			mi.httpRequestsInFlight.WithLabelValues(mi.config.TracingServiceName).Inc()
			defer mi.httpRequestsInFlight.WithLabelValues(mi.config.TracingServiceName).Dec()

			// Wrap response writer to capture status code
			wrapped := &responseWriter{ResponseWriter: w, statusCode: 200}

			// Process request
			next.ServeHTTP(wrapped, r.WithContext(ctx))

			// Calculate duration
			duration := time.Since(start)

			// Record metrics
			statusCode := fmt.Sprintf("%d", wrapped.statusCode)
			path := mi.sanitizePath(r.URL.Path)

			mi.httpRequestsTotal.WithLabelValues(r.Method, path, statusCode, mi.config.TracingServiceName).Inc()
			mi.httpRequestDuration.WithLabelValues(r.Method, path, statusCode, mi.config.TracingServiceName).Observe(duration.Seconds())

			// Record OpenTelemetry metrics
			if mi.config.TracingEnabled {
				mi.requestCounter.Add(ctx, 1,
					metric.WithAttributes(
						attribute.String("method", r.Method),
						attribute.String("path", path),
						attribute.String("status_code", statusCode),
					),
				)

				mi.requestDurationHistogram.Record(ctx, duration.Seconds(),
					metric.WithAttributes(
						attribute.String("method", r.Method),
						attribute.String("path", path),
						attribute.String("status_code", statusCode),
					),
				)

				// Add span attributes
				span.SetAttributes(
					attribute.Int("http.status_code", wrapped.statusCode),
					attribute.String("http.status_text", http.StatusText(wrapped.statusCode)),
				)

				// Set span status based on status code
				if wrapped.statusCode >= 400 {
					span.SetAttributes(attribute.String("error", "true"))
				}
			}

			// Check for anomalies if enabled
			if mi.config.AnomalyEnabled && wrapped.statusCode >= 500 {
				mi.checkAnomalies(r, wrapped.statusCode, duration)
			}
		})
	}
}

// responseWriter wraps http.ResponseWriter to capture status code
type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(statusCode int) {
	rw.statusCode = statusCode
	rw.ResponseWriter.WriteHeader(statusCode)
}

// sanitizePath sanitizes URL path for metrics
func (mi *MonitoringIntegration) sanitizePath(path string) string {
	// Replace path parameters with placeholders
	segments := strings.Split(path, "/")
	for i, segment := range segments {
		if segment != "" && (strings.HasPrefix(segment, "{") || strings.Contains(segment, ":")) {
			segments[i] = "{param}"
		}
	}
	return strings.Join(segments, "/")
}

// checkAnomalies checks for anomalies in request metrics
func (mi *MonitoringIntegration) checkAnomalies(r *http.Request, statusCode int, duration time.Duration) {
	if mi.anomalyDetector == nil {
		return
	}

	// Check response time anomaly
	if duration > 5*time.Second {
		result := anomaly.AnomalyResult{
			Timestamp:  time.Now(),
			MetricName: "http_request_duration_seconds",
			Labels: map[string]string{
				"method": r.Method,
				"path":   mi.sanitizePath(r.URL.Path),
				"status": fmt.Sprintf("%d", statusCode),
			},
			Value:     duration.Seconds(),
			IsAnomaly: true,
			ModelType: anomaly.ModelTypeStatistical,
			Reason:    "Response time exceeded threshold",
		}

		if err := mi.anomalyDetector.ProcessResult(result); err != nil {
			// Log error but don't fail the request
			fmt.Printf("Failed to process anomaly result: %v\n", err)
		}
	}

	// Check error rate anomaly
	if statusCode >= 500 {
		result := anomaly.AnomalyResult{
			Timestamp:  time.Now(),
			MetricName: "http_server_errors_total",
			Labels: map[string]string{
				"method": r.Method,
				"path":   mi.sanitizePath(r.URL.Path),
				"status": fmt.Sprintf("%d", statusCode),
			},
			Value:     1,
			IsAnomaly: true,
			ModelType: anomaly.ModelTypeStatistical,
			Reason:    "Server error detected",
		}

		if err := mi.anomalyDetector.ProcessResult(result); err != nil {
			fmt.Printf("Failed to process anomaly result: %v\n", err)
		}
	}
}

// SetupRoutes sets up monitoring routes
func (mi *MonitoringIntegration) SetupRoutes(r chi.Router) {
	// Metrics endpoint
	if mi.config.MetricsEnabled {
		r.Handle(mi.config.MetricsPath, promhttp.Handler())
	}

	// Health check endpoints
	if mi.config.HealthCheckEnabled {
		r.Get(mi.config.HealthCheckPath, mi.healthCheck)
		r.Get(mi.config.ReadinessCheckPath, mi.readinessCheck)
	}

	// Anomaly detection endpoints
	if mi.config.AnomalyEnabled {
		r.Route("/anomaly", func(r chi.Router) {
			r.Get("/status", mi.anomalyStatus)
			r.Post("/train", mi.trainModel)
			r.Get("/alerts", mi.getAlerts)
			r.Post("/alerts/{id}/acknowledge", mi.acknowledgeAlert)
		})
	}

	// Dashboard endpoints
	if mi.config.DashboardEnabled {
		r.Route("/dashboards", func(r chi.Router) {
			r.Get("/", mi.listDashboards)
			r.Get("/{name}", mi.getDashboard)
			r.Post("/sync", mi.syncDashboards)
		})
	}
}

// healthCheck returns basic health status
func (mi *MonitoringIntegration) healthCheck(w http.ResponseWriter, r *http.Request) {
	health := map[string]interface{}{
		"status":    "healthy",
		"timestamp": time.Now().UTC(),
		"service":   mi.config.TracingServiceName,
		"version":   "1.0.0",
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(health)
}

// readinessCheck returns readiness status
func (mi *MonitoringIntegration) readinessCheck(w http.ResponseWriter, r *http.Request) {
	checks := map[string]bool{
		"metrics":    mi.config.MetricsEnabled,
		"tracing":    mi.config.TracingEnabled,
		"anomaly":    mi.anomalyDetector != nil,
		"dashboards": mi.dashboardManager != nil,
	}

	allReady := true
	for _, ready := range checks {
		if !ready {
			allReady = false
			break
		}
	}

	status := "ready"
	statusCode := http.StatusOK
	if !allReady {
		status = "not_ready"
		statusCode = http.StatusServiceUnavailable
	}

	readiness := map[string]interface{}{
		"status":    status,
		"timestamp": time.Now().UTC(),
		"checks":    checks,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(readiness)
}

// anomalyStatus returns anomaly detection status
func (mi *MonitoringIntegration) anomalyStatus(w http.ResponseWriter, r *http.Request) {
	if mi.anomalyDetector == nil {
		http.Error(w, "Anomaly detection not enabled", http.StatusServiceUnavailable)
		return
	}

	status := mi.anomalyDetector.GetStatus()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(status)
}

// trainModel triggers model training
func (mi *MonitoringIntegration) trainModel(w http.ResponseWriter, r *http.Request) {
	if mi.anomalyDetector == nil {
		http.Error(w, "Anomaly detection not enabled", http.StatusServiceUnavailable)
		return
	}

	var req anomaly.ModelTrainingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	result, err := mi.anomalyDetector.TrainModel(req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(result)
}

// getAlerts returns active alerts
func (mi *MonitoringIntegration) getAlerts(w http.ResponseWriter, r *http.Request) {
	if mi.alertManager == nil {
		http.Error(w, "Alert manager not available", http.StatusServiceUnavailable)
		return
	}

	alerts, err := mi.alertManager.GetActiveAlerts()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(alerts)
}

// acknowledgeAlert acknowledges an alert
func (mi *MonitoringIntegration) acknowledgeAlert(w http.ResponseWriter, r *http.Request) {
	if mi.alertManager == nil {
		http.Error(w, "Alert manager not available", http.StatusServiceUnavailable)
		return
	}

	alertID := chi.URLParam(r, "id")
	if alertID == "" {
		http.Error(w, "Alert ID is required", http.StatusBadRequest)
		return
	}

	if err := mi.alertManager.AcknowledgeAlert(alertID, "system", "Acknowledged via API"); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "acknowledged"})
}

// listDashboards returns available dashboards
func (mi *MonitoringIntegration) listDashboards(w http.ResponseWriter, r *http.Request) {
	if mi.dashboardManager == nil {
		http.Error(w, "Dashboard manager not available", http.StatusServiceUnavailable)
		return
	}

	dashboards := mi.dashboardManager.ListDashboards()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(dashboards)
}

// getDashboard returns a specific dashboard
func (mi *MonitoringIntegration) getDashboard(w http.ResponseWriter, r *http.Request) {
	if mi.dashboardManager == nil {
		http.Error(w, "Dashboard manager not available", http.StatusServiceUnavailable)
		return
	}

	name := chi.URLParam(r, "name")
	_, err := mi.dashboardManager.GetDashboard(name)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	data, err := mi.dashboardManager.ExportDashboard(name)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write(data)
}

// syncDashboards syncs dashboards to Grafana
func (mi *MonitoringIntegration) syncDashboards(w http.ResponseWriter, r *http.Request) {
	if mi.dashboardManager == nil {
		http.Error(w, "Dashboard manager not available", http.StatusServiceUnavailable)
		return
	}

	if err := mi.dashboardManager.SyncDashboards(); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "synced"})
}

// Shutdown gracefully shuts down monitoring components
func (mi *MonitoringIntegration) Shutdown(ctx context.Context) error {
	if mi.anomalyDetector != nil {
		if err := mi.anomalyDetector.Shutdown(); err != nil {
			return fmt.Errorf("failed to shutdown anomaly detector: %w", err)
		}
	}

	if mi.alertManager != nil {
		if err := mi.alertManager.Shutdown(); err != nil {
			return fmt.Errorf("failed to shutdown alert manager: %w", err)
		}
	}

	if mi.traceAnalytics != nil {
		if err := mi.traceAnalytics.Shutdown(); err != nil {
			return fmt.Errorf("failed to shutdown trace analytics: %w", err)
		}
	}

	return nil
}

// SetupMonitoringRouter creates a monitoring-only router
func (mi *MonitoringIntegration) SetupMonitoringRouter() http.Handler {
	r := chi.NewRouter()

	// Add standard middleware
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))

	// Setup monitoring routes
	mi.SetupRoutes(r)

	return r
}

// StartMonitoringServer starts the monitoring HTTP server
func (mi *MonitoringIntegration) StartMonitoringServer(ctx context.Context) error {
	if !mi.config.MetricsEnabled {
		return nil
	}

	addr := fmt.Sprintf(":%d", mi.config.MetricsPort)
	server := &http.Server{
		Addr:         addr,
		Handler:      mi.SetupMonitoringRouter(),
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	fmt.Printf("Starting monitoring server on %s\n", addr)

	// Start server in goroutine
	errChan := make(chan error, 1)
	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			errChan <- err
		}
	}()

	// Wait for context cancellation or server error
	select {
	case <-ctx.Done():
		fmt.Println("Shutting down monitoring server...")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			return fmt.Errorf("failed to shutdown monitoring server: %w", err)
		}
		return nil
	case err := <-errChan:
		return fmt.Errorf("monitoring server failed: %w", err)
	}
}

// GetAnomalyDetector returns the anomaly detector (for integration with middleware)
func (mi *MonitoringIntegration) GetAnomalyDetector() *anomaly.AnomalyDetector {
	return mi.anomalyDetector
}
