package abuse

import (
	"context"
	"fmt"
	"math"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/sirupsen/logrus"
)

// AbuseDetector implements real-time abuse detection
type AbuseDetector struct {
	patterns   map[string]*AbusePattern
	mutex      sync.RWMutex
	logger     *logrus.Logger
	storage    AbuseStorage
	mlModels   map[string]MLModel
	riskScorer RiskScorer
}

// AbusePattern represents a detected abuse pattern
type AbusePattern struct {
	ID        string            `json:"id"`
	Type      string            `json:"type"`      // ddos, brute_force, abuse, etc.
	Pattern   string            `json:"pattern"`   // Regex or rule pattern
	Threshold float64           `json:"threshold"` // Detection threshold
	Weight    float64           `json:"weight"`    // Pattern weight
	Window    time.Duration     `json:"window"`    // Detection window
	Metadata  map[string]string `json:"metadata"`
	CreatedAt time.Time         `json:"created_at"`
	UpdatedAt time.Time         `json:"updated_at"`
}

// AbuseAnalysis represents abuse detection results
type AbuseAnalysis struct {
	Score           float64         `json:"score"`
	RiskLevel       string          `json:"risk_level"`
	ThreatTypes     []string        `json:"threat_types"`
	Patterns        []*AbusePattern `json:"patterns"`
	Recommendations []string        `json:"recommendations"`
	BlockSuggested  bool            `json:"block_suggested"`
	BlockDuration   time.Duration   `json:"block_duration"`
	Confidence      float64         `json:"confidence"`
}

// AbuseStorage interface for persisting abuse data
type AbuseStorage interface {
	StorePattern(ctx context.Context, pattern *AbusePattern) error
	GetPatterns(ctx context.Context) ([]*AbusePattern, error)
	StoreAnalysis(ctx context.Context, key string, analysis *AbuseAnalysis) error
	GetRecentAnalyses(ctx context.Context, ip string, duration time.Duration) ([]*AbuseAnalysis, error)
}

// MLModel interface for machine learning-based detection
type MLModel interface {
	Predict(features []float64) (float64, error)
	Train(data []TrainingExample) error
	GetFeatureNames() []string
}

// TrainingExample represents training data for ML models
type TrainingExample struct {
	Features []float64
	Label    float64 // 0 for benign, 1 for malicious
}

// RiskScorer calculates overall risk scores
type RiskScorer interface {
	CalculateRiskScore(analyses []*AbuseAnalysis, patterns []*AbusePattern) float64
	GetRiskLevel(score float64) string
	GetRecommendations(score float64, patterns []*AbusePattern) []string
}

// RequestFeatures represents extracted features from a request
type RequestFeatures struct {
	IPAddress    string            `json:"ip_address"`
	UserAgent    string            `json:"user_agent"`
	Endpoint     string            `json:"endpoint"`
	Method       string            `json:"method"`
	RequestSize  int64             `json:"request_size"`
	ResponseSize int64             `json:"response_size"`
	ResponseTime int64             `json:"response_time_ms"`
	Timestamp    time.Time         `json:"timestamp"`
	Headers      map[string]string `json:"headers"`
	Params       map[string]string `json:"params"`
	Body         string            `json:"body"`
}

// ThreatMetrics tracks various threat indicators
type ThreatMetrics struct {
	RequestsPerSecond  float64 `json:"requests_per_second"`
	ErrorRate          float64 `json:"error_rate"`
	UniqueEndpoints    int     `json:"unique_endpoints"`
	AverageRequestSize int64   `json:"average_request_size"`
	FailedAuthAttempts int     `json:"failed_auth_attempts"`
	SuspiciousPatterns int     `json:"suspicious_patterns"`
	GeoAnomalyScore    float64 `json:"geo_anomaly_score"`
	UserAgentAnomaly   float64 `json:"user_agent_anomaly"`
	TimePatternAnomaly float64 `json:"time_pattern_anomaly"`
}

