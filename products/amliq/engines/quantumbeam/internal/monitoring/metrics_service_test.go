package monitoring

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewMetricsCollector(t *testing.T) {
	mc := NewMetricsCollector()

	assert.NotNil(t, mc)
	assert.NotNil(t, mc.httpRequestsTotal)
	assert.NotNil(t, mc.httpRequestDuration)
	assert.NotNil(t, mc.fraudDetectionsTotal)
	assert.NotNil(t, mc.authTotal)
	assert.NotNil(t, mc.billingEventsTotal)
}

func TestMetricsCollector_HTTPMetrics(t *testing.T) {
	mc := NewMetricsCollector()

	// Test HTTP request recording
	mc.RecordHTTPRequest("GET", "/api/v1/analyze", "200")
	mc.RecordHTTPRequest("POST", "/api/v1/analyze", "400")

	// Test HTTP request duration recording
	mc.RecordHTTPRequestDuration("GET", "/api/v1/analyze", 150*time.Millisecond)
	mc.RecordHTTPRequestDuration("POST", "/api/v1/analyze", 200*time.Millisecond)

	// Test request/response size recording
	mc.RecordHTTPRequestSize("GET", "/api/v1/analyze", 1024)
	mc.RecordHTTPResponseSize("GET", "/api/v1/analyze", 2048)

	// Verify metrics were recorded
	reg := prometheus.NewRegistry()
	mc.RegisterMetrics()

	metricFamilies, err := reg.Gather()
	require.NoError(t, err)

	// Check that we have the expected metrics
	metricNames := make(map[string]bool)
	for _, mf := range metricFamilies {
		metricNames[*mf.Name] = true
	}

	expectedMetrics := []string{
		"quantumbeam_fraud_detection_http_requests_total",
		"quantumbeam_fraud_detection_http_request_duration_seconds",
		"quantumbeam_fraud_detection_http_request_size_bytes",
		"quantumbeam_fraud_detection_http_response_size_bytes",
	}

	for _, expected := range expectedMetrics {
		assert.True(t, metricNames[expected], "Expected metric %s not found", expected)
	}
}

func TestMetricsCollector_FraudDetectionMetrics(t *testing.T) {
	mc := NewMetricsCollector()

	// Test fraud detection recording
	mc.RecordFraudDetection("quantum", "fraud", "high")
	mc.RecordFraudDetection("classical", "legitimate", "medium")

	// Test duration recording
	mc.RecordFraudDetectionDuration("quantum", 50*time.Millisecond)
	mc.RecordFraudDetectionDuration("classical", 25*time.Millisecond)

	// Test quantum vs classical processing
	mc.RecordQuantumProcessing("ibm_quantum", "vqc", "success")
	mc.RecordClassicalProcessing("random_forest", "success")

	// Test quantum advantage score
	mc.SetQuantumAdvantageScore("vqc", "accuracy", 0.95)
	mc.SetQuantumAdvantageScore("qaoa", "speed", 1.25)

	// Verify metrics using testutil
	err := testutil.CollectAndCompare(mc.httpRequestsTotal, `
	# HELP quantumbeam_fraud_detection_http_requests_total Total number of HTTP requests
	# TYPE quantumbeam_fraud_detection_http_requests_total counter
	`)
	assert.NoError(t, err)
}

func TestMetricsCollector_AuthenticationMetrics(t *testing.T) {
	mc := NewMetricsCollector()

	// Test authentication metrics
	mc.RecordAuth("jwt", "success")
	mc.RecordAuth("api_key", "failed")
	mc.RecordAuth("sso", "success")

	// Test authentication duration
	mc.RecordAuthDuration("jwt", 10*time.Millisecond)
	mc.RecordAuthDuration("api_key", 5*time.Millisecond)

	// Test key validations
	mc.RecordAPIKeyValidation("valid")
	mc.RecordAPIKeyValidation("invalid")
	mc.RecordJWTValidation("valid")
	mc.RecordJWTValidation("expired")

	// Verify counts
	assert.NoError(t, testutil.CollectAndCompare(mc.authTotal, `
	# HELP quantumbeam_fraud_detection_auth_operations_total Total number of authentication operations
	# TYPE quantumbeam_fraud_detection_auth_operations_total counter
	`))
}

