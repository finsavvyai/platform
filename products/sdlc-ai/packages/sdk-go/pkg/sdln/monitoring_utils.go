package sdln

import (
	"math"
	"sort"
	"sync"
	"time"
)

// MonitoringUtils provides utility functions for enhanced monitoring
type MonitoringUtils struct {
	mu sync.RWMutex
	// In-memory cache for recent metrics and alerts
	recentMetrics map[string][]MetricPoint
	recentAlerts  map[string][]Alert
	alertGroups   map[string][]Alert // Correlated alerts
}

// NewMonitoringUtils creates a new monitoring utils instance
func NewMonitoringUtils() *MonitoringUtils {
	return &MonitoringUtils{
		recentMetrics: make(map[string][]MetricPoint),
		recentAlerts:  make(map[string][]Alert),
		alertGroups:   make(map[string][]Alert),
	}
}

// PerformanceMetricsCollector collects and aggregates performance metrics
type PerformanceMetricsCollector struct {
	window     time.Duration
	bucketSize time.Duration
	metrics    map[string]*TimeSeriesBuffer
	mu         sync.RWMutex
}

// NewPerformanceMetricsCollector creates a new performance metrics collector
func NewPerformanceMetricsCollector(window, bucketSize time.Duration) *PerformanceMetricsCollector {
	return &PerformanceMetricsCollector{
		window:     window,
		bucketSize: bucketSize,
		metrics:    make(map[string]*TimeSeriesBuffer),
	}
}

// TimeSeriesBuffer stores time series data in memory
type TimeSeriesBuffer struct {
	points []MetricPoint
	head   int
	size   int
	mu     sync.RWMutex
}

// NewTimeSeriesBuffer creates a new time series buffer
func NewTimeSeriesBuffer(size int) *TimeSeriesBuffer {
	return &TimeSeriesBuffer{
		points: make([]MetricPoint, size),
		head:   0,
		size:   0,
	}
}

// Add adds a new point to the buffer
func (b *TimeSeriesBuffer) Add(point MetricPoint) {
	b.mu.Lock()
	defer b.mu.Unlock()

	b.points[b.head] = point
	b.head = (b.head + 1) % len(b.points)
	if b.size < len(b.points) {
		b.size++
	}
}

// GetPoints returns all points in the buffer
func (b *TimeSeriesBuffer) GetPoints() []MetricPoint {
	b.mu.RLock()
	defer b.mu.RUnlock()

	if b.size < len(b.points) {
		result := make([]MetricPoint, b.size)
		copy(result, b.points[:b.size])
		return result
	}

	result := make([]MetricPoint, len(b.points))
	copy(result, b.points[b.head:])
	copy(result[len(b.points)-b.head:], b.points[:b.head])
	return result
}

// GetPointsInRange returns points within the given time range
func (b *TimeSeriesBuffer) GetPointsInRange(start, end Timestamp) []MetricPoint {
	b.mu.RLock()
	defer b.mu.RUnlock()

	var result []MetricPoint
	points := b.GetPoints()

	for _, point := range points {
		if point.Timestamp >= start && point.Timestamp <= end {
			result = append(result, point)
		}
	}

	return result
}

// AddMetric adds a metric to the collector
func (c *PerformanceMetricsCollector) AddMetric(name string, value float64, labels map[string]string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if _, ok := c.metrics[name]; !ok {
		c.metrics[name] = NewTimeSeriesBuffer(int(c.window/c.bucketSize) * 2)
	}

	point := MetricPoint{
		Timestamp: NewTimestamp(time.Now()),
		Value:     value,
	}

	c.metrics[name].Add(point)
}

// GetMetrics retrieves metrics for a given name and time range
func (c *PerformanceMetricsCollector) GetMetrics(name string, timeRange TimestampRange) []MetricPoint {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if buffer, ok := c.metrics[name]; ok {
		return buffer.GetPointsInRange(timeRange.From, timeRange.To)
	}
	return nil
}

