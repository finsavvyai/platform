//go:build ignore

package observability

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewMetricsCollector(t *testing.T) {
	config := MetricsConfig{
		Enabled:   true,
		Namespace: "test",
		Subsystem: "gateway",
		Port:      9090,
		Path:      "/metrics",
	}

	logger := logrus.New()
	collector := NewMetricsCollector(config, logger)

	assert.NotNil(t, collector)
	assert.Equal(t, "test", collector.config.Namespace)
	assert.Equal(t, "gateway", collector.config.Subsystem)
	assert.NotNil(t, collector.registry)
	assert.NotNil(t, collector.httpRequestsTotal)
	assert.NotNil(t, collector.httpRequestDuration)
}

func TestMetricsCollectorInitializeHTTPMetrics(t *testing.T) {
	config := MetricsConfig{
		Enabled:   true,
		Namespace: "test",
		Subsystem: "gateway",
	}

	logger := logrus.New()
	collector := NewMetricsCollector(config, logger)

	// Verify HTTP metrics are initialized
	assert.NotNil(t, collector.httpRequestsTotal)
	assert.NotNil(t, collector.httpRequestDuration)
	assert.NotNil(t, collector.httpRequestSize)
	assert.NotNil(t, collector.httpResponseSize)
	assert.NotNil(t, collector.httpActiveConnections)

	// Test metric increment
	collector.httpRequestsTotal.WithLabelValues("GET", "/test", "200", "v1", "tenant-1").Inc()
	collector.httpActiveConnections.Inc()
	collector.httpActiveConnections.Dec()

	// Verify metrics are registered
	metricFamilies, err := collector.registry.Gather()
	require.NoError(t, err)
	assert.Greater(t, len(metricFamilies), 0)
}

func TestMetricsCollectorInitializeApplicationMetrics(t *testing.T) {
	config := MetricsConfig{
		Enabled:          true,
		EnableAPIMetrics: true,
		Namespace:        "test",
		Subsystem:        "gateway",
	}

	logger := logrus.New()
	collector := NewMetricsCollector(config, logger)

	// Verify application metrics are initialized
	assert.NotNil(t, collector.operationsTotal)
	assert.NotNil(t, collector.operationDuration)
	assert.NotNil(t, collector.activeOperations)
	assert.NotNil(t, collector.operationErrors)

	// Test recording operations
	collector.RecordOperation("test_operation", "success", "test_component", 100*time.Millisecond)
	collector.IncrementActiveOperations()
	collector.DecrementActiveOperations()
}

func TestMetricsCollectorInitializeBusinessMetrics(t *testing.T) {
	config := MetricsConfig{
		Enabled:               true,
		EnableBusinessMetrics: true,
		Namespace:             "test",
		Subsystem:             "gateway",
	}

	logger := logrus.New()
	collector := NewMetricsCollector(config, logger)

	// Verify business metrics are initialized
	assert.NotNil(t, collector.userRequestsTotal)
	assert.NotNil(t, collector.tenantRequestsTotal)
	assert.NotNil(t, collector.apiUsageByEndpoint)
	assert.NotNil(t, collector.documentProcessingTime)
	assert.NotNil(t, collector.vectorSearchLatency)
	assert.NotNil(t, collector.llmResponseTime)

	// Test recording metrics
	collector.userRequestsTotal.WithLabelValues("user-1", "/api/test", "GET").Inc()
	collector.tenantRequestsTotal.WithLabelValues("tenant-1", "/api/test", "GET").Inc()
	collector.apiUsageByEndpoint.WithLabelValues("/api/test", "GET", "v1", "tenant-1").Inc()
	collector.documentProcessingTime.WithLabelValues("pdf", "ocr", "tenant-1").Observe(5.5)
	collector.vectorSearchLatency.WithLabelValues("semantic", "1000", "tenant-1").Observe(0.1)
	collector.llmResponseTime.WithLabelValues("openai", "gpt-4", "100", "tenant-1").Observe(2.5)
}

