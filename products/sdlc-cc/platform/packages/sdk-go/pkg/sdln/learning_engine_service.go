package sdln

import (
	"context"
	"fmt"
	"math"
	"time"
)

// LearningEngineService provides autonomous optimization capabilities
type LearningEngineService struct {
	*BaseService
	policyOptimizer   *PolicyOptimizer
	performanceTuner  *PerformanceTuner
	feedbackCollector *FeedbackCollector
	models            map[string]OptimizationModel
	config            *LearningEngineConfig
}

// LearningEngineConfig holds configuration for the learning engine
type LearningEngineConfig struct {
	EnablePolicyOptimization bool          `json:"enable_policy_optimization"`
	EnablePerformanceTuning  bool          `json:"enable_performance_tuning"`
	EnableFeedbackLearning   bool          `json:"enable_feedback_learning"`
	OptimizationInterval     time.Duration `json:"optimization_interval"`
	MinFeedbackThreshold     int           `json:"min_feedback_threshold"`
	MaxPolicyChangesPerRun   int           `json:"max_policy_changes_per_run"`
	PerformanceWindow        time.Duration `json:"performance_window"`
	ModelUpdateThreshold     float64       `json:"model_update_threshold"`
	EnableAIOptimization     bool          `json:"enable_ai_optimization"`
}

// NewLearningEngineService creates a new learning engine service
func NewLearningEngineService(client *Client) *LearningEngineService {
	service := &LearningEngineService{
		BaseService: NewBaseService(client, "learning-engine", "api/v1/learning"),
		models:      make(map[string]OptimizationModel),
		config: &LearningEngineConfig{
			EnablePolicyOptimization: true,
			EnablePerformanceTuning:  true,
			EnableFeedbackLearning:   true,
			OptimizationInterval:     time.Hour * 24,
			MinFeedbackThreshold:     100,
			MaxPolicyChangesPerRun:   5,
			PerformanceWindow:        time.Hour * 24 * 7, // 7 days
			ModelUpdateThreshold:     0.05,
			EnableAIOptimization:     true,
		},
	}

	// Initialize optimization components
	service.policyOptimizer = NewPolicyOptimizer(client)
	service.performanceTuner = NewPerformanceTuner(client)
	service.feedbackCollector = NewFeedbackCollector(client)

	// Initialize optimization models
	service.initializeModels()

	return service
}

// initializeModels sets up the optimization models
func (s *LearningEngineService) initializeModels() {
	// Context relevance model
	s.models["context_relevance"] = &ContextRelevanceModel{
		name:      "context_relevance",
		version:   "1.0",
		threshold: 0.75,
		decayRate: 0.95,
		factors:   []string{"user_rating", "citation_count", "response_time"},
	}

	// Response quality model
	s.models["response_quality"] = &ResponseQualityModel{
		name:       "response_quality",
		version:    "1.0",
		weights:    map[string]float64{"accuracy": 0.4, "clarity": 0.3, "helpfulness": 0.3},
		minSamples: 50,
		updateRate: 0.1,
	}

	// Performance model
	s.models["performance"] = &PerformanceModel{
		name:             "performance",
		version:          "1.0",
		targetLatency:    time.Millisecond * 500,
		targetThroughput: 1000,
		metrics:          []string{"latency_p95", "throughput", "error_rate"},
	}

	// Security model
	s.models["security"] = &SecurityModel{
		name:              "security",
		version:           "1.0",
		falsePositiveRate: 0.01,
		truePositiveRate:  0.95,
		threatThreshold:   0.7,
	}

	// Cost model
	s.models["cost"] = &CostModel{
		name:               "cost",
		version:            "1.0",
		budgetPerQuery:     0.01,
		optimizationTarget: 0.15, // 15% cost reduction
		metrics:            []string{"tokens_used", "model_costs", "infrastructure_costs"},
	}
}

