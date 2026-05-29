//go:build legacy_migrated
// +build legacy_migrated

package anomaly

import (
	"math"
	"sort"
	"time"
)

// SpikeDetector detects sudden spikes in metric values
type SpikeDetector struct{}

func (d *SpikeDetector) Name() string {
	return "spike"
}

func (d *SpikeDetector) Detect(data []DataPoint, config MetricConfig) (*Anomaly, error) {
	if len(data) < 2 {
		return nil, nil
	}

	// Calculate recent average
	recentWindow := min(10, len(data))
	recentSum := 0.0
	for i := len(data) - recentWindow; i < len(data); i++ {
		recentSum += data[i].Value
	}
	recentAvg := recentSum / float64(recentWindow)

	// Calculate historical baseline (excluding recent data)
	historicalStart := max(0, len(data)-50)
	historicalEnd := len(data) - recentWindow
	if historicalEnd <= historicalStart {
		return nil, nil
	}

	historicalSum := 0.0
	historicalCount := 0
	for i := historicalStart; i < historicalEnd; i++ {
		historicalSum += data[i].Value
		historicalCount++
	}

	if historicalCount == 0 {
		return nil, nil
	}

	historicalAvg := historicalSum / float64(historicalCount)
	currentValue := data[len(data)-1].Value

	// Calculate standard deviation
	variance := 0.0
	for i := historicalStart; i < historicalEnd; i++ {
		diff := data[i].Value - historicalAvg
		variance += diff * diff
	}
	stdDev := math.Sqrt(variance / float64(historicalCount))

	// Check for spike
	threshold := historicalAvg + (config.ThresholdFactor * stdDev)
	if currentValue > threshold && currentValue > recentAvg*1.5 {
		deviation := (currentValue - historicalAvg) / historicalAvg * 100

		return &Anomaly{
			ID:          GenerateAnomalyID(config.Name, data[len(data)-1].Timestamp),
			Type:        TypeSpike,
			Severity:    config.Severity,
			Value:       currentValue,
			Expected:    historicalAvg,
			Deviation:   deviation,
			Timestamp:   data[len(data)-1].Timestamp,
			Description: fmt.Sprintf("Spike detected: %.2f vs expected %.2f (%.1f%% deviation)", currentValue, historicalAvg, deviation),
			Confidence:  min(1.0, deviation/100.0),
		}, nil
	}

	return nil, nil
}

// DropDetector detects sudden drops in metric values
type DropDetector struct{}

func (d *DropDetector) Name() string {
	return "drop"
}

func (d *DropDetector) Detect(data []DataPoint, config MetricConfig) (*Anomaly, error) {
	if len(data) < 2 {
		return nil, nil
	}

	// Calculate recent average
	recentWindow := min(5, len(data))
	recentSum := 0.0
	for i := len(data) - recentWindow; i < len(data); i++ {
		recentSum += data[i].Value
	}
	recentAvg := recentSum / float64(recentWindow)

	// Calculate historical baseline
	historicalStart := max(0, len(data)-30)
	historicalEnd := len(data) - recentWindow
	if historicalEnd <= historicalStart {
		return nil, nil
	}

	historicalSum := 0.0
	historicalCount := 0
	for i := historicalStart; i < historicalEnd; i++ {
		historicalSum += data[i].Value
		historicalCount++
	}

	if historicalCount == 0 {
		return nil, nil
	}

	historicalAvg := historicalSum / float64(historicalCount)
	currentValue := data[len(data)-1].Value

	// Calculate standard deviation
	variance := 0.0
	for i := historicalStart; i < historicalEnd; i++ {
		diff := data[i].Value - historicalAvg
		variance += diff * diff
	}
	stdDev := math.Sqrt(variance / float64(historicalCount))

	// Check for drop
	threshold := historicalAvg - (config.ThresholdFactor * stdDev)
	if currentValue < threshold && currentValue < recentAvg*0.5 {
		deviation := (historicalAvg - currentValue) / historicalAvg * 100

		return &Anomaly{
			ID:          GenerateAnomalyID(config.Name, data[len(data)-1].Timestamp),
			Type:        TypeDrop,
			Severity:    config.Severity,
			Value:       currentValue,
			Expected:    historicalAvg,
			Deviation:   deviation,
			Timestamp:   data[len(data)-1].Timestamp,
			Description: fmt.Sprintf("Drop detected: %.2f vs expected %.2f (%.1f%% deviation)", currentValue, historicalAvg, deviation),
			Confidence:  min(1.0, deviation/100.0),
		}, nil
	}

	return nil, nil
}