// CalculatePercentile calculates the percentile for a set of values
func CalculatePercentile(values []float64, percentile float64) float64 {
	if len(values) == 0 {
		return 0
	}

	sort.Float64s(values)
	index := (percentile / 100.0) * float64(len(values)-1)

	if index == float64(int(index)) {
		return values[int(index)]
	}

	lower := int(math.Floor(index))
	upper := int(math.Ceil(index))
	weight := index - float64(lower)

	return values[lower]*(1-weight) + values[upper]*weight
}

// AlertCorrelator correlates alerts based on similarity
type AlertCorrelator struct {
	similarityThreshold float64
	timeWindow          time.Duration
}

// NewAlertCorrelator creates a new alert correlator
func NewAlertCorrelator(threshold float64, window time.Duration) *AlertCorrelator {
	return &AlertCorrelator{
		similarityThreshold: threshold,
		timeWindow:          window,
	}
}

// CorrelateAlerts correlates a group of alerts
func (ac *AlertCorrelator) CorrelateAlerts(alerts []Alert) [][]Alert {
	var groups [][]Alert
	processed := make(map[string]bool)

	for i, alert := range alerts {
		if processed[alert.ID] {
			continue
		}

		group := []Alert{alert}
		processed[alert.ID] = true

		// Find similar alerts
		for j := i + 1; j < len(alerts); j++ {
			other := alerts[j]
			if processed[other.ID] {
				continue
			}

			similarity := ac.calculateSimilarity(alert, other)
			if similarity >= ac.similarityThreshold {
				group = append(group, other)
				processed[other.ID] = true
			}
		}

		if len(group) > 1 {
			groups = append(groups, group)
		}
	}

	return groups
}

// calculateSimilarity calculates similarity between two alerts
func (ac *AlertCorrelator) calculateSimilarity(a, b Alert) float64 {
	score := 0.0
	factors := 0

	// Check source similarity
	if a.Source == b.Source {
		score += 1.0
	}
	factors++

	// Check severity similarity
	if a.Severity == b.Severity {
		score += 0.5
	}
	factors++

	// Check label similarity
	labelSimilarity := ac.calculateLabelSimilarity(a.Labels, b.Labels)
	score += labelSimilarity
	factors++

	// Check time proximity
	timeDiff := a.StartsAt.Sub(b.StartsAt.Time())
	if timeDiff < ac.timeWindow {
		timeScore := 1.0 - (float64(timeDiff) / float64(ac.timeWindow))
		score += timeScore
	}
	factors++

	// Check description similarity
	descSimilarity := ac.calculateStringSimilarity(a.Description, b.Description)
	score += descSimilarity
	factors++

	return score / float64(factors)
}

// calculateLabelSimilarity calculates similarity between label maps
func (ac *AlertCorrelator) calculateLabelSimilarity(a, b map[string]string) float64 {
	if len(a) == 0 && len(b) == 0 {
		return 1.0
	}

	if len(a) == 0 || len(b) == 0 {
		return 0.0
	}

	common := 0
	total := len(a) + len(b)

	for key, valA := range a {
		if valB, ok := b[key]; ok && valA == valB {
			common++
		}
	}

	return 2.0 * float64(common) / float64(total)
}

// calculateStringSimilarity calculates similarity between two strings using Jaccard similarity
func (ac *AlertCorrelator) calculateStringSimilarity(a, b string) float64 {
	if a == b {
		return 1.0
	}

	wordsA := ac.tokenize(a)
	wordsB := ac.tokenize(b)

	if len(wordsA) == 0 && len(wordsB) == 0 {
		return 1.0
	}

	if len(wordsA) == 0 || len(wordsB) == 0 {
		return 0.0
	}

	setA := make(map[string]bool)
	setB := make(map[string]bool)

	for _, word := range wordsA {
		setA[word] = true
	}

	for _, word := range wordsB {
		setB[word] = true
	}

	intersection := 0
	for word := range setA {
		if setB[word] {
			intersection++
		}
	}

	union := len(setA) + len(setB) - intersection

	return float64(intersection) / float64(union)
}