func TestMetricsCollectorInitializeDatabaseMetrics(t *testing.T) {
	config := MetricsConfig{
		Enabled:               true,
		EnableDatabaseMetrics: true,
		Namespace:             "test",
		Subsystem:             "gateway",
	}

	logger := logrus.New()
	collector := NewMetricsCollector(config, logger)

	// Verify database metrics are initialized
	assert.NotNil(t, collector.dbConnectionsActive)
	assert.NotNil(t, collector.dbConnectionsIdle)
	assert.NotNil(t, collector.dbQueryDuration)
	assert.NotNil(t, collector.dbQueryTotal)
	assert.NotNil(t, collector.dbConnectionErrors)

	// Test recording metrics
	collector.dbConnectionsActive.Set(10)
	collector.dbConnectionsIdle.Set(5)
	collector.dbQueryDuration.WithLabelValues("SELECT", "documents", "read").Observe(0.01)
	collector.dbQueryTotal.WithLabelValues("SELECT", "documents", "read", "success").Inc()
	collector.dbConnectionErrors.Inc()
}

func TestMetricsCollectorInitializeCacheMetrics(t *testing.T) {
	config := MetricsConfig{
		Enabled:            true,
		EnableCacheMetrics: true,
		Namespace:          "test",
		Subsystem:          "gateway",
	}

	logger := logrus.New()
	collector := NewMetricsCollector(config, logger)

	// Verify cache metrics are initialized
	assert.NotNil(t, collector.cacheHits)
	assert.NotNil(t, collector.cacheMisses)
	assert.NotNil(t, collector.cacheEvictions)
	assert.NotNil(t, collector.cacheSize)

	// Test recording metrics
	collector.RecordCacheHit("redis", "user:")
	collector.RecordCacheMiss("redis", "user:")
	collector.cacheEvictions.WithLabelValues("redis", "ttl").Inc()
	collector.UpdateCacheSize(1024 * 1024) // 1MB
}

func TestMetricsCollectorInitializeSecurityMetrics(t *testing.T) {
	config := MetricsConfig{
		Enabled:               true,
		EnableSecurityMetrics: true,
		Namespace:             "test",
		Subsystem:             "gateway",
	}

	logger := logrus.New()
	collector := NewMetricsCollector(config, logger)

	// Verify security metrics are initialized
	assert.NotNil(t, collector.authAttemptsTotal)
	assert.NotNil(t, collector.authSuccessesTotal)
	assert.NotNil(t, collector.authFailuresTotal)
	assert.NotNil(t, collector.rateLimitHits)
	assert.NotNil(t, collector.blockedRequests)
	assert.NotNil(t, collector.dlpViolations)

	// Test recording metrics
	collector.RecordAuthAttempt("jwt", "regular", "tenant-1")
	collector.RecordAuthSuccess("jwt", "regular", "tenant-1")
	collector.RecordAuthFailure("jwt", "invalid_token", "regular", "tenant-1")
	collector.rateLimitHits.WithLabelValues("/api/test", "user", "tenant-1", "user-1").Inc()
	collector.blockedRequests.WithLabelValues("ip_block", "192.168.1.1", "user-1", "tenant-1").Inc()
	collector.dlpViolations.WithLabelValues("ssn", "high", "tenant-1").Inc()
}

func TestMetricsCollectorInitializeSystemMetrics(t *testing.T) {
	config := MetricsConfig{
		Enabled:              true,
		EnableRuntimeMetrics: true,
		Namespace:            "test",
		Subsystem:            "gateway",
	}

	logger := logrus.New()
	collector := NewMetricsCollector(config, logger)

	// Verify system metrics are initialized
	assert.NotNil(t, collector.goRoutines)
	assert.NotNil(t, collector.memoryAllocated)
	assert.NotNil(t, collector.memoryTotal)
	assert.NotNil(t, collector.gcCollections)
	assert.NotNil(t, collector.gcPauseDuration)

	// Test updating system metrics
	collector.UpdateSystemMetrics()
}

