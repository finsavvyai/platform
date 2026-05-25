package observability

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestObservabilityIntegration tests the complete observability stack working together
func TestObservabilityIntegration(t *testing.T) {
	// Setup logging
	var logBuffer bytes.Buffer
	loggingConfig := LoggingConfig{
		Level:          LogLevelInfo,
		Output:         "stdout",
		SanitizeFields: []string{"password", "token"},
		Fields:         map[string]interface{}{"service": "test-service"},
	}
	logger := NewStructuredLogger("test-gateway", "1.0.0", loggingConfig)
	logger.logger.SetOutput(&logBuffer)

	// Setup metrics
	metricsConfig := MetricsConfig{
		Enabled:               true,
		Namespace:             "test_sdlc",
		Subsystem:             "gateway",
		Port:                  9091,
		Path:                  "/metrics",
		EnableAPIMetrics:      true,
		EnableBusinessMetrics: true,
		EnableSecurityMetrics: true,
	}
	metricsCollector := NewMetricsCollector(metricsConfig, logger.logger)

	// Setup tracing
	tracingConfig := TracingConfig{
		Enabled:        true,
		ServiceName:    "test-gateway",
		ServiceVersion: "1.0.0",
		Environment:    "test",
		ExporterType:   "stdout",
		SamplingRate:   1.0,
	}
	tracerProvider, err := NewTracerProvider(tracingConfig)
	require.NoError(t, err)
	defer tracerProvider.Shutdown(context.Background())

	// Create a test HTTP handler with all observability middleware
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Add context information to logger
		ctx := r.Context()
		entry := logger.WithContext(ctx).
			WithFields(map[string]interface{}{
				"endpoint": r.URL.Path,
				"method":   r.Method,
			})

		// Simulate work with tracing
		_, span := tracerProvider.StartSpan(ctx, "process-request")
		defer span.End()

		// Add attributes to span
		AddSpanAttributes(ctx,
			HTTPMethod.String(r.Method),
			HTTPTarget.String(r.URL.Path),
			UserID.String(r.Header.Get("X-User-ID")),
			TenantID.String(r.Header.Get("X-Tenant-ID")),
		)

		// Simulate different responses based on path
		switch r.URL.Path {
		case "/success":
			entry.Info("Request processed successfully")
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"success": true}`))

			// Record business metrics
			metricsCollector.userRequestsTotal.WithLabelValues(
				r.Header.Get("X-User-ID"),
				r.URL.Path,
				r.Method,
			).Inc()

		case "/error":
			entry.WithError(fmt.Errorf("simulated error")).Error("Request failed")
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"error": "internal error"}`))

			// Record error metrics
			metricsCollector.operationErrors.WithLabelValues(
				"process_request",
				"simulated_error",
				"http_handler",
			).Inc()

		case "/auth-failure":
			// Record auth metrics
			metricsCollector.RecordAuthFailure(
				"jwt",
				"invalid_token",
				"api",
				r.Header.Get("X-Tenant-ID"),
			)

			entry.Warn("Authentication failed")
			w.WriteHeader(http.StatusUnauthorized)
			w.Write([]byte(`{"error": "unauthorized"}`))

		case "/rate-limited":
			// Record rate limit metrics
			metricsCollector.rateLimitHits.WithLabelValues(
				r.URL.Path,
				"user",
				r.Header.Get("X-Tenant-ID"),
				r.Header.Get("X-User-ID"),
			).Inc()

			w.WriteHeader(http.StatusTooManyRequests)
			w.Write([]byte(`{"error": "rate limit exceeded"}`))

		default:
			w.WriteHeader(http.StatusNotFound)
			w.Write([]byte(`{"error": "not found"}`))
		}
	})

	// Apply middleware
	middleware := ChainMiddleware(
		tracerProvider.TraceMiddleware,
		metricsCollector.InstrumentHTTPMiddleware,
		loggingMiddleware(logger),
	)

	finalHandler := middleware(handler)

	// Test cases
	testCases := []struct {
		name           string
		path           string
		headers        map[string]string
		expectedStatus int
		expectedLog    string
		checkMetrics   bool
	}{
		{
			name:           "successful request",
			path:           "/success",
			headers:        map[string]string{"X-User-ID": "user-123", "X-Tenant-ID": "tenant-456"},
			expectedStatus: http.StatusOK,
			expectedLog:    "Request processed successfully",
			checkMetrics:   true,
		},
		{
			name:           "error response",
			path:           "/error",
			headers:        map[string]string{"X-User-ID": "user-123", "X-Tenant-ID": "tenant-456"},
			expectedStatus: http.StatusInternalServerError,
			expectedLog:    "Request failed",
			checkMetrics:   true,
		},
		{
			name:           "auth failure",
			path:           "/auth-failure",
			headers:        map[string]string{"X-User-ID": "user-123", "X-Tenant-ID": "tenant-456"},
			expectedStatus: http.StatusUnauthorized,
			expectedLog:    "Authentication failed",
			checkMetrics:   true,
		},
		{
			name:           "rate limit hit",
			path:           "/rate-limited",
			headers:        map[string]string{"X-User-ID": "user-123", "X-Tenant-ID": "tenant-456"},
			expectedStatus: http.StatusTooManyRequests,
			checkMetrics:   true,
		},
		{
			name:           "not found",
			path:           "/not-found",
			headers:        map[string]string{"X-User-ID": "user-123", "X-Tenant-ID": "tenant-456"},
			expectedStatus: http.StatusNotFound,
			checkMetrics:   false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Clear log buffer
			logBuffer.Reset()

			// Create request
			req := httptest.NewRequest("GET", "http://example.com"+tc.path, nil)
			for k, v := range tc.headers {
				req.Header.Set(k, v)
			}

			// Create response recorder
			rr := httptest.NewRecorder()

			// Serve request
			finalHandler.ServeHTTP(rr, req)

			// Verify response
			assert.Equal(t, tc.expectedStatus, rr.Code)

			// Verify logs
			logOutput := logBuffer.String()
			assert.Contains(t, logOutput, tc.expectedLog)
			assert.Contains(t, logOutput, "GET")
			assert.Contains(t, logOutput, tc.path)
			assert.Contains(t, logOutput, "test-gateway")
			assert.Contains(t, logOutput, "1.0.0")

			// Verify structured format
			var logEntry map[string]interface{}
			logLines := bytes.Split(logBuffer.Bytes(), []byte("\n"))
			for _, line := range logLines {
				if len(line) > 0 {
					err := json.Unmarshal(line, &logEntry)
					require.NoError(t, err)
					assert.Equal(t, "info", logEntry["level"])
					assert.Equal(t, "test-gateway", logEntry["component"])
				}
			}

			// Check metrics if requested
			if tc.checkMetrics {
				// Get metrics handler
				metricsHandler := metricsCollector.GetMetricsHandler()
				metricsReq := httptest.NewRequest("GET", "/metrics", nil)
				metricsRR := httptest.NewRecorder()
				metricsHandler.ServeHTTP(metricsRR, metricsReq)

				assert.Equal(t, http.StatusOK, metricsRR.Code)
				metricsOutput := metricsRR.Body.String()
				assert.Contains(t, metricsOutput, "test_sdlc_gateway_http_requests_total")
				assert.Contains(t, metricsOutput, "test_sdlc_gateway_http_request_duration_seconds")
			}
		})
	}
}

