// Package influxdb provides metrics collection functionality for QuantumBeam.io
package influxdb

import (
	"context"
	"fmt"
	"time"

	"github.com/rs/zerolog/log"
)

// MetricsCollector handles collection of various metrics for QuantumBeam
type MetricsCollector struct {
	client     *Client
	config     *MetricsCollectorConfig
	counters   map[string]*Counter
	gauges     map[string]*Gauge
	histograms map[string]*Histogram
}

// MetricsCollectorConfig holds metrics collector configuration
type MetricsCollectorConfig struct {
	DefaultTags       map[string]string
	FlushInterval     time.Duration
	BatchSize         int
	Timeout           time.Duration
	EnableCompression bool
}

// Counter represents a counter metric
type Counter struct {
	name      string
	value     int64
	tags      map[string]string
	collector *MetricsCollector
}

// Gauge represents a gauge metric
type Gauge struct {
	name      string
	value     float64
	tags      map[string]string
	collector *MetricsCollector
}

// Histogram represents a histogram metric
type Histogram struct {
	name      string
	buckets   []float64
	observer  map[float64]int64
	count     int64
	sum       float64
	tags      map[string]string
	collector *MetricsCollector
}

// NewMetricsCollector creates a new metrics collector
func NewMetricsCollector(client *Client, config *MetricsCollectorConfig) *MetricsCollector {
	if config == nil {
		config = defaultMetricsConfig()
	}

	collector := &MetricsCollector{
		client:     client,
		config:     config,
		counters:   make(map[string]*Counter),
		gauges:     make(map[string]*Gauge),
		histograms: make(map[string]*Histogram),
	}

	// Start periodic flush
	go collector.flushPeriodically()

	return collector
}

// defaultMetricsConfig returns default metrics collector configuration
func defaultMetricsConfig() *MetricsCollectorConfig {
	return &MetricsCollectorConfig{
		DefaultTags:       map[string]string{},
		FlushInterval:     10 * time.Second,
		BatchSize:         100,
		Timeout:           5 * time.Second,
		EnableCompression: true,
	}
}

// NewCounter creates a new counter metric
func (mc *MetricsCollector) NewCounter(name string, tags map[string]string) *Counter {
	key := mc.metricKey(name, tags)

	counter := &Counter{
		name:      name,
		value:     0,
		tags:      mc.mergeTags(tags),
		collector: mc,
	}

	mc.counters[key] = counter
	return counter
}

// NewGauge creates a new gauge metric
func (mc *MetricsCollector) NewGauge(name string, tags map[string]string) *Gauge {
	key := mc.metricKey(name, tags)

	gauge := &Gauge{
		name:      name,
		value:     0,
		tags:      mc.mergeTags(tags),
		collector: mc,
	}

	mc.gauges[key] = gauge
	return gauge
}

// NewHistogram creates a new histogram metric
func (mc *MetricsCollector) NewHistogram(name string, buckets []float64, tags map[string]string) *Histogram {
	key := mc.metricKey(name, tags)

	histogram := &Histogram{
		name:      name,
		buckets:   buckets,
		observer:  make(map[float64]int64),
		count:     0,
		sum:       0,
		tags:      mc.mergeTags(tags),
		collector: mc,
	}

	mc.histograms[key] = histogram
	return histogram
}

// Increment increments a counter by 1
func (c *Counter) Increment() {
	c.IncrementBy(1)
}

// IncrementBy increments a counter by the specified value
func (c *Counter) IncrementBy(value int64) {
	c.value += value
}

// Get returns the current counter value
func (c *Counter) Get() int64 {
	return c.value
}

// Reset resets the counter to 0
func (c *Counter) Reset() {
	c.value = 0
}

// Set sets the gauge value
func (g *Gauge) Set(value float64) {
	g.value = value
}

// Increment increments the gauge by 1
func (g *Gauge) Increment() {
	g.value += 1
}

// Decrement decrements the gauge by 1
func (g *Gauge) Decrement() {
	g.value -= 1
}