func TestMetricsCollectorInstrumentHTTPMiddleware(t *testing.T) {
	config := MetricsConfig{
		Enabled:   true,
		Namespace: "test",
		Subsystem: "gateway",
	}

	logger := logrus.New()
	collector := NewMetricsCollector(config, logger)

	// Create a test handler
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	// Wrap with metrics middleware
	instrumentedHandler := collector.InstrumentHTTPMiddleware(handler)

	// Create test request
	req := httptest.NewRequest("GET", "http://example.com/test", nil)
	req.Header.Set("API-Version", "v1")
	req.Header.Set("X-Tenant-ID", "tenant-1")

	// Create response recorder
	rr := httptest.NewRecorder()

	// Serve request
	instrumentedHandler.ServeHTTP(rr, req)

	// Verify response
	assert.Equal(t, http.StatusOK, rr.Code)
	assert.Equal(t, "OK", rr.Body.String())

	// Verify metrics were recorded
	metricFamilies, err := collector.registry.Gather()
	require.NoError(t, err)

	// Find HTTP requests total metric
	var httpRequestsMetric *prometheus.MetricFamily
	for _, mf := range metricFamilies {
		if *mf.Name == "test_gateway_http_requests_total" {
			httpRequestsMetric = mf
			break
		}
	}
	assert.NotNil(t, httpRequestsMetric)
}

func TestMetricsCollectorCustomMetrics(t *testing.T) {
	config := MetricsConfig{
		Enabled:             true,
		EnableCustomMetrics: true,
		Namespace:           "test",
		Subsystem:           "gateway",
	}

	logger := logrus.New()
	collector := NewMetricsCollector(config, logger)

	// Create a custom counter
	customCounter := prometheus.NewCounter(prometheus.CounterOpts{
		Name: "test_custom_counter",
		Help: "A custom test counter",
	})

	// Register custom metric
	err := collector.RegisterCustomMetric("test_counter", customCounter)
	require.NoError(t, err)

	// Increment custom metric
	customCounter.Inc()

	// Try to register again (should fail)
	err = collector.RegisterCustomMetric("test_counter", customCounter)
	assert.Error(t, err)

	// Unregister metric
	err = collector.UnregisterCustomMetric("test_counter")
	require.NoError(t, err)

	// Try to unregister non-existent metric
	err = collector.UnregisterCustomMetric("non_existent")
	assert.Error(t, err)
}

func TestMetricsCollectorGetMetricsHandler(t *testing.T) {
	config := MetricsConfig{
		Enabled:   true,
		Namespace: "test",
		Subsystem: "gateway",
	}

	logger := logrus.New()
	collector := NewMetricsCollector(config, logger)

	// Get metrics handler
	handler := collector.GetMetricsHandler()
	assert.NotNil(t, handler)

	// Create test request
	req := httptest.NewRequest("GET", "http://example.com/metrics", nil)
	rr := httptest.NewRecorder()

	// Serve metrics
	handler.ServeHTTP(rr, req)

	// Verify response
	assert.Equal(t, http.StatusOK, rr.Code)
	assert.Contains(t, rr.Body.String(), "# HELP")
	assert.Contains(t, rr.Body.String(), "# TYPE")
}

func TestMetricsCollectorDefaultConfig(t *testing.T) {
	config := MetricsConfig{
		Enabled: true,
	}

	logger := logrus.New()
	collector := NewMetricsCollector(config, logger)

	// Verify defaults are set
	assert.Equal(t, "sdlc_platform", collector.config.Namespace)
	assert.Equal(t, "gateway", collector.config.Subsystem)
	assert.NotEmpty(t, collector.config.Buckets)
	assert.NotEmpty(t, collector.config.Percentiles)
}

