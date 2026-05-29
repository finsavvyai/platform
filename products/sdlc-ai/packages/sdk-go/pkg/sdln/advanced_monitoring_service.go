package sdln

import (
	"context"
	"fmt"
	"math"
	"sort"
	"time"
)

// AdvancedMonitoringService handles enterprise-grade monitoring with ML capabilities
type AdvancedMonitoringService struct {
	*BaseService
	metricsAggregator *MetricsAggregator
	anomalyDetector   *AnomalyDetector
	alertManager      *IntelligentAlertManager
	dashboardService  *RealtimeDashboardService
	tracingService    *DistributedTracingService
	logAnalyzer       *LogAnalysisService
	perfMonitor       *PerformanceMonitoringService
	securityMonitor   *SecurityMonitoringService
	biService         *BusinessIntelligenceService
	slaMonitor        *SLAMonitoringService
	incidentManager   *IncidentResponseService
	capacityPlanner   *CapacityPlanningService
}

// NewAdvancedMonitoringService creates a new advanced monitoring service
func NewAdvancedMonitoringService(client *Client) *AdvancedMonitoringService {
	svc := &AdvancedMonitoringService{
		BaseService: NewBaseService(client, "advanced-monitoring", "api/v1/monitoring"),
	}

	svc.metricsAggregator = NewMetricsAggregator(svc)
	svc.anomalyDetector = NewAnomalyDetector(svc)
	svc.alertManager = NewIntelligentAlertManager(svc)
	svc.dashboardService = NewRealtimeDashboardService(svc)
	svc.tracingService = NewDistributedTracingService(svc)
	svc.logAnalyzer = NewLogAnalysisService(svc)
	svc.perfMonitor = NewPerformanceMonitoringService(svc)
	svc.securityMonitor = NewSecurityMonitoringService(svc)
	svc.biService = NewBusinessIntelligenceService(svc)
	svc.slaMonitor = NewSLAMonitoringService(svc)
	svc.incidentManager = NewIncidentResponseService(svc)
	svc.capacityPlanner = NewCapacityPlanningService(svc)

	return svc
}

// MetricsAggregator handles high-performance metrics collection and aggregation
type MetricsAggregator struct {
	service *AdvancedMonitoringService
	buffers map[string]*MetricBuffer
	config  AggregationConfig
}

// MetricBuffer buffers metrics for aggregation
type MetricBuffer struct {
	metrics    []MetricPoint
	size       int
	maxSize    int
	windowSize time.Duration
	lastFlush  time.Time
}

// AggregationConfig configures metrics aggregation
type AggregationConfig struct {
	FlushInterval    time.Duration     `json:"flush_interval"`
	BufferSize       int               `json:"buffer_size"`
	AggregationRules []AggregationRule `json:"aggregation_rules"`
	CompressionLevel int               `json:"compression_level"`
}

// AggregationRule defines how to aggregate metrics
type AggregationRule struct {
	Pattern      string            `json:"pattern"`
	Method       string            `json:"method"` // sum, avg, min, max, count, percentile
	Percentile   float64           `json:"percentile,omitempty"`
	GroupBy      []string          `json:"group_by"`
	Window       time.Duration     `json:"window"`
	OutputMetric string            `json:"output_metric"`
	Labels       map[string]string `json:"labels"`
}

// NewMetricsAggregator creates a new metrics aggregator
func NewMetricsAggregator(service *AdvancedMonitoringService) *MetricsAggregator {
	return &MetricsAggregator{
		service: service,
		buffers: make(map[string]*MetricBuffer),
		config: AggregationConfig{
			FlushInterval:    10 * time.Second,
			BufferSize:       10000,
			CompressionLevel: 6,
			AggregationRules: []AggregationRule{
				{
					Pattern:      "http.request.duration",
					Method:       "percentile",
					Percentile:   95,
					Window:       time.Minute,
					OutputMetric: "http.request.duration.p95",
				},
				{
					Pattern:      "error.rate",
					Method:       "avg",
					Window:       time.Minute,
					OutputMetric: "error.rate.1m",
				},
			},
		},
	}
}

// AggregateMetrics aggregates metrics according to rules
func (ma *MetricsAggregator) AggregateMetrics(ctx context.Context, tenantID string, metrics []Metric) (*AggregationResult, error) {
	result := &AggregationResult{
		TenantID:     tenantID,
		Timestamp:    TimestampNow(),
		Aggregated:   make([]MetricSeries, 0),
		RawCount:     len(metrics),
		Aggregations: make(map[string]interface{}),
	}

	// Group metrics by pattern
	grouped := make(map[string][]Metric)
	for _, metric := range metrics {
		for _, rule := range ma.config.AggregationRules {
			if matchPattern(metric.Name, rule.Pattern) {
				grouped[rule.Pattern] = append(grouped[rule.Pattern], metric)
			}
		}
	}

	// Apply aggregation rules
	for pattern, ruleMetrics := range grouped {
		for _, rule := range ma.config.AggregationRules {
			if rule.Pattern == pattern {
				aggregated := ma.applyAggregationRule(rule, ruleMetrics)
				result.Aggregated = append(result.Aggregated, aggregated...)
			}
		}
	}

	// Store aggregation metadata
	result.Aggregations["total_series"] = len(result.Aggregated)
	result.Aggregations["aggregation_time"] = time.Since(result.Timestamp.Time).Seconds()

	return result, nil
}