// NewAbuseDetector creates a new abuse detector
func NewAbuseDetector(storage AbuseStorage, logger *logrus.Logger) *AbuseDetector {
	detector := &AbuseDetector{
		patterns:   make(map[string]*AbusePattern),
		logger:     logger,
		storage:    storage,
		mlModels:   make(map[string]MLModel),
		riskScorer: &DefaultRiskScorer{},
	}

	// Load existing patterns
	if err := detector.loadPatterns(context.Background()); err != nil {
		logger.WithError(err).Error("Failed to load abuse patterns")
	}

	// Load default patterns
	detector.loadDefaultPatterns()

	return detector
}

// AnalyzeRequest analyzes a request for abuse patterns
func (ad *AbuseDetector) AnalyzeRequest(ctx context.Context, req *RateLimitRequest) (*AbuseAnalysis, error) {
	startTime := time.Now()
	defer func() {
		ad.logger.WithField("duration_ms", time.Since(startTime).Milliseconds()).Debug("Abuse analysis completed")
	}()

	// Extract features from request
	features := ad.extractFeatures(req)

	// Get recent analyses for context
	recentAnalyses, err := ad.storage.GetRecentAnalyses(ctx, req.IPAddress, time.Hour)
	if err != nil {
		ad.logger.WithError(err).Warn("Failed to get recent analyses")
		recentAnalyses = []*AbuseAnalysis{}
	}

	// Match against patterns
	matchedPatterns := ad.matchPatterns(features)

	// Calculate ML-based score
	mlScore := ad.calculateMLScore(features)

	// Calculate threat metrics
	threatMetrics := ad.calculateThreatMetrics(req, recentAnalyses)

	// Calculate overall risk score
	score := ad.riskScorer.CalculateRiskScore(recentAnalyses, matchedPatterns)

	// Combine scores with weights
	finalScore := (score * 0.6) + (mlScore * 0.3) + (threatMetrics.ErrorRate * 0.1)

	// Determine risk level and recommendations
	riskLevel := ad.riskScorer.GetRiskLevel(finalScore)
	recommendations := ad.riskScorer.GetRecommendations(finalScore, matchedPatterns)

	analysis := &AbuseAnalysis{
		Score:           finalScore,
		RiskLevel:       riskLevel,
		ThreatTypes:     ad.getThreatTypes(matchedPatterns),
		Patterns:        matchedPatterns,
		Recommendations: recommendations,
		BlockSuggested:  finalScore > 0.8,
		BlockDuration:   ad.calculateBlockDuration(finalScore, riskLevel),
		Confidence:      ad.calculateConfidence(matchedPatterns, mlScore),
	}

	// Store analysis
	if err := ad.storage.StoreAnalysis(ctx, req.IPAddress, analysis); err != nil {
		ad.logger.WithError(err).Error("Failed to store abuse analysis")
	}

	ad.logger.WithFields(logrus.Fields{
		"ip_address":       req.IPAddress,
		"score":            finalScore,
		"risk_level":       riskLevel,
		"patterns_matched": len(matchedPatterns),
	}).Info("Abuse analysis completed")

	return analysis, nil
}

// UpdatePattern updates or creates an abuse pattern
func (ad *AbuseDetector) UpdatePattern(ctx context.Context, pattern *AbusePattern) error {
	ad.mutex.Lock()
	defer ad.mutex.Unlock()

	if pattern.ID == "" {
		pattern.ID = fmt.Sprintf("pattern_%d", time.Now().UnixNano())
	}

	now := time.Now()
	if pattern.CreatedAt.IsZero() {
		pattern.CreatedAt = now
	}
	pattern.UpdatedAt = now

	// Validate pattern
	if err := ad.validatePattern(pattern); err != nil {
		return fmt.Errorf("invalid pattern: %w", err)
	}

	// Store pattern
	ad.patterns[pattern.ID] = pattern

	if err := ad.storage.StorePattern(ctx, pattern); err != nil {
		return fmt.Errorf("failed to store pattern: %w", err)
	}

	ad.logger.WithFields(logrus.Fields{
		"pattern_id":   pattern.ID,
		"pattern_type": pattern.Type,
		"threshold":    pattern.Threshold,
	}).Info("Abuse pattern updated")

	return nil
}

