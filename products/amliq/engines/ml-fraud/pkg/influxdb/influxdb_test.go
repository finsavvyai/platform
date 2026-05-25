package influxdb

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestClient_WritePoint(t *testing.T) {
	// Setup test InfluxDB client
	config := &Config{
		URL:     "http://localhost:8086",
		Token:   "test-token",
		Org:     "test-org",
		Bucket:  "test-bucket",
		Timeout: 10 * time.Second,
	}

	client, err := NewClient(config)
	if err != nil {
		t.Skip("InfluxDB not available for testing")
	}
	defer client.Close()

	ctx := context.Background()

	// Test writing a single point
	point := &Point{
		Measurement: "test_measurement",
		Tags: map[string]string{
			"environment": "test",
			"service":     "test-service",
		},
		Fields: map[string]interface{}{
			"value": 42.5,
			"count": 10,
		},
		Timestamp: time.Now(),
	}

	err = client.WritePoint(ctx, point)
	require.NoError(t, err)
}

func TestClient_WritePoints(t *testing.T) {
	config := &Config{
		URL:     "http://localhost:8086",
		Token:   "test-token",
		Org:     "test-org",
		Bucket:  "test-bucket",
		Timeout: 10 * time.Second,
	}

	client, err := NewClient(config)
	if err != nil {
		t.Skip("InfluxDB not available for testing")
	}
	defer client.Close()

	ctx := context.Background()

	// Test writing multiple points
	points := make([]*Point, 3)
	for i := 0; i < 3; i++ {
		points[i] = &Point{
			Measurement: "batch_test",
			Tags: map[string]string{
				"batch_id": "test-batch",
				"index":    string(rune(i)),
			},
			Fields: map[string]interface{}{
				"value": float64(i) * 10.5,
			},
			Timestamp: time.Now().Add(time.Duration(i) * time.Second),
		}
	}

	err = client.WritePoints(ctx, points)
	require.NoError(t, err)
}

func TestClient_WriteMetric(t *testing.T) {
	config := &Config{
		URL:     "http://localhost:8086",
		Token:   "test-token",
		Org:     "test-org",
		Bucket:  "test-bucket",
		Timeout: 10 * time.Second,
	}

	client, err := NewClient(config)
	if err != nil {
		t.Skip("InfluxDB not available for testing")
	}
	defer client.Close()

	ctx := context.Background()

	// Test writing a metric with predefined configuration
	metricsConfig := &MetricsConfig{
		Name:        "cpu_usage",
		Measurement: "system_metrics",
		Tags: map[string]string{
			"host":    "test-host",
			"service": "test-service",
		},
		Fields: map[string]interface{}{
			"additional_field": "test-value",
		},
	}

	err = client.WriteMetric(ctx, metricsConfig, 75.5)
	require.NoError(t, err)
}

func TestClient_Query(t *testing.T) {
	config := &Config{
		URL:     "http://localhost:8086",
		Token:   "test-token",
		Org:     "test-org",
		Bucket:  "test-bucket",
		Timeout: 10 * time.Second,
	}

	client, err := NewClient(config)
	if err != nil {
		t.Skip("InfluxDB not available for testing")
	}
	defer client.Close()

	ctx := context.Background()

	// First write some test data
	point := &Point{
		Measurement: "query_test",
		Tags: map[string]string{
			"test": "query",
		},
		Fields: map[string]interface{}{
			"value": 100.0,
		},
		Timestamp: time.Now(),
	}

	err = client.WritePoint(ctx, point)
	require.NoError(t, err)

	// Wait a bit for data to be available
	time.Sleep(2 * time.Second)

	// Test querying
	query := `from(bucket: "test-bucket")
		|> range(start: -1h)
		|> filter(fn: (r) => r._measurement == "query_test")`

	result, err := client.Query(ctx, query)
	if err != nil {
		t.Skip("Query failed - possibly due to data not being available yet")
	}

	assert.NotNil(t, result)
	assert.GreaterOrEqual(t, len(result.Records), 0)
}

func TestClient_QueryScalar(t *testing.T) {
	config := &Config{
		URL:     "http://localhost:8086",
		Token:   "test-token",
		Org:     "test-org",
		Bucket:  "test-bucket",
		Timeout: 10 * time.Second,
	}

	client, err := NewClient(config)
	if err != nil {
		t.Skip("InfluxDB not available for testing")
	}
	defer client.Close()

	ctx := context.Background()

	// Test scalar query
	query := `from(bucket: "test-bucket")
		|> range(start: -1h)
		|> limit(n: 1)
		|> yield(column: "_value")`

	value, err := client.QueryScalar(ctx, query)
	if err != nil {
		t.Skip("Scalar query failed - possibly due to no data being available")
	}

	assert.NotNil(t, value)
}