// applyAggregationRule applies a single aggregation rule
func (ma *MetricsAggregator) applyAggregationRule(rule AggregationRule, metrics []Metric) []MetricSeries {
	// Group metrics by labels
	groups := make(map[string][]float64)
	for _, metric := range metrics {
		key := ma.getGroupingKey(metric, rule.GroupBy)
		groups[key] = append(groups[key], metric.Value)
	}

	var series []MetricSeries
	for key, values := range groups {
		var aggregatedValue float64
		switch rule.Method {
		case "sum":
			for _, v := range values {
				aggregatedValue += v
			}
		case "avg":
			for _, v := range values {
				aggregatedValue += v
			}
			aggregatedValue /= float64(len(values))
		case "min":
			aggregatedValue = math.MaxFloat64
			for _, v := range values {
				if v < aggregatedValue {
					aggregatedValue = v
				}
			}
		case "max":
			aggregatedValue = -math.MaxFloat64
			for _, v := range values {
				if v > aggregatedValue {
					aggregatedValue = v
				}
			}
		case "count":
			aggregatedValue = float64(len(values))
		case "percentile":
			sort.Float64s(values)
			index := int(rule.Percentile * float64(len(values)) / 100)
			if index >= len(values) {
				index = len(values) - 1
			}
			aggregatedValue = values[index]
		}

		// Create metric series
		labels := make(map[string]string)
		for k, v := range rule.Labels {
			labels[k] = v
		}
		if key != "" {
			labels["group"] = key
		}

		series = append(series, MetricSeries{
			Name:   rule.OutputMetric,
			Labels: labels,
			Points: []MetricPoint{
				{
					Timestamp: TimestampNow(),
					Value:     aggregatedValue,
				},
			},
		})
	}

	return series
}

// getGroupingKey creates a grouping key from metric labels
func (ma *MetricsAggregator) getGroupingKey(metric Metric, groupBy []string) string {
	if len(groupBy) == 0 {
		return ""
	}

	key := ""
	for _, field := range groupBy {
		if value, ok := metric.Labels[field]; ok {
			if key != "" {
				key += ";"
			}
			key += value
		}
	}
	return key
}

// matchPattern checks if a metric name matches a pattern
func matchPattern(name, pattern string) bool {
	// Simple wildcard matching for now
	if pattern == "*" {
		return true
	}
	return name == pattern
}

// AggregationResult represents the result of metric aggregation
type AggregationResult struct {
	TenantID     string                 `json:"tenant_id"`
	Timestamp    Timestamp              `json:"timestamp"`
	Aggregated   []MetricSeries         `json:"aggregated"`
	RawCount     int                    `json:"raw_count"`
	Aggregations map[string]interface{} `json:"aggregations"`
}

// AnomalyDetector handles ML-based anomaly detection
type AnomalyDetector struct {
	service    *AdvancedMonitoringService
	models     map[string]*AnomalyModel
	thresholds map[string]AnomalyThreshold
	config     AnomalyDetectionConfig
}

// AnomalyModel represents an anomaly detection model
type AnomalyModel struct {
	Name       string                 `json:"name"`
	Type       string                 `json:"type"` // statistical, ml, hybrid
	Algorithm  string                 `json:"algorithm"`
	Parameters map[string]interface{} `json:"parameters"`
	Trained    bool                   `json:"trained"`
	Accuracy   float64                `json:"accuracy"`
	LastUpdate Timestamp              `json:"last_update"`
}

// AnomalyThreshold defines thresholds for anomaly detection
type AnomalyThreshold struct {
	MetricName   string    `json:"metric_name"`
	UpperLimit   *float64  `json:"upper_limit,omitempty"`
	LowerLimit   *float64  `json:"lower_limit,omitempty"`
	Deviation    float64   `json:"deviation"`   // Standard deviations
	Sensitivity  float64   `json:"sensitivity"` // 0.0 to 1.0
	Seasonality  bool      `json:"seasonality"`
	Adaptive     bool      `json:"adaptive"`
	LastAdjusted Timestamp `json:"last_adjusted"`
}

// AnomalyDetectionConfig configures anomaly detection
type AnomalyDetectionConfig struct {
	Models              []AnomalyModel `json:"models"`
	TrainingWindowSize  time.Duration  `json:"training_window_size"`
	DetectionWindowSize time.Duration  `json:"detection_window_size"`
	MinDataPoints       int            `json:"min_data_points"`
	AutoRetraining      bool           `json:"auto_retraining"`
	RetrainingInterval  time.Duration  `json:"retraining_interval"`
	EnsembleAggregation string         `json:"ensemble_aggregation"` // avg, max, voting
	AlertOnAnomaly      bool           `json:"alert_on_anomaly"`
}

// NewAnomalyDetector creates a new anomaly detector
func NewAnomalyDetector(service *AdvancedMonitoringService) *AnomalyDetector {
	return &AnomalyDetector{
		service: service,
		models:  make(map[string]*AnomalyModel),
		thresholds: map[string]AnomalyThreshold{
			"http.request.duration": {
				MetricName:   "http.request.duration",
				Deviation:    2.0,
				Sensitivity:  0.7,
				Seasonality:  true,
				Adaptive:     true,
				LastAdjusted: TimestampNow(),
			},
			"error.rate": {
				MetricName:   "error.rate",
				UpperLimit:   &[]float64{0.05}[0], // 5%
				Deviation:    3.0,
				Sensitivity:  0.8,
				Seasonality:  false,
				Adaptive:     true,
				LastAdjusted: TimestampNow(),
			},
		},
		config: AnomalyDetectionConfig{
			TrainingWindowSize:  time.Hour * 24,
			DetectionWindowSize: time.Minute * 5,
			MinDataPoints:       100,
			AutoRetraining:      true,
			RetrainingInterval:  time.Hour * 6,
			EnsembleAggregation: "voting",
			AlertOnAnomaly:      true,
		},
	}
}

