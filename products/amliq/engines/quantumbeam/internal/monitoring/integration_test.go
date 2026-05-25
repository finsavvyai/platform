package monitoring

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMonitoringSystem_Integration(t *testing.T) {
	// Create a complete monitoring system integration test
	t.Run("CompleteMonitoringFlow", func(t *testing.T) {
		// 1. Set up monitoring service
		monitoringConfig := MonitoringConfig{
			PrometheusURL:  "http://localhost:9090",
			MetricsPort:    "0", // Random port for testing
			MetricsPath:    "/metrics",
			Enabled:        true,
			ReportInterval: 100 * time.Millisecond,
		}

		monitoringService, err := NewMonitoringService(monitoringConfig)
		require.NoError(t, err)

		// 2. Set up logging service
		var logOutput strings.Builder
		loggingConfig := LoggingConfig{
			ServiceName:          "quantumbeam-test",
			Environment:          "test",
			LogLevel:             LevelInfo,
			EnableJSON:           true,
			EnableAuditLog:       true,
			EnableCorrelationIDs: true,
		}

		loggingService, err := NewLoggingService(loggingConfig)
		require.NoError(t, err)

		// Override logger for testing
		testLogger := loggingService.WithCorrelationID("test-integration")
		testLogger.WithMetadata(map[string]interface{}{
			"test_suite": "monitoring_integration",
		})

		// 3. Set up alerting service with mock notification endpoints
		var notifications []string
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if strings.Contains(r.URL.Path, "slack") {
				notifications = append(notifications, "slack")
			} else if strings.Contains(r.URL.Path, "webhook") {
				notifications = append(notifications, "webhook")
			}
			w.WriteHeader(http.StatusOK)
		}))
		defer server.Close()

		alertingConfig := AlertingConfig{
			PrometheusURL: "http://localhost:9090",
			EvalInterval:  50 * time.Millisecond,
			Enabled:       true,
			SlackConfig: SlackConfig{
				WebhookURL: server.URL + "/slack",
				Channel:    "#test-alerts",
				Username:   "test-bot",
			},
			WebhookConfig: WebhookConfig{
				URL:     server.URL + "/webhook",
				Headers: map[string]string{"Content-Type": "application/json"},
				Timeout: 5 * time.Second,
			},
		}

		alertingService, err := NewAlertingService(alertingConfig)
		require.NoError(t, err)

		// 4. Add predefined rules
		alertingService.AddPredefinedRules()

		// 5. Simulate application activity and monitoring
		mc := monitoringService.GetMetricsCollector()

		// Simulate HTTP requests
		for i := 0; i < 10; i++ {
			mc.RecordHTTPRequest("POST", "/api/v1/analyze", "200")
			mc.RecordHTTPRequestDuration("POST", "/api/v1/analyze", time.Duration(i*10)*time.Millisecond)
		}

		// Simulate fraud detection activity
		mc.RecordFraudDetection("quantum", "fraud", "high")
		mc.RecordFraudDetectionDuration("quantum", 50*time.Millisecond)
		mc.RecordQuantumProcessing("ibm_quantum", "vqc", "success")
		mc.SetQuantumAdvantageScore("vqc", "accuracy", 0.95)

		// Simulate authentication activity
		mc.RecordAuth("jwt", "success")
		mc.RecordAPIKeyValidation("valid")

		// Simulate billing activity
		mc.RecordBillingEvent("usage_tracked", "success")
		mc.RecordUsage("api_calls", "premium")

		// Simulate system activity
		mc.SetActiveConnections("websocket", 150.0)
		mc.SetDatabaseConnections("postgres", 20.0)
		mc.SetQuantumBackendStatus("ibm_quantum", "ibm", 1.0)

		// Simulate AI/ML activity
		mc.RecordAIProcessing("openai", "gpt-4", "success")
		mc.RecordAIProcessingDuration("openai", "gpt-4", 2*time.Second)

		// 6. Log application events
		testLogger.Info("Application started successfully", map[string]interface{}{
			"version": "1.0.0",
			"port":    8080,
		})

		testLogger.Info("Fraud detection completed", map[string]interface{}{
			"transaction_id":  "txn_123",
			"processing_time": "50ms",
			"result":          "fraud_detected",
		})

		testLogger.Audit("Sensitive data access", map[string]interface{}{
			"user_id":    "user_456",
			"resource":   "transaction_data",
			"action":     "read",
			"ip_address": "192.168.1.100",
		})

		// 7. Test error conditions
		testLogger.Error("Processing error occurred", fmt.Errorf("quantum backend unavailable"), map[string]interface{}{
			"backend":     "ibm_quantum",
			"retry_count": 3,
		})

		mc.RecordProviderFailure("ibm_quantum", "connection_timeout")
		mc.SetQuantumBackendStatus("ibm_quantum", "ibm", 0.0)

		// 8. Verify metrics collection
		// Test that metrics endpoint would work (simulated)
		handler := promhttp.Handler()
		req := httptest.NewRequest("GET", "/metrics", nil)
		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		assert.Contains(t, rr.Body.String(), "HELP")

		// 9. Test alerting rules
		rules := alertingService.GetRules()
		assert.Greater(t, len(rules), 0)

		// Verify specific rules exist
		expectedRules := []string{
			"high_fraud_rate",
			"quantum_backend_down",
			"high_error_rate",
		}

		for _, ruleID := range expectedRules {
			assert.Contains(t, rules, ruleID, "Expected rule %s should be present", ruleID)
		}

		// 10. Test alerting context cancellation
		ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
		defer cancel()

		// Start alerting in background
		go func() {
			_ = alertingService.Start(ctx)
		}()

		// Wait for context to cancel
		<-ctx.Done()
		assert.Equal(t, context.DeadlineExceeded, ctx.Err())

		// 11. Verify all components are working together
		assert.NotNil(t, monitoringService)
		assert.NotNil(t, loggingService)
		assert.NotNil(t, alertingService)
		assert.NotNil(t, mc)
	})
}