// Add adds the specified value to the gauge
func (g *Gauge) Add(value float64) {
	g.value += value
}

// Get returns the current gauge value
func (g *Gauge) Get() float64 {
	return g.value
}

// Observe records a value in the histogram
func (h *Histogram) Observe(value float64) {
	h.count++
	h.sum += value

	// Find the appropriate bucket
	for _, bucket := range h.buckets {
		if value <= bucket {
			h.observer[bucket]++
			break
		}
	}
}

// GetCount returns the total count of observations
func (h *Histogram) GetCount() int64 {
	return h.count
}

// GetSum returns the sum of all observations
func (h *Histogram) GetSum() float64 {
	return h.sum
}

// GetBuckets returns the bucket counts
func (h *Histogram) GetBuckets() map[float64]int64 {
	result := make(map[float64]int64)
	for bucket, count := range h.observer {
		result[bucket] = count
	}
	return result
}

// Flush flushes all metrics to InfluxDB
func (mc *MetricsCollector) Flush(ctx context.Context) error {
	points := make([]*Point, 0)

	// Flush counters
	for _, counter := range mc.counters {
		if counter.value > 0 {
			point := &Point{
				Measurement: "counters",
				Tags:        counter.tags,
				Fields: map[string]interface{}{
					"value": counter.value,
				},
				Timestamp: time.Now(),
			}
			point.Tags["metric_name"] = counter.name
			points = append(points, point)

			// Reset counter after flushing
			counter.value = 0
		}
	}

	// Flush gauges
	for _, gauge := range mc.gauges {
		point := &Point{
			Measurement: "gauges",
			Tags:        gauge.tags,
			Fields: map[string]interface{}{
				"value": gauge.value,
			},
			Timestamp: time.Now(),
		}
		point.Tags["metric_name"] = gauge.name
		points = append(points, point)
	}

	// Flush histograms
	for _, histogram := range mc.histograms {
		if histogram.count > 0 {
			// Create a point for each bucket
			for bucket, count := range histogram.observer {
				point := &Point{
					Measurement: "histograms",
					Tags:        histogram.tags,
					Fields: map[string]interface{}{
						"count":  count,
						"sum":    histogram.sum,
						"bucket": bucket,
					},
					Timestamp: time.Now(),
				}
				point.Tags["metric_name"] = histogram.name
				points = append(points, point)
			}

			// Reset histogram after flushing
			histogram.observer = make(map[float64]int64)
			histogram.count = 0
			histogram.sum = 0
		}
	}

	if len(points) == 0 {
		return nil
	}

	// Write points to InfluxDB
	return mc.client.WritePoints(ctx, points)
}

// flushPeriodically flushes metrics at regular intervals
func (mc *MetricsCollector) flushPeriodically() {
	ticker := time.NewTicker(mc.config.FlushInterval)
	defer ticker.Stop()

	for range ticker.C {
		ctx, cancel := context.WithTimeout(context.Background(), mc.config.Timeout)
		if err := mc.Flush(ctx); err != nil {
			log.Error().Err(err).Msg("Failed to flush metrics to InfluxDB")
		}
		cancel()
	}
}

// metricKey creates a unique key for a metric with tags
func (mc *MetricsCollector) metricKey(name string, tags map[string]string) string {
	key := name
	for k, v := range tags {
		key += fmt.Sprintf(":%s=%s", k, v)
	}
	return key
}

// mergeTags merges metric tags with default tags
func (mc *MetricsCollector) mergeTags(tags map[string]string) map[string]string {
	merged := make(map[string]string)

	// Add default tags first
	for k, v := range mc.config.DefaultTags {
		merged[k] = v
	}

	// Add metric-specific tags
	for k, v := range tags {
		merged[k] = v
	}

	return merged
}