// DetectAnomalies detects anomalies in metrics
func (ad *AnomalyDetector) DetectAnomalies(ctx context.Context, tenantID string, metrics []MetricSeries) (*AnomalyDetectionResult, error) {
	result := &AnomalyDetectionResult{
		TenantID:     tenantID,
		Timestamp:    TimestampNow(),
		Anomalies:    make([]Anomaly, 0),
		Summary:      AnomalySummary{},
		ModelMetrics: make(map[string]interface{}),
	}

	for _, series := range metrics {
		if len(series.Points) < ad.config.MinDataPoints {
			continue
		}

		// Get threshold for this metric
		threshold, exists := ad.thresholds[series.Name]
		if !exists {
			continue
		}

		// Detect anomalies using multiple models
		anomalies := ad.detectWithModels(series, threshold)
		result.Anomalies = append(result.Anomalies, anomalies...)
	}

	// Calculate summary
	result.Summary.TotalAnomalies = len(result.Anomalies)
	result.Summary.CriticalAnomalies = ad.countBySeverity(result.Anomalies, "critical")
	result.Summary.WarningAnomalies = ad.countBySeverity(result.Anomalies, "warning")
	result.Summary.InfoAnomalies = ad.countBySeverity(result.Anomalies, "info")

	// Trigger alerts if configured
	if ad.config.AlertOnAnomaly && len(result.Anomalies) > 0 {
		for _, anomaly := range result.Anomalies {
			if anomaly.Severity == "critical" || anomaly.Severity == "warning" {
				ad.triggerAnomalyAlert(ctx, tenantID, anomaly)
			}
		}
	}

	return result, nil
}

// detectWithModels detects anomalies using multiple models
func (ad *AnomalyDetector) detectWithModels(series MetricSeries, threshold AnomalyThreshold) []Anomaly {
	var anomalies []Anomaly

	// Statistical model
	statAnomalies := ad.statisticalDetection(series, threshold)
	anomalies = append(anomalies, statAnomalies...)

	// Seasonal model if enabled
	if threshold.Seasonality {
		seasonalAnomalies := ad.seasonalDetection(series, threshold)
		anomalies = append(anomalies, seasonalAnomalies...)
	}

	// ML model if available
	if model, exists := ad.models[series.Name]; exists && model.Trained {
		mlAnomalies := ad.mlDetection(series, threshold, model)
		anomalies = append(anomalies, mlAnomalies...)
	}

	// Ensemble aggregation
	if len(anomalies) > 1 {
		anomalies = ad.aggregateAnomalies(anomalies)
	}

	return anomalies
}

// statisticalDetection performs statistical anomaly detection
func (ad *AnomalyDetector) statisticalDetection(series MetricSeries, threshold AnomalyThreshold) []Anomaly {
	var anomalies []Anomaly

	// Calculate mean and standard deviation
	values := make([]float64, len(series.Points))
	for i, point := range series.Points {
		values[i] = point.Value
	}

	mean := calculateMean(values)
	stdDev := calculateStdDev(values, mean)

	// Check each point
	for i, point := range series.Points {
		zScore := math.Abs(point.Value-mean) / stdDev

		if zScore > threshold.Deviation {
			severity := ad.calculateSeverity(zScore, threshold)

			anomalies = append(anomalies, Anomaly{
				ID:         generateUUID(),
				MetricName: series.Name,
				Timestamp:  point.Timestamp,
				Value:      point.Value,
				Expected:   mean,
				Deviation:  zScore,
				Severity:   severity,
				Confidence: math.Min(zScore/threshold.Deviation, 1.0),
				Method:     "statistical",
				Labels:     series.Labels,
				Description: fmt.Sprintf("Value %.2f is %.1f standard deviations from mean %.2f",
					point.Value, zScore, mean),
			})
		}
	}

	return anomalies
}

// seasonalDetection performs seasonal anomaly detection
func (ad *AnomalyDetector) seasonalDetection(series MetricSeries, threshold AnomalyThreshold) []Anomaly {
	var anomalies []Anomaly

	// Group by time of day and day of week
	timeGroups := make(map[string][]float64)
	for _, point := range series.Points {
		timeKey := point.Timestamp.Format("15:04") // Hour:Minute
		timeGroups[timeKey] = append(timeGroups[timeKey], point.Value)
	}

	// Calculate seasonal baseline
	seasonalBaselines := make(map[string]SeasonalBaseline)
	for timeKey, values := range timeGroups {
		if len(values) < 10 { // Need enough data points
			continue
		}

		mean := calculateMean(values)
		stdDev := calculateStdDev(values, mean)

		seasonalBaselines[timeKey] = SeasonalBaseline{
			TimeKey: timeKey,
			Mean:    mean,
			StdDev:  stdDev,
			Count:   len(values),
		}
	}

	// Detect anomalies based on seasonal baseline
	for _, point := range series.Points {
		timeKey := point.Timestamp.Format("15:04")
		baseline, exists := seasonalBaselines[timeKey]
		if !exists {
			continue
		}

		zScore := math.Abs(point.Value-baseline.Mean) / baseline.StdDev
		if zScore > threshold.Deviation {
			severity := ad.calculateSeverity(zScore, threshold)

			anomalies = append(anomalies, Anomaly{
				ID:         generateUUID(),
				MetricName: series.Name,
				Timestamp:  point.Timestamp,
				Value:      point.Value,
				Expected:   baseline.Mean,
				Deviation:  zScore,
				Severity:   severity,
				Confidence: math.Min(zScore/threshold.Deviation, 1.0),
				Method:     "seasonal",
				Labels:     series.Labels,
				Description: fmt.Sprintf("Value %.2f is %.1f standard deviations from seasonal baseline %.2f at %s",
					point.Value, zScore, baseline.Mean, timeKey),
			})
		}
	}

	return anomalies
}

