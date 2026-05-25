package anomaly

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/prometheus/client_golang/api"
	v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"
)

// AnomalySeverity represents the severity level of an anomaly
type AnomalySeverity string

const (
	SeverityLow      AnomalySeverity = "low"
	SeverityMedium   AnomalySeverity = "medium"
	SeverityHigh     AnomalySeverity = "high"
	SeverityCritical AnomalySeverity = "critical"
)

// AnomalyType represents the type of anomaly
type AnomalyType string

const (
	TypeSpike          AnomalyType = "spike"
	TypeDrop           AnomalyType = "drop"
	TypeTrendChange    AnomalyType = "trend_change"
	TypeAnomalousValue AnomalyType = "anomalous_value"
	TypePatternBreak   AnomalyType = "pattern_break"
	TypeSeasonalDev    AnomalyType = "seasonal_deviation"
)

// Anomaly represents a detected anomaly
type Anomaly struct {
	ID          string                 `json:"id"`
	Type        AnomalyType            `json:"type"`
	Severity    AnomalySeverity        `json:"severity"`
	Metric      string                 `json:"metric"`
	Value       float64                `json:"value"`
	Expected    float64                `json:"expected"`
	Deviation   float64                `json:"deviation"`
	Timestamp   time.Time              `json:"timestamp"`
	Duration    time.Duration          `json:"duration"`
	Description string                 `json:"description"`
	Labels      map[string]string      `json:"labels"`
	Annotations map[string]string      `json:"annotations"`
	Confidence  float64                `json:"confidence"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// AnomalyAlert represents an alert for a detected anomaly
type AnomalyAlert struct {
	ID            string                 `json:"id"`
	Timestamp     time.Time              `json:"timestamp"`
	MetricName    string                 `json:"metric_name"`
	Severity      string                 `json:"severity"`
	Message       string                 `json:"message"`
	Value         float64                `json:"value"`
	ExpectedValue float64                `json:"expected_value"`
	Deviation     float64                `json:"deviation"`
	Score         float64                `json:"score"`
	Confidence    float64                `json:"confidence"`
	Context       map[string]interface{} `json:"context"`
	Model         string                 `json:"model"`
	Labels        map[string]string      `json:"labels"`
	Resolved      bool                   `json:"resolved"`
}

// AnomalyDetectorConfig contains configuration for the anomaly detector
type AnomalyDetectorConfig struct {
	PrometheusURL      string        `json:"prometheus_url"`
	EvaluationInterval time.Duration `json:"evaluation_interval"`
	LookbackWindow     time.Duration `json:"lookback_window"`
	MinDataPoints      int           `json:"min_data_points"`
	ThresholdFactor    float64       `json:"threshold_factor"`
	SeasonalityPeriod  time.Duration `json:"seasonality_period"`
	AlertThreshold     float64       `json:"alert_threshold"`
	Enabled            bool          `json:"enabled"`
	BatchSize          int           `json:"batch_size"`
	MaxConcurrent      int           `json:"max_concurrent"`
}

// MetricConfig contains configuration for a specific metric
type MetricConfig struct {
	Name              string                 `json:"name"`
	Query             string                 `json:"query"`
	Type              AnomalyType            `json:"type"`
	Severity          AnomalySeverity        `json:"severity"`
	ThresholdFactor   float64                `json:"threshold_factor"`
	SeasonalityPeriod time.Duration          `json:"seasonality_period"`
	Labels            map[string]string      `json:"labels"`
	Enabled           bool                   `json:"enabled"`
	CustomRules       map[string]interface{} `json:"custom_rules,omitempty"`
}

// DetectionMethod represents anomaly detection algorithms
type DetectionMethod interface {
	Detect(data []DataPoint, config MetricConfig) (*Anomaly, error)
	Name() string
}

// DataPoint represents a single metric data point
type DataPoint struct {
	Timestamp time.Time
	Value     float64
	Labels    map[string]string
}

// StatisticalModel represents statistical models for anomaly detection
type StatisticalModel interface {
	Fit(data []DataPoint) error
	Predict(point DataPoint) (float64, error)
	IsAnomaly(point DataPoint, threshold float64) (bool, float64)
}

// AnomalyDetector handles anomaly detection for metrics
type AnomalyDetector struct {
	config     AnomalyDetectorConfig
	metrics    map[string]*MetricConfig
	prometheus v1.API
	detectors  map[AnomalyType]DetectionMethod
	models     map[string]StatisticalModel
	alerts     chan *Anomaly
	dataCache  map[string][]DataPoint
	mu         sync.RWMutex
	ctx        context.Context
	cancel     context.CancelFunc
}

// NewAnomalyDetector creates a new anomaly detector
func NewAnomalyDetector(config AnomalyDetectorConfig) (*AnomalyDetector, error) {
	ctx, cancel := context.WithCancel(context.Background())

	// Set default values
	if config.EvaluationInterval == 0 {
		config.EvaluationInterval = 5 * time.Minute
	}
	if config.LookbackWindow == 0 {
		config.LookbackWindow = 24 * time.Hour
	}
	if config.MinDataPoints == 0 {
		config.MinDataPoints = 10
	}
	if config.ThresholdFactor == 0 {
		config.ThresholdFactor = 2.0
	}
	if config.BatchSize == 0 {
		config.BatchSize = 100
	}
	if config.MaxConcurrent == 0 {
		config.MaxConcurrent = 5
	}

	ad := &AnomalyDetector{
		config:    config,
		metrics:   make(map[string]*MetricConfig),
		detectors: make(map[AnomalyType]DetectionMethod),
		models:    make(map[string]StatisticalModel),
		alerts:    make(chan *Anomaly, 1000),
		dataCache: make(map[string][]DataPoint),
		ctx:       ctx,
		cancel:    cancel,
	}

	// Initialize Prometheus client
	if config.PrometheusURL != "" {
		client, err := api.NewClient(api.Config{
			Address: config.PrometheusURL,
		})
		if err != nil {
			cancel()
			return nil, fmt.Errorf("failed to create Prometheus client: %w", err)
		}
		ad.prometheus = v1.NewAPI(client)
	}

	// Initialize default detectors
	ad.initializeDetectors()

	// Load default metrics
	ad.loadDefaultMetrics()

	return ad, nil
}

// initializeDetectors initializes the default anomaly detection methods
func (ad *AnomalyDetector) initializeDetectors() {
	ad.detectors[TypeSpike] = &SpikeDetector{}
	ad.detectors[TypeDrop] = &DropDetector{}
	ad.detectors[TypeTrendChange] = &TrendChangeDetector{}
	ad.detectors[TypeAnomalousValue] = &AnomalousValueDetector{}
	ad.detectors[TypePatternBreak] = &PatternBreakDetector{}
	ad.detectors[TypeSeasonalDev] = &SeasonalDeviationDetector{}
}

// loadDefaultMetrics loads default metrics to monitor
func (ad *AnomalyDetector) loadDefaultMetrics() {
	defaultMetrics := []MetricConfig{
		{
			Name:            "http_request_rate",
			Query:           "sum(rate(http_requests_total{job=\"quantumbeam-api\"}[5m]))",
			Type:            TypeSpike,
			Severity:        SeverityHigh,
			ThresholdFactor: 3.0,
			Enabled:         true,
		},
		{
			Name:            "error_rate",
			Query:           "sum(rate(http_requests_total{job=\"quantumbeam-api\",status_code=~\"5..\"}[5m])) / sum(rate(http_requests_total{job=\"quantumbeam-api\"}[5m])) * 100",
			Type:            TypeSpike,
			Severity:        SeverityCritical,
			ThresholdFactor: 2.0,
			Enabled:         true,
		},
		{
			Name:            "response_time_p95",
			Query:           "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{job=\"quantumbeam-api\"}[5m])) by (le))",
			Type:            TypeAnomalousValue,
			Severity:        SeverityHigh,
			ThresholdFactor: 2.5,
			Enabled:         true,
		},
		{
			Name:            "fraud_detection_rate",
			Query:           "sum(rate(fraud_detections_total{job=\"quantumbeam-api\"}[5m]))",
			Type:            TypeDrop,
			Severity:        SeverityMedium,
			ThresholdFactor: 2.0,
			Enabled:         true,
		},
		{
			Name:            "model_accuracy",
			Query:           "model_accuracy_score{job=\"quantumbeam-api\"}",
			Type:            TypeDrop,
			Severity:        SeverityHigh,
			ThresholdFactor: 1.5,
			Enabled:         true,
		},
		{
			Name:            "cpu_usage",
			Query:           "cpu_usage_percent{job=\"quantumbeam-api\"}",
			Type:            TypeSpike,
			Severity:        SeverityMedium,
			ThresholdFactor: 2.0,
			Enabled:         true,
		},
		{
			Name:            "memory_usage",
			Query:           "memory_usage_bytes{job=\"quantumbeam-api\",type=\"used\"} / memory_usage_bytes{job=\"quantumbeam-api\",type=\"total\"} * 100",
			Type:            TypeSpike,
			Severity:        SeverityMedium,
			ThresholdFactor: 2.0,
			Enabled:         true,
		},
		{
			Name:            "database_connections",
			Query:           "db_connections_active{job=\"quantumbeam-api\"}",
			Type:            TypeSpike,
			Severity:        SeverityHigh,
			ThresholdFactor: 2.0,
			Enabled:         true,
		},
		{
			Name:            "cache_hit_rate",
			Query:           "sum(rate(cache_hits_total{job=\"quantumbeam-api\"}[5m])) / (sum(rate(cache_hits_total{job=\"quantumbeam-api\"}[5m])) + sum(rate(cache_misses_total{job=\"quantumbeam-api\"}[5m]))) * 100",
			Type:            TypeDrop,
			Severity:        SeverityMedium,
			ThresholdFactor: 1.5,
			Enabled:         true,
		},
		{
			Name:            "quantum_circuit_failures",
			Query:           "sum(rate(quantum_circuit_executions_total{job=\"quantumbeam-api\",success=\"false\"}[5m]))",
			Type:            TypeSpike,
			Severity:        SeverityHigh,
			ThresholdFactor: 3.0,
			Enabled:         true,
		},
	}

	for _, metric := range defaultMetrics {
		ad.metrics[metric.Name] = &metric
	}
}

// Start starts the anomaly detection process
func (ad *AnomalyDetector) Start() error {
	if !ad.config.Enabled {
		return nil
	}

	go ad.detectionLoop()
	return nil
}

// Stop stops the anomaly detection process
func (ad *AnomalyDetector) Stop() {
	ad.cancel()
}

// detectionLoop runs the main anomaly detection loop
func (ad *AnomalyDetector) detectionLoop() {
	ticker := time.NewTicker(ad.config.EvaluationInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ad.ctx.Done():
			return
		case <-ticker.C:
			ad.runDetection()
		}
	}
}

// runDetection runs anomaly detection for all configured metrics
func (ad *AnomalyDetector) runDetection() {
	if ad.prometheus == nil {
		return
	}

	// Process metrics in batches
	metricNames := make([]string, 0, len(ad.metrics))
	for name, config := range ad.metrics {
		if config.Enabled {
			metricNames = append(metricNames, name)
		}
	}

	// Process in parallel batches
	semaphore := make(chan struct{}, ad.config.MaxConcurrent)
	var wg sync.WaitGroup

	for i := 0; i < len(metricNames); i += ad.config.BatchSize {
		end := i + ad.config.BatchSize
		if end > len(metricNames) {
			end = len(metricNames)
		}

		batch := metricNames[i:end]
		for _, metricName := range batch {
			wg.Add(1)
			go func(name string) {
				defer wg.Done()
				semaphore <- struct{}{}
				defer func() { <-semaphore }()

				ad.detectMetricAnomalies(name)
			}(metricName)
		}
		wg.Wait()
	}
}

// detectMetricAnomalies detects anomalies for a specific metric
func (ad *AnomalyDetector) detectMetricAnomalies(metricName string) {
	config, exists := ad.metrics[metricName]
	if !exists || !config.Enabled {
		return
	}

	// Fetch data from Prometheus
	data, err := ad.fetchMetricData(config.Query, ad.config.LookbackWindow)
	if err != nil {
		ad.logError("Failed to fetch data for metric %s: %v", metricName, err)
		return
	}

	if len(data) < ad.config.MinDataPoints {
		return
	}

	// Update cache
	ad.mu.Lock()
	ad.dataCache[metricName] = data
	ad.mu.Unlock()

	// Detect anomalies
	detector, exists := ad.detectors[config.Type]
	if !exists {
		return
	}

	anomaly, err := detector.Detect(data, *config)
	if err != nil {
		ad.logError("Detection failed for metric %s: %v", metricName, err)
		return
	}

	if anomaly != nil {
		anomaly.Metric = metricName
		anomaly.Labels = config.Labels

		// Send alert
		select {
		case ad.alerts <- anomaly:
		default:
			// Channel full, skip alert
		}
	}
}

// fetchMetricData fetches metric data from Prometheus
func (ad *AnomalyDetector) fetchMetricData(query string, lookback time.Duration) ([]DataPoint, error) {
	ctx, cancel := context.WithTimeout(ad.ctx, 30*time.Second)
	defer cancel()

	end := time.Now()
	start := end.Add(-lookback)

	result, _, err := ad.prometheus.QueryRange(ctx, query, v1.Range{
		Start: start,
		End:   end,
		Step:  time.Minute,
	})
	if err != nil {
		return nil, err
	}

	var dataPoints []DataPoint
	switch result.Type() {
	case model.ValMatrix:
		matrix := result.(model.Matrix)
		for _, sampleStream := range matrix {
			for _, sample := range sampleStream.Values {
				dataPoints = append(dataPoints, DataPoint{
					Timestamp: sample.Timestamp.Time(),
					Value:     float64(sample.Value),
					Labels:    metricToMap(sampleStream.Metric),
				})
			}
		}
	case model.ValVector:
		vector := result.(model.Vector)
		for _, sample := range vector {
			dataPoints = append(dataPoints, DataPoint{
				Timestamp: sample.Timestamp.Time(),
				Value:     float64(sample.Value),
				Labels:    metricToMap(sample.Metric),
			})
		}
	}

	return dataPoints, nil
}

func metricToMap(metric model.Metric) map[string]string {
	result := make(map[string]string)
	for k, v := range metric {
		result[string(k)] = string(v)
	}
	return result
}

// AddMetric adds a new metric to monitor
func (ad *AnomalyDetector) AddMetric(config MetricConfig) error {
	ad.mu.Lock()
	defer ad.mu.Unlock()

	ad.metrics[config.Name] = &config
	return nil
}

// RemoveMetric removes a metric from monitoring
func (ad *AnomalyDetector) RemoveMetric(name string) error {
	ad.mu.Lock()
	defer ad.mu.Unlock()

	delete(ad.metrics, name)
	delete(ad.dataCache, name)
	return nil
}

// GetMetrics returns all configured metrics
func (ad *AnomalyDetector) GetMetrics() map[string]*MetricConfig {
	ad.mu.RLock()
	defer ad.mu.RUnlock()

	metrics := make(map[string]*MetricConfig)
	for k, v := range ad.metrics {
		metrics[k] = v
	}
	return metrics
}

// GetAlerts returns the alert channel for consuming detected anomalies
func (ad *AnomalyDetector) GetAlerts() <-chan *Anomaly {
	return ad.alerts
}

// GetMetricData returns cached data for a metric
func (ad *AnomalyDetector) GetMetricData(metricName string) []DataPoint {
	ad.mu.RLock()
	defer ad.mu.RUnlock()

	return ad.dataCache[metricName]
}

// HealthCheck performs a health check on the anomaly detector
func (ad *AnomalyDetector) HealthCheck() error {
	if ad.prometheus == nil {
		return fmt.Errorf("Prometheus client not initialized")
	}

	// Test Prometheus connectivity
	ctx, cancel := context.WithTimeout(ad.ctx, 10*time.Second)
	defer cancel()

	_, _, err := ad.prometheus.Query(ctx, "up", time.Now())
	if err != nil {
		return fmt.Errorf("Prometheus health check failed: %w", err)
	}

	return nil
}

// GetStatistics returns detection statistics
func (ad *AnomalyDetector) GetStatistics() map[string]interface{} {
	ad.mu.RLock()
	defer ad.mu.RUnlock()

	stats := map[string]interface{}{
		"total_metrics":      len(ad.metrics),
		"enabled_metrics":    0,
		"cached_data_points": 0,
		"alert_channel_size": len(ad.alerts),
	}

	for _, config := range ad.metrics {
		if config.Enabled {
			stats["enabled_metrics"] = stats["enabled_metrics"].(int) + 1
		}
	}

	for _, data := range ad.dataCache {
		stats["cached_data_points"] = stats["cached_data_points"].(int) + len(data)
	}

	return stats
}

// logError logs an error message (placeholder implementation)
func (ad *AnomalyDetector) logError(format string, args ...interface{}) {
	// In a real implementation, this would use a proper logger
	fmt.Printf("ERROR: "+format+"\n", args...)
}

// GenerateAnomalyID generates a unique ID for an anomaly
func GenerateAnomalyID(metric string, timestamp time.Time) string {
	return fmt.Sprintf("%s-%d", metric, timestamp.Unix())
}

// SerializeAnomaly serializes an anomaly to JSON
func SerializeAnomaly(anomaly *Anomaly) ([]byte, error) {
	return json.Marshal(anomaly)
}

// DeserializeAnomaly deserializes an anomaly from JSON
func DeserializeAnomaly(data []byte) (*Anomaly, error) {
	var anomaly Anomaly
	err := json.Unmarshal(data, &anomaly)
	if err != nil {
		return nil, err
	}
	return &anomaly, nil
}

// Stubs for integration compatibility

func (ad *AnomalyDetector) ProcessResult(result AnomalyResult) error {
	return nil
}

func (ad *AnomalyDetector) GetStatus() map[string]interface{} {
	return map[string]interface{}{"status": "active"}
}

func (ad *AnomalyDetector) TrainModel(req ModelTrainingRequest) (map[string]interface{}, error) {
	return map[string]interface{}{"status": "training_started", "model_id": req.ModelID}, nil
}

func (ad *AnomalyDetector) Shutdown() error {
	return nil
}

// AnomalyResult represents the result of an anomaly check
type AnomalyResult struct {
	Timestamp  time.Time         `json:"timestamp"`
	MetricName string            `json:"metric_name"`
	Labels     map[string]string `json:"labels"`
	Value      float64           `json:"value"`
	IsAnomaly  bool              `json:"is_anomaly"`
	ModelType  string            `json:"model_type"`
	Reason     string            `json:"reason"`
}

const (
	ModelTypeStatistical = "statistical"
)

// ModelTrainingRequest represents a request to train a model
type ModelTrainingRequest struct {
	ModelID   string                 `json:"model_id"`
	Algorithm string                 `json:"algorithm"`
	Params    map[string]interface{} `json:"params"`
}
