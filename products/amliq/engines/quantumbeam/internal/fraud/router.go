package fraud

import (
	"context"
	"fmt"
	"math"
	"time"

	"quantumbeam/internal/interfaces"
	"quantumbeam/internal/models"
)

// Router implements the IntelligentRouter interface for quantum/classical routing decisions
type Router struct {
	quantumBackend     interfaces.QuantumBackendService
	strategy           *interfaces.RoutingStrategy
	performanceHistory *PerformanceTracker
}

// PerformanceTracker tracks historical performance for routing decisions
type PerformanceTracker struct {
	quantumSuccessRate   float64
	classicalSuccessRate float64
	quantumAvgTime       float64
	classicalAvgTime     float64
	quantumAdvantage     float64
	lastUpdated          time.Time
}

// NewRouter creates a new intelligent router
func NewRouter(quantumBackend interfaces.QuantumBackendService) *Router {
	defaultStrategy := &interfaces.RoutingStrategy{
		Name:              "adaptive_quantum_first",
		QuantumThreshold:  0.6, // Use quantum if confidence > 60%
		ComplexityWeight:  0.4, // 40% weight on transaction complexity
		PerformanceWeight: 0.6, // 60% weight on expected performance
		Parameters: map[string]interface{}{
			"min_quantum_advantage": 0.1, // Minimum 10% advantage required
			"fallback_threshold":    0.3, // Fallback if confidence < 30%
			"complexity_factors":    []string{"amount", "features", "network_size"},
		},
	}

	performanceTracker := &PerformanceTracker{
		quantumSuccessRate:   0.95, // Initial high success rate
		classicalSuccessRate: 0.98, // Classical is more reliable initially
		quantumAvgTime:       75.0, // Target sub-100ms
		classicalAvgTime:     45.0, // Classical is faster initially
		quantumAdvantage:     0.15, // 15% initial advantage
		lastUpdated:          time.Now(),
	}

	return &Router{
		quantumBackend:     quantumBackend,
		strategy:           defaultStrategy,
		performanceHistory: performanceTracker,
	}
}

// RouteTransaction determines the optimal processing method for a transaction
func (r *Router) RouteTransaction(ctx context.Context, transaction *models.TransactionData) (interfaces.ProcessingMethod, error) {
	// Calculate transaction complexity score
	complexityScore := r.calculateComplexityScore(transaction)

	// Get quantum backend status
	backendStatus, err := r.quantumBackend.MonitorQuantumHardware(ctx)
	if err != nil {
		// If quantum status check fails, default to classical
		return interfaces.ProcessingMethodClassical, nil
	}

	// Calculate quantum availability score
	availabilityScore := r.calculateAvailabilityScore(backendStatus)

	// Calculate expected performance scores
	quantumPerformanceScore := r.calculateQuantumPerformanceScore(complexityScore, availabilityScore)
	classicalPerformanceScore := r.calculateClassicalPerformanceScore(complexityScore)

	// Make routing decision based on strategy
	decision := r.makeRoutingDecision(quantumPerformanceScore, classicalPerformanceScore, complexityScore)

	return decision.Method, nil
}

// GetRoutingDecision provides detailed routing decision information
func (r *Router) GetRoutingDecision(ctx context.Context, features map[string]float64) (*interfaces.RoutingDecision, error) {
	// Create a mock transaction for analysis
	transaction := &models.TransactionData{
		Features: features,
	}

	complexityScore := r.calculateComplexityScore(transaction)

	backendStatus, err := r.quantumBackend.MonitorQuantumHardware(ctx)
	if err != nil {
		return &interfaces.RoutingDecision{
			Method:            interfaces.ProcessingMethodClassical,
			Confidence:        0.8,
			Reasoning:         "Quantum backend unavailable, using classical fallback",
			ExpectedAdvantage: 0.0,
		}, nil
	}

	availabilityScore := r.calculateAvailabilityScore(backendStatus)
	quantumPerformanceScore := r.calculateQuantumPerformanceScore(complexityScore, availabilityScore)
	classicalPerformanceScore := r.calculateClassicalPerformanceScore(complexityScore)

	decision := r.makeRoutingDecision(quantumPerformanceScore, classicalPerformanceScore, complexityScore)

	return &decision, nil
}