// mlDetection performs ML-based anomaly detection
func (ad *AnomalyDetector) mlDetection(series MetricSeries, threshold AnomalyThreshold, model *AnomalyModel) []Anomaly {
	var anomalies []Anomaly

	// For now, implement a simple isolation forest-like approach
	values := make([]float64, len(series.Points))
	for i, point := range series.Points {
		values[i] = point.Value
	}

	// Calculate isolation scores
	scores := ad.calculateIsolationScores(values)

	// Detect anomalies based on scores
	for i, point := range series.Points {
		if i >= len(scores) {
			continue
		}

		score := scores[i]
		if score > threshold.Sensitivity {
			severity := "info"
			if score > 0.8 {
				severity = "critical"
			} else if score > 0.6 {
				severity = "warning"
			}

			anomalies = append(anomalies, Anomaly{
				ID:          generateUUID(),
				MetricName:  series.Name,
				Timestamp:   point.Timestamp,
				Value:       point.Value,
				Score:       score,
				Severity:    severity,
				Confidence:  score,
				Method:      "ml",
				ModelName:   model.Name,
				Labels:      series.Labels,
				Description: fmt.Sprintf("ML model detected anomaly with score %.2f", score),
			})
		}
	}

	return anomalies
}

// calculateIsolationScores calculates isolation scores for anomaly detection
func (ad *AnomalyDetector) calculateIsolationScores(values []float64) []float64 {
	scores := make([]float64, len(values))

	// Simple implementation: use distance from median as anomaly score
	sortedValues := make([]float64, len(values))
	copy(sortedValues, values)
	sort.Float64s(sortedValues)

	median := sortedValues[len(sortedValues)/2]

	for i, value := range values {
		// Normalize score to [0, 1]
		distance := math.Abs(value - median)
		scores[i] = math.Min(distance/median, 1.0)
	}

	return scores
}

// aggregateAnomalies aggregates anomalies from multiple models
func (ad *AnomalyDetector) aggregateAnomalies(anomalies []Anomaly) []Anomaly {
	// Group by timestamp
	grouped := make(map[string][]Anomaly)
	for _, anomaly := range anomalies {
		key := anomaly.Timestamp.Format(time.RFC3339)
		grouped[key] = append(grouped[key], anomaly)
	}

	var aggregated []Anomaly
	for key, group := range grouped {
		if len(group) > 1 {
			// Multiple models detected anomaly at same time
			avgSeverity := ad.calculateAverageSeverity(group)
			maxConfidence := 0.0

			for _, a := range group {
				if a.Confidence > maxConfidence {
					maxConfidence = a.Confidence
				}
			}

			// Create aggregated anomaly
			aggregated = append(aggregated, Anomaly{
				ID:          generateUUID(),
				MetricName:  group[0].MetricName,
				Timestamp:   group[0].Timestamp,
				Value:       group[0].Value,
				Expected:    group[0].Expected,
				Deviation:   group[0].Deviation,
				Score:       group[0].Score,
				Severity:    avgSeverity,
				Confidence:  maxConfidence,
				Method:      "ensemble",
				Labels:      group[0].Labels,
				Description: fmt.Sprintf("Ensemble of %d models detected anomaly", len(group)),
			})
		} else {
			aggregated = append(aggregated, group[0])
		}
	}

	return aggregated
}

// calculateSeverity calculates anomaly severity based on deviation
func (ad *AnomalyDetector) calculateSeverity(zScore float64, threshold AnomalyThreshold) string {
	adjustedThreshold := threshold.Deviation * (2.0 - threshold.Sensitivity)

	if zScore > adjustedThreshold*2 {
		return "critical"
	} else if zScore > adjustedThreshold*1.5 {
		return "warning"
	}
	return "info"
}

// calculateAverageSeverity calculates average severity from multiple anomalies
func (ad *AnomalyDetector) calculateAverageSeverity(anomalies []Anomaly) string {
	criticalCount := 0
	warningCount := 0
	infoCount := 0

	for _, a := range anomalies {
		switch a.Severity {
		case "critical":
			criticalCount++
		case "warning":
			warningCount++
		case "info":
			infoCount++
		}
	}

	if criticalCount >= len(anomalies)/2 {
		return "critical"
	} else if warningCount+criticalCount >= len(anomalies)/2 {
		return "warning"
	}
	return "info"
}

// countBySeverity counts anomalies by severity
func (ad *AnomalyDetector) countBySeverity(anomalies []Anomaly, severity string) int {
	count := 0
	for _, a := range anomalies {
		if a.Severity == severity {
			count++
		}
	}
	return count
}