// GetSuspiciousIPs returns IPs that exceed the abuse threshold
func (ad *AbuseDetector) GetSuspiciousIPs(ctx context.Context, threshold float64) ([]string, error) {
	// This would need to be implemented based on your storage backend
	// For now, return empty slice
	return []string{}, nil
}

// Helper methods

func (ad *AbuseDetector) extractFeatures(req *RateLimitRequest) *RequestFeatures {
	return &RequestFeatures{
		IPAddress:   req.IPAddress,
		Endpoint:    req.Endpoint,
		Method:      req.Method,
		RequestSize: int64(len(req.Headers)), // Rough estimation
		Timestamp:   req.Timestamp,
		Headers:     req.Headers,
	}
}

func (ad *AbuseDetector) matchPatterns(features *RequestFeatures) []*AbusePattern {
	ad.mutex.RLock()
	defer ad.mutex.RUnlock()

	var matchedPatterns []*AbusePattern

	for _, pattern := range ad.patterns {
		if ad.matchesPattern(pattern, features) {
			matchedPatterns = append(matchedPatterns, pattern)
		}
	}

	return matchedPatterns
}

func (ad *AbuseDetector) matchesPattern(pattern *AbusePattern, features *RequestFeatures) bool {
	switch pattern.Type {
	case "ddos":
		return ad.matchesDDoSPattern(pattern, features)
	case "brute_force":
		return ad.matchesBruteForcePattern(pattern, features)
	case "sql_injection":
		return ad.matchesSQLInjectionPattern(pattern, features)
	case "xss":
		return ad.matchesXSSPattern(pattern, features)
	case "suspicious_user_agent":
		return ad.matchesSuspiciousUserAgentPattern(pattern, features)
	case "anomalous_timing":
		return ad.matchesAnomalousTimingPattern(pattern, features)
	default:
		return false
	}
}

func (ad *AbuseDetector) matchesDDoSPattern(pattern *AbusePattern, features *RequestFeatures) bool {
	// DDoS detection would need historical data
	// For now, just check for suspicious endpoint patterns
	ddosEndpoints := []string{
		"/api/v1/auth/login",
		"/api/v1/users/register",
		"/api/v1/password/reset",
	}

	for _, endpoint := range ddosEndpoints {
		if strings.Contains(features.Endpoint, endpoint) {
			return true
		}
	}

	return false
}

func (ad *AbuseDetector) matchesBruteForcePattern(pattern *AbusePattern, features *RequestFeatures) bool {
	// Look for authentication-related endpoints
	authEndpoints := []string{
		"/auth/login",
		"/auth/signin",
		"/api/auth",
		"/login",
		"/signin",
	}

	for _, endpoint := range authEndpoints {
		if strings.Contains(features.Endpoint, endpoint) {
			return true
		}
	}

	return false
}

func (ad *AbuseDetector) matchesSQLInjectionPattern(pattern *AbusePattern, features *RequestFeatures) bool {
	sqlPatterns := []string{
		`(?i)(union|select|insert|update|delete|drop|create|alter)`,
		`(?i)(or|and)\s+\d+\s*=\s*\d+`,
		`(?i)('|"|\s)*(or|and)\s+\w+\s*=\s*\w+`,
		`(?i)(--|;|/\*|\*/)`,
	}

	for _, pattern := range sqlPatterns {
		matched, _ := regexp.MatchString(pattern, features.Endpoint)
		if matched {
			return true
		}
	}

	return false
}

func (ad *AbuseDetector) matchesXSSPattern(pattern *AbusePattern, features *RequestFeatures) bool {
	xssPatterns := []string{
		`(?i)<script[^>]*>.*?</script>`,
		`(?i)javascript:`,
		`(?i)on\w+\s*=`,
		`(?i)<iframe[^>]*>`,
		`(?i)<object[^>]*>`,
	}

	for _, pattern := range xssPatterns {
		matched, _ := regexp.MatchString(pattern, features.Endpoint)
		if matched {
			return true
		}
	}

	return false
}