// tokenize splits a string into words
func (ac *AlertCorrelator) tokenize(s string) []string {
	// Simple tokenization - in practice, you might want more sophisticated tokenization
	var words []string
	current := ""

	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') {
			current += string(r)
		} else {
			if current != "" {
				words = append(words, current)
				current = ""
			}
		}
	}

	if current != "" {
		words = append(words, current)
	}

	return words
}

// NoiseReducer reduces alert noise by suppressing duplicate alerts
type NoiseReducer struct {
	suppressionWindow map[string]time.Duration
	lastAlerts        map[string]Timestamp
	mu                sync.RWMutex
}

// NewNoiseReducer creates a new noise reducer
func NewNoiseReducer() *NoiseReducer {
	return &NoiseReducer{
		suppressionWindow: make(map[string]time.Duration),
		lastAlerts:        make(map[string]Timestamp),
	}
}

// SetSuppressionWindow sets the suppression window for an alert type
func (nr *NoiseReducer) SetSuppressionWindow(alertType string, window time.Duration) {
	nr.mu.Lock()
	defer nr.mu.Unlock()
	nr.suppressionWindow[alertType] = window
}

// ShouldSuppress checks if an alert should be suppressed
func (nr *NoiseReducer) ShouldSuppress(alert Alert) bool {
	nr.mu.RLock()
	defer nr.mu.RUnlock()

	window, ok := nr.suppressionWindow[alert.Source]
	if !ok {
		// Default suppression window of 5 minutes
		window = 5 * time.Minute
	}

	lastAlert, ok := nr.lastAlerts[alert.Source]
	if !ok {
		return false
	}

	timeSinceLast := alert.StartsAt.Sub(lastAlert.Time())
	return timeSinceLast < window
}

// RecordAlert records an alert for noise reduction
func (nr *NoiseReducer) RecordAlert(alert Alert) {
	nr.mu.Lock()
	defer nr.mu.Unlock()
	nr.lastAlerts[alert.Source] = alert.StartsAt
}

// PredictiveAlerting provides predictive alerting capabilities
type PredictiveAlerting struct {
	historyLength int
	models        map[string]*PredictionModel
	mu            sync.RWMutex
}

// PredictionModel represents a simple prediction model
type PredictionModel struct {
	name    string
	values  []float64
	times   []time.Time
	maxSize int
	mu      sync.RWMutex
}

// NewPredictionModel creates a new prediction model
func NewPredictionModel(name string, maxSize int) *PredictionModel {
	return &PredictionModel{
		name:    name,
		values:  make([]float64, 0, maxSize),
		times:   make([]time.Time, 0, maxSize),
		maxSize: maxSize,
	}
}

// Add adds a new data point to the model
func (m *PredictionModel) Add(value float64, timestamp time.Time) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.values = append(m.values, value)
	m.times = append(m.times, timestamp)

	// Keep only the most recent values
	if len(m.values) > m.maxSize {
		copy(m.values, m.values[1:])
		m.values = m.values[:m.maxSize]

		copy(m.times, m.times[1:])
		m.times = m.times[:m.maxSize]
	}
}

// Predict predicts future values using linear regression
func (m *PredictionModel) Predict(steps int) []float64 {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if len(m.values) < 2 {
		return nil
	}

	// Simple linear regression
	n := float64(len(m.values))
	var sumX, sumY, sumXY, sumX2 float64

	for i := range m.values {
		x := float64(i)
		y := m.values[i]
		sumX += x
		sumY += y
		sumXY += x * y
		sumX2 += x * x
	}

	slope := (n*sumXY - sumX*sumY) / (n*sumX2 - sumX*sumX)
	intercept := (sumY - slope*sumX) / n

	predictions := make([]float64, steps)
	for i := 0; i < steps; i++ {
		x := float64(len(m.values) + i)
		predictions[i] = slope*x + intercept
	}

	return predictions
}