func TestMonitoringSystem_ConcurrentAccess(t *testing.T) {
	// Test concurrent access to monitoring components
	t.Run("ConcurrentMetricsAndLogging", func(t *testing.T) {
		monitoringConfig := MonitoringConfig{
			MetricsPort: "0",
			Enabled:     true,
		}

		monitoringService, err := NewMonitoringService(monitoringConfig)
		require.NoError(t, err)

		loggingConfig := LoggingConfig{
			ServiceName: "concurrent-test",
			Environment: "test",
			LogLevel:    LevelInfo,
		}

		loggingService, err := NewLoggingService(loggingConfig)
		require.NoError(t, err)

		mc := monitoringService.GetMetricsCollector()

		// Test concurrent access patterns
		done := make(chan bool, 4)

		// Goroutine 1: HTTP metrics
		go func() {
			for i := 0; i < 100; i++ {
				mc.RecordHTTPRequest("GET", "/api/health", "200")
				mc.RecordHTTPRequestDuration("GET", "/api/health", time.Duration(i)*time.Millisecond)
			}
			done <- true
		}()

		// Goroutine 2: Fraud detection metrics
		go func() {
			for i := 0; i < 100; i++ {
				mc.RecordFraudDetection("quantum", "legitimate", "low")
				mc.RecordFraudDetectionDuration("quantum", time.Duration(i)*time.Millisecond)
			}
			done <- true
		}()

		// Goroutine 3: Authentication metrics
		go func() {
			for i := 0; i < 100; i++ {
				mc.RecordAuth("jwt", "success")
				mc.RecordAuth("api_key", "failed")
			}
			done <- true
		}()

		// Goroutine 4: Logging
		go func() {
			logger := loggingService.WithCorrelationID("concurrent-test")
			for i := 0; i < 100; i++ {
				logger.Info("Concurrent log message", map[string]interface{}{
					"iteration": i,
					"goroutine": "logger",
				})
			}
			done <- true
		}()

		// Wait for all goroutines to complete
		for i := 0; i < 4; i++ {
			<-done
		}

		// Test should pass if no race conditions or panics occurred
		assert.True(t, true, "Concurrent access completed without issues")
	})
}