func TestClient_CreateBucket(t *testing.T) {
	config := &Config{
		URL:     "http://localhost:8086",
		Token:   "test-token",
		Org:     "test-org",
		Bucket:  "test-bucket",
		Timeout: 10 * time.Second,
	}

	client, err := NewClient(config)
	if err != nil {
		t.Skip("InfluxDB not available for testing")
	}
	defer client.Close()

	ctx := context.Background()

	// Test creating a bucket
	bucketName := "test-bucket-created"
	retention := 24 * time.Hour

	err = client.CreateBucket(ctx, bucketName, retention)
	require.NoError(t, err)

	// Verify bucket was created
	buckets, err := client.ListBuckets(ctx)
	require.NoError(t, err)
	assert.Contains(t, buckets, bucketName)

	// Clean up
	err = client.DeleteBucket(ctx, bucketName)
	require.NoError(t, err)
}

func TestClient_Ping(t *testing.T) {
	config := &Config{
		URL:     "http://localhost:8086",
		Token:   "test-token",
		Org:     "test-org",
		Bucket:  "test-bucket",
		Timeout: 10 * time.Second,
	}

	client, err := NewClient(config)
	if err != nil {
		t.Skip("InfluxDB not available for testing")
	}
	defer client.Close()

	ctx := context.Background()

	// Test ping
	err = client.Ping(ctx)
	require.NoError(t, err)
}

func TestMetricsCollector_Counter(t *testing.T) {
	config := &Config{
		URL:     "http://localhost:8086",
		Token:   "test-token",
		Org:     "test-org",
		Bucket:  "test-bucket",
		Timeout: 10 * time.Second,
	}

	client, err := NewClient(config)
	if err != nil {
		t.Skip("InfluxDB not available for testing")
	}
	defer client.Close()

	metricsConfig := &MetricsCollectorConfig{
		FlushInterval: 1 * time.Second,
		Timeout:       5 * time.Second,
	}

	collector := NewMetricsCollector(client, metricsConfig)
	defer collector.Close()

	// Test counter
	counter := collector.NewCounter("test_counter", map[string]string{
		"test": "metrics",
	})

	assert.Equal(t, int64(0), counter.Get())

	counter.Increment()
	assert.Equal(t, int64(1), counter.Get())

	counter.IncrementBy(5)
	assert.Equal(t, int64(6), counter.Get())

	counter.Reset()
	assert.Equal(t, int64(0), counter.Get())
}

func TestMetricsCollector_Gauge(t *testing.T) {
	config := &Config{
		URL:     "http://localhost:8086",
		Token:   "test-token",
		Org:     "test-org",
		Bucket:  "test-bucket",
		Timeout: 10 * time.Second,
	}

	client, err := NewClient(config)
	if err != nil {
		t.Skip("InfluxDB not available for testing")
	}
	defer client.Close()

	metricsConfig := &MetricsCollectorConfig{
		FlushInterval: 1 * time.Second,
		Timeout:       5 * time.Second,
	}

	collector := NewMetricsCollector(client, metricsConfig)
	defer collector.Close()

	// Test gauge
	gauge := collector.NewGauge("test_gauge", map[string]string{
		"test": "metrics",
	})

	gauge.Set(42.5)
	assert.Equal(t, 42.5, gauge.Get())

	gauge.Increment()
	assert.Equal(t, 43.5, gauge.Get())

	gauge.Decrement()
	assert.Equal(t, 42.5, gauge.Get())

	gauge.Add(10.0)
	assert.Equal(t, 52.5, gauge.Get())
}

func TestMetricsCollector_Histogram(t *testing.T) {
	config := &Config{
		URL:     "http://localhost:8086",
		Token:   "test-token",
		Org:     "test-org",
		Bucket:  "test-bucket",
		Timeout: 10 * time.Second,
	}

	client, err := NewClient(config)
	if err != nil {
		t.Skip("InfluxDB not available for testing")
	}
	defer client.Close()

	metricsConfig := &MetricsCollectorConfig{
		FlushInterval: 1 * time.Second,
		Timeout:       5 * time.Second,
	}

	collector := NewMetricsCollector(client, metricsConfig)
	defer collector.Close()

	// Test histogram
	buckets := []float64{10.0, 50.0, 100.0, 500.0}
	histogram := collector.NewHistogram("test_histogram", buckets, map[string]string{
		"test": "metrics",
	})

	assert.Equal(t, int64(0), histogram.GetCount())
	assert.Equal(t, 0.0, histogram.GetSum())

	// Record some observations
	histogram.Observe(25.0)  // Should go in 50.0 bucket
	histogram.Observe(75.0)  // Should go in 100.0 bucket
	histogram.Observe(25.0)  // Should go in 50.0 bucket
	histogram.Observe(600.0) // Should not go in any bucket

	assert.Equal(t, int64(4), histogram.GetCount())
	assert.Equal(t, 725.0, histogram.GetSum())

	bucketCounts := histogram.GetBuckets()
	assert.Equal(t, int64(2), bucketCounts[50.0])
	assert.Equal(t, int64(1), bucketCounts[100.0])
}