// Close closes the metrics collector
func (mc *MetricsCollector) Close() {
	// Final flush
	ctx, cancel := context.WithTimeout(context.Background(), mc.config.Timeout)
	defer cancel()

	if err := mc.Flush(ctx); err != nil {
		log.Error().Err(err).Msg("Failed to flush metrics during shutdown")
	}
}

// FraudMetrics provides specialized metrics for fraud detection
type FraudMetrics struct {
	collector *MetricsCollector

	// Counters
	transactionsProcessed *Counter
	fraudTransactions     *Counter
	falsePositives        *Counter
	truePositives         *Counter
	modelPredictions      *Counter
	apiRequests           *Counter

	// Gauges
	currentRiskScore  *Gauge
	processingLatency *Gauge
	queueSize         *Gauge
	activeUsers       *Gauge

	// Histograms
	responseTimeHistogram *Histogram
	riskScoreHistogram    *Histogram
}

// NewFraudMetrics creates a new fraud metrics collector
func NewFraudMetrics(collector *MetricsCollector) *FraudMetrics {
	return &FraudMetrics{
		collector: collector,

		transactionsProcessed: collector.NewCounter("transactions_processed", map[string]string{
			"service": "fraud_detection",
		}),
		fraudTransactions: collector.NewCounter("fraud_transactions", map[string]string{
			"service": "fraud_detection",
		}),
		falsePositives: collector.NewCounter("false_positives", map[string]string{
			"service": "fraud_detection",
		}),
		truePositives: collector.NewCounter("true_positives", map[string]string{
			"service": "fraud_detection",
		}),
		modelPredictions: collector.NewCounter("model_predictions", map[string]string{
			"service": "fraud_detection",
		}),
		apiRequests: collector.NewCounter("api_requests", map[string]string{
			"service": "fraud_detection",
		}),

		currentRiskScore: collector.NewGauge("current_risk_score", map[string]string{
			"service": "fraud_detection",
		}),
		processingLatency: collector.NewGauge("processing_latency_ms", map[string]string{
			"service": "fraud_detection",
		}),
		queueSize: collector.NewGauge("queue_size", map[string]string{
			"service": "fraud_detection",
		}),
		activeUsers: collector.NewGauge("active_users", map[string]string{
			"service": "fraud_detection",
		}),

		responseTimeHistogram: collector.NewHistogram("response_time_ms", []float64{
			10, 50, 100, 200, 500, 1000, 2000, 5000,
		}, map[string]string{
			"service": "fraud_detection",
		}),
		riskScoreHistogram: collector.NewHistogram("risk_score", []float64{
			0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0,
		}, map[string]string{
			"service": "fraud_detection",
		}),
	}
}

// RecordTransaction records a transaction processing event
func (fm *FraudMetrics) RecordTransaction(isFraud bool, riskScore float64, processingTime time.Duration) {
	fm.transactionsProcessed.Increment()
	fm.responseTimeHistogram.Observe(float64(processingTime.Milliseconds()))
	fm.riskScoreHistogram.Observe(riskScore)
	fm.currentRiskScore.Set(riskScore)
	fm.processingLatency.Set(float64(processingTime.Milliseconds()))

	if isFraud {
		fm.fraudTransactions.Increment()
	}
}

// RecordModelPrediction records a model prediction event
func (fm *FraudMetrics) RecordModelPrediction(isCorrect bool) {
	fm.modelPredictions.Increment()

	if isCorrect {
		fm.truePositives.Increment()
	} else {
		fm.falsePositives.Increment()
	}
}

// RecordAPIRequest records an API request
func (fm *FraudMetrics) RecordAPIRequest(endpoint string, responseTime time.Duration) {
	fm.apiRequests.Increment()
	fm.responseTimeHistogram.Observe(float64(responseTime.Milliseconds()))
}

// UpdateQueueSize updates the current queue size
func (fm *FraudMetrics) UpdateQueueSize(size int) {
	fm.queueSize.Set(float64(size))
}

// UpdateActiveUsers updates the number of active users
func (fm *FraudMetrics) UpdateActiveUsers(count int) {
	fm.activeUsers.Set(float64(count))
}