// TestObservabilityWithCorrelation tests correlation ID propagation
func TestObservabilityWithCorrelation(t *testing.T) {
	// Setup logging
	var logBuffer bytes.Buffer
	loggingConfig := LoggingConfig{
		Level:  LogLevelInfo,
		Output: "stdout",
	}
	logger := NewStructuredLogger("test-gateway", "1.0.0", loggingConfig)
	logger.logger.SetOutput(&logBuffer)

	// Setup tracing
	tracingConfig := TracingConfig{
		Enabled:      true,
		ServiceName:  "test-gateway",
		ExporterType: "stdout",
		SamplingRate: 1.0,
	}
	tracerProvider, _ := NewTracerProvider(tracingConfig)
	defer tracerProvider.Shutdown(context.Background())

	// Create handler that processes multiple steps
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

		// Step 1: Extract correlation ID or generate one
		correlationID := r.Header.Get("X-Correlation-ID")
		if correlationID == "" {
			correlationID = fmt.Sprintf("corr-%d", time.Now().UnixNano())
		}
		ctx = context.WithValue(ctx, "correlation_id", correlationID)

		// Step 2: Log with correlation
		logger.WithContext(ctx).Info("Starting request processing")

		// Step 3: Start a span for processing
		_, span := tracerProvider.StartSpan(ctx, "processing")
		defer span.End()

		// Step 4: Simulate async processing
		go func() {
			// Create new context with correlation ID for goroutine
			asyncCtx := context.WithValue(context.Background(), "correlation_id", correlationID)
			logger.WithContext(asyncCtx).Info("Async processing completed")
		}()

		// Step 5: Complete request
		time.Sleep(10 * time.Millisecond) // Allow async processing
		logger.WithContext(ctx).Info("Request processing completed")

		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"correlation_id": "` + correlationID + `"}`))
	})

	// Apply middleware
	middleware := ChainMiddleware(
		tracerProvider.TraceMiddleware,
		loggingMiddleware(logger),
	)

	finalHandler := middleware(handler)

	// Create request with correlation ID
	req := httptest.NewRequest("GET", "http://example.com/process", nil)
	req.Header.Set("X-Correlation-ID", "test-correlation-123")
	rr := httptest.NewRecorder()

	// Serve request
	finalHandler.ServeHTTP(rr, req)

	// Verify response
	assert.Equal(t, http.StatusOK, rr.Code)
	assert.Contains(t, rr.Body.String(), "test-correlation-123")

	// Wait for async processing
	time.Sleep(50 * time.Millisecond)

	// Verify correlation ID in logs
	logOutput := logBuffer.String()
	assert.Contains(t, logOutput, "test-correlation-123")
	assert.Contains(t, logOutput, "Starting request processing")
	assert.Contains(t, logOutput, "Request processing completed")
	assert.Contains(t, logOutput, "Async processing completed")
}

// TestObservabilityPerformance tests the performance impact of observability
func TestObservabilityPerformance(t *testing.T) {
	// Setup minimal observability for performance testing
	loggingConfig := LoggingConfig{
		Level:  LogLevelWarn, // Only log warnings to reduce overhead
		Output: "stdout",
	}
	logger := NewStructuredLogger("perf-test", "1.0.0", loggingConfig)

	metricsConfig := MetricsConfig{
		Enabled:   true,
		Namespace: "perf",
		Subsystem: "test",
	}
	metricsCollector := NewMetricsCollector(metricsConfig, logger.logger)

	tracingConfig := TracingConfig{
		Enabled:      false, // Disable tracing for performance test
		ServiceName:  "perf-test",
		ExporterType: "stdout",
	}
	tracerProvider, _ := NewTracerProvider(tracingConfig)

	// Create simple handler
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	// Apply middleware
	middleware := ChainMiddleware(
		tracerProvider.TraceMiddleware,
		metricsCollector.InstrumentHTTPMiddleware,
		loggingMiddleware(logger),
	)

	finalHandler := middleware(handler)

	// Benchmark request processing
	start := time.Now()
	requestCount := 1000

	for i := 0; i < requestCount; i++ {
		req := httptest.NewRequest("GET", "http://example.com/test", nil)
		rr := httptest.NewRecorder()
		finalHandler.ServeHTTP(rr, req)
	}

	duration := time.Since(start)
	avgDuration := duration / time.Duration(requestCount)

	// Performance assertions
	assert.Less(t, avgDuration, time.Millisecond, "Average request duration should be less than 1ms")
	t.Logf("Processed %d requests in %v (avg: %v per request)",
		requestCount, duration, avgDuration)
}

// Helper functions

// loggingMiddleware creates middleware for logging
func loggingMiddleware(logger *StructuredLogger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()

			// Log request
			logger.LogRequest(r)

			// Wrap response writer
			wrapped := &responseWriterTracing{
				ResponseWriter: w,
				statusCode:     http.StatusOK,
			}

			// Process request
			next.ServeHTTP(wrapped, r)

			// Log response
			logger.LogResponse(r, &http.Response{
				StatusCode:    wrapped.statusCode,
				ContentLength: wrapped.responseSize,
				Request:       r,
			}, time.Since(start))
		})
	}
}

// ChainMiddleware chains multiple middleware functions
func ChainMiddleware(middlewares ...func(http.Handler) http.Handler) func(http.Handler) http.Handler {
	return func(final http.Handler) http.Handler {
		for i := len(middlewares) - 1; i >= 0; i-- {
			final = middlewares[i](final)
		}
		return final
	}
}

// Test observability configuration validation
func TestObservabilityConfigValidation(t *testing.T) {
	t.Run("LoggingConfig validation", func(t *testing.T) {
		config := LoggingConfig{
			Level: LogLevelInfo,
		}
		logger := NewStructuredLogger("test", "1.0.0", config)
		assert.NotNil(t, logger)
		assert.Equal(t, LogLevelInfo, logger.logger.GetLevel())
	})

	t.Run("MetricsConfig validation", func(t *testing.T) {
		config := MetricsConfig{
			Enabled:   true,
			Namespace: "test",
		}
		collector := NewMetricsCollector(config, logrus.New())
		assert.NotNil(t, collector)
		assert.Equal(t, "test", collector.config.Namespace)
	})

	t.Run("TracingConfig validation", func(t *testing.T) {
		config := TracingConfig{
			Enabled:     true,
			ServiceName: "test-service",
		}
		tp, err := NewTracerProvider(config)
		assert.NoError(t, err)
		assert.NotNil(t, tp)
		assert.Equal(t, "test-service", tp.config.ServiceName)
	})
}

// Test observability with real workflow
func TestObservabilityRealWorkflow(t *testing.T) {
	// Setup complete observability stack
	loggingConfig := LoggingConfig{
		Level:          LogLevelInfo,
		Output:         "stdout",
		SanitizeFields: []string{"password", "token"},
		Fields:         map[string]interface{}{"service": "api-gateway"},
	}
	logger := NewStructuredLogger("api-gateway", "1.0.0", loggingConfig)

	metricsConfig := MetricsConfig{
		Enabled:               true,
		Namespace:             "sdlc_platform",
		Subsystem:             "gateway",
		EnableAPIMetrics:      true,
		EnableBusinessMetrics: true,
		EnableSecurityMetrics: true,
	}
	metricsCollector := NewMetricsCollector(metricsConfig, logger.logger)

	tracingConfig := TracingConfig{
		Enabled:        true,
		ServiceName:    "api-gateway",
		ServiceVersion: "1.0.0",
		Environment:    "test",
		ExporterType:   "stdout",
		SamplingRate:   0.1, // 10% sampling
	}
	tracerProvider, _ := NewTracerProvider(tracingConfig)
	defer tracerProvider.Shutdown(context.Background())

	// Simulate document upload workflow
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		userID := r.Header.Get("X-User-ID")
		tenantID := r.Header.Get("X-Tenant-ID")

		// Start workflow span
		ctx, span := tracerProvider.StartSpan(ctx, "document-upload-workflow")
		defer span.End()

		// Log workflow start
		logger.WithContext(ctx).WithFields(map[string]interface{}{
			"user_id":   userID,
			"tenant_id": tenantID,
			"file_name": r.Header.Get("X-File-Name"),
			"file_size": r.Header.Get("X-File-Size"),
		}).Info("Document upload started")

		// Step 1: Authentication
		_, authSpan := tracerProvider.StartSpan(ctx, "authenticate")
		time.Sleep(10 * time.Millisecond)
		metricsCollector.RecordAuthSuccess("jwt", "regular", tenantID)
		authSpan.End()

		// Step 2: Virus scanning
		_, scanSpan := tracerProvider.StartSpan(ctx, "virus-scan")
		time.Sleep(50 * time.Millisecond)
		logger.WithContext(ctx).Info("Virus scan completed: clean")
		scanSpan.End()

		// Step 3: DLP scanning
		_, dlpSpan := tracerProvider.StartSpan(ctx, "dlp-scan")
		time.Sleep(30 * time.Millisecond)
		metricsCollector.dlpViolations.WithLabelValues("email", "medium", tenantID).Inc()
		logger.WithContext(ctx).Warn("DLP violation detected: email address")
		dlpSpan.End()

		// Step 4: Store file
		_, storeSpan := tracerProvider.StartSpan(ctx, "store-file")
		time.Sleep(20 * time.Millisecond)
		logger.WithContext(ctx).Info("File stored successfully")
		storeSpan.End()

		// Step 5: Update metrics
		metricsCollector.documentProcessingTime.WithLabelValues(
			"pdf", "upload", tenantID,
		).Observe(0.11) // 110ms total

		metricsCollector.userRequestsTotal.WithLabelValues(
			userID, "/api/documents", "POST",
		).Inc()

		// Complete workflow
		logger.WithContext(ctx).Info("Document upload completed successfully")
		w.WriteHeader(http.StatusCreated)
		w.Write([]byte(`{"id": "doc-123", "status": "uploaded"}`))
	})

	// Apply all middleware
	finalHandler := ChainMiddleware(
		tracerProvider.TraceMiddleware,
		metricsCollector.InstrumentHTTPMiddleware,
		loggingMiddleware(logger),
	)(handler)

	// Execute workflow
	req := httptest.NewRequest("POST", "http://example.com/api/documents", nil)
	req.Header.Set("X-User-ID", "user-456")
	req.Header.Set("X-Tenant-ID", "tenant-789")
	req.Header.Set("X-File-Name", "test.pdf")
	req.Header.Set("X-File-Size", "1048576")
	rr := httptest.NewRecorder()

	finalHandler.ServeHTTP(rr, req)

	// Verify response
	assert.Equal(t, http.StatusCreated, rr.Code)
	assert.Contains(t, rr.Body.String(), "doc-123")
	assert.Contains(t, rr.Body.String(), "uploaded")

	// Verify metrics were recorded
	metricsHandler := metricsCollector.GetMetricsHandler()
	metricsReq := httptest.NewRequest("GET", "/metrics", nil)
	metricsRR := httptest.NewRecorder()
	metricsHandler.ServeHTTP(metricsRR, metricsReq)

	assert.Equal(t, http.StatusOK, metricsRR.Code)
	metricsOutput := metricsRR.Body.String()
	assert.Contains(t, metricsOutput, "sdlc_platform_gateway_auth_successes_total")
	assert.Contains(t, metricsOutput, "sdlc_platform_gateway_dlp_violations_total")
	assert.Contains(t, metricsOutput, "sdlc_platform_gateway_document_processing_duration_seconds")
}