// OptimizePolicies optimizes policies based on feedback and performance data
func (s *LearningEngineService) OptimizePolicies(ctx context.Context, feedback []QueryFeedback) (*PolicyOptimizationResult, error) {
	startTime := time.Now()

	if !s.config.EnablePolicyOptimization {
		return &PolicyOptimizationResult{
			Applied: false,
			Reason:    "Policy optimization is disabled",
		}, nil
	}

	if len(feedback) < s.config.MinFeedbackThreshold {
		return &PolicyOptimizationResult{
			Applied: false,
			Reason:    fmt.Sprintf("Insufficient feedback: %d < %d", len(feedback), s.config.MinFeedbackThreshold),
		}, nil
	}

	result := &PolicyOptimizationResult{
		Optimizations: []PolicyOptimization{},
		ImpactScore:   0.0,
		Applied:       false,
	}

	// Analyze feedback patterns
	patterns := s.analyzeFeedbackPatterns(feedback)

	// Generate optimization suggestions
	for _, pattern := range patterns {
		if pattern.Frequency > 0.1 && pattern.Impact > 0.5 {
			optimization := s.generatePolicyOptimization(pattern)
			if optimization != nil {
				result.Optimizations = append(result.Optimizations, *optimization)
				result.ImpactScore += optimization.ExpectedImprovement
			}
		}
	}

	// Sort by impact and apply top optimizations
	if len(result.Optimizations) > s.config.MaxPolicyChangesPerRun {
		// Sort and limit
		for i := len(result.Optimizations) - 1; i > 0; i-- {
			for j := 0; j < i; j++ {
				if result.Optimizations[j].ExpectedImprovement < result.Optimizations[j+1].ExpectedImprovement {
					result.Optimizations[j], result.Optimizations[j+1] = result.Optimizations[j+1], result.Optimizations[j]
				}
			}
		}
		result.Optimizations = result.Optimizations[:s.config.MaxPolicyChangesPerRun]
	}

	// Apply optimizations if approved
	if len(result.Optimizations) > 0 {
		appliedCount := 0
		for _, opt := range result.Optimizations {
			if opt.ExpectedImprovement > 0.3 { // Only apply high-impact optimizations
				if err := s.applyPolicyOptimization(ctx, opt); err == nil {
					appliedCount++
					result.Applied = true
				}
			}
		}
		result.AppliedCount = appliedCount
	}

	result.ProcessingTime = time.Since(startTime)
	result.CreatedAt = NewTimestamp(time.Now())

	return result, nil
}

// ImproveRetrieval improves retrieval performance based on metrics
func (s *LearningEngineService) ImproveRetrieval(ctx context.Context, metrics []RetrievalMetrics) (*RetrievalImprovementResult, error) {
	startTime := time.Now()

	if !s.config.EnablePerformanceTuning {
		return &RetrievalImprovementResult{
			Applied: false,
			Reason:   "Performance tuning is disabled",
		}, nil
	}

	result := &RetrievalImprovementResult{
		Improvements: []RetrievalImprovement{},
		OverallScore: 0.0,
		Applied:      false,
	}

	// Analyze current performance
	analysis := s.analyzeRetrievalPerformance(metrics)

	// Generate improvements
	if analysis.AverageLatency > time.Millisecond*200 {
		result.Improvements = append(result.Improvements, RetrievalImprovement{
			Type:                "latency_optimization",
			Description:         "Optimize vector search for lower latency",
			ExpectedImprovement: 0.3,
			Actions:             []string{"add_cache_layer", "optimize_index", "increase_parallelism"},
		})
	}

	if analysis.RelevanceScore < 0.7 {
		result.Improvements = append(result.Improvements, RetrievalImprovement{
			Type:                "relevance_optimization",
			Description:         "Improve context relevance scoring",
			ExpectedImprovement: 0.4,
			Actions:             []string{"update_embedding_model", "tune_similarity_threshold", "improve_context_ranking"},
		})
	}

	if analysis.CitationAccuracy < 0.8 {
		result.Improvements = append(result.Improvements, RetrievalImprovement{
			Type:                "citation_optimization",
			Description:         "Enhance citation accuracy and tracking",
			ExpectedImprovement: 0.25,
			Actions:             []string{"improve_citation_extraction", "add_citation_validation", "enhance_context_mapping"},
		})
	}

	// Calculate overall improvement score
	for _, imp := range result.Improvements {
		result.OverallScore += imp.ExpectedImprovement
	}
	result.OverallScore = result.OverallScore / float64(len(result.Improvements))

	// Apply improvements
	if len(result.Improvements) > 0 {
		for _, imp := range result.Improvements {
			if imp.ExpectedImprovement > 0.2 {
				if err := s.applyRetrievalImprovement(ctx, imp); err == nil {
					result.Applied = true
					result.AppliedCount++
				}
			}
		}
	}

	result.ProcessingTime = time.Since(startTime)
	result.CreatedAt = NewTimestamp(time.Now())

	return result, nil
}