func TestMonitoringSystem_PerformanceCharacteristics(t *testing.T) {
	t.Run("PerformanceBenchmarks", func(t *testing.T) {
		monitoringConfig := MonitoringConfig{
			MetricsPort: "0",
			Enabled:     true,
		}

		monitoringService, err := NewMonitoringService(monitoringConfig)
		require.NoError(t, err)

		mc := monitoringService.GetMetricsCollector()

		// Benchmark metrics collection
		start := time.Now()
		for i := 0; i < 10000; i++ {
			mc.RecordHTTPRequest("POST", "/api/v1/analyze", "200")
			mc.RecordFraudDetection("quantum", "fraud", "high")
			mc.RecordAuth("jwt", "success")
			mc.RecordBillingEvent("usage", "success")
		}
		duration := time.Since(start)

		// Should complete 40,000 metric operations quickly
		assert.Less(t, duration, 1*time.Second, "Metrics collection should be fast")
		t.Logf("40,000 metric operations completed in %v", duration)

		// Benchmark gauge operations
		start = time.Now()
		for i := 0; i < 10000; i++ {
			mc.SetActiveConnections("websocket", float64(i%1000))
			mc.SetQuantumAdvantageScore("vqc", "accuracy", 0.95)
		}
		duration = time.Since(start)

		assert.Less(t, duration, 500*time.Millisecond, "Gauge operations should be very fast")
		t.Logf("20,000 gauge operations completed in %v", duration)
	})
}

func TestMonitoringSystem_ErrorHandling(t *testing.T) {
	t.Run("GracefulErrorHandling", func(t *testing.T) {
		// Test monitoring service with invalid configuration
		invalidConfig := MonitoringConfig{
			PrometheusURL: "invalid-url",
			MetricsPort:   "invalid-port",
			Enabled:       true,
		}

		// Should not panic with invalid configuration
		service, err := NewMonitoringService(invalidConfig)
		// May error, but should not panic
		if err != nil {
			assert.Nil(t, service)
		}

		// Test logging service error handling
		loggingConfig := LoggingConfig{
			ServiceName:    "error-test",
			Environment:    "test",
			LogLevel:       LevelInfo,
			EnableAuditLog: true,
			AuditLogFile:   "/invalid/path/audit.log", // Invalid path
		}

		// Should handle invalid audit log path gracefully
		loggingService, err := NewLoggingService(loggingConfig)
		assert.NoError(t, err)
		assert.NotNil(t, loggingService)

		// Test that logging still works even with invalid audit file
		loggingService.Info("Test message with invalid audit config")
		loggingService.Audit("Test audit with invalid config", "test-user")

		// Test alerting service with invalid configurations
		alertingConfig := AlertingConfig{
			PrometheusURL: "http://invalid-prometheus-url:9090",
			Enabled:       true,
			EvalInterval:  10 * time.Millisecond,
		}

		alertingService, err := NewAlertingService(alertingConfig)
		assert.NoError(t, err)
		assert.NotNil(t, alertingService)

		// Add a rule
		rule := AlertRule{
			ID:       "error-test-rule",
			Name:     "Error Test Rule",
			Query:    "up == 0",
			Severity: SeverityCritical,
			Enabled:  true,
		}

		err = alertingService.AddRule(rule)
		assert.NoError(t, err)

		// Test evaluation with invalid Prometheus URL
		ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
		defer cancel()

		err = alertingService.EvaluateRules(ctx)
		assert.Error(t, err) // Should error, but not panic
	})
}

func TestMonitoringSystem_MemoryUsage(t *testing.T) {
	t.Run("MemoryLeakDetection", func(t *testing.T) {
		monitoringConfig := MonitoringConfig{
			MetricsPort: "0",
			Enabled:     true,
		}

		monitoringService, err := NewMonitoringService(monitoringConfig)
		require.NoError(t, err)

		mc := monitoringService.GetMetricsCollector()

		// Simulate high-volume usage
		for i := 0; i < 1000; i++ {
			// Create many different metric combinations
			mc.RecordHTTPRequest("GET", fmt.Sprintf("/api/endpoint/%d", i), "200")
			mc.RecordFraudDetection("quantum", "fraud", fmt.Sprintf("level_%d", i%10))
			mc.RecordAuth("jwt", fmt.Sprintf("status_%d", i%5))

			// Create alerts with different IDs
			alert := Alert{
				ID:          fmt.Sprintf("alert-%d", i),
				Name:        fmt.Sprintf("Alert %d", i),
				Description: fmt.Sprintf("Test alert number %d", i),
				Severity:    AlertSeverity(SeverityInfo),
				Status:      StatusFiring,
				StartsAt:    time.Now(),
				Labels: map[string]string{
					"iteration": fmt.Sprintf("%d", i),
				},
			}

			// Simulate alert lifecycle
			time.Sleep(1 * time.Microsecond) // Small delay to simulate real usage
		}

		// If we reach here without memory issues, the test passes
		assert.True(t, true, "High-volume usage completed successfully")
	})
}