// NewPredictiveAlerting creates a new predictive alerting system
func NewPredictiveAlerting(historyLength int) *PredictiveAlerting {
	return &PredictiveAlerting{
		historyLength: historyLength,
		models:        make(map[string]*PredictionModel),
	}
}

// AddMetric adds a metric value for prediction
func (pa *PredictiveAlerting) AddMetric(name string, value float64, timestamp time.Time) {
	pa.mu.Lock()
	defer pa.mu.Unlock()

	if _, ok := pa.models[name]; !ok {
		pa.models[name] = NewPredictionModel(name, pa.historyLength)
	}

	pa.models[name].Add(value, timestamp)
}

// Predict predicts future values for a metric
func (pa *PredictiveAlerting) Predict(name string, steps int) []float64 {
	pa.mu.RLock()
	defer pa.mu.RUnlock()

	if model, ok := pa.models[name]; ok {
		return model.Predict(steps)
	}
	return nil
}

// CheckThreshold predicts if a threshold will be breached
func (pa *PredictiveAlerting) CheckThreshold(name string, threshold float64, steps int) (bool, float64, time.Duration) {
	predictions := pa.Predict(name, steps)
	if predictions == nil {
		return false, 0, 0
	}

	for i, pred := range predictions {
		if pred > threshold {
			// Calculate time until breach
			return true, pred, time.Duration(i+1) * time.Minute
		}
	}

	return false, 0, 0
}

// TrendAnalyzer analyzes trends in metrics
type TrendAnalyzer struct {
	window time.Duration
}

// NewTrendAnalyzer creates a new trend analyzer
func NewTrendAnalyzer(window time.Duration) *TrendAnalyzer {
	return &TrendAnalyzer{window: window}
}

// AnalyzeTrend analyzes the trend of a metric
func (ta *TrendAnalyzer) AnalyzeTrend(points []MetricPoint) TrendResult {
	if len(points) < 2 {
		return TrendResult{Direction: "stable", Confidence: 0}
	}

	// Sort points by timestamp
	sort.Slice(points, func(i, j int) bool {
		return points[i].Timestamp.Before(points[j].Timestamp.Time())
	})

	// Calculate trend using linear regression
	n := float64(len(points))
	var sumX, sumY, sumXY, sumX2 float64

	startTime := points[0].Timestamp.Time()

	for i, point := range points {
		x := float64(point.Timestamp.Sub(startTime))
		y := point.Value
		sumX += x
		sumY += y
		sumXY += x * y
		sumX2 += x * x
	}

	slope := (n*sumXY - sumX*sumY) / (n*sumX2 - sumX*sumX)

	// Calculate R-squared for confidence
	meanY := sumY / n
	var ssRes, ssTot float64

	for _, point := range points {
		x := float64(point.Timestamp.Sub(startTime))
		predicted := slope*x + sumY/n - slope*sumX/n
		actual := point.Value
		ssRes += math.Pow(actual-predicted, 2)
		ssTot += math.Pow(actual-meanY, 2)
	}

	rSquared := 1 - (ssRes / ssTot)
	confidence := math.Max(0, rSquared)

	// Determine trend direction
	direction := "stable"
	threshold := 0.01 // 1% change threshold

	if slope > threshold {
		direction = "increasing"
	} else if slope < -threshold {
		direction = "decreasing"
	}

	// Calculate rate of change
	rateOfChange := slope * 3600 // Convert to per hour

	return TrendResult{
		Direction:    direction,
		Confidence:   confidence,
		RateOfChange: rateOfChange,
		Slope:        slope,
		RSquared:     rSquared,
	}
}

// TrendResult represents the result of trend analysis
type TrendResult struct {
	Direction    string  `json:"direction"`      // increasing, decreasing, stable
	Confidence   float64 `json:"confidence"`     // 0-1
	RateOfChange float64 `json:"rate_of_change"` // per hour
	Slope        float64 `json:"slope"`
	RSquared     float64 `json:"r_squared"`
}