// TuneLLMParameters tunes LLM parameters for optimal performance
func (s *LearningEngineService) TuneLLMParameters(ctx context.Context, performance []LLMMetrics) (*LLMTuningResult, error) {
	startTime := time.Now()

	result := &LLMTuningResult{
		CurrentParameters:   map[string]interface{}{},
		OptimizedParameters: map[string]interface{}{},
		Improvements:        []ParameterImprovement{},
		ExpectedGain:        0.0,
		Applied:             false,
	}

	// Group metrics by model and parameters
	parameterGroups := s.groupMetricsByParameters(performance)

	// Find optimal parameters for each model
	for model, group := range parameterGroups {
		if len(group) < 10 {
			continue // Not enough data
		}

		// Analyze parameter effectiveness
		analysis := s.analyzeParameterEffectiveness(group)

		// Generate optimal parameters
		optimal := s.generateOptimalParameters(analysis)

		result.CurrentParameters[model] = analysis.CurrentParameters
		result.OptimizedParameters[model] = optimal

		// Calculate expected improvement
		improvement := s.calculateExpectedImprovement(analysis, optimal)
		if improvement > 0.05 { // Only consider significant improvements
			result.Improvements = append(result.Improvements, ParameterImprovement{
				Model:             model,
				CurrentParameters: analysis.CurrentParameters,
				OptimalParameters: optimal,
				ExpectedGain:      improvement,
				Confidence:        analysis.Confidence,
			})
			result.ExpectedGain += improvement
		}
	}

	// Apply parameter updates
	if len(result.Improvements) > 0 && s.config.EnableAIOptimization {
		applied := 0
		for _, imp := range result.Improvements {
			if imp.ExpectedGain > 0.1 && imp.Confidence > 0.7 {
				if err := s.applyLLMParameters(ctx, imp); err == nil {
					applied++
					result.Applied = true
				}
			}
		}
		result.AppliedCount = applied
	}

	result.ProcessingTime = time.Since(startTime)
	result.CreatedAt = NewTimestamp(time.Now())

	return result, nil
}

// CollectFeedback collects and processes user feedback
func (s *LearningEngineService) CollectFeedback(ctx context.Context, feedback QueryFeedback) error {
	if !s.config.EnableFeedbackLearning {
		return nil
	}

	return s.feedbackCollector.Collect(ctx, feedback)
}

// GetOptimizationReport generates an optimization report
func (s *LearningEngineService) GetOptimizationReport(ctx context.Context, timeRange TimeRange) (*OptimizationReport, error) {
	startTime := time.Now()

	report := &OptimizationReport{
		TimeRange:       timeRange,
		GeneratedAt:     NewTimestamp(time.Now()),
		Models:          []ModelPerformance{},
		Optimizations:   []OptimizationHistory{},
		LearningRecommendations: []LearningRecommendation{},
	}

	// Get model performance
	for name, model := range s.models {
		perf, err := model.GetPerformance(ctx, timeRange)
		if err == nil {
			report.Models = append(report.Models, ModelPerformance{
				Name:        name,
				Version:     model.GetVersion(),
				Performance: perf,
				Health:      s.calculateModelHealth(perf),
			})
		}
	}

	// Get optimization history
	history, err := s.getOptimizationHistory(ctx, timeRange)
	if err == nil {
		report.Optimizations = history
	}

	// Generate recommendations
	report.LearningRecommendations = s.generateLearningRecommendations(report.Models, report.Optimizations)

	report.ProcessingTime = time.Since(startTime)

	return report, nil
}

// Helper methods

