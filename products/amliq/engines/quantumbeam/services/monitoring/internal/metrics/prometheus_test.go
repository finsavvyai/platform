package metrics

import (
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"
	"github.com/stretchr/testify/assert"
)

func TestNewMetricsCollector(t *testing.T) {
	collector := NewMetricsCollector()
	assert.NotNil(t, collector)
	assert.NotNil(t, collector.httpRequestsTotal)
	assert.NotNil(t, collector.fraudDetectionsTotal)
	assert.NotNil(t, collector.quantumProcessingTotal)
}

func TestRecordHTTPRequest(t *testing.T) {
	collector := NewMetricsCollector()

	// Record a sample HTTP request
	collector.RecordHTTPRequest(
		"POST",
		"/api/v1/analyze",
		"200",
		"user123",
		100*time.Millisecond,
		1024,
		2048,
	)

	// Verify the counter was incremented
	metric := &dto.Metric{}
	err := collector.httpRequestsTotal.WithLabelValues("POST", "/api/v1/analyze", "200", "user123").Write(metric)
	assert.NoError(t, err)
	assert.Equal(t, float64(1), metric.GetCounter().GetValue())

	// Verify the histogram was updated
	metric = &dto.Metric{}
	err = collector.httpRequestDuration.WithLabelValues("POST", "/api/v1/analyze", "200").Write(metric)
	assert.NoError(t, err)
	assert.Equal(t, 1, len(metric.GetHistogram().GetSample().GetCount()))
}

func TestRecordFraudDetection(t *testing.T) {
	collector := NewMetricsCollector()

	// Record a fraud detection
	collector.RecordFraudDetection(
		"user123",
		"credit_card",
		"quantum",
		"fraud_detected",
		150*time.Millisecond,
	)

	// Verify counters were incremented
	metric := &dto.Metric{}
	err := collector.fraudDetectionsTotal.WithLabelValues("user123", "credit_card", "quantum", "fraud_detected").Write(metric)
	assert.NoError(t, err)
	assert.Equal(t, float64(1), metric.GetCounter().GetValue())

	err = collector.transactionsProcessed.WithLabelValues("user123", "quantum", "fraud_detected").Write(metric)
	assert.NoError(t, err)
	assert.Equal(t, float64(1), metric.GetCounter().GetValue())

	// Verify histogram was updated
	metric = &dto.Metric{}
	err = collector.fraudDetectionDuration.WithLabelValues("quantum", "user123").Write(metric)
	assert.NoError(t, err)
	assert.Equal(t, 1, len(metric.GetHistogram().GetSample().GetCount()))
}

func TestRecordQuantumProcessing(t *testing.T) {
	collector := NewMetricsCollector()

	// Record quantum processing
	collector.RecordQuantumProcessing(
		"ibm_qasm",
		"vqc",
		"user123",
		500*time.Millisecond,
	)

	// Verify counter was incremented
	metric := &dto.Metric{}
	err := collector.quantumProcessingTotal.WithLabelValues("ibm_qasm", "vqc", "user123").Write(metric)
	assert.NoError(t, err)
	assert.Equal(t, float64(1), metric.GetCounter().GetValue())
}

func TestUpdateQuantumAdvantage(t *testing.T) {
	collector := NewMetricsCollector()

	// Update quantum advantage score
	collector.UpdateQuantumAdvantage("vqc", "ibm_qasm", 0.95)

	// Verify gauge was set
	metric := &dto.Metric{}
	err := collector.quantumAdvantageScore.WithLabelValues("vqc", "ibm_qasm").Write(metric)
	assert.NoError(t, err)
	assert.Equal(t, 0.95, metric.GetGauge().GetValue())
}