// triggerAnomalyAlert triggers an alert for detected anomaly
func (ad *AnomalyDetector) triggerAnomalyAlert(ctx context.Context, tenantID string, anomaly Anomaly) error {
	// Create alert rule for anomaly
	alertReq := &CreateAlertRuleRequest{
		Name:        fmt.Sprintf("Anomaly Detected: %s", anomaly.MetricName),
		Description: anomaly.Description,
		Query:       fmt.Sprintf("%s{%s}", anomaly.MetricName, formatLabels(anomaly.Labels)),
		Condition:   "anomaly",
		Threshold:   anomaly.Deviation,
		Severity:    anomaly.Severity,
		For:         &[]time.Duration{time.Minute * 5}[0],
		Labels: map[string]string{
			"type":      "anomaly",
			"method":    anomaly.Method,
			"metric":    anomaly.MetricName,
			"tenant_id": tenantID,
		},
		Enabled: &[]bool{true}[0],
	}

	// Create alert through alert manager
	_, err := ad.service.alertManager.CreateIntelligentAlert(ctx, tenantID, alertReq)
	if err != nil {
		return fmt.Errorf("failed to trigger anomaly alert: %w", err)
	}

	return nil
}

// Anomaly represents a detected anomaly
type Anomaly struct {
	ID          string            `json:"id"`
	MetricName  string            `json:"metric_name"`
	Timestamp   Timestamp         `json:"timestamp"`
	Value       float64           `json:"value"`
	Expected    float64           `json:"expected"`
	Deviation   float64           `json:"deviation"`
	Score       float64           `json:"score,omitempty"`
	Severity    string            `json:"severity"`
	Confidence  float64           `json:"confidence"`
	Method      string            `json:"method"`
	ModelName   string            `json:"model_name,omitempty"`
	Labels      map[string]string `json:"labels"`
	Description string            `json:"description"`
}

// SeasonalBaseline represents seasonal baseline for anomaly detection
type SeasonalBaseline struct {
	TimeKey string  `json:"time_key"`
	Mean    float64 `json:"mean"`
	StdDev  float64 `json:"std_dev"`
	Count   int     `json:"count"`
}

// AnomalyDetectionResult represents anomaly detection results
type AnomalyDetectionResult struct {
	TenantID     string                 `json:"tenant_id"`
	Timestamp    Timestamp              `json:"timestamp"`
	Anomalies    []Anomaly              `json:"anomalies"`
	Summary      AnomalySummary         `json:"summary"`
	ModelMetrics map[string]interface{} `json:"model_metrics"`
}

// AnomalySummary provides summary of detected anomalies
type AnomalySummary struct {
	TotalAnomalies    int     `json:"total_anomalies"`
	CriticalAnomalies int     `json:"critical_anomalies"`
	WarningAnomalies  int     `json:"warning_anomalies"`
	InfoAnomalies     int     `json:"info_anomalies"`
	DetectionRate     float64 `json:"detection_rate"`
	FalsePositiveRate float64 `json:"false_positive_rate"`
}

// IntelligentAlertManager handles intelligent alerting with correlation and escalation
type IntelligentAlertManager struct {
	service            *AdvancedMonitoringService
	alertRules         map[string]*AlertRule
	activeAlerts       map[string]*ActiveAlert
	escalationPolicies map[string]*EscalationPolicy
	correlationRules   []CorrelationRule
	config             AlertingConfig
}

// ActiveAlert represents an active alert
type ActiveAlert struct {
	Alert       *Alert            `json:"alert"`
	Rule        *AlertRule        `json:"rule"`
	Context     AlertContext      `json:"context"`
	Escalations []EscalationLevel `json:"escalations"`
	Acked       bool              `json:"acked"`
	AckedBy     string            `json:"acked_by,omitempty"`
	AckedAt     *Timestamp        `json:"acked_at,omitempty"`
}

// AlertContext provides context for an alert
type AlertContext struct {
	RelatedAlerts  []string               `json:"related_alerts"`
	MetricHistory  []MetricPoint          `json:"metric_history"`
	SystemState    map[string]interface{} `json:"system_state"`
	UserImpact     UserImpact             `json:"user_impact"`
	BusinessImpact BusinessImpact         `json:"business_impact"`
}

// EscalationPolicy defines escalation rules
type EscalationPolicy struct {
	ID         string                `json:"id"`
	Name       string                `json:"name"`
	Conditions []EscalationCondition `json:"conditions"`
	Levels     []EscalationLevel     `json:"levels"`
	Enabled    bool                  `json:"enabled"`
}

// EscalationCondition defines when to escalate
type EscalationCondition struct {
	Field    string         `json:"field"`    // severity, duration, count
	Operator string         `json:"operator"` // gt, lt, eq, in
	Value    interface{}    `json:"value"`
	Duration *time.Duration `json:"duration,omitempty"`
}

// EscalationLevel defines an escalation level
type EscalationLevel struct {
	Level    int           `json:"level"`
	Duration time.Duration `json:"duration"`
	Channels []string      `json:"channels"` // email, slack, sms, pagerduty
	Users    []string      `json:"users"`
	Roles    []string      `json:"roles"`
	Message  string        `json:"message"`
}

// CorrelationRule defines how to correlate alerts
type CorrelationRule struct {
	ID         string                 `json:"id"`
	Name       string                 `json:"name"`
	Conditions []CorrelationCondition `json:"conditions"`
	Window     time.Duration          `json:"window"`
	Action     string                 `json:"action"` // group, suppress, enhance
	Attributes map[string]string      `json:"attributes"`
}

// CorrelationCondition defines correlation conditions
type CorrelationCondition struct {
	Field    string      `json:"field"`
	Operator string      `json:"operator"`
	Value    interface{} `json:"value"`
}