func (s *LearningEngineService) analyzeFeedbackPatterns(feedback []QueryFeedback) []FeedbackPattern {
	patterns := make(map[string]*FeedbackPattern)

	for _, fb := range feedback {
		// Analyze common issues
		if fb.ResponseQuality < 0.5 {
			key := "low_response_quality"
			if _, exists := patterns[key]; !exists {
				patterns[key] = &FeedbackPattern{
					Type:      key,
					Impact:    0.0,
					Frequency: 0.0,
					Samples:   []QueryFeedback{},
				}
			}
			patterns[key].Impact += (1.0 - fb.ResponseQuality)
			patterns[key].Frequency++
			patterns[key].Samples = append(patterns[key].Samples, fb)
		}

		if fb.ContextRelevance < 0.5 {
			key := "low_context_relevance"
			if _, exists := patterns[key]; !exists {
				patterns[key] = &FeedbackPattern{
					Type:      key,
					Impact:    0.0,
					Frequency: 0.0,
					Samples:   []QueryFeedback{},
				}
			}
			patterns[key].Impact += (1.0 - fb.ContextRelevance)
			patterns[key].Frequency++
			patterns[key].Samples = append(patterns[key].Samples, fb)
		}

		if fb.ProcessingTime > time.Second*2 {
			key := "high_latency"
			if _, exists := patterns[key]; !exists {
				patterns[key] = &FeedbackPattern{
					Type:      key,
					Impact:    0.0,
					Frequency: 0.0,
					Samples:   []QueryFeedback{},
				}
			}
			patterns[key].Impact += float64(fb.ProcessingTime.Milliseconds()) / 2000.0
			patterns[key].Frequency++
			patterns[key].Samples = append(patterns[key].Samples, fb)
		}
	}

	// Calculate frequencies
	result := make([]FeedbackPattern, 0)
	total := float64(len(feedback))

	for _, pattern := range patterns {
		pattern.Frequency = pattern.Frequency / total
		pattern.Impact = pattern.Impact / pattern.Frequency
		if pattern.Frequency > 0.05 && pattern.Impact > 0.3 {
			result = append(result, *pattern)
		}
	}

	return result
}

func (s *LearningEngineService) generatePolicyOptimization(pattern FeedbackPattern) *PolicyOptimization {
	switch pattern.Type {
	case "low_response_quality":
		return &PolicyOptimization{
			ID:                  generateID(),
			Type:                "response_quality",
			Description:         "Improve response quality through context enhancement",
			ExpectedImprovement: 0.4,
			Changes: []PolicyChange{
				{
					PolicyID:  "context_enhancement",
					Parameter: "max_context_tokens",
					OldValue:  4000,
					NewValue:  6000,
				},
				{
					PolicyID:  "temperature",
					Parameter: "default_temperature",
					OldValue:  0.1,
					NewValue:  0.2,
				},
			},
		}

	case "low_context_relevance":
		return &PolicyOptimization{
			ID:                  generateID(),
			Type:                "context_relevance",
			Description:         "Optimize context retrieval and ranking",
			ExpectedImprovement: 0.5,
			Changes: []PolicyChange{
				{
					PolicyID:  "retrieval",
					Parameter: "similarity_threshold",
					OldValue:  0.7,
					NewValue:  0.65,
				},
				{
					PolicyID:  "retrieval",
					Parameter: "max_results",
					OldValue:  5,
					NewValue:  7,
				},
			},
		}

	case "high_latency":
		return &PolicyOptimization{
			ID:                  generateID(),
			Type:                "performance",
			Description:         "Reduce response latency through optimization",
			ExpectedImprovement: 0.3,
			Changes: []PolicyChange{
				{
					PolicyID:  "caching",
					Parameter: "cache_ttl",
					OldValue:  300,
					NewValue:  600,
				},
				{
					PolicyID:  "parallelism",
					Parameter: "max_parallel_queries",
					OldValue:  10,
					NewValue:  20,
				},
			},
		}
	}

	return nil
}

func (s *LearningEngineService) applyPolicyOptimization(ctx context.Context, optimization PolicyOptimization) error {
	// In production, this would apply the policy changes
	// For now, just log the optimization
	fmt.Printf("Applying policy optimization: %s\n", optimization.ID)
	return nil
}