// UpdateRoutingStrategy updates the routing strategy configuration
func (r *Router) UpdateRoutingStrategy(ctx context.Context, strategy *interfaces.RoutingStrategy) error {
	// Validate strategy parameters
	if strategy.QuantumThreshold < 0 || strategy.QuantumThreshold > 1 {
		return fmt.Errorf("quantum threshold must be between 0 and 1")
	}

	if strategy.ComplexityWeight < 0 || strategy.ComplexityWeight > 1 {
		return fmt.Errorf("complexity weight must be between 0 and 1")
	}

	if strategy.PerformanceWeight < 0 || strategy.PerformanceWeight > 1 {
		return fmt.Errorf("performance weight must be between 0 and 1")
	}

	if math.Abs(strategy.ComplexityWeight+strategy.PerformanceWeight-1.0) > 0.01 {
		return fmt.Errorf("complexity weight and performance weight must sum to 1.0")
	}

	r.strategy = strategy
	return nil
}

// calculateComplexityScore calculates the complexity score of a transaction
func (r *Router) calculateComplexityScore(transaction *models.TransactionData) float64 {
	score := 0.0

	// Amount complexity (higher amounts are more complex)
	if !transaction.Amount.IsZero() {
		amount, _ := transaction.Amount.Float64()
		if amount > 0 {
			// Log scale normalization for amount complexity
			amountComplexity := math.Log10(amount) / 6.0 // Normalize to $1M max
			if amountComplexity > 1.0 {
				amountComplexity = 1.0
			}
			score += amountComplexity * 0.3
		}
	}

	// Feature complexity (more features = more complex)
	if transaction.Features != nil {
		featureCount := float64(len(transaction.Features))
		featureComplexity := math.Min(featureCount/20.0, 1.0) // Max 20 features
		score += featureComplexity * 0.4

		// Feature variance complexity
		if featureCount > 0 {
			variance := r.calculateFeatureVariance(transaction.Features)
			varianceComplexity := math.Min(variance, 1.0)
			score += varianceComplexity * 0.2
		}
	}

	// Location complexity (international transactions are more complex)
	if transaction.Location != nil {
		score += 0.1 // Base international complexity
	}

	// Ensure score is between 0 and 1
	if score > 1.0 {
		score = 1.0
	}

	return score
}

// calculateAvailabilityScore calculates quantum backend availability score
func (r *Router) calculateAvailabilityScore(status *interfaces.HardwareStatus) float64 {
	if status.AvailableBackends == 0 {
		return 0.0
	}

	// Base availability score
	availabilityRatio := float64(status.AvailableBackends) / float64(status.TotalBackends)

	// Adjust for queue times (lower is better)
	queuePenalty := math.Min(status.AverageQueueTime/300.0, 0.5) // Max 50% penalty for 5min+ queue

	// System health factor
	healthFactor := 1.0
	switch status.SystemHealth {
	case "excellent":
		healthFactor = 1.0
	case "good":
		healthFactor = 0.9
	case "fair":
		healthFactor = 0.7
	case "poor":
		healthFactor = 0.5
	default:
		healthFactor = 0.3
	}

	score := availabilityRatio * healthFactor * (1.0 - queuePenalty)
	return math.Max(score, 0.0)
}

// calculateQuantumPerformanceScore calculates expected quantum performance
func (r *Router) calculateQuantumPerformanceScore(complexityScore, availabilityScore float64) float64 {
	// Quantum performs better on complex problems
	complexityBonus := complexityScore * 0.4

	// Historical performance factor
	historicalFactor := r.performanceHistory.quantumSuccessRate *
		(r.performanceHistory.quantumAdvantage + 1.0) / 2.0

	// Availability impact
	availabilityFactor := availabilityScore

	// Time performance (quantum target is sub-100ms)
	timeFactor := 1.0
	if r.performanceHistory.quantumAvgTime > 100 {
		timeFactor = 100.0 / r.performanceHistory.quantumAvgTime
	}

	score := (complexityBonus + historicalFactor*0.6) * availabilityFactor * timeFactor
	return math.Min(score, 1.0)
}

// calculateClassicalPerformanceScore calculates expected classical performance
func (r *Router) calculateClassicalPerformanceScore(complexityScore float64) float64 {
	// Classical performs consistently but doesn't benefit from complexity
	basePerformance := r.performanceHistory.classicalSuccessRate

	// Classical is less affected by complexity but doesn't get complexity bonus
	complexityPenalty := complexityScore * 0.1 // Small penalty for high complexity

	// Time performance (classical is typically faster)
	timeFactor := 1.0
	if r.performanceHistory.classicalAvgTime > 50 {
		timeFactor = 50.0 / r.performanceHistory.classicalAvgTime
	}

	score := basePerformance * (1.0 - complexityPenalty) * timeFactor
	return math.Min(score, 1.0)
}