// AlertingConfig configures intelligent alerting
type AlertingConfig struct {
	MaxAlertsPerMinute      int                   `json:"max_alerts_per_minute"`
	CorrelationWindow       time.Duration         `json:"correlation_window"`
	DefaultEscalationPolicy string                `json:"default_escalation_policy"`
	SuppressionRules        []SuppressionRule     `json:"suppression_rules"`
	NotificationChannels    []NotificationChannel `json:"notification_channels"`
	AlertGrouping           AlertGroupingConfig   `json:"alert_grouping"`
}

// SuppressionRule defines alert suppression rules
type SuppressionRule struct {
	ID         string                 `json:"id"`
	Name       string                 `json:"name"`
	Conditions map[string]interface{} `json:"conditions"`
	Duration   time.Duration          `json:"duration"`
	Reason     string                 `json:"reason"`
}

// NotificationChannel defines a notification channel
type NotificationChannel struct {
	ID      string                 `json:"id"`
	Name    string                 `json:"name"`
	Type    string                 `json:"type"` // email, slack, webhook, pagerduty
	Config  map[string]interface{} `json:"config"`
	Enabled bool                   `json:"enabled"`
}

// AlertGroupingConfig configures alert grouping
type AlertGroupingConfig struct {
	Enabled      bool          `json:"enabled"`
	GroupBy      []string      `json:"group_by"`
	WaitTime     time.Duration `json:"wait_time"`
	MaxGroupSize int           `json:"max_group_size"`
}

// UserImpact represents user impact assessment
type UserImpact struct {
	AffectedUsers int      `json:"affected_users"`
	ImpactLevel   string   `json:"impact_level"` // low, medium, high, critical
	Features      []string `json:"features"`
	Regions       []string `json:"regions"`
	EstimatedLoss float64  `json:"estimated_loss"`
}

// BusinessImpact represents business impact assessment
type BusinessImpact struct {
	RevenueImpact  float64  `json:"revenue_impact"`
	CustomerImpact string   `json:"customer_impact"`
	SLAImpact      []string `json:"sla_impact"`
	BrandImpact    string   `json:"brand_impact"`
	ComplianceRisk []string `json:"compliance_risk"`
}

// NewIntelligentAlertManager creates a new intelligent alert manager
func NewIntelligentAlertManager(service *AdvancedMonitoringService) *IntelligentAlertManager {
	return &IntelligentAlertManager{
		service:            service,
		alertRules:         make(map[string]*AlertRule),
		activeAlerts:       make(map[string]*ActiveAlert),
		escalationPolicies: make(map[string]*EscalationPolicy),
		correlationRules: []CorrelationRule{
			{
				ID:     "database-issues",
				Name:   "Database Related Issues",
				Window: time.Minute * 5,
				Action: "group",
				Conditions: []CorrelationCondition{
					{Field: "service", Operator: "eq", Value: "database"},
					{Field: "severity", Operator: "in", Value: []string{"critical", "warning"}},
				},
			},
		},
		config: AlertingConfig{
			MaxAlertsPerMinute:      100,
			CorrelationWindow:       time.Minute * 5,
			DefaultEscalationPolicy: "default",
			AlertGrouping: AlertGroupingConfig{
				Enabled:      true,
				GroupBy:      []string{"service", "severity"},
				WaitTime:     time.Minute * 2,
				MaxGroupSize: 10,
			},
		},
	}
}

// CreateIntelligentAlert creates an intelligent alert with correlation
func (iam *IntelligentAlertManager) CreateIntelligentAlert(ctx context.Context, tenantID string, req *CreateAlertRuleRequest) (*AlertRule, error) {
	// Create the alert rule
	rule, err := iam.service.client.Monitoring.CreateAlertRule(ctx, tenantID, req)
	if err != nil {
		return nil, fmt.Errorf("failed to create alert rule: %w", err)
	}

	// Store in local cache
	iam.alertRules[rule.ID] = rule

	// Set up correlation if needed
	iam.setupCorrelation(rule)

	return rule, nil
}

// ProcessAlert processes an incoming alert
func (iam *IntelligentAlertManager) ProcessAlert(ctx context.Context, alert *Alert) error {
	// Check for correlation
	correlated := iam.checkCorrelation(alert)

	// Check for suppression
	if iam.isSuppressed(alert) {
		return nil
	}

	// Create active alert
	activeAlert := &ActiveAlert{
		Alert:   alert,
		Rule:    iam.alertRules[alert.Labels["rule_id"]],
		Context: iam.buildAlertContext(alert),
	}

	// Store active alert
	iam.activeAlerts[alert.ID] = activeAlert

	// Check for escalation
	iam.checkEscalation(ctx, activeAlert)

	// Send notifications
	iam.sendNotifications(ctx, activeAlert)

	return nil
}

// checkCorrelation checks if alert correlates with others
func (iam *IntelligentAlertManager) checkCorrelation(alert *Alert) bool {
	for _, rule := range iam.correlationRules {
		if iam.matchesCorrelationRule(alert, rule) {
			// Apply correlation action
			switch rule.Action {
			case "group":
				iam.groupAlert(alert, rule)
			case "suppress":
				return true // Suppress this alert
			case "enhance":
				iam.enhanceAlert(alert, rule)
			}
		}
	}
	return false
}

// matchesCorrelationRule checks if alert matches correlation rule
func (iam *IntelligentAlertManager) matchesCorrelationRule(alert *Alert, rule CorrelationRule) bool {
	for _, condition := range rule.Conditions {
		value := iam.getAlertField(alert, condition.Field)
		if !iam.evaluateCondition(value, condition.Operator, condition.Value) {
			return false
		}
	}
	return true
}