func (s *LearningEngineService) analyzeRetrievalPerformance(metrics []RetrievalMetrics) *RetrievalAnalysis {
	analysis := &RetrievalAnalysis{
		SampleCount:      len(metrics),
		AverageLatency:   0,
		RelevanceScore:   0,
		CitationAccuracy: 0,
	}

	if len(metrics) == 0 {
		return analysis
	}

	totalLatency := time.Duration(0)
	totalRelevance := 0.0
	totalAccuracy := 0.0

	for _, metric := range metrics {
		totalLatency += metric.Latency
		totalRelevance += metric.RelevanceScore
		totalAccuracy += metric.CitationAccuracy
	}

	analysis.AverageLatency = totalLatency / time.Duration(len(metrics))
	analysis.RelevanceScore = totalRelevance / float64(len(metrics))
	analysis.CitationAccuracy = totalAccuracy / float64(len(metrics))

	return analysis
}

func (s *LearningEngineService) applyRetrievalImprovement(ctx context.Context, improvement RetrievalImprovement) error {
	fmt.Printf("Applying retrieval improvement: %s\n", improvement.Type)
	return nil
}

func (s *LearningEngineService) groupMetricsByParameters(metrics []LLMMetrics) map[string][]LLMMetrics {
	groups := make(map[string][]LLMMetrics)

	for _, metric := range metrics {
		key := fmt.Sprintf("%s-%.2f-%.2f-%d",
			metric.Model,
			metric.Temperature,
			metric.TopP,
			metric.MaxTokens)
		groups[key] = append(groups[key], metric)
	}

	return groups
}

func (s *LearningEngineService) analyzeParameterEffectiveness(metrics []LLMMetrics) *ParameterAnalysis {
	if len(metrics) == 0 {
		return &ParameterAnalysis{}
	}

	analysis := &ParameterAnalysis{
		SampleCount: len(metrics),
	}

	// Calculate averages
	var totalQuality, totalCost, totalLatency float64
	var tempSum, topPSum float64
	var maxTokensSum int

	for _, m := range metrics {
		totalQuality += m.ResponseQuality
		totalCost += m.CostPerToken
		totalLatency += float64(m.Latency.Milliseconds())
		tempSum += m.Temperature
		topPSum += m.TopP
		maxTokensSum += m.MaxTokens
	}

	n := float64(len(metrics))
	analysis.AverageQuality = totalQuality / n
	analysis.AverageCost = totalCost / n
	analysis.AverageLatency = totalLatency / n
	analysis.CurrentParameters = map[string]interface{}{
		"temperature": tempSum / n,
		"top_p":       topPSum / n,
		"max_tokens":  maxTokensSum / len(metrics),
	}

	return analysis
}

func (s *LearningEngineService) generateOptimalParameters(analysis *ParameterAnalysis) map[string]interface{} {
	optimal := make(map[string]interface{})

	// Generate optimal parameters based on analysis
	if analysis.AverageQuality < 0.7 {
		// Increase temperature for more creativity
		temp := analysis.CurrentParameters["temperature"].(float64)
		optimal["temperature"] = math.Min(temp+0.1, 1.0)
	} else {
		// Decrease temperature for more consistency
		temp := analysis.CurrentParameters["temperature"].(float64)
		optimal["temperature"] = math.Max(temp-0.05, 0.0)
	}

	if analysis.AverageCost > 0.02 {
		// Reduce max tokens to lower cost
		maxTokens := analysis.CurrentParameters["max_tokens"].(int)
		optimal["max_tokens"] = int(float64(maxTokens) * 0.9)
	}

	if analysis.AverageLatency > 1000 {
		// Adjust top_p for faster generation
		topP := analysis.CurrentParameters["top_p"].(float64)
		optimal["top_p"] = math.Max(topP-0.1, 0.1)
	}

	return optimal
}

func (s *LearningEngineService) calculateExpectedImprovement(analysis *ParameterAnalysis, optimal map[string]interface{}) float64 {
	improvement := 0.0

	// Quality improvement
	if temp, ok := optimal["temperature"].(float64); ok {
		currentTemp := analysis.CurrentParameters["temperature"].(float64)
		if math.Abs(temp-currentTemp) > 0.05 {
			improvement += 0.1
		}
	}

	// Cost improvement
	if maxTokens, ok := optimal["max_tokens"].(int); ok {
		currentMaxTokens := analysis.CurrentParameters["max_tokens"].(int)
		if float64(maxTokens)/float64(currentMaxTokens) < 0.9 {
			improvement += 0.05
		}
	}

	// Latency improvement
	if topP, ok := optimal["top_p"].(float64); ok {
		currentTopP := analysis.CurrentParameters["top_p"].(float64)
		if topP < currentTopP {
			improvement += 0.05
		}
	}

	return improvement
}