func (ad *AbuseDetector) matchesSuspiciousUserAgentPattern(pattern *AbusePattern, features *RequestFeatures) bool {
	userAgent := features.Headers["User-Agent"]

	suspiciousPatterns := []string{
		`(?i)bot|crawler|spider`,
		`(?i)scraper|harvest`,
		`(?i)curl|wget|python|java`,
		`(?i)sqlmap|nmap|burp`,
	}

	for _, pattern := range suspiciousPatterns {
		matched, _ := regexp.MatchString(pattern, userAgent)
		if matched {
			return true
		}
	}

	return false
}

func (ad *AbuseDetector) matchesAnomalousTimingPattern(pattern *AbusePattern, features *RequestFeatures) bool {
	// Check for requests at unusual hours (e.g., 2-4 AM)
	hour := features.Timestamp.Hour()
	if hour >= 2 && hour <= 4 {
		return true
	}

	return false
}

func (ad *AbuseDetector) calculateMLScore(features *RequestFeatures) float64 {
	// Convert features to numeric array for ML model
	featureVector := ad.featuresToVector(features)

	// If ML models are available, use them
	if len(ad.mlModels) > 0 {
		var totalScore float64
		var modelCount int

		for _, model := range ad.mlModels {
			if score, err := model.Predict(featureVector); err == nil {
				totalScore += score
				modelCount++
			}
		}

		if modelCount > 0 {
			return totalScore / float64(modelCount)
		}
	}

	// Fallback to heuristic scoring
	return ad.calculateHeuristicScore(features)
}

func (ad *AbuseDetector) featuresToVector(features *RequestFeatures) []float64 {
	// Simple feature extraction - in practice, this would be more sophisticated
	vector := make([]float64, 10)

	// Hour of day (normalized)
	vector[0] = float64(features.Timestamp.Hour()) / 24.0

	// Day of week (normalized)
	vector[1] = float64(features.Timestamp.Weekday()) / 7.0

	// Request size (log normalized)
	if features.RequestSize > 0 {
		vector[2] = math.Log(float64(features.RequestSize)) / 20.0
	}

	// Method encoding (GET=0, POST=1, PUT=2, DELETE=3)
	switch features.Method {
	case "GET":
		vector[3] = 0
	case "POST":
		vector[3] = 1
	case "PUT":
		vector[3] = 2
	case "DELETE":
		vector[3] = 3
	default:
		vector[3] = 0.5
	}

	// User agent length (normalized)
	userAgent := features.Headers["User-Agent"]
	vector[4] = math.Min(float64(len(userAgent))/500.0, 1.0)

	// Contains suspicious keywords
	suspiciousKeywords := []string{"admin", "api", "test", "debug"}
	suspiciousCount := 0
	for _, keyword := range suspiciousKeywords {
		if strings.Contains(strings.ToLower(features.Endpoint), keyword) {
			suspiciousCount++
		}
	}
	vector[5] = float64(suspiciousCount) / float64(len(suspiciousKeywords))

	// Placeholder for additional features
	vector[6] = 0 // Response time would go here
	vector[7] = 0 // Error rate would go here
	vector[8] = 0 // Geographic anomaly would go here
	vector[9] = 0 // Request frequency would go here

	return vector
}

func (ad *AbuseDetector) calculateHeuristicScore(features *RequestFeatures) float64 {
	score := 0.0

	// Suspicious user agent
	userAgent := strings.ToLower(features.Headers["User-Agent"])
	if strings.Contains(userAgent, "bot") || strings.Contains(userAgent, "crawler") {
		score += 0.3
	}
	if strings.Contains(userAgent, "curl") || strings.Contains(userAgent, "wget") {
		score += 0.2
	}

	// Suspicious endpoint
	endpoint := strings.ToLower(features.Endpoint)
	if strings.Contains(endpoint, "admin") || strings.Contains(endpoint, "debug") {
		score += 0.2
	}

	// Unusual timing
	hour := features.Timestamp.Hour()
	if hour >= 2 && hour <= 4 {
		score += 0.1
	}

	return math.Min(score, 1.0)
}