// AlertAggregator aggregates alerts for reporting
type AlertAggregator struct {
	aggregationWindow time.Duration
}

// NewAlertAggregator creates a new alert aggregator
func NewAlertAggregator(window time.Duration) *AlertAggregator {
	return &AlertAggregator{aggregationWindow: window}
}

// AggregateAlerts aggregates alerts by various dimensions
func (aa *AlertAggregator) AggregateAlerts(alerts []Alert) AlertAggregation {
	aggregation := AlertAggregation{
		TotalAlerts:    len(alerts),
		BySeverity:     make(map[string]int),
		BySource:       make(map[string]int),
		ByStatus:       make(map[string]int),
		ByHour:         make(map[string]int),
		TopSources:     make([]AlertSourceCount, 0),
		CriticalAlerts: 0,
	}

	now := time.Now()

	for _, alert := range alerts {
		// Count by severity
		aggregation.BySeverity[alert.Severity]++

		// Count by source
		aggregation.BySource[alert.Source]++

		// Count by status
		aggregation.ByStatus[alert.Status]++

		// Count by hour
		hour := alert.StartsAt.Format("2006-01-02 15:00")
		aggregation.ByHour[hour]++

		// Count critical alerts
		if alert.Severity == "critical" {
			aggregation.CriticalAlerts++
		}

		// Calculate resolution time if resolved
		if alert.Status == "resolved" && alert.EndTime != nil {
			resolutionTime := alert.EndTime.Sub(alert.StartsAt.Time())
			aggregation.TotalResolutionTime += resolutionTime
			aggregation.ResolvedAlerts++
		}
	}

	// Calculate average resolution time
	if aggregation.ResolvedAlerts > 0 {
		aggregation.AverageResolutionTime = aggregation.TotalResolutionTime / time.Duration(aggregation.ResolvedAlerts)
	}

	// Find top sources
	for source, count := range aggregation.BySource {
		aggregation.TopSources = append(aggregation.TopSources, AlertSourceCount{
			Source: source,
			Count:  count,
		})
	}

	sort.Slice(aggregation.TopSources, func(i, j int) bool {
		return aggregation.TopSources[i].Count > aggregation.TopSources[j].Count
	})

	if len(aggregation.TopSources) > 10 {
		aggregation.TopSources = aggregation.TopSources[:10]
	}

	// Calculate alert rate per hour
	if len(alerts) > 0 {
		oldestAlert := alerts[0]
		for _, alert := range alerts {
			if alert.StartsAt.Before(oldestAlert.StartsAt.Time()) {
				oldestAlert = alert
			}
		}

		duration := now.Sub(oldestAlert.StartsAt.Time())
		if duration > 0 {
			hours := duration.Hours()
			aggregation.AlertRatePerHour = float64(len(alerts)) / hours
		}
	}

	return aggregation
}

// AlertAggregation represents aggregated alert data
type AlertAggregation struct {
	TotalAlerts           int                `json:"total_alerts"`
	CriticalAlerts        int                `json:"critical_alerts"`
	ResolvedAlerts        int                `json:"resolved_alerts"`
	TotalResolutionTime   time.Duration      `json:"total_resolution_time"`
	AverageResolutionTime time.Duration      `json:"average_resolution_time"`
	AlertRatePerHour      float64            `json:"alert_rate_per_hour"`
	BySeverity            map[string]int     `json:"by_severity"`
	BySource              map[string]int     `json:"by_source"`
	ByStatus              map[string]int     `json:"by_status"`
	ByHour                map[string]int     `json:"by_hour"`
	TopSources            []AlertSourceCount `json:"top_sources"`
}

// AlertSourceCount represents alert count by source
type AlertSourceCount struct {
	Source string `json:"source"`
	Count  int    `json:"count"`
}