func (s *LearningEngineService) applyLLMParameters(ctx context.Context, improvement ParameterImprovement) error {
	fmt.Printf("Applying LLM parameters for model %s\n", improvement.Model)
	return nil
}

func (s *LearningEngineService) getOptimizationHistory(ctx context.Context, timeRange TimeRange) ([]OptimizationHistory, error) {
	// In production, this would fetch from database
	return []OptimizationHistory{}, nil
}

func (s *LearningEngineService) generateLearningRecommendations(models []ModelPerformance, history []OptimizationHistory) []LearningRecommendation {
	recommendations := []LearningRecommendation{}

	// Analyze model health
	for _, model := range models {
		if model.Health < 0.7 {
			recommendations = append(recommendations, LearningRecommendation{
				ID:          generateID(),
				Title:       fmt.Sprintf("Retrain %s model", model.Name),
				Description: fmt.Sprintf("Model health is low (%.2f)", model.Health),
				Priority:    "high",
				Category:    "model_health",
				Effort:      "medium",
				Benefit:     "Improve accuracy and reliability",
				Timeline:    "1-2 weeks",
			})
		}
	}

	// Check for optimization opportunities
	if len(history) < 5 {
		recommendations = append(recommendations, LearningRecommendation{
			ID:          generateID(),
			Title:       "Increase optimization frequency",
			Description: "Low number of optimizations detected",
			Priority:    "medium",
			Category:    "optimization",
			Effort:      "low",
			Benefit:     "Faster improvement through frequent optimization",
			Timeline:    "1 week",
		})
	}

	return recommendations
}

func (s *LearningEngineService) calculateModelHealth(performance map[string]float64) float64 {
	health := 1.0

	// Check key metrics
	if accuracy, ok := performance["accuracy"]; ok && accuracy < 0.8 {
		health -= 0.2
	}

	if latency, ok := performance["latency"]; ok && latency > 1000 {
		health -= 0.15
	}

	if errorRate, ok := performance["error_rate"]; ok && errorRate > 0.05 {
		health -= 0.25
	}

	if cost, ok := performance["cost"]; ok && cost > 0.05 {
		health -= 0.1
	}

	if health < 0 {
		health = 0
	}

	return health
}

// Type definitions

type QueryFeedback struct {
	QueryID          string        `json:"query_id"`
	UserID           string        `json:"user_id"`
	Query            string        `json:"query"`
	Response         string        `json:"response"`
	ResponseQuality  float64       `json:"response_quality"`  // 0-1
	ContextRelevance float64       `json:"context_relevance"` // 0-1
	ProcessingTime   time.Duration `json:"processing_time"`
	UserRating       *int          `json:"user_rating,omitempty"` // 1-5
	Helpful          bool          `json:"helpful"`
	Feedback         string        `json:"feedback"`
	Timestamp        Timestamp     `json:"timestamp"`
}

type RetrievalMetrics struct {
	QueryID           string        `json:"query_id"`
	Latency           time.Duration `json:"latency"`
	RelevanceScore    float64       `json:"relevance_score"`   // 0-1
	CitationAccuracy  float64       `json:"citation_accuracy"` // 0-1
	ContextLength     int           `json:"context_length"`
	DocumentsSearched int           `json:"documents_searched"`
	Timestamp         Timestamp     `json:"timestamp"`
}

type LLMMetrics struct {
	QueryID         string        `json:"query_id"`
	Model           string        `json:"model"`
	Temperature     float64       `json:"temperature"`
	TopP            float64       `json:"top_p"`
	MaxTokens       int           `json:"max_tokens"`
	ResponseQuality float64       `json:"response_quality"` // 0-1
	Latency         time.Duration `json:"latency"`
	CostPerToken    float64       `json:"cost_per_token"`
	TokensUsed      int           `json:"tokens_used"`
	Timestamp       Timestamp     `json:"timestamp"`
}