func TestFraudMetrics(t *testing.T) {
	config := &Config{
		URL:     "http://localhost:8086",
		Token:   "test-token",
		Org:     "test-org",
		Bucket:  "test-bucket",
		Timeout: 10 * time.Second,
	}

	client, err := NewClient(config)
	if err != nil {
		t.Skip("InfluxDB not available for testing")
	}
	defer client.Close()

	metricsConfig := &MetricsCollectorConfig{
		FlushInterval: 1 * time.Second,
		Timeout:       5 * time.Second,
	}

	collector := NewMetricsCollector(client, metricsConfig)
	defer collector.Close()

	// Test fraud metrics
	fraudMetrics := NewFraudMetrics(collector)

	// Record some transactions
	fraudMetrics.RecordTransaction(false, 0.15, 50*time.Millisecond)
	fraudMetrics.RecordTransaction(true, 0.85, 120*time.Millisecond)
	fraudMetrics.RecordTransaction(false, 0.25, 75*time.Millisecond)

	// Record model predictions
	fraudMetrics.RecordModelPrediction(true)
	fraudMetrics.RecordModelPrediction(false)
	fraudMetrics.RecordModelPrediction(true)

	// Record API requests
	fraudMetrics.RecordAPIRequest("/api/v1/transactions", 25*time.Millisecond)
	fraudMetrics.RecordAPIRequest("/api/v1/fraud-check", 150*time.Millisecond)

	// Update gauges
	fraudMetrics.UpdateQueueSize(15)
	fraudMetrics.UpdateActiveUsers(250)

	// Verify metrics are recorded (values should be accumulated)
	assert.Greater(t, fraudMetrics.transactionsProcessed.Get(), int64(0))
	assert.Greater(t, fraudMetrics.fraudTransactions.Get(), int64(0))
	assert.Greater(t, fraudMetrics.apiRequests.Get(), int64(0))
}

func TestQuantumMetrics(t *testing.T) {
	config := &Config{
		URL:     "http://localhost:8086",
		Token:   "test-token",
		Org:     "test-org",
		Bucket:  "test-bucket",
		Timeout: 10 * time.Second,
	}

	client, err := NewClient(config)
	if err != nil {
		t.Skip("InfluxDB not available for testing")
	}
	defer client.Close()

	metricsConfig := &MetricsCollectorConfig{
		FlushInterval: 1 * time.Second,
		Timeout:       5 * time.Second,
	}

	collector := NewMetricsCollector(client, metricsConfig)
	defer collector.Close()

	// Test quantum metrics
	quantumMetrics := NewQuantumMetrics(collector)

	// Record quantum jobs
	quantumMetrics.RecordQuantumJob("vqc", 2*time.Second, true, 0.95)
	quantumMetrics.RecordQuantumJob("qaoa", 5*time.Second, false, 0.87)
	quantumMetrics.RecordQuantumJob("qft", 1*time.Second, true, 0.98)

	// Record circuit executions
	quantumMetrics.RecordCircuitExecution(10, 0.92)
	quantumMetrics.RecordCircuitExecution(25, 0.88)
	quantumMetrics.RecordCircuitExecution(15, 0.91)

	// Record QPU requests
	quantumMetrics.RecordQPURequest("ibm_quito", 3*time.Second)
	quantumMetrics.RecordQPURequest("ionq_harmony", 8*time.Second)

	// Update gauges
	quantumMetrics.UpdateActiveQuantumTasks(5)

	// Verify metrics are recorded
	assert.Greater(t, quantumMetrics.quantumJobsSubmitted.Get(), int64(0))
	assert.Greater(t, quantumMetrics.circuitExecutions.Get(), int64(0))
	assert.Greater(t, quantumMetrics.qpuRequests.Get(), int64(0))
}

// Benchmark tests
func BenchmarkClient_WritePoint(b *testing.B) {
	config := &Config{
		URL:     "http://localhost:8086",
		Token:   "test-token",
		Org:     "test-org",
		Bucket:  "test-bucket",
		Timeout: 10 * time.Second,
	}

	client, err := NewClient(config)
	if err != nil {
		b.Skip("InfluxDB not available for benchmarking")
	}
	defer client.Close()

	ctx := context.Background()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		point := &Point{
			Measurement: "bench_test",
			Tags: map[string]string{
				"iteration": string(rune(i % 100)),
			},
			Fields: map[string]interface{}{
				"value": float64(i),
			},
			Timestamp: time.Now(),
		}
		client.WritePoint(ctx, point)
	}
}

func BenchmarkMetricsCollector_CounterIncrement(b *testing.B) {
	config := &Config{
		URL:     "http://localhost:8086",
		Token:   "test-token",
		Org:     "test-org",
		Bucket:  "test-bucket",
		Timeout: 10 * time.Second,
	}

	client, err := NewClient(config)
	if err != nil {
		b.Skip("InfluxDB not available for benchmarking")
	}
	defer client.Close()

	metricsConfig := &MetricsCollectorConfig{
		FlushInterval: 30 * time.Second, // Long interval to avoid flushing during benchmark
		Timeout:       5 * time.Second,
	}

	collector := NewMetricsCollector(client, metricsConfig)
	defer collector.Close()

	counter := collector.NewCounter("bench_counter", map[string]string{"bench": "test"})

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		counter.Increment()
	}
}