// getAlertField gets field value from alert
func (iam *IntelligentAlertManager) getAlertField(alert *Alert, field string) interface{} {
	switch field {
	case "service":
		return alert.Labels["service"]
	case "severity":
		return alert.Severity
	case "source":
		return alert.Source
	default:
		return alert.Labels[field]
	}
}

// evaluateCondition evaluates a condition
func (iam *IntelligentAlertManager) evaluateCondition(value interface{}, operator string, expected interface{}) bool {
	switch operator {
	case "eq":
		return value == expected
	case "in":
		if slice, ok := expected.([]interface{}); ok {
			for _, item := range slice {
				if value == item {
					return true
				}
			}
		}
		return false
	case "gt":
		if vf, ok := value.(float64); ok {
			if ef, ok := expected.(float64); ok {
				return vf > ef
			}
		}
		return false
	case "lt":
		if vf, ok := value.(float64); ok {
			if ef, ok := expected.(float64); ok {
				return vf < ef
			}
		}
		return false
	}
	return false
}

// groupAlert groups alert with related alerts
func (iam *IntelligentAlertManager) groupAlert(alert *Alert, rule CorrelationRule) {
	// Find related alerts within correlation window
	windowStart := time.Now().Add(-rule.Window)
	var relatedAlerts []string

	for id, activeAlert := range iam.activeAlerts {
		if activeAlert.Alert.Timestamp.Time.After(windowStart) {
			if iam.matchesCorrelationRule(activeAlert.Alert, rule) {
				relatedAlerts = append(relatedAlerts, id)
			}
		}
	}

	// Add to alert labels
	if alert.Labels == nil {
		alert.Labels = make(map[string]string)
	}
	alert.Labels["group_id"] = rule.ID
	alert.Labels["related_alerts"] = fmt.Sprintf("%v", relatedAlerts)
}

// enhanceAlert enhances alert with additional information
func (iam *IntelligentAlertManager) enhanceAlert(alert *Alert, rule CorrelationRule) {
	// Add correlation attributes
	if alert.Labels == nil {
		alert.Labels = make(map[string]string)
	}
	for k, v := range rule.Attributes {
		alert.Labels[k] = v
	}
}

// isSuppressed checks if alert is suppressed
func (iam *IntelligentAlertManager) isSuppressed(alert *Alert) bool {
	for _, rule := range iam.config.SuppressionRules {
		if iam.matchesSuppressionRule(alert, rule) {
			return true
		}
	}
	return false
}

// matchesSuppressionRule checks if alert matches suppression rule
func (iam *IntelligentAlertManager) matchesSuppressionRule(alert *Alert, rule SuppressionRule) bool {
	// Check if suppression is still active
	if time.Since(time.Time{}) < rule.Duration {
		// Check conditions
		for field, expected := range rule.Conditions {
			value := iam.getAlertField(alert, field)
			if value != expected {
				return false
			}
		}
		return true
	}
	return false
}

// buildAlertContext builds context for alert
func (iam *IntelligentAlertManager) buildAlertContext(alert *Alert) AlertContext {
	// Get related alerts
	var relatedAlerts []string
	if ids, ok := alert.Labels["related_alerts"]; ok {
		relatedAlerts = append(relatedAlerts, ids)
	}

	// Assess impacts
	userImpact := UserImpact{
		AffectedUsers: iam.estimateAffectedUsers(alert),
		ImpactLevel:   iam.assessUserImpactLevel(alert),
		Features:      iam.getAffectedFeatures(alert),
		Regions:       iam.getAffectedRegions(alert),
		EstimatedLoss: iam.estimateLoss(alert),
	}

	businessImpact := BusinessImpact{
		RevenueImpact:  iam.estimateRevenueImpact(alert),
		CustomerImpact: iam.assessCustomerImpact(alert),
		SLAImpact:      iam.getImpactedSLAs(alert),
		BrandImpact:    iam.assessBrandImpact(alert),
		ComplianceRisk: iam.getComplianceRisks(alert),
	}

	return AlertContext{
		RelatedAlerts:  relatedAlerts,
		SystemState:    iam.getSystemState(alert),
		UserImpact:     userImpact,
		BusinessImpact: businessImpact,
	}
}

// estimateAffectedUsers estimates number of affected users
func (iam *IntelligentAlertManager) estimateAffectedUsers(alert *Alert) int {
	// Simple estimation based on severity and service
	switch alert.Severity {
	case "critical":
		return 10000
	case "warning":
		return 1000
	case "info":
		return 100
	}
	return 0
}

// assessUserImpactLevel assesses user impact level
func (iam *IntelligentAlertManager) assessUserImpactLevel(alert *Alert) string {
	if alert.Severity == "critical" {
		return "high"
	} else if alert.Severity == "warning" {
		return "medium"
	}
	return "low"
}

// getAffectedFeatures gets affected features
func (iam *IntelligentAlertManager) getAffectedFeatures(alert *Alert) []string {
	service := alert.Labels["service"]
	switch service {
	case "api":
		return []string{"api_access", "data_upload", "search"}
	case "database":
		return []string{"data_storage", "query_processing"}
	case "rag":
		return []string{"document_search", "ai_chat"}
	}
	return []string{}
}

// getAffectedRegions gets affected regions
func (iam *IntelligentAlertManager) getAffectedRegions(alert *Alert) []string {
	// Simple implementation - return all regions
	return []string{"us-east-1", "us-west-2", "eu-west-1", "ap-southeast-1"}
}