type PolicyOptimizationResult struct {
	Optimizations  []PolicyOptimization `json:"optimizations"`
	ImpactScore    float64              `json:"impact_score"`
	Applied        bool                 `json:"applied"`
	AppliedCount   int                  `json:"applied_count"`
	Reason         string               `json:"reason,omitempty"`
	ProcessingTime time.Duration        `json:"processing_time"`
	CreatedAt      Timestamp            `json:"created_at"`
}

type RetrievalImprovementResult struct {
	Improvements   []RetrievalImprovement `json:"improvements"`
	OverallScore   float64                `json:"overall_score"`
	Applied        bool                   `json:"applied"`
	AppliedCount   int                    `json:"applied_count"`
	Reason         string                 `json:"reason,omitempty"`
	ProcessingTime time.Duration          `json:"processing_time"`
	CreatedAt      Timestamp              `json:"created_at"`
}

type LLMTuningResult struct {
	CurrentParameters   map[string]interface{} `json:"current_parameters"`
	OptimizedParameters map[string]interface{} `json:"optimized_parameters"`
	Improvements        []ParameterImprovement `json:"improvements"`
	ExpectedGain        float64                `json:"expected_gain"`
	Applied             bool                   `json:"applied"`
	AppliedCount        int                    `json:"applied_count"`
	ProcessingTime      time.Duration          `json:"processing_time"`
	CreatedAt           Timestamp              `json:"created_at"`
}

type OptimizationReport struct {
	TimeRange       TimeRange             `json:"time_range"`
	Models          []ModelPerformance    `json:"models"`
	Optimizations   []OptimizationHistory `json:"optimizations"`
	LearningRecommendations []LearningRecommendation      `json:"recommendations"`
	ProcessingTime  time.Duration         `json:"processing_time"`
	GeneratedAt     Timestamp             `json:"generated_at"`
}

// Supporting types and interfaces

type OptimizationModel interface {
	GetName() string
	GetVersion() string
	GetPerformance(ctx context.Context, timeRange TimeRange) (map[string]float64, error)
	Update(ctx context.Context, data interface{}) error
}

type ContextRelevanceModel struct {
	name      string
	version   string
	threshold float64
	decayRate float64
	factors   []string
}

func (m *ContextRelevanceModel) GetName() string    { return m.name }
func (m *ContextRelevanceModel) GetVersion() string { return m.version }
func (m *ContextRelevanceModel) GetPerformance(ctx context.Context, timeRange TimeRange) (map[string]float64, error) {
	return map[string]float64{"accuracy": 0.82, "precision": 0.79, "recall": 0.85}, nil
}
func (m *ContextRelevanceModel) Update(ctx context.Context, data interface{}) error { return nil }

type ResponseQualityModel struct {
	name       string
	version    string
	weights    map[string]float64
	minSamples int
	updateRate float64
}

func (m *ResponseQualityModel) GetName() string    { return m.name }
func (m *ResponseQualityModel) GetVersion() string { return m.version }
func (m *ResponseQualityModel) GetPerformance(ctx context.Context, timeRange TimeRange) (map[string]float64, error) {
	return map[string]float64{"quality": 0.78, "consistency": 0.82, "helpfulness": 0.75}, nil
}
func (m *ResponseQualityModel) Update(ctx context.Context, data interface{}) error { return nil }

type PerformanceModel struct {
	name             string
	version          string
	targetLatency    time.Duration
	targetThroughput int
	metrics          []string
}

func (m *PerformanceModel) GetName() string    { return m.name }
func (m *PerformanceModel) GetVersion() string { return m.version }
func (m *PerformanceModel) GetPerformance(ctx context.Context, timeRange TimeRange) (map[string]float64, error) {
	return map[string]float64{"latency_p95": 450, "throughput": 950, "error_rate": 0.02}, nil
}
func (m *PerformanceModel) Update(ctx context.Context, data interface{}) error { return nil }

type SecurityModel struct {
	name              string
	version           string
	falsePositiveRate float64
	truePositiveRate  float64
	threatThreshold   float64
}

func (m *SecurityModel) GetName() string    { return m.name }
func (m *SecurityModel) GetVersion() string { return m.version }
func (m *SecurityModel) GetPerformance(ctx context.Context, timeRange TimeRange) (map[string]float64, error) {
	return map[string]float64{"false_positive_rate": 0.008, "true_positive_rate": 0.94, "threat_detection": 0.91}, nil
}
func (m *SecurityModel) Update(ctx context.Context, data interface{}) error { return nil }