func TestUpdateAccuracy(t *testing.T) {
	collector := NewMetricsCollector()

	// Update accuracy metrics
	collector.UpdateAccuracy("quantum", "vqc", 0.987, 0.012, 0.001)

	// Verify gauges were set
	metric := &dto.Metric{}
	err := collector.accuracyScore.WithLabelValues("quantum", "vqc").Write(metric)
	assert.NoError(t, err)
	assert.Equal(t, 0.987, metric.GetGauge().GetValue())

	err = collector.falsePositiveRate.WithLabelValues("quantum", "vqc").Write(metric)
	assert.NoError(t, err)
	assert.Equal(t, 0.012, metric.GetGauge().GetValue())

	err = collector.falseNegativeRate.WithLabelValues("quantum", "vqc").Write(metric)
	assert.NoError(t, err)
	assert.Equal(t, 0.001, metric.GetGauge().GetValue())
}

func TestRecordQuantumCircuitExecution(t *testing.T) {
	collector := NewMetricsCollector()

	// Record quantum circuit execution
	collector.RecordQuantumCircuitExecution(
		"aws_braket",
		"qaoa",
		8,
		100,
		2*time.Second,
	)

	// Verify counter was incremented
	metric := &dto.Metric{}
	err := collector.quantumCircuitExecutions.WithLabelValues("aws_braket", "qaoa", "8", "100").Write(metric)
	assert.NoError(t, err)
	assert.Equal(t, float64(1), metric.GetCounter().GetValue())

	// Verify histogram was updated
	metric = &dto.Metric{}
	err = collector.quantumCircuitDuration.WithLabelValues("aws_braket", "qaoa", "8").Write(metric)
	assert.NoError(t, err)
	assert.Equal(t, 1, len(metric.GetHistogram().GetSample().GetCount()))
}

func TestUpdateQuantumBackendAvailability(t *testing.T) {
	collector := NewMetricsCollector()

	// Update backend availability
	collector.UpdateQuantumBackendAvailability("ibm_qasm", "ibm", 0.98)

	// Verify gauge was set
	metric := &dto.Metric{}
	err := collector.quantumBackendAvailability.WithLabelValues("ibm_qasm", "ibm").Write(metric)
	assert.NoError(t, err)
	assert.Equal(t, 0.98, metric.GetGauge().GetValue())
}

func TestUpdateBusinessMetrics(t *testing.T) {
	collector := NewMetricsCollector()

	// Update business metrics
	activeUsers := map[string]float64{
		"starter":    1000,
		"professional": 500,
		"enterprise": 50,
	}

	subscriptions := map[string]float64{
		"starter":    950,
		"professional": 480,
		"enterprise": 45,
	}

	revenue := map[string]float64{
		"starter":    299000,
		"professional": 479520,
		"enterprise": 100000,
	}

	collector.UpdateBusinessMetrics(activeUsers, subscriptions, revenue)

	// Verify gauges were set
	for plan, count := range activeUsers {
		metric := &dto.Metric{}
		err := collector.activeUsers.WithLabelValues(plan, "active").Write(metric)
		assert.NoError(t, err)
		assert.Equal(t, count, metric.GetGauge().GetValue())
	}

	for plan, count := range subscriptions {
		metric := &dto.Metric{}
		err := collector.subscriptionsActive.WithLabelValues(plan, "active").Write(metric)
		assert.NoError(t, err)
		assert.Equal(t, count, metric.GetGauge().GetValue())
	}

	for plan, amount := range revenue {
		metric := &dto.Metric{}
		err := collector.revenueMonthly.WithLabelValues(plan, "USD").Write(metric)
		assert.NoError(t, err)
		assert.Equal(t, amount, metric.GetGauge().GetValue())
	}
}

func TestUpdateSystemMetrics(t *testing.T) {
	collector := NewMetricsCollector()

	// Update system metrics
	cpu := map[string]float64{
		"instance1": 45.5,
		"instance2": 32.1,
	}

	memory := map[string]float64{
		"instance1": 8.5 * 1024 * 1024 * 1024,
		"instance2": 4.2 * 1024 * 1024 * 1024,
	}

	dbConnections := map[string]float64{
		"main":    15,
		"replica": 8,
	}

	redisConnections := map[string]float64{
		"cache": 25,
		"session": 12,
	}

	queueSize := map[string]float64{
		"fraud_detection": 150,
		"billing":         25,
	}

	collector.UpdateSystemMetrics(cpu, memory, dbConnections, redisConnections, queueSize)

	// Verify gauges were set
	for instance, usage := range cpu {
		metric := &dto.Metric{}
		err := collector.cpuUsage.WithLabelValues(instance, "total").Write(metric)
		assert.NoError(t, err)
		assert.Equal(t, usage, metric.GetGauge().GetValue())
	}

	for instance, usage := range memory {
		metric := &dto.Metric{}
		err := collector.memoryUsage.WithLabelValues(instance, "used").Write(metric)
		assert.NoError(t, err)
		assert.Equal(t, usage, metric.GetGauge().GetValue())
	}
}