// estimateLoss estimates financial loss
func (iam *IntelligentAlertManager) estimateLoss(alert *Alert) float64 {
	// Simple calculation based on affected users and duration
	users := iam.estimateAffectedUsers(alert)
	duration := time.Since(alert.StartsAt.Time).Hours()

	// Assume $0.01 per user per hour
	return float64(users) * duration * 0.01
}

// estimateRevenueImpact estimates revenue impact
func (iam *IntelligentAlertManager) estimateRevenueImpact(alert *Alert) float64 {
	return iam.estimateLoss(alert)
}

// assessCustomerImpact assesses customer impact
func (iam *IntelligentAlertManager) assessCustomerImpact(alert *Alert) string {
	if alert.Severity == "critical" {
		return "High - Service unavailable"
	} else if alert.Severity == "warning" {
		return "Medium - Degraded performance"
	}
	return "Low - Minor impact"
}

// getImpactedSLAs gets impacted SLAs
func (iam *IntelligentAlertManager) getImpactedSLAs(alert *Alert) []string {
	if alert.Severity == "critical" {
		return []string{"API Availability", "Response Time", "Error Rate"}
	}
	return []string{"Response Time"}
}

// assessBrandImpact assesses brand impact
func (iam *IntelligentAlertManager) assessBrandImpact(alert *Alert) string {
	if alert.Severity == "critical" {
		return "High - Public outage likely"
	}
	return "Low"
}

// getComplianceRisks gets compliance risks
func (iam *IntelligentAlertManager) getComplianceRisks(alert *Alert) []string {
	if alert.Severity == "critical" {
		return []string{"Data Availability", "Security Controls"}
	}
	return []string{}
}

// getSystemState gets current system state
func (iam *IntelligentAlertManager) getSystemState(alert *Alert) map[string]interface{} {
	return map[string]interface{}{
		"active_alerts":   len(iam.activeAlerts),
		"system_load":     0.75,
		"error_rate":      0.02,
		"response_time":   "250ms",
		"last_deployment": "2025-11-04T10:00:00Z",
	}
}

// checkEscalation checks if alert should be escalated
func (iam *IntelligentAlertManager) checkEscalation(ctx context.Context, activeAlert *ActiveAlert) {
	// Get escalation policy
	policyID := "default"
	if activeAlert.Rule != nil {
		if pid := activeAlert.Rule.Labels["escalation_policy"]; pid != "" {
			policyID = pid
		}
	}

	policy, exists := iam.escalationPolicies[policyID]
	if !exists {
		return
	}

	// Check escalation conditions
	for _, condition := range policy.Conditions {
		if iam.shouldEscalate(activeAlert, condition) {
			iam.executeEscalation(ctx, activeAlert, policy)
			break
		}
	}
}

// shouldEscalate checks if alert should be escalated
func (iam *IntelligentAlertManager) shouldEscalate(activeAlert *ActiveAlert, condition EscalationCondition) bool {
	switch condition.Field {
	case "severity":
		if condition.Operator == "eq" {
			return activeAlert.Alert.Severity == condition.Value.(string)
		}
	case "duration":
		duration := time.Since(activeAlert.Alert.StartsAt.Time)
		if condition.Duration != nil {
			return duration > *condition.Duration
		}
	}
	return false
}

// executeEscalation executes alert escalation
func (iam *IntelligentAlertManager) executeEscalation(ctx context.Context, activeAlert *ActiveAlert, policy *EscalationPolicy) {
	// Determine escalation level
	duration := time.Since(activeAlert.Alert.StartsAt.Time)
	level := 0

	for i, escalationLevel := range policy.Levels {
		if duration > escalationLevel.Duration {
			level = i + 1
		}
	}

	if level < len(policy.Levels) {
		escalationLevel := policy.Levels[level]

		// Add to alert escalations
		activeAlert.Escalations = append(activeAlert.Escalations, escalationLevel)

		// Send escalation notifications
		iam.sendEscalationNotifications(ctx, activeAlert, escalationLevel)
	}
}

// sendEscalationNotifications sends escalation notifications
func (iam *IntelligentAlertManager) sendEscalationNotifications(ctx context.Context, activeAlert *ActiveAlert, level EscalationLevel) {
	// Implementation would send notifications through configured channels
	// This is a placeholder for the actual notification sending logic
}

// sendNotifications sends alert notifications
func (iam *IntelligentAlertManager) sendNotifications(ctx context.Context, activeAlert *ActiveAlert) {
	// Implementation would send notifications through configured channels
	// This is a placeholder for the actual notification sending logic
}

// setupCorrelation sets up correlation for alert rule
func (iam *IntelligentAlertManager) setupCorrelation(rule *AlertRule) {
	// Implementation would set up correlation rules based on alert rule
	// This is a placeholder for the correlation setup logic
}

// Helper functions for calculations
func calculateMean(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	sum := 0.0
	for _, v := range values {
		sum += v
	}
	return sum / float64(len(values))
}

func calculateStdDev(values []float64, mean float64) float64 {
	if len(values) == 0 {
		return 0
	}
	sum := 0.0
	for _, v := range values {
		sum += math.Pow(v-mean, 2)
	}
	return math.Sqrt(sum / float64(len(values)))
}

func formatLabels(labels map[string]string) string {
	result := ""
	for k, v := range labels {
		if result != "" {
			result += ","
		}
		result += fmt.Sprintf("%s=\"%s\"", k, v)
	}
	return result
}