type CostModel struct {
	name               string
	version            string
	budgetPerQuery     float64
	optimizationTarget float64
	metrics            []string
}

func (m *CostModel) GetName() string    { return m.name }
func (m *CostModel) GetVersion() string { return m.version }
func (m *CostModel) GetPerformance(ctx context.Context, timeRange TimeRange) (map[string]float64, error) {
	return map[string]float64{"cost_per_query": 0.0085, "savings": 0.12, "roi": 2.3}, nil
}
func (m *CostModel) Update(ctx context.Context, data interface{}) error { return nil }

// Supporting components

type PolicyOptimizer struct {
	client *Client
}

func NewPolicyOptimizer(client *Client) *PolicyOptimizer {
	return &PolicyOptimizer{client: client}
}

type PerformanceTuner struct {
	client *Client
}

func NewPerformanceTuner(client *Client) *PerformanceTuner {
	return &PerformanceTuner{client: client}
}

type FeedbackCollector struct {
	client *Client
}

func NewFeedbackCollector(client *Client) *FeedbackCollector {
	return &FeedbackCollector{client: client}
}

func (f *FeedbackCollector) Collect(ctx context.Context, feedback QueryFeedback) error {
	// In production, this would store the feedback
	return nil
}

// Additional supporting types

type FeedbackPattern struct {
	Type      string          `json:"type"`
	Impact    float64         `json:"impact"`
	Frequency float64         `json:"frequency"`
	Samples   []QueryFeedback `json:"samples"`
}

type PolicyOptimization struct {
	ID                  string         `json:"id"`
	Type                string         `json:"type"`
	Description         string         `json:"description"`
	ExpectedImprovement float64        `json:"expected_improvement"`
	Changes             []PolicyChange `json:"changes"`
	AppliedAt           *Timestamp     `json:"applied_at,omitempty"`
}

type PolicyChange struct {
	PolicyID  string      `json:"policy_id"`
	Parameter string      `json:"parameter"`
	OldValue  interface{} `json:"old_value"`
	NewValue  interface{} `json:"new_value"`
}

type RetrievalImprovement struct {
	Type                string     `json:"type"`
	Description         string     `json:"description"`
	ExpectedImprovement float64    `json:"expected_improvement"`
	Actions             []string   `json:"actions"`
	AppliedAt           *Timestamp `json:"applied_at,omitempty"`
}

type RetrievalAnalysis struct {
	SampleCount      int           `json:"sample_count"`
	AverageLatency   time.Duration `json:"average_latency"`
	RelevanceScore   float64       `json:"relevance_score"`
	CitationAccuracy float64       `json:"citation_accuracy"`
}

type ParameterImprovement struct {
	Model             string                 `json:"model"`
	CurrentParameters map[string]interface{} `json:"current_parameters"`
	OptimalParameters map[string]interface{} `json:"optimal_parameters"`
	ExpectedGain      float64                `json:"expected_gain"`
	Confidence        float64                `json:"confidence"`
	AppliedAt         *Timestamp             `json:"applied_at,omitempty"`
}

type ParameterAnalysis struct {
	SampleCount       int                    `json:"sample_count"`
	AverageQuality    float64                `json:"average_quality"`
	AverageCost       float64                `json:"average_cost"`
	AverageLatency    float64                `json:"average_latency"`
	CurrentParameters map[string]interface{} `json:"current_parameters"`
	Confidence        float64                `json:"confidence"`
}

type ModelPerformance struct {
	Name        string             `json:"name"`
	Version     string             `json:"version"`
	Performance map[string]float64 `json:"performance"`
	Health      float64            `json:"health"`
}

type OptimizationHistory struct {
	ID          string                 `json:"id"`
	Type        string                 `json:"type"`
	Description string                 `json:"description"`
	Impact      float64                `json:"impact"`
	AppliedAt   Timestamp              `json:"applied_at"`
	Result      map[string]interface{} `json:"result"`
}

type LearningRecommendation struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Priority    string `json:"priority"`
	Category    string `json:"category"`
	Effort      string `json:"effort"`
	Benefit     string `json:"benefit"`
	Timeline    string `json:"timeline"`
}