// QuantumMetrics provides specialized metrics for quantum processing
type QuantumMetrics struct {
	collector *MetricsCollector

	// Counters
	quantumJobsSubmitted *Counter
	quantumJobsCompleted *Counter
	quantumJobsFailed    *Counter
	circuitExecutions    *Counter
	qpuRequests          *Counter

	// Gauges
	currentCircuitDepth   *Gauge
	quantumProcessingTime *Gauge
	fidelity              *Gauge
	activeQuantumTasks    *Gauge

	// Histograms
	jobLatencyHistogram *Histogram
	fidelityHistogram   *Histogram
}

// NewQuantumMetrics creates a new quantum metrics collector
func NewQuantumMetrics(collector *MetricsCollector) *QuantumMetrics {
	return &QuantumMetrics{
		collector: collector,

		quantumJobsSubmitted: collector.NewCounter("quantum_jobs_submitted", map[string]string{
			"service": "quantum_processing",
		}),
		quantumJobsCompleted: collector.NewCounter("quantum_jobs_completed", map[string]string{
			"service": "quantum_processing",
		}),
		quantumJobsFailed: collector.NewCounter("quantum_jobs_failed", map[string]string{
			"service": "quantum_processing",
		}),
		circuitExecutions: collector.NewCounter("circuit_executions", map[string]string{
			"service": "quantum_processing",
		}),
		qpuRequests: collector.NewCounter("qpu_requests", map[string]string{
			"service": "quantum_processing",
		}),

		currentCircuitDepth: collector.NewGauge("current_circuit_depth", map[string]string{
			"service": "quantum_processing",
		}),
		quantumProcessingTime: collector.NewGauge("quantum_processing_time_ms", map[string]string{
			"service": "quantum_processing",
		}),
		fidelity: collector.NewGauge("circuit_fidelity", map[string]string{
			"service": "quantum_processing",
		}),
		activeQuantumTasks: collector.NewGauge("active_quantum_tasks", map[string]string{
			"service": "quantum_processing",
		}),

		jobLatencyHistogram: collector.NewHistogram("quantum_job_latency_ms", []float64{
			100, 500, 1000, 2000, 5000, 10000, 30000, 60000,
		}, map[string]string{
			"service": "quantum_processing",
		}),
		fidelityHistogram: collector.NewHistogram("circuit_fidelity", []float64{
			0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 0.99, 1.0,
		}, map[string]string{
			"service": "quantum_processing",
		}),
	}
}

// RecordQuantumJob records a quantum job execution
func (qm *QuantumMetrics) RecordQuantumJob(jobType string, duration time.Duration, success bool, fidelity float64) {
	qm.quantumJobsSubmitted.Increment()
	qm.jobLatencyHistogram.Observe(float64(duration.Milliseconds()))
	qm.fidelityHistogram.Observe(fidelity)
	qm.fidelity.Set(fidelity)
	qm.quantumProcessingTime.Set(float64(duration.Milliseconds()))

	if success {
		qm.quantumJobsCompleted.Increment()
	} else {
		qm.quantumJobsFailed.Increment()
	}
}

// RecordCircuitExecution records a quantum circuit execution
func (qm *QuantumMetrics) RecordCircuitExecution(depth int, fidelity float64) {
	qm.circuitExecutions.Increment()
	qm.currentCircuitDepth.Set(float64(depth))
	qm.fidelity.Set(fidelity)
	qm.fidelityHistogram.Observe(fidelity)
}

// RecordQPURequest records a QPU request
func (qm *QuantumMetrics) RecordQPURequest(backend string, duration time.Duration) {
	qm.qpuRequests.Increment()
	qm.jobLatencyHistogram.Observe(float64(duration.Milliseconds()))
}

// UpdateActiveQuantumTasks updates the number of active quantum tasks
func (qm *QuantumMetrics) UpdateActiveQuantumTasks(count int) {
	qm.activeQuantumTasks.Set(float64(count))
}