// TrendChangeDetector detects changes in trend direction
type TrendChangeDetector struct{}

func (d *TrendChangeDetector) Name() string {
	return "trend_change"
}

func (d *TrendChangeDetector) Detect(data []DataPoint, config MetricConfig) (*Anomaly, error) {
	if len(data) < 20 {
		return nil, nil
	}

	// Calculate trend using linear regression
	shortWindow := min(10, len(data))
	shortSlope := d.calculateSlope(data[len(data)-shortWindow:])

	longWindow := min(30, len(data))
	longSlope := d.calculateSlope(data[len(data)-longWindow:])

	// Check for significant trend change
	slopeDiff := math.Abs(shortSlope - longSlope)
	avgValue := d.calculateAverage(data[len(data)-shortWindow:])

	if slopeDiff > avgValue*0.1 && math.Abs(shortSlope) > math.Abs(longSlope)*2 {
		currentValue := data[len(data)-1].Value
		deviation := slopeDiff / avgValue * 100

		severity := SeverityMedium
		if deviation > 50 {
			severity = SeverityHigh
		}

		return &Anomaly{
			ID:          GenerateAnomalyID(config.Name, data[len(data)-1].Timestamp),
			Type:        TypeTrendChange,
			Severity:    severity,
			Value:       currentValue,
			Expected:    0, // Expected trend
			Deviation:   deviation,
			Timestamp:   data[len(data)-1].Timestamp,
			Description: fmt.Sprintf("Trend change detected: short-term slope %.4f vs long-term slope %.4f", shortSlope, longSlope),
			Confidence:  min(1.0, deviation/50.0),
			Metadata: map[string]interface{}{
				"short_slope": shortSlope,
				"long_slope":  longSlope,
				"slope_diff":  slopeDiff,
			},
		}, nil
	}

	return nil, nil
}

// AnomalousValueDetector detects values that deviate from statistical norms
type AnomalousValueDetector struct{}

func (d *AnomalousValueDetector) Name() string {
	return "anomalous_value"
}

func (d *AnomalousValueDetector) Detect(data []DataPoint, config MetricConfig) (*Anomaly, error) {
	if len(data) < 10 {
		return nil, nil
	}

	// Calculate statistical properties
	values := make([]float64, len(data))
	for i, point := range data {
		values[i] = point.Value
	}

	mean := d.calculateMean(values)
	median := d.calculateMedian(values)
	stdDev := d.calculateStandardDeviation(values, mean)

	currentValue := data[len(data)-1].Value

	// Use Modified Z-score for outlier detection
	mad := d.calculateMedianAbsoluteDeviation(values, median)
	modifiedZScore := 0.6745 * (currentValue - median) / mad

	// Check for anomaly
	threshold := config.ThresholdFactor
	if math.Abs(modifiedZScore) > threshold {
		deviation := math.Abs(currentValue-mean) / mean * 100

		return &Anomaly{
			ID:          GenerateAnomalyID(config.Name, data[len(data)-1].Timestamp),
			Type:        TypeAnomalousValue,
			Severity:    config.Severity,
			Value:       currentValue,
			Expected:    mean,
			Deviation:   deviation,
			Timestamp:   data[len(data)-1].Timestamp,
			Description: fmt.Sprintf("Anomalous value detected: %.2f (Z-score: %.2f)", currentValue, modifiedZScore),
			Confidence:  min(1.0, math.Abs(modifiedZScore)/threshold),
			Metadata: map[string]interface{}{
				"modified_z_score": modifiedZScore,
				"median":           median,
				"mad":              mad,
			},
		}, nil
	}

	return nil, nil
}

// PatternBreakDetector detects breaks in established patterns
type PatternBreakDetector struct{}

func (d *PatternBreakDetector) Name() string {
	return "pattern_break"
}

