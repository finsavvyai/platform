package ai

import (
	"context"
	"fmt"
	"log"
	"time"

	"quantumbeam/internal/models"
)

// Service provides AI/ML enhanced fraud detection capabilities
type Service struct {
	client *AIClient
}

// NewService creates a new AI service
func NewService(aiServiceURL string) *Service {
	return &Service{
		client: NewAIClient(aiServiceURL),
	}
}

// EnhancedFraudResult represents an AI-enhanced fraud detection result
type EnhancedFraudResult struct {
	*models.FraudResult
	AIAnalysis        *FraudAnalysisResponse       `json:"ai_analysis,omitempty"`
	TextAnalysis      *TransactionAnalysisResponse `json:"text_analysis,omitempty"`
	AnomalyDetection  *AnomalyDetectionResponse    `json:"anomaly_detection,omitempty"`
	Explanation       string                       `json:"explanation"`
	ConfidenceFactors []string                     `json:"confidence_factors"`
}

// AnalyzeTransactionWithAI performs AI-enhanced fraud analysis
func (s *Service) AnalyzeTransactionWithAI(ctx context.Context, transaction *models.TransactionData) (*EnhancedFraudResult, error) {
	result := &EnhancedFraudResult{
		FraudResult: &models.FraudResult{
			TransactionID:    transaction.TransactionID,
			ProcessingMethod: "ai_enhanced",
		},
		ConfidenceFactors: make([]string, 0),
	}

	// Start timing
	startTime := time.Now()

	// 1. Analyze transaction text/description if available
	if transaction.Description != nil && *transaction.Description != "" {
		textAnalysis, err := s.analyzeTransactionText(ctx, *transaction.Description)
		if err != nil {
			log.Printf("Text analysis failed: %v", err)
		} else {
			result.TextAnalysis = textAnalysis
			result.ConfidenceFactors = append(result.ConfidenceFactors,
				fmt.Sprintf("Text sentiment: %s (%.2f confidence)",
					textAnalysis.Sentiment, textAnalysis.Confidence))
		}
	}

	// 2. Perform fraud pattern analysis using LLMs
	fraudAnalysis, err := s.analyzeFraudPatterns(ctx, transaction)
	if err != nil {
		log.Printf("Fraud pattern analysis failed: %v", err)
	} else {
		result.AIAnalysis = fraudAnalysis
		result.ConfidenceFactors = append(result.ConfidenceFactors,
			fmt.Sprintf("AI risk assessment: %s (%.2f confidence)",
				fraudAnalysis.RiskLevel, fraudAnalysis.Confidence))
	}

	// 3. Detect anomalies in transaction features
	if len(transaction.Features) > 0 {
		features := make([]float64, 0, len(transaction.Features))
		for _, value := range transaction.Features {
			features = append(features, value)
		}

		anomalyResult, err := s.detectAnomalies(ctx, features)
		if err != nil {
			log.Printf("Anomaly detection failed: %v", err)
		} else {
			result.AnomalyDetection = anomalyResult
			if anomalyResult.AnomalyDetected {
				result.ConfidenceFactors = append(result.ConfidenceFactors,
					"Anomalous transaction patterns detected")
			}
		}
	}

	// 4. Generate comprehensive explanation
	explanation, err := s.generateExplanation(ctx, transaction, result)
	if err != nil {
		log.Printf("Explanation generation failed: %v", err)
		result.Explanation = "AI analysis completed with limited explanation capability"
	} else {
		result.Explanation = explanation
	}

	// 5. Calculate final fraud score and risk level
	result.FraudScore = s.calculateEnhancedFraudScore(result)
	result.RiskLevel = s.determineRiskLevel(result.FraudScore)
	result.Confidence = s.calculateConfidence(result)
	result.ProcessingTimeMs = time.Since(startTime).Milliseconds()

	return result, nil
}

// analyzeTransactionText analyzes transaction text for fraud indicators
func (s *Service) analyzeTransactionText(ctx context.Context, text string) (*TransactionAnalysisResponse, error) {
	req := &TransactionAnalysisRequest{
		Text: text,
	}

	return s.client.AnalyzeTransactionText(ctx, req)
}

// analyzeFraudPatterns analyzes transaction data for fraud patterns
func (s *Service) analyzeFraudPatterns(ctx context.Context, transaction *models.TransactionData) (*FraudAnalysisResponse, error) {
	// Convert transaction to map for analysis
	transactionData := map[string]interface{}{
		"transaction_id": transaction.TransactionID,
		"amount":         transaction.Amount.String(),
		"timestamp":      transaction.Timestamp.Format(time.RFC3339),
		"merchant_id":    transaction.MerchantID,
		"user_id":        transaction.UserID,
		"payment_method": transaction.PaymentMethod,
		"features":       transaction.Features,
	}

	if transaction.Location != nil {
		transactionData["location"] = map[string]interface{}{
			"latitude":  transaction.Location.Latitude,
			"longitude": transaction.Location.Longitude,
			"country":   transaction.Location.Country,
			"city":      transaction.Location.City,
		}
	}

	if transaction.DeviceFingerprint != nil {
		transactionData["device_fingerprint"] = *transaction.DeviceFingerprint
	}

	req := &FraudAnalysisRequest{
		TransactionData: transactionData,
		UseConsensus:    true, // Use multiple providers for better accuracy
		PreferLocal:     false,
	}

	return s.client.AnalyzeFraudPatterns(ctx, req)
}

// detectAnomalies detects anomalies in transaction features
func (s *Service) detectAnomalies(ctx context.Context, features []float64) (*AnomalyDetectionResponse, error) {
	req := &AnomalyDetectionRequest{
		Features:  features,
		Threshold: 0.5,
	}

	return s.client.DetectAnomalies(ctx, req)
}

// generateExplanation generates a natural language explanation for the fraud decision
func (s *Service) generateExplanation(ctx context.Context, transaction *models.TransactionData, result *EnhancedFraudResult) (string, error) {
	prompt := s.buildExplanationPrompt(transaction, result)

	req := &TextGenerationRequest{
		Prompt:      prompt,
		MaxTokens:   300,
		Temperature: 0.3, // Lower temperature for more consistent explanations
	}

	response, err := s.client.GenerateText(ctx, req)
	if err != nil {
		return "", err
	}

	return response.Text, nil
}

// buildExplanationPrompt builds a prompt for explanation generation
func (s *Service) buildExplanationPrompt(transaction *models.TransactionData, result *EnhancedFraudResult) string {
	prompt := fmt.Sprintf(`
Explain the fraud detection decision for this transaction:

Transaction Details:
- ID: %s
- Amount: %s
- Merchant: %s
- Payment Method: %s
- Timestamp: %s

Analysis Results:
- Fraud Score: %.2f
- Risk Level: %s
- Confidence: %.2f

`, transaction.TransactionID, transaction.Amount.String(), transaction.MerchantID,
		transaction.PaymentMethod, transaction.Timestamp.Format("2006-01-02 15:04:05"),
		result.FraudScore, result.RiskLevel, result.Confidence)

	if result.AIAnalysis != nil {
		prompt += fmt.Sprintf("- AI Risk Assessment: %s\n", result.AIAnalysis.RiskLevel)
	}

	if result.TextAnalysis != nil {
		prompt += fmt.Sprintf("- Text Sentiment: %s\n", result.TextAnalysis.Sentiment)
	}

	if result.AnomalyDetection != nil && result.AnomalyDetection.AnomalyDetected {
		prompt += "- Anomalous patterns detected\n"
	}

	prompt += `
Provide a clear, concise explanation of why this transaction was flagged or approved. 
Focus on the key factors that influenced the decision. Keep it under 200 words.`

	return prompt
}

// calculateEnhancedFraudScore calculates the final fraud score using AI insights
func (s *Service) calculateEnhancedFraudScore(result *EnhancedFraudResult) float64 {
	baseScore := 0.5 // Start with neutral score

	// Weight AI analysis heavily
	if result.AIAnalysis != nil {
		switch result.AIAnalysis.RiskLevel {
		case "HIGH":
			baseScore += 0.3 * result.AIAnalysis.Confidence
		case "MEDIUM":
			baseScore += 0.1 * result.AIAnalysis.Confidence
		case "LOW":
			baseScore -= 0.2 * result.AIAnalysis.Confidence
		}
	}

	// Consider text sentiment
	if result.TextAnalysis != nil {
		if result.TextAnalysis.Sentiment == "NEGATIVE" {
			baseScore += 0.15 * result.TextAnalysis.Confidence
		} else if result.TextAnalysis.Sentiment == "POSITIVE" {
			baseScore -= 0.1 * result.TextAnalysis.Confidence
		}
	}

	// Factor in anomaly detection
	if result.AnomalyDetection != nil && result.AnomalyDetection.AnomalyDetected {
		baseScore += 0.2
	}

	// Ensure score is within bounds
	if baseScore > 1.0 {
		baseScore = 1.0
	} else if baseScore < 0.0 {
		baseScore = 0.0
	}

	return baseScore
}

// determineRiskLevel determines risk level based on fraud score
func (s *Service) determineRiskLevel(fraudScore float64) models.RiskLevel {
	if fraudScore >= 0.7 {
		return models.RiskLevelHigh
	} else if fraudScore >= 0.4 {
		return models.RiskLevelMedium
	}
	return models.RiskLevelLow
}

// calculateConfidence calculates overall confidence in the decision
func (s *Service) calculateConfidence(result *EnhancedFraudResult) float64 {
	confidenceSum := 0.0
	confidenceCount := 0

	if result.AIAnalysis != nil {
		confidenceSum += result.AIAnalysis.Confidence
		confidenceCount++
	}

	if result.TextAnalysis != nil {
		confidenceSum += result.TextAnalysis.Confidence
		confidenceCount++
	}

	// Anomaly detection adds to confidence if anomaly is detected
	if result.AnomalyDetection != nil && result.AnomalyDetection.AnomalyDetected {
		confidenceSum += 0.8
		confidenceCount++
	}

	if confidenceCount == 0 {
		return 0.5 // Default confidence
	}

	return confidenceSum / float64(confidenceCount)
}

// GetServiceHealth checks the health of the AI service
func (s *Service) GetServiceHealth(ctx context.Context) (map[string]interface{}, error) {
	return s.client.HealthCheck(ctx)
}

// GetModelStats retrieves model statistics
func (s *Service) GetModelStats(ctx context.Context) (map[string]interface{}, error) {
	return s.client.GetModelStats(ctx)
}

// GetProviderStats retrieves provider statistics
func (s *Service) GetProviderStats(ctx context.Context) (map[string]interface{}, error) {
	return s.client.GetProviderStats(ctx)
}

// GenerateFraudExplanation generates a comprehensive explanation for a fraud decision
func (s *Service) GenerateFraudExplanation(ctx context.Context, result *EnhancedFraudResult,
	transaction *models.TransactionData, style string) (*FraudExplanationResponse, error) {

	// Convert fraud indicators to the format expected by the explanation service
	indicators := make([]map[string]interface{}, 0)

	// Add indicators based on the enhanced result
	if result.AIAnalysis != nil {
		indicators = append(indicators, map[string]interface{}{
			"name":         "ai_risk_assessment",
			"value":        s.riskLevelToScore(result.AIAnalysis.RiskLevel),
			"threshold":    0.5,
			"severity":     s.riskLevelToSeverity(result.AIAnalysis.RiskLevel),
			"description":  "AI-based risk assessment",
			"impact_score": result.AIAnalysis.Confidence,
		})
	}

	if result.TextAnalysis != nil {
		sentimentScore := s.sentimentToScore(result.TextAnalysis.Sentiment)
		indicators = append(indicators, map[string]interface{}{
			"name":         "text_sentiment",
			"value":        sentimentScore,
			"threshold":    0.6,
			"severity":     s.scoreToSeverity(sentimentScore),
			"description":  "Transaction text sentiment analysis",
			"impact_score": result.TextAnalysis.Confidence * 0.3, // Lower impact than AI analysis
		})
	}

	if result.AnomalyDetection != nil && result.AnomalyDetection.AnomalyDetected {
		indicators = append(indicators, map[string]interface{}{
			"name":         "anomaly_detection",
			"value":        1.0,
			"threshold":    0.5,
			"severity":     "high",
			"description":  "Anomalous transaction patterns detected",
			"impact_score": 0.8,
		})
	}

	// Add feature-based indicators
	for feature, value := range transaction.Features {
		if value > 0.7 { // Only include high-value features
			indicators = append(indicators, map[string]interface{}{
				"name":         feature,
				"value":        value,
				"threshold":    0.5,
				"severity":     s.scoreToSeverity(value),
				"description":  s.getFeatureDescription(feature),
				"impact_score": value * 0.6, // Moderate impact
			})
		}
	}

	// Prepare transaction data
	transactionData := map[string]interface{}{
		"transaction_id": transaction.TransactionID,
		"amount":         transaction.Amount.String(),
		"timestamp":      transaction.Timestamp.Format("2006-01-02 15:04:05"),
		"merchant_id":    transaction.MerchantID,
		"user_id":        transaction.UserID,
		"payment_method": transaction.PaymentMethod,
	}

	if transaction.Description != nil {
		transactionData["description"] = *transaction.Description
	}

	if transaction.Location != nil {
		transactionData["location"] = map[string]interface{}{
			"latitude":  transaction.Location.Latitude,
			"longitude": transaction.Location.Longitude,
			"country":   transaction.Location.Country,
			"city":      transaction.Location.City,
		}
	}

	// Prepare AI analysis data
	var aiAnalysisData map[string]interface{}
	if result.AIAnalysis != nil {
		aiAnalysisData = map[string]interface{}{
			"risk_level":      result.AIAnalysis.RiskLevel,
			"confidence":      result.AIAnalysis.Confidence,
			"provider":        result.AIAnalysis.Provider,
			"processing_time": result.AIAnalysis.ProcessingTime,
		}
	}

	// Prepare text analysis data
	var textAnalysisData map[string]interface{}
	if result.TextAnalysis != nil {
		textAnalysisData = map[string]interface{}{
			"sentiment":       result.TextAnalysis.Sentiment,
			"confidence":      result.TextAnalysis.Confidence,
			"processing_time": result.TextAnalysis.ProcessingTime,
		}
	}

	// Prepare anomaly detection data
	var anomalyData map[string]interface{}
	if result.AnomalyDetection != nil {
		anomalyData = map[string]interface{}{
			"anomaly_detected":      result.AnomalyDetection.AnomalyDetected,
			"anomaly_scores":        result.AnomalyDetection.AnomalyScores,
			"anomaly_probabilities": result.AnomalyDetection.AnomalyProbabilities,
			"feature_count":         result.AnomalyDetection.FeatureCount,
		}
	}

	// Create explanation request
	req := &FraudExplanationRequest{
		TransactionData:        transactionData,
		FraudScore:             result.FraudScore,
		RiskLevel:              string(result.RiskLevel),
		Confidence:             result.Confidence,
		Indicators:             indicators,
		AIAnalysis:             aiAnalysisData,
		TextAnalysis:           textAnalysisData,
		AnomalyDetection:       anomalyData,
		Style:                  style,
		IncludeRecommendations: true,
	}

	return s.client.ExplainFraudDecision(ctx, req)
}

// Helper functions for converting between different formats

func (s *Service) riskLevelToScore(riskLevel string) float64 {
	switch riskLevel {
	case "HIGH":
		return 0.9
	case "MEDIUM":
		return 0.6
	case "LOW":
		return 0.3
	default:
		return 0.5
	}
}

func (s *Service) riskLevelToSeverity(riskLevel string) string {
	switch riskLevel {
	case "HIGH":
		return "critical"
	case "MEDIUM":
		return "medium"
	case "LOW":
		return "low"
	default:
		return "medium"
	}
}

func (s *Service) sentimentToScore(sentiment string) float64 {
	switch sentiment {
	case "NEGATIVE":
		return 0.8
	case "POSITIVE":
		return 0.2
	default:
		return 0.5
	}
}

func (s *Service) scoreToSeverity(score float64) string {
	if score >= 0.8 {
		return "critical"
	} else if score >= 0.6 {
		return "high"
	} else if score >= 0.4 {
		return "medium"
	} else {
		return "low"
	}
}

func (s *Service) getFeatureDescription(feature string) string {
	descriptions := map[string]string{
		"velocity_1h":    "Transaction velocity in the last hour",
		"velocity_24h":   "Transaction velocity in the last 24 hours",
		"amount_zscore":  "Transaction amount z-score compared to user history",
		"merchant_risk":  "Merchant risk score based on historical data",
		"location_risk":  "Geographic location risk assessment",
		"device_risk":    "Device fingerprint risk evaluation",
		"behavior_score": "User behavior pattern analysis",
		"time_risk":      "Transaction timing risk assessment",
	}

	if desc, exists := descriptions[feature]; exists {
		return desc
	}
	return fmt.Sprintf("Risk indicator: %s", feature)
}

// GetFraudPatterns retrieves available fraud patterns
func (s *Service) GetFraudPatterns(ctx context.Context) (map[string]interface{}, error) {
	return s.client.GetFraudPatterns(ctx)
}

// GetExplanationStyles retrieves available explanation styles
func (s *Service) GetExplanationStyles(ctx context.Context) (map[string]interface{}, error) {
	return s.client.GetExplanationStyles(ctx)
}