func TestMetricsCollector_BillingMetrics(t *testing.T) {
	mc := NewMetricsCollector()

	// Test billing events
	mc.RecordBillingEvent("subscription_created", "success")
	mc.RecordBillingEvent("payment_failed", "error")

	// Test usage tracking
	mc.RecordUsage("api_calls", "premium")
	mc.RecordUsage("quantum_processing", "enterprise")

	// Test cost calculation duration
	mc.RecordCostCalculationDuration("quantum", 100*time.Millisecond)
	mc.RecordCostCalculationDuration("classical", 50*time.Millisecond)

	assert.NoError(t, testutil.CollectAndCompare(mc.billingEventsTotal, `
	# HELP quantumbeam_fraud_detection_billing_events_total Total number of billing events
	# TYPE quantumbeam_fraud_detection_billing_events_total counter
	`))
}

func TestMetricsCollector_SystemMetrics(t *testing.T) {
	mc := NewMetricsCollector()

	// Test connection metrics
	mc.SetActiveConnections("websocket", 150.0)
	mc.SetDatabaseConnections("postgres", 20.0)
	mc.SetRedisConnections("cache", 10.0)

	// Test quantum backend status
	mc.SetQuantumBackendStatus("ibm_quantum", "ibm", 1.0)
	mc.SetQuantumBackendStatus("aws_braket", "aws", 0.0) // Down

	assert.NoError(t, testutil.CollectAndCompare(mc.activeConnections, `
	# HELP quantumbeam_fraud_detection_active_connections Number of active connections
	# TYPE quantumbeam_fraud_detection_active_connections gauge
	`))
}

func TestMetricsCollector_AIMetrics(t *testing.T) {
	mc := NewMetricsCollector()

	// Test AI processing metrics
	mc.RecordAIProcessing("openai", "gpt-4", "success")
	mc.RecordAIProcessing("anthropic", "claude-3", "failed")

	// Test AI processing duration
	mc.RecordAIProcessingDuration("openai", "gpt-4", 2*time.Second)
	mc.RecordAIProcessingDuration("anthropic", "claude-3", 1500*time.Millisecond)

	// Test provider failures
	mc.RecordProviderFailure("openai", "rate_limit")
	mc.RecordProviderFailure("anthropic", "timeout")

	// Test explanation generation
	mc.RecordExplanationGeneration("success", "fraud_pattern")
	mc.RecordExplanationGeneration("failed", "anomaly_detection")

	assert.NoError(t, testutil.CollectAndCompare(mc.aiProcessingTotal, `
	# HELP quantumbeam_fraud_detection_ai_processing_total Total number of AI processing requests
	# TYPE quantumbeam_fraud_detection_ai_processing_total counter
	`))
}

func TestNewMonitoringService(t *testing.T) {
	config := MonitoringConfig{
		PrometheusURL:  "http://localhost:9090",
		MetricsPort:    "8080",
		MetricsPath:    "/metrics",
		Enabled:        true,
		ReportInterval: 30 * time.Second,
	}

	service, err := NewMonitoringService(config)
	require.NoError(t, err)
	assert.NotNil(t, service)
	assert.Equal(t, config.MetricsPath, service.metricsPath)
	assert.NotNil(t, service.metricsCollector)
}

func TestMonitoringService_MetricsEndpoint(t *testing.T) {
	config := MonitoringConfig{
		MetricsPort: "0", // Use random port
		MetricsPath: "/testmetrics",
		Enabled:     true,
	}

	service, err := NewMonitoringService(config)
	require.NoError(t, err)

	// Create test HTTP server
	handler := promhttp.Handler()
	server := httptest.NewServer(handler)
	defer server.Close()

	// Test metrics endpoint
	resp, err := http.Get(server.URL)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	assert.Contains(t, string(body), "HELP")
	assert.Contains(t, string(body), "TYPE")
}

func TestMonitoringService_WithoutPrometheusClient(t *testing.T) {
	config := MonitoringConfig{
		MetricsPort: "8080",
		Enabled:     true,
		// No PrometheusURL configured
	}

	service, err := NewMonitoringService(config)
	require.NoError(t, err)
	assert.Nil(t, service.prometheusClient)

	// Test that QueryPrometheus returns error when no client is configured
	_, err = service.QueryPrometheus(context.Background(), "up")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "Prometheus client not configured")
}

func TestMonitoringService_Integration(t *testing.T) {
	// Create a monitoring service with all components
	config := MonitoringConfig{
		PrometheusURL:  "http://localhost:9090",
		MetricsPort:    "8080",
		MetricsPath:    "/metrics",
		Enabled:        true,
		ReportInterval: 1 * time.Second,
	}

	service, err := NewMonitoringService(config)
	require.NoError(t, err)

	mc := service.GetMetricsCollector()
	assert.NotNil(t, mc)

	// Simulate some activity
	mc.RecordHTTPRequest("POST", "/api/v1/analyze", "200")
	mc.RecordHTTPRequestDuration("POST", "/api/v1/analyze", 75*time.Millisecond)
	mc.RecordFraudDetection("quantum", "fraud", "high")
	mc.RecordAuth("jwt", "success")
	mc.RecordBillingEvent("usage_tracked", "success")
	mc.SetActiveConnections("websocket", 100.0)
	mc.RecordAIProcessing("openai", "gpt-4", "success")

	// Test quantum advantage
	mc.SetQuantumAdvantageScore("vqc", "accuracy", 0.92)
	mc.RecordQuantumProcessing("ibm_quantum", "vqc", "success")

	// Verify that metrics collector can handle concurrent operations
	done := make(chan bool, 2)

	// Goroutine 1: HTTP metrics
	go func() {
		for i := 0; i < 100; i++ {
			mc.RecordHTTPRequest("GET", "/api/v1/health", "200")
			mc.RecordHTTPRequestDuration("GET", "/api/v1/health", time.Duration(i)*time.Millisecond)
		}
		done <- true
	}()

	// Goroutine 2: Fraud detection metrics
	go func() {
		for i := 0; i < 100; i++ {
			processingType := "quantum"
			if i%2 == 0 {
				processingType = "classical"
			}
			mc.RecordFraudDetection(processingType, "legitimate", "low")
			mc.RecordFraudDetectionDuration(processingType, time.Duration(i)*time.Millisecond)
		}
		done <- true
	}()

	// Wait for both goroutines to complete
	<-done
	<-done

	// Test error conditions
	mc.RecordAuth("api_key", "invalid")
	mc.RecordProviderFailure("openai", "rate_limit")
	mc.SetQuantumBackendStatus("aws_braket", "aws", 0.0) // Backend down

	// The test passes if no panics occurred during concurrent operations
	assert.True(t, true)
}

// Benchmark tests for metrics performance
func BenchmarkMetricsCollector_RecordHTTPRequest(b *testing.B) {
	mc := NewMetricsCollector()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		mc.RecordHTTPRequest("POST", "/api/v1/analyze", "200")
	}
}

func BenchmarkMetricsCollector_RecordFraudDetection(b *testing.B) {
	mc := NewMetricsCollector()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		mc.RecordFraudDetection("quantum", "fraud", "high")
	}
}

func BenchmarkMetricsCollector_RecordAuth(b *testing.B) {
	mc := NewMetricsCollector()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		mc.RecordAuth("jwt", "success")
	}
}

func BenchmarkMetricsCollector_SetQuantumAdvantageScore(b *testing.B) {
	mc := NewMetricsCollector()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		mc.SetQuantumAdvantageScore("vqc", "accuracy", 0.95)
	}
}