func (d *PatternBreakDetector) Detect(data []DataPoint, config MetricConfig) (*Anomaly, error) {
	if len(data) < 20 {
		return nil, nil
	}

	// Analyze seasonal patterns
	seasonLength := int(config.SeasonalityPeriod.Minutes())
	if seasonLength == 0 {
		seasonLength = 60 // Default to 1 hour
	}

	// Check for pattern consistency
	patterns := d.extractSeasonalPatterns(data, seasonLength)
	if len(patterns) < 2 {
		return nil, nil
	}

	// Compare current pattern with historical patterns
	currentPattern := patterns[len(patterns)-1]
	historicalPatterns := patterns[:len(patterns)-1]

	anomalyScore := d.calculatePatternAnomalyScore(currentPattern, historicalPatterns)
	threshold := 0.3 // 30% deviation from expected pattern

	if anomalyScore > threshold {
		currentValue := data[len(data)-1].Value
		expectedValue := d.calculateExpectedFromPatterns(currentPattern, historicalPatterns)
		deviation := math.Abs(currentValue-expectedValue) / expectedValue * 100

		return &Anomaly{
			ID:          GenerateAnomalyID(config.Name, data[len(data)-1].Timestamp),
			Type:        TypePatternBreak,
			Severity:    config.Severity,
			Value:       currentValue,
			Expected:    expectedValue,
			Deviation:   deviation,
			Timestamp:   data[len(data)-1].Timestamp,
			Description: fmt.Sprintf("Pattern break detected: score %.2f (threshold %.2f)", anomalyScore, threshold),
			Confidence:  min(1.0, anomalyScore),
			Metadata: map[string]interface{}{
				"anomaly_score": anomalyScore,
				"season_length": seasonLength,
			},
		}, nil
	}

	return nil, nil
}

// SeasonalDeviationDetector detects deviations from seasonal patterns
type SeasonalDeviationDetector struct{}

func (d *SeasonalDeviationDetector) Name() string {
	return "seasonal_deviation"
}

func (d *SeasonalDeviationDetector) Detect(data []DataPoint, config MetricConfig) (*Anomaly, error) {
	if len(data) < 100 {
		return nil, nil
	}

	// Decompose time series into trend, seasonal, and residual components
	components := d.decomposeTimeSeries(data, int(config.SeasonalityPeriod.Hours()))
	if components == nil {
		return nil, nil
	}

	// Check residual component for anomalies
	residuals := components["residual"]
	residualStd := d.calculateStandardDeviation(residuals, 0.0)

	currentResidual := residuals[len(residuals)-1]
	threshold := config.ThresholdFactor * residualStd

	if math.Abs(currentResidual) > threshold {
		currentValue := data[len(data)-1].Value
		expectedValue := components["trend"][len(components["trend"])-1] + components["seasonal"][len(components["seasonal"])-1]
		deviation := math.Abs(currentValue-expectedValue) / expectedValue * 100

		return &Anomaly{
			ID:          GenerateAnomalyID(config.Name, data[len(data)-1].Timestamp),
			Type:        TypeSeasonalDev,
			Severity:    config.Severity,
			Value:       currentValue,
			Expected:    expectedValue,
			Deviation:   deviation,
			Timestamp:   data[len(data)-1].Timestamp,
			Description: fmt.Sprintf("Seasonal deviation detected: residual %.2f (threshold %.2f)", currentResidual, threshold),
			Confidence:  min(1.0, math.Abs(currentResidual)/threshold),
			Metadata: map[string]interface{}{
				"residual":        currentResidual,
				"residual_std":    residualStd,
				"seasonal_period": config.SeasonalityPeriod,
			},
		}, nil
	}

	return nil, nil
}

// Helper methods for detection algorithms

func (d *TrendChangeDetector) calculateSlope(data []DataPoint) float64 {
	if len(data) < 2 {
		return 0
	}

	n := float64(len(data))
	sumX := 0.0
	sumY := 0.0
	sumXY := 0.0
	sumX2 := 0.0

	for i, point := range data {
		x := float64(i)
		y := point.Value
		sumX += x
		sumY += y
		sumXY += x * y
		sumX2 += x * x
	}

	slope := (n*sumXY - sumX*sumY) / (n*sumX2 - sumX*sumX)
	return slope
}

func (d *AnomalousValueDetector) calculateMean(values []float64) float64 {
	sum := 0.0
	for _, v := range values {
		sum += v
	}
	return sum / float64(len(values))
}

func (d *AnomalousValueDetector) calculateMedian(values []float64) float64 {
	sorted := make([]float64, len(values))
	copy(sorted, values)
	sort.Float64s(sorted)

	n := len(sorted)
	if n%2 == 0 {
		return (sorted[n/2-1] + sorted[n/2]) / 2
	}
	return sorted[n/2]
}

func (d *AnomalousValueDetector) calculateStandardDeviation(values []float64, mean float64) float64 {
	sum := 0.0
	for _, v := range values {
		diff := v - mean
		sum += diff * diff
	}
	return math.Sqrt(sum / float64(len(values)))
}