func (ad *AbuseDetector) calculateThreatMetrics(req *RateLimitRequest, recentAnalyses []*AbuseAnalysis) *ThreatMetrics {
	metrics := &ThreatMetrics{
		RequestsPerSecond:  float64(len(recentAnalyses)) / 3600.0, // per second over last hour
		ErrorRate:          0.0,
		UniqueEndpoints:    0,
		AverageRequestSize: req.RequestSize,
		FailedAuthAttempts: 0,
		SuspiciousPatterns: 0,
		GeoAnomalyScore:    0.0,
		UserAgentAnomaly:   0.0,
		TimePatternAnomaly: 0.0,
	}

	endpoints := make(map[string]bool)
	for _, analysis := range recentAnalyses {
		if analysis.Score > 0.5 {
			metrics.SuspiciousPatterns++
		}
	}

	metrics.UniqueEndpoints = len(endpoints)
	if len(recentAnalyses) > 0 {
		errorCount := 0
		for _, analysis := range recentAnalyses {
			if analysis.Score > 0.8 {
				errorCount++
			}
		}
		metrics.ErrorRate = float64(errorCount) / float64(len(recentAnalyses))
	}

	return metrics
}

func (ad *AbuseDetector) getThreatTypes(patterns []*AbusePattern) []string {
	threatTypes := make(map[string]bool)
	for _, pattern := range patterns {
		threatTypes[pattern.Type] = true
	}

	result := make([]string, 0, len(threatTypes))
	for threatType := range threatTypes {
		result = append(result, threatType)
	}

	return result
}

func (ad *AbuseDetector) calculateBlockDuration(score float64, riskLevel string) time.Duration {
	switch riskLevel {
	case "critical":
		return time.Hour * 24
	case "high":
		return time.Hour * 6
	case "medium":
		return time.Hour * 2
	case "low":
		return time.Minute * 30
	default:
		return time.Minute * 15
	}
}

func (ad *AbuseDetector) calculateConfidence(patterns []*AbusePattern, mlScore float64) float64 {
	if len(patterns) == 0 {
		return mlScore
	}

	// Combine pattern-based confidence with ML confidence
	patternConfidence := math.Min(float64(len(patterns))/5.0, 1.0)
	return (patternConfidence + mlScore) / 2.0
}

func (ad *AbuseDetector) loadPatterns(ctx context.Context) error {
	patterns, err := ad.storage.GetPatterns(ctx)
	if err != nil {
		return fmt.Errorf("failed to load patterns from storage: %w", err)
	}

	ad.mutex.Lock()
	defer ad.mutex.Unlock()

	for _, pattern := range patterns {
		ad.patterns[pattern.ID] = pattern
	}

	ad.logger.WithField("pattern_count", len(patterns)).Info("Abuse patterns loaded")
	return nil
}

func (ad *AbuseDetector) loadDefaultPatterns() {
	defaultPatterns := []*AbusePattern{
		{
			ID:        "ddos-high-frequency",
			Type:      "ddos",
			Pattern:   "high_request_frequency",
			Threshold: 0.7,
			Weight:    1.0,
			Window:    time.Minute * 5,
			Metadata: map[string]string{
				"max_requests_per_minute": "100",
			},
		},
		{
			ID:        "brute-force-auth",
			Type:      "brute_force",
			Pattern:   "auth_endpoint_abuse",
			Threshold: 0.6,
			Weight:    0.8,
			Window:    time.Minute * 10,
			Metadata: map[string]string{
				"max_auth_attempts": "10",
			},
		},
		{
			ID:        "sql-injection-detection",
			Type:      "sql_injection",
			Pattern:   "sql_injection_patterns",
			Threshold: 0.8,
			Weight:    1.0,
			Window:    time.Hour,
			Metadata: map[string]string{
				"severity": "high",
			},
		},
		{
			ID:        "xss-detection",
			Type:      "xss",
			Pattern:   "xss_patterns",
			Threshold: 0.7,
			Weight:    0.9,
			Window:    time.Hour,
			Metadata: map[string]string{
				"severity": "medium",
			},
		},
		{
			ID:        "suspicious-user-agent",
			Type:      "suspicious_user_agent",
			Pattern:   "bot_or_tool_user_agent",
			Threshold: 0.5,
			Weight:    0.6,
			Window:    time.Hour,
			Metadata: map[string]string{
				"severity": "low",
			},
		},
	}

	ad.mutex.Lock()
	defer ad.mutex.Unlock()

	for _, pattern := range defaultPatterns {
		ad.patterns[pattern.ID] = pattern
	}

	ad.logger.WithField("pattern_count", len(defaultPatterns)).Info("Default abuse patterns loaded")
}