func TestResponseWriter(t *testing.T) {
	// Create response writer
	rr := httptest.NewRecorder()
	rw := &responseWriter{
		ResponseWriter: rr,
		statusCode:     http.StatusOK,
	}

	// Test WriteHeader
	rw.WriteHeader(http.StatusNotFound)
	assert.Equal(t, http.StatusNotFound, rw.statusCode)

	// Test Write
	n, err := rw.Write([]byte("test response"))
	require.NoError(t, err)
	assert.Equal(t, 12, n)
	assert.Equal(t, int64(12), rw.responseSize)

	// Verify response
	assert.Equal(t, http.StatusNotFound, rr.Code)
	assert.Equal(t, "test response", rr.Body.String())
}

func TestGetAPIVersion(t *testing.T) {
	testCases := []struct {
		name        string
		headerValue string
		queryValue  string
		expected    string
	}{
		{
			name:        "version from header",
			headerValue: "v1",
			queryValue:  "",
			expected:    "v1",
		},
		{
			name:        "version from query",
			headerValue: "",
			queryValue:  "v2",
			expected:    "v2",
		},
		{
			name:        "no version",
			headerValue: "",
			queryValue:  "",
			expected:    "unknown",
		},
		{
			name:        "header takes precedence",
			headerValue: "v1",
			queryValue:  "v2",
			expected:    "v1",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "http://example.com/test", nil)
			if tc.headerValue != "" {
				req.Header.Set("API-Version", tc.headerValue)
			}
			if tc.queryValue != "" {
				q := req.URL.Query()
				q.Set("version", tc.queryValue)
				req.URL.RawQuery = q.Encode()
			}

			version := getAPIVersion(req)
			assert.Equal(t, tc.expected, version)
		})
	}
}

func TestGetTenantID(t *testing.T) {
	testCases := []struct {
		name        string
		headerValue string
		queryValue  string
		expected    string
	}{
		{
			name:        "tenant from header",
			headerValue: "tenant-1",
			queryValue:  "",
			expected:    "tenant-1",
		},
		{
			name:        "tenant from query",
			headerValue: "",
			queryValue:  "tenant-2",
			expected:    "tenant-2",
		},
		{
			name:        "no tenant",
			headerValue: "",
			queryValue:  "",
			expected:    "unknown",
		},
		{
			name:        "header takes precedence",
			headerValue: "tenant-1",
			queryValue:  "tenant-2",
			expected:    "tenant-1",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "http://example.com/test", nil)
			if tc.headerValue != "" {
				req.Header.Set("X-Tenant-ID", tc.headerValue)
			}
			if tc.queryValue != "" {
				q := req.URL.Query()
				q.Set("tenant_id", tc.queryValue)
				req.URL.RawQuery = q.Encode()
			}

			tenantID := getTenantID(req)
			assert.Equal(t, tc.expected, tenantID)
		})
	}
}

func TestMetricsCollectorDisabled(t *testing.T) {
	config := MetricsConfig{
		Enabled: false,
	}

	logger := logrus.New()
	collector := NewMetricsCollector(config, logger)

	// Metrics should still be created but not exposed
	assert.NotNil(t, collector)
	assert.NotNil(t, collector.registry)
}

// Benchmark tests

func BenchmarkMetricsCollectorRecordOperation(b *testing.B) {
	config := MetricsConfig{
		Enabled:   true,
		Namespace: "test",
		Subsystem: "gateway",
	}

	logger := logrus.New()
	collector := NewMetricsCollector(config, logger)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		collector.RecordOperation("test_op", "success", "test", 100*time.Millisecond)
	}
}

func BenchmarkMetricsCollectorIncrementActiveOperations(b *testing.B) {
	config := MetricsConfig{
		Enabled:   true,
		Namespace: "test",
		Subsystem: "gateway",
	}

	logger := logrus.New()
	collector := NewMetricsCollector(config, logger)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		collector.IncrementActiveOperations()
		collector.DecrementActiveOperations()
	}
}

func BenchmarkMetricsCollectorRecordCacheHit(b *testing.B) {
	config := MetricsConfig{
		Enabled:   true,
		Namespace: "test",
		Subsystem: "gateway",
	}

	logger := logrus.New()
	collector := NewMetricsCollector(config, logger)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		collector.RecordCacheHit("redis", "test:")
	}
}