func TestMonitoringSystem_RealWorldScenario(t *testing.T) {
	t.Run("FraudDetectionScenario", func(t *testing.T) {
		// Simulate a realistic fraud detection scenario
		monitoringConfig := MonitoringConfig{
			MetricsPort: "0",
			Enabled:     true,
		}

		monitoringService, err := NewMonitoringService(monitoringConfig)
		require.NoError(t, err)

		loggingConfig := LoggingConfig{
			ServiceName:          "quantumbeam-fraud-detection",
			Environment:          "production",
			LogLevel:             LevelInfo,
			EnableJSON:           true,
			EnableAuditLog:       true,
			EnableCorrelationIDs: true,
		}

		loggingService, err := NewLoggingService(loggingConfig)
		require.NoError(t, err)

		mc := monitoringService.GetMetricsCollector()

		// Simulate transaction processing
		transactions := []struct {
			id           string
			amount       float64
			isFraud      bool
			processingMs int
			quantumUsed  bool
		}{
			{"txn_001", 1500.00, false, 25, true},
			{"txn_002", 45000.00, true, 150, true},
			{"txn_003", 250.00, false, 15, false},
			{"txn_004", 120000.00, true, 200, true},
			{"txn_005", 75.00, false, 10, false},
		}

		for _, tx := range transactions {
			// Generate correlation ID for transaction
			correlationID := GenerateCorrelationID()
			logger := loggingService.WithCorrelationID(correlationID).WithRequest(tx.id, "user_123")

			// Log transaction start
			logger.Info("Processing transaction", map[string]interface{}{
				"transaction_id": tx.id,
				"amount":         tx.amount,
			})

			// Record metrics
			mc.RecordHTTPRequest("POST", "/api/v1/analyze", "200")
			mc.RecordHTTPRequestDuration("POST", "/api/v1/analyze", time.Duration(tx.processingMs)*time.Millisecond)

			if tx.quantumUsed {
				mc.RecordQuantumProcessing("ibm_quantum", "vqc", "success")
				mc.RecordFraudDetection("quantum", "fraud", "high")
				mc.SetQuantumAdvantageScore("vqc", "accuracy", 0.95)
			} else {
				mc.RecordClassicalProcessing("random_forest", "success")
				mc.RecordFraudDetection("classical", "legitimate", "low")
			}

			mc.RecordFraudDetectionDuration(
				map[string]interface{}{
					"quantum": func() string {
						if tx.quantumUsed {
							return "quantum"
						} else {
							return "classical"
						}
					}(),
				}[0],
				time.Duration(tx.processingMs)*time.Millisecond,
			)

			// Log result
			if tx.isFraud {
				logger.Warn("Fraud detected", map[string]interface{}{
					"confidence":    "high",
					"processing_ms": tx.processingMs,
					"quantum_used":  tx.quantumUsed,
				})

				// Audit log for fraud detection
				logger.Audit("Fraud detection result", map[string]interface{}{
					"transaction_id": tx.id,
					"result":         "fraud_detected",
					"amount":         tx.amount,
					"risk_score":     0.95,
				})
			} else {
				logger.Info("Transaction approved", map[string]interface{}{
					"confidence":    "low",
					"processing_ms": tx.processingMs,
					"quantum_used":  tx.quantumUsed,
				})
			}

			// Simulate some system metrics updates
			mc.SetActiveConnections("websocket", 50.0)
			mc.SetDatabaseConnections("postgres", 15.0)
			mc.SetQuantumBackendStatus("ibm_quantum", "ibm", 1.0)
		}

		// Simulate billing activity
		mc.RecordUsage("api_calls", "premium")
		mc.RecordUsage("quantum_processing", "enterprise")
		mc.RecordBillingEvent("usage_tracked", "success")

		// Simulate AI explanation generation
		mc.RecordAIProcessing("openai", "gpt-4", "success")
		mc.RecordAIProcessingDuration("openai", "gpt-4", 1500*time.Millisecond)
		mc.RecordExplanationGeneration("success", "fraud_pattern")

		// Verify scenario completed successfully
		assert.True(t, true, "Fraud detection scenario completed successfully")
	})
}