func (ad *AbuseDetector) validatePattern(pattern *AbusePattern) error {
	if pattern.Type == "" {
		return fmt.Errorf("pattern type is required")
	}
	if pattern.Pattern == "" {
		return fmt.Errorf("pattern is required")
	}
	if pattern.Threshold <= 0 || pattern.Threshold > 1 {
		return fmt.Errorf("threshold must be between 0 and 1")
	}
	if pattern.Window <= 0 {
		return fmt.Errorf("window must be positive")
	}

	return nil
}

// DefaultRiskScorer implements RiskScorer interface
type DefaultRiskScorer struct{}

func (drs *DefaultRiskScorer) CalculateRiskScore(analyses []*AbuseAnalysis, patterns []*AbusePattern) float64 {
	if len(analyses) == 0 && len(patterns) == 0 {
		return 0.0
	}

	score := 0.0

	// Score from recent analyses
	if len(analyses) > 0 {
		var totalScore float64
		for _, analysis := range analyses {
			totalScore += analysis.Score
		}
		score += (totalScore / float64(len(analyses))) * 0.6
	}

	// Score from pattern matches
	if len(patterns) > 0 {
		var totalWeight float64
		for _, pattern := range patterns {
			totalWeight += pattern.Weight * pattern.Threshold
		}
		score += math.Min(totalWeight, 1.0) * 0.4
	}

	return math.Min(score, 1.0)
}

func (drs *DefaultRiskScorer) GetRiskLevel(score float64) string {
	switch {
	case score >= 0.9:
		return "critical"
	case score >= 0.7:
		return "high"
	case score >= 0.5:
		return "medium"
	case score >= 0.3:
		return "low"
	default:
		return "minimal"
	}
}

func (drs *DefaultRiskScorer) GetRecommendations(score float64, patterns []*AbusePattern) []string {
	var recommendations []string

	if score >= 0.9 {
		recommendations = append(recommendations, "Immediate IP blocking recommended")
		recommendations = append(recommendations, "Investigate all recent requests from this IP")
		recommendations = append(recommendations, "Consider notifying security team")
	} else if score >= 0.7 {
		recommendations = append(recommendations, "Temporary IP blocking recommended")
		recommendations = append(recommendations, "Monitor for continued suspicious activity")
	} else if score >= 0.5 {
		recommendations = append(recommendations, "Increased monitoring recommended")
		recommendations = append(recommendations, "Consider rate limiting adjustments")
	}

	// Add pattern-specific recommendations
	for _, pattern := range patterns {
		switch pattern.Type {
		case "ddos":
			recommendations = append(recommendations, "Enable DDoS protection")
		case "brute_force":
			recommendations = append(recommendations, "Implement account lockout policies")
		case "sql_injection":
			recommendations = append(recommendations, "Review input validation and parameterized queries")
		case "xss":
			recommendations = append(recommendations, "Implement content security policy and output encoding")
		}
	}

	return recommendations
}

// RateLimitRequest is used for compatibility with the rate limiter
type RateLimitRequest struct {
	Key         string            `json:"key"`
	TenantID    string            `json:"tenant_id"`
	UserID      string            `json:"user_id"`
	IPAddress   string            `json:"ip_address"`
	Endpoint    string            `json:"endpoint"`
	Method      string            `json:"method"`
	Headers     map[string]string `json:"headers"`
	Timestamp   time.Time         `json:"timestamp"`
	RequestSize int64             `json:"request_size"`
	Weight      int               `json:"weight"`
	Burst       bool              `json:"burst"`
}