// makeRoutingDecision makes the final routing decision
func (r *Router) makeRoutingDecision(quantumScore, classicalScore, complexityScore float64) interfaces.RoutingDecision {
	// Calculate confidence based on score difference
	scoreDiff := quantumScore - classicalScore
	confidence := math.Min(math.Abs(scoreDiff)+0.5, 1.0)

	// Apply strategy thresholds
	minAdvantage, _ := r.strategy.Parameters["min_quantum_advantage"].(float64)
	fallbackThreshold, _ := r.strategy.Parameters["fallback_threshold"].(float64)

	var method interfaces.ProcessingMethod
	var reasoning string
	var expectedAdvantage float64

	if quantumScore > classicalScore && scoreDiff > minAdvantage {
		method = interfaces.ProcessingMethodQuantum
		expectedAdvantage = scoreDiff
		reasoning = fmt.Sprintf("Quantum processing selected: complexity=%.2f, quantum_score=%.2f, classical_score=%.2f",
			complexityScore, quantumScore, classicalScore)
	} else if confidence < fallbackThreshold {
		method = interfaces.ProcessingMethodClassical
		expectedAdvantage = 0.0
		reasoning = fmt.Sprintf("Classical fallback: low confidence (%.2f) in routing decision", confidence)
	} else {
		method = interfaces.ProcessingMethodClassical
		expectedAdvantage = math.Max(-scoreDiff, 0.0)
		reasoning = fmt.Sprintf("Classical processing selected: quantum_score=%.2f, classical_score=%.2f",
			quantumScore, classicalScore)
	}

	return interfaces.RoutingDecision{
		Method:            method,
		Confidence:        confidence,
		Reasoning:         reasoning,
		ExpectedAdvantage: expectedAdvantage,
	}
}

// calculateFeatureVariance calculates the variance of feature values
func (r *Router) calculateFeatureVariance(features map[string]float64) float64 {
	if len(features) == 0 {
		return 0.0
	}

	// Calculate mean
	sum := 0.0
	for _, value := range features {
		sum += value
	}
	mean := sum / float64(len(features))

	// Calculate variance
	varianceSum := 0.0
	for _, value := range features {
		diff := value - mean
		varianceSum += diff * diff
	}

	variance := varianceSum / float64(len(features))
	return math.Sqrt(variance) // Return standard deviation
}

// UpdatePerformanceMetrics updates performance tracking based on actual results
func (r *Router) UpdatePerformanceMetrics(method interfaces.ProcessingMethod, success bool, processingTime float64, advantage float64) {
	now := time.Now()

	// Exponential moving average with alpha = 0.1 (10% weight to new data)
	alpha := 0.1

	switch method {
	case interfaces.ProcessingMethodQuantum:
		if success {
			r.performanceHistory.quantumSuccessRate = (1-alpha)*r.performanceHistory.quantumSuccessRate + alpha*1.0
		} else {
			r.performanceHistory.quantumSuccessRate = (1-alpha)*r.performanceHistory.quantumSuccessRate + alpha*0.0
		}
		r.performanceHistory.quantumAvgTime = (1-alpha)*r.performanceHistory.quantumAvgTime + alpha*processingTime
		if advantage > 0 {
			r.performanceHistory.quantumAdvantage = (1-alpha)*r.performanceHistory.quantumAdvantage + alpha*advantage
		}

	case interfaces.ProcessingMethodClassical:
		if success {
			r.performanceHistory.classicalSuccessRate = (1-alpha)*r.performanceHistory.classicalSuccessRate + alpha*1.0
		} else {
			r.performanceHistory.classicalSuccessRate = (1-alpha)*r.performanceHistory.classicalSuccessRate + alpha*0.0
		}
		r.performanceHistory.classicalAvgTime = (1-alpha)*r.performanceHistory.classicalAvgTime + alpha*processingTime
	}

	r.performanceHistory.lastUpdated = now
}

// GetPerformanceMetrics returns current performance tracking metrics
func (r *Router) GetPerformanceMetrics() *PerformanceTracker {
	return r.performanceHistory
}

// GetCurrentStrategy returns the current routing strategy
func (r *Router) GetCurrentStrategy() *interfaces.RoutingStrategy {
	return r.strategy
}