func (d *AnomalousValueDetector) calculateMedianAbsoluteDeviation(values []float64, median float64) float64 {
	deviations := make([]float64, len(values))
	for i, v := range values {
		deviations[i] = math.Abs(v - median)
	}
	return d.calculateMedian(deviations)
}

func (d *PatternBreakDetector) extractSeasonalPatterns(data []DataPoint, seasonLength int) [][]float64 {
	if len(data) < seasonLength*2 {
		return nil
	}

	patterns := make([][]float64, 0)
	numSeasons := len(data) / seasonLength

	for s := 0; s < numSeasons; s++ {
		start := s * seasonLength
		end := start + seasonLength
		if end > len(data) {
			break
		}

		pattern := make([]float64, seasonLength)
		for i := 0; i < seasonLength; i++ {
			pattern[i] = data[start+i].Value
		}
		patterns = append(patterns, pattern)
	}

	return patterns
}

func (d *PatternBreakDetector) calculatePatternAnomalyScore(currentPattern []float64, historicalPatterns [][]float64) float64 {
	if len(historicalPatterns) == 0 {
		return 0
	}

	// Calculate average historical pattern
	avgPattern := make([]float64, len(currentPattern))
	for _, pattern := range historicalPatterns {
		for i := range pattern {
			avgPattern[i] += pattern[i]
		}
	}

	for i := range avgPattern {
		avgPattern[i] /= float64(len(historicalPatterns))
	}

	// Calculate deviation score
	totalDeviation := 0.0
	for i := range currentPattern {
		deviation := math.Abs(currentPattern[i] - avgPattern[i])
		totalDeviation += deviation
	}

	avgDeviation := totalDeviation / float64(len(currentPattern))
	avgValue := d.calculateAverage(avgPattern)

	return avgDeviation / avgValue
}

func (d *PatternBreakDetector) calculateExpectedFromPatterns(currentPattern []float64, historicalPatterns [][]float64) float64 {
	if len(historicalPatterns) == 0 {
		return d.calculateAverage(currentPattern)
	}

	// Simple prediction based on historical average at same position
	position := len(currentPattern) - 1
	if position >= len(historicalPatterns[0]) {
		return d.calculateAverage(currentPattern)
	}

	sum := 0.0
	count := 0
	for _, pattern := range historicalPatterns {
		if position < len(pattern) {
			sum += pattern[position]
			count++
		}
	}

	if count == 0 {
		return d.calculateAverage(currentPattern)
	}
	return sum / float64(count)
}

func (d *SeasonalDeviationDetector) decomposeTimeSeries(data []DataPoint, seasonLength int) map[string][]float64 {
	if len(data) < seasonLength*2 {
		return nil
	}

	values := make([]float64, len(data))
	for i, point := range data {
		values[i] = point.Value
	}

	// Simple moving average for trend
	trend := make([]float64, len(values))
	window := seasonLength
	for i := range values {
		start := max(0, i-window/2)
		end := min(len(values), i+window/2+1)

		sum := 0.0
		for j := start; j < end; j++ {
			sum += values[j]
		}
		trend[i] = sum / float64(end-start)
	}

	// Calculate seasonal component
	seasonal := make([]float64, len(values))
	for i := 0; i < seasonLength; i++ {
		seasonalSum := 0.0
		seasonalCount := 0
		for j := i; j < len(values); j += seasonLength {
			seasonalSum += values[j] - trend[j]
			seasonalCount++
		}
		if seasonalCount > 0 {
			seasonalAvg := seasonalSum / float64(seasonalCount)
			for j := i; j < len(values); j += seasonLength {
				seasonal[j] = seasonalAvg
			}
		}
	}

	// Calculate residual component
	residual := make([]float64, len(values))
	for i := range values {
		residual[i] = values[i] - trend[i] - seasonal[i]
	}

	return map[string][]float64{
		"trend":    trend,
		"seasonal": seasonal,
		"residual": residual,
	}
}

func (d *PatternBreakDetector) calculateAverage(values []float64) float64 {
	sum := 0.0
	for _, v := range values {
		sum += v
	}
	return sum / float64(len(values))
}

func (d *SeasonalDeviationDetector) calculateStandardDeviation(values []float64, mean float64) float64 {
	sum := 0.0
	for _, v := range values {
		diff := v - mean
		sum += diff * diff
	}
	return math.Sqrt(sum / float64(len(values)))
}

// Utility functions
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func minFloat(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}