func TestRecordSecurityEvent(t *testing.T) {
	collector := NewMetricsCollector()

	// Record security events
	collector.RecordSecurityEvent("login", "user123", "success", "")
	collector.RecordSecurityEvent("auth_failure", "user123", "failed", "invalid_credentials")
	collector.RecordSecurityEvent("rate_limit", "user123", "violated", "api")
	collector.RecordSecurityEvent("security_alert", "user123", "detected", "suspicious_activity")

	// Verify counters were incremented
	metric := &dto.Metric{}
	err := collector.loginAttemptsTotal.WithLabelValues("user123", "success", "password").Write(metric)
	assert.NoError(t, err)
	assert.Equal(t, float64(1), metric.GetCounter().GetValue())

	err = collector.failedAuthAttemptsTotal.WithLabelValues("user123", "invalid_credentials", "api_key").Write(metric)
	assert.NoError(t, err)
	assert.Equal(t, float64(1), metric.GetCounter().GetValue())

	err = collector.rateLimitViolationsTotal.WithLabelValues("user123", "api", "requests_per_minute").Write(metric)
	assert.NoError(t, err)
	assert.Equal(t, float64(1), metric.GetCounter().GetValue())

	err = collector.securityAlertsTotal.WithLabelValues("suspicious_activity", "high", "user123").Write(metric)
	assert.NoError(t, err)
	assert.Equal(t, float64(1), metric.GetCounter().GetValue())
}

func TestMetricsLabels(t *testing.T) {
	collector := NewMetricsCollector()

	// Record metrics with different labels
	collector.RecordHTTPRequest("GET", "/health", "200", "", 10*time.Millisecond, 0, 0)
	collector.RecordHTTPRequest("POST", "/api/v1/analyze", "200", "user123", 100*time.Millisecond, 1024, 2048)
	collector.RecordHTTPRequest("GET", "/api/v1/status", "500", "user456", 200*time.Millisecond, 512, 0)

	// Verify each metric has the correct labels
	tests := []struct {
		method      string
		endpoint    string
		statusCode  string
		userID      string
		expectCount float64
	}{
		{"GET", "/health", "200", "", 1},
		{"POST", "/api/v1/analyze", "200", "user123", 1},
		{"GET", "/api/v1/status", "500", "user456", 1},
	}

	for _, test := range tests {
		metric := &dto.Metric{}
		err := collector.httpRequestsTotal.WithLabelValues(test.method, test.endpoint, test.statusCode, test.userID).Write(metric)
		assert.NoError(t, err)
		assert.Equal(t, test.expectCount, metric.GetCounter().GetValue())
	}
}

func TestMetricsConcurrency(t *testing.T) {
	collector := NewMetricsCollector()

	// Test concurrent metric recording
	done := make(chan bool, 10)
	for i := 0; i < 10; i++ {
		go func(id int) {
			collector.RecordHTTPRequest(
				"POST",
				"/api/v1/analyze",
				"200",
				"user123",
				time.Duration(id)*time.Millisecond,
				1024,
				2048,
			)
			done <- true
		}(i)
	}

	// Wait for all goroutines to complete
	for i := 0; i < 10; i++ {
		<-done
	}

	// Verify all metrics were recorded
	metric := &dto.Metric{}
	err := collector.httpRequestsTotal.WithLabelValues("POST", "/api/v1/analyze", "200", "user123").Write(metric)
	assert.NoError(t, err)
	assert.Equal(t, float64(10), metric.GetCounter().GetValue())
}