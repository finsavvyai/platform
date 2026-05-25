package ai

import (
	"testing"
	"time"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"quantumbeam/internal/models"
)

func TestService_AnalyzeTransactionWithAI(t *testing.T) {
	// This would require a mock AI service or integration test setup
	// For now, we'll test the logic components

	service := NewService("http://localhost:8001")

	// Test calculateEnhancedFraudScore
	result := &EnhancedFraudResult{
		AIAnalysis: &FraudAnalysisResponse{
			RiskLevel:  "HIGH",
			Confidence: 0.9,
		},
		TextAnalysis: &TransactionAnalysisResponse{
			Sentiment:  "NEGATIVE",
			Confidence: 0.8,
		},
		AnomalyDetection: &AnomalyDetectionResponse{
			AnomalyDetected: true,
		},
	}

	score := service.calculateEnhancedFraudScore(result)
	assert.Greater(t, score, 0.7, "High risk should result in high fraud score")

	// Test determineRiskLevel
	riskLevel := service.determineRiskLevel(score)
	assert.Equal(t, models.RiskLevelHigh, riskLevel)

	// Test calculateConfidence
	confidence := service.calculateConfidence(result)
	assert.Greater(t, confidence, 0.8, "High confidence inputs should result in high confidence")
}

func TestService_calculateEnhancedFraudScore(t *testing.T) {
	service := NewService("http://localhost:8001")

	tests := []struct {
		name     string
		result   *EnhancedFraudResult
		expected float64
		minScore float64
		maxScore float64
	}{
		{
			name: "High risk AI analysis",
			result: &EnhancedFraudResult{
				AIAnalysis: &FraudAnalysisResponse{
					RiskLevel:  "HIGH",
					Confidence: 0.9,
				},
			},
			minScore: 0.7,
			maxScore: 1.0,
		},
		{
			name: "Low risk AI analysis",
			result: &EnhancedFraudResult{
				AIAnalysis: &FraudAnalysisResponse{
					RiskLevel:  "LOW",
					Confidence: 0.8,
				},
			},
			minScore: 0.0,
			maxScore: 0.4,
		},
		{
			name: "Negative sentiment",
			result: &EnhancedFraudResult{
				TextAnalysis: &TransactionAnalysisResponse{
					Sentiment:  "NEGATIVE",
					Confidence: 0.9,
				},
			},
			minScore: 0.6,
			maxScore: 1.0,
		},
		{
			name: "Anomaly detected",
			result: &EnhancedFraudResult{
				AnomalyDetection: &AnomalyDetectionResponse{
					AnomalyDetected: true,
				},
			},
			minScore: 0.7,
			maxScore: 1.0,
		},
		{
			name: "Combined high risk indicators",
			result: &EnhancedFraudResult{
				AIAnalysis: &FraudAnalysisResponse{
					RiskLevel:  "HIGH",
					Confidence: 0.9,
				},
				TextAnalysis: &TransactionAnalysisResponse{
					Sentiment:  "NEGATIVE",
					Confidence: 0.8,
				},
				AnomalyDetection: &AnomalyDetectionResponse{
					AnomalyDetected: true,
				},
			},
			minScore: 0.8,
			maxScore: 1.0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			score := service.calculateEnhancedFraudScore(tt.result)
			assert.GreaterOrEqual(t, score, tt.minScore, "Score should be above minimum")
			assert.LessOrEqual(t, score, tt.maxScore, "Score should be below maximum")
			assert.GreaterOrEqual(t, score, 0.0, "Score should not be negative")
			assert.LessOrEqual(t, score, 1.0, "Score should not exceed 1.0")
		})
	}
}

func TestService_determineRiskLevel(t *testing.T) {
	service := NewService("http://localhost:8001")

	tests := []struct {
		fraudScore float64
		expected   models.RiskLevel
	}{
		{0.8, models.RiskLevelHigh},
		{0.7, models.RiskLevelHigh},
		{0.6, models.RiskLevelMedium},
		{0.4, models.RiskLevelMedium},
		{0.3, models.RiskLevelLow},
		{0.0, models.RiskLevelLow},
	}

	for _, tt := range tests {
		t.Run("", func(t *testing.T) {
			result := service.determineRiskLevel(tt.fraudScore)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestService_calculateConfidence(t *testing.T) {
	service := NewService("http://localhost:8001")

	tests := []struct {
		name     string
		result   *EnhancedFraudResult
		expected float64
	}{
		{
			name: "Single high confidence AI analysis",
			result: &EnhancedFraudResult{
				AIAnalysis: &FraudAnalysisResponse{
					Confidence: 0.9,
				},
			},
			expected: 0.9,
		},
		{
			name: "Multiple confidence sources",
			result: &EnhancedFraudResult{
				AIAnalysis: &FraudAnalysisResponse{
					Confidence: 0.8,
				},
				TextAnalysis: &TransactionAnalysisResponse{
					Confidence: 0.6,
				},
			},
			expected: 0.7, // Average of 0.8 and 0.6
		},
		{
			name: "With anomaly detection",
			result: &EnhancedFraudResult{
				AIAnalysis: &FraudAnalysisResponse{
					Confidence: 0.9,
				},
				AnomalyDetection: &AnomalyDetectionResponse{
					AnomalyDetected: true,
				},
			},
			expected: 0.85, // Average of 0.9 and 0.8
		},
		{
			name:     "No confidence sources",
			result:   &EnhancedFraudResult{},
			expected: 0.5, // Default confidence
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			confidence := service.calculateConfidence(tt.result)
			assert.InDelta(t, tt.expected, confidence, 0.01, "Confidence should match expected value")
		})
	}
}

func TestService_buildExplanationPrompt(t *testing.T) {
	service := NewService("http://localhost:8001")

	transaction := &models.TransactionData{
		TransactionID: "txn_123",
		Amount:        decimal.NewFromFloat(1000.50),
		MerchantID:    "merchant_456",
		PaymentMethod: "credit_card",
		Timestamp:     time.Now(),
	}

	result := &EnhancedFraudResult{
		FraudResult: &models.FraudResult{
			FraudScore: 0.85,
			RiskLevel:  models.RiskLevelHigh,
			Confidence: 0.9,
		},
		AIAnalysis: &FraudAnalysisResponse{
			RiskLevel: "HIGH",
		},
		TextAnalysis: &TransactionAnalysisResponse{
			Sentiment: "NEGATIVE",
		},
		AnomalyDetection: &AnomalyDetectionResponse{
			AnomalyDetected: true,
		},
	}

	prompt := service.buildExplanationPrompt(transaction, result)

	assert.Contains(t, prompt, "txn_123", "Prompt should contain transaction ID")
	assert.Contains(t, prompt, "1000.5", "Prompt should contain amount")
	assert.Contains(t, prompt, "merchant_456", "Prompt should contain merchant ID")
	assert.Contains(t, prompt, "0.85", "Prompt should contain fraud score")
	assert.Contains(t, prompt, "HIGH", "Prompt should contain risk level")
	assert.Contains(t, prompt, "NEGATIVE", "Prompt should contain sentiment")
	assert.Contains(t, prompt, "Anomalous patterns detected", "Prompt should mention anomaly")
}

// Mock transaction data for testing
func createMockTransaction() *models.TransactionData {
	description := "Online purchase at electronics store"
	deviceFingerprint := "fp_abc123"

	return &models.TransactionData{
		TransactionID: "txn_test_123",
		Amount:        decimal.NewFromFloat(299.99),
		Timestamp:     time.Now(),
		MerchantID:    "merchant_electronics",
		UserID:        "user_456",
		PaymentMethod: "credit_card",
		Description:   &description,
		Location: &models.GeoLocation{
			Latitude:  37.7749,
			Longitude: -122.4194,
			Country:   "US",
			City:      "San Francisco",
		},
		DeviceFingerprint: &deviceFingerprint,
		Features: map[string]float64{
			"velocity_1h":   2.0,
			"velocity_24h":  5.0,
			"amount_zscore": 1.5,
			"merchant_risk": 0.3,
			"location_risk": 0.1,
		},
	}
}

func TestCreateMockTransaction(t *testing.T) {
	transaction := createMockTransaction()

	require.NotNil(t, transaction)
	assert.Equal(t, "txn_test_123", transaction.TransactionID)
	assert.Equal(t, "299.99", transaction.Amount.String())
	assert.Equal(t, "merchant_electronics", transaction.MerchantID)
	assert.Equal(t, "user_456", transaction.UserID)
	assert.Equal(t, "credit_card", transaction.PaymentMethod)
	assert.NotNil(t, transaction.Description)
	assert.Equal(t, "Online purchase at electronics store", *transaction.Description)
	assert.NotNil(t, transaction.Location)
	assert.Equal(t, 37.7749, transaction.Location.Latitude)
	assert.NotNil(t, transaction.DeviceFingerprint)
	assert.Equal(t, "fp_abc123", *transaction.DeviceFingerprint)
	assert.Len(t, transaction.Features, 5)

	// Test feature access
	velocity, exists := transaction.GetFeatureValue("velocity_1h")
	assert.True(t, exists)
	assert.Equal(t, 2.0, velocity)
}
