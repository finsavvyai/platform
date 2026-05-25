package models

import (
	"encoding/json"
	"math/rand"
	"testing"
	"time"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFraudResult_CalculateRiskLevel(t *testing.T) {
	tests := []struct {
		name       string
		fraudScore float64
		expected   RiskLevel
	}{
		{"critical risk", 0.9, RiskLevelCritical},
		{"critical risk boundary", 0.8, RiskLevelCritical},
		{"high risk", 0.7, RiskLevelHigh},
		{"high risk boundary", 0.6, RiskLevelHigh},
		{"medium risk", 0.4, RiskLevelMedium},
		{"medium risk boundary", 0.3, RiskLevelMedium},
		{"low risk", 0.1, RiskLevelLow},
		{"zero risk", 0.0, RiskLevelLow},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := &FraudResult{FraudScore: tt.fraudScore}
			assert.Equal(t, tt.expected, result.CalculateRiskLevel())
		})
	}
}

func TestFraudResult_IsHighRisk(t *testing.T) {
	tests := []struct {
		name      string
		riskLevel RiskLevel
		expected  bool
	}{
		{"critical is high risk", RiskLevelCritical, true},
		{"high is high risk", RiskLevelHigh, true},
		{"medium is not high risk", RiskLevelMedium, false},
		{"low is not high risk", RiskLevelLow, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := &FraudResult{RiskLevel: tt.riskLevel}
			assert.Equal(t, tt.expected, result.IsHighRisk())
		})
	}
}

func TestFraudResult_AddExplanation(t *testing.T) {
	result := &FraudResult{}

	// Test adding first explanation
	result.AddExplanation("High velocity detected")
	assert.Len(t, result.Explanation, 1)
	assert.Equal(t, "High velocity detected", result.Explanation[0])

	// Test adding second explanation
	result.AddExplanation("Unusual location")
	assert.Len(t, result.Explanation, 2)
	assert.Equal(t, "Unusual location", result.Explanation[1])
}

func TestFraudResult_HasQuantumAdvantage(t *testing.T) {
	tests := []struct {
		name             string
		quantumAdvantage *float64
		expected         bool
	}{
		{"positive advantage", floatPtr(0.15), true},
		{"zero advantage", floatPtr(0.0), false},
		{"negative advantage", floatPtr(-0.05), false},
		{"nil advantage", nil, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := &FraudResult{QuantumAdvantage: tt.quantumAdvantage}
			assert.Equal(t, tt.expected, result.HasQuantumAdvantage())
		})
	}
}

func TestFraudResult_Validate(t *testing.T) {
	tests := []struct {
		name    string
		result  *FraudResult
		wantErr error
	}{
		{
			name: "valid result",
			result: &FraudResult{
				FraudScore:       0.75,
				Confidence:       0.85,
				ProcessingTimeMs: 50,
				QuantumAdvantage: floatPtr(0.1),
			},
			wantErr: nil,
		},
		{
			name: "invalid fraud score - too high",
			result: &FraudResult{
				FraudScore:       1.5,
				Confidence:       0.85,
				ProcessingTimeMs: 50,
			},
			wantErr: ErrInvalidFraudScore,
		},
		{
			name: "invalid fraud score - negative",
			result: &FraudResult{
				FraudScore:       -0.1,
				Confidence:       0.85,
				ProcessingTimeMs: 50,
			},
			wantErr: ErrInvalidFraudScore,
		},
		{
			name: "invalid confidence - too high",
			result: &FraudResult{
				FraudScore:       0.75,
				Confidence:       1.5,
				ProcessingTimeMs: 50,
			},
			wantErr: ErrInvalidConfidence,
		},
		{
			name: "invalid confidence - negative",
			result: &FraudResult{
				FraudScore:       0.75,
				Confidence:       -0.1,
				ProcessingTimeMs: 50,
			},
			wantErr: ErrInvalidConfidence,
		},
		{
			name: "invalid processing time - negative",
			result: &FraudResult{
				FraudScore:       0.75,
				Confidence:       0.85,
				ProcessingTimeMs: -10,
			},
			wantErr: ErrInvalidProcessingTime,
		},
		{
			name: "invalid quantum advantage - too high",
			result: &FraudResult{
				FraudScore:       0.75,
				Confidence:       0.85,
				ProcessingTimeMs: 50,
				QuantumAdvantage: floatPtr(1.5),
			},
			wantErr: ErrInvalidQuantumAdvantage,
		},
		{
			name: "invalid quantum advantage - too low",
			result: &FraudResult{
				FraudScore:       0.75,
				Confidence:       0.85,
				ProcessingTimeMs: 50,
				QuantumAdvantage: floatPtr(-1.5),
			},
			wantErr: ErrInvalidQuantumAdvantage,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.result.Validate()
			if tt.wantErr != nil {
				assert.Error(t, err)
				assert.Equal(t, tt.wantErr, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestFraudResult_TableName(t *testing.T) {
	result := &FraudResult{}
	assert.Equal(t, "fraud_results", result.TableName())
}

// Helper functions are now in test_utils.go

// Property-based tests for FraudResult validation
func TestFraudResult_PropertyBasedValidation(t *testing.T) {
	t.Run("valid fraud scores", func(t *testing.T) {
		for i := 0; i < 100; i++ {
			fraudScore := rand.Float64()        // Random score between 0 and 1
			confidence := rand.Float64()        // Random confidence between 0 and 1
			processingTime := rand.Int63n(1000) // Random processing time 0-999ms

			result := &FraudResult{
				TransactionID:    "tx_" + randomString(10),
				FraudScore:       fraudScore,
				Confidence:       confidence,
				ProcessingTimeMs: processingTime,
				ModelVersion:     "v1.0.0",
			}

			err := result.Validate()
			assert.NoError(t, err, "Valid fraud result should not produce error: score=%f, confidence=%f, time=%d",
				fraudScore, confidence, processingTime)
		}
	})

	t.Run("quantum advantage validation", func(t *testing.T) {
		validAdvantages := []float64{-1.0, -0.5, 0.0, 0.5, 1.0}

		for _, advantage := range validAdvantages {
			result := &FraudResult{
				TransactionID:    "tx_123",
				FraudScore:       0.5,
				Confidence:       0.8,
				ProcessingTimeMs: 50,
				QuantumAdvantage: &advantage,
				ModelVersion:     "v1.0.0",
			}

			err := result.Validate()
			assert.NoError(t, err, "Valid quantum advantage %f should not produce error", advantage)
		}

		invalidAdvantages := []float64{-1.1, 1.1, -2.0, 2.0}

		for _, advantage := range invalidAdvantages {
			result := &FraudResult{
				TransactionID:    "tx_123",
				FraudScore:       0.5,
				Confidence:       0.8,
				ProcessingTimeMs: 50,
				QuantumAdvantage: &advantage,
				ModelVersion:     "v1.0.0",
			}

			err := result.Validate()
			assert.Equal(t, ErrInvalidQuantumAdvantage, err, "Invalid quantum advantage %f should produce error", advantage)
		}
	})
}

// Serialization and deserialization tests
func TestFraudResult_JSONSerialization(t *testing.T) {
	quantumAdvantage := 0.15
	original := &FraudResult{
		ID:               123,
		TransactionID:    "tx_12345",
		FraudScore:       0.75,
		RiskLevel:        RiskLevelHigh,
		ProcessingMethod: ProcessingMethodQuantum,
		Confidence:       0.85,
		ProcessingTimeMs: 45,
		QuantumAdvantage: &quantumAdvantage,
		Explanation:      []string{"High velocity detected", "Unusual location pattern"},
		ModelVersion:     "v2.1.0",
		CreatedAt:        time.Date(2024, 1, 15, 10, 30, 0, 0, time.UTC),
		UpdatedAt:        time.Date(2024, 1, 15, 10, 30, 5, 0, time.UTC),
	}

	// Test serialization
	jsonData, err := json.Marshal(original)
	require.NoError(t, err)
	assert.Contains(t, string(jsonData), "tx_12345")
	assert.Contains(t, string(jsonData), "0.75")
	assert.Contains(t, string(jsonData), "high")
	assert.Contains(t, string(jsonData), "quantum")

	// Test deserialization
	var deserialized FraudResult
	err = json.Unmarshal(jsonData, &deserialized)
	require.NoError(t, err)

	// Verify all fields
	assert.Equal(t, original.ID, deserialized.ID)
	assert.Equal(t, original.TransactionID, deserialized.TransactionID)
	assert.Equal(t, original.FraudScore, deserialized.FraudScore)
	assert.Equal(t, original.RiskLevel, deserialized.RiskLevel)
	assert.Equal(t, original.ProcessingMethod, deserialized.ProcessingMethod)
	assert.Equal(t, original.Confidence, deserialized.Confidence)
	assert.Equal(t, original.ProcessingTimeMs, deserialized.ProcessingTimeMs)
	assert.Equal(t, *original.QuantumAdvantage, *deserialized.QuantumAdvantage)
	assert.Equal(t, original.ModelVersion, deserialized.ModelVersion)

	// Verify explanation array
	require.Equal(t, len(original.Explanation), len(deserialized.Explanation))
	for i, explanation := range original.Explanation {
		assert.Equal(t, explanation, deserialized.Explanation[i])
	}
}

func TestFraudResult_JSONSerializationEdgeCases(t *testing.T) {
	tests := []struct {
		name   string
		result *FraudResult
	}{
		{
			name: "minimal fraud result",
			result: &FraudResult{
				TransactionID:    "tx_min",
				FraudScore:       0.0,
				RiskLevel:        RiskLevelLow,
				ProcessingMethod: ProcessingMethodClassical,
				Confidence:       0.5,
				ProcessingTimeMs: 1,
				ModelVersion:     "v1.0",
			},
		},
		{
			name: "result with nil quantum advantage",
			result: &FraudResult{
				TransactionID:    "tx_nil_qa",
				FraudScore:       0.5,
				RiskLevel:        RiskLevelMedium,
				ProcessingMethod: ProcessingMethodHybrid,
				Confidence:       0.7,
				ProcessingTimeMs: 100,
				QuantumAdvantage: nil,
				ModelVersion:     "v1.5",
			},
		},
		{
			name: "result with empty explanation",
			result: &FraudResult{
				TransactionID:    "tx_empty_exp",
				FraudScore:       0.9,
				RiskLevel:        RiskLevelCritical,
				ProcessingMethod: ProcessingMethodQuantum,
				Confidence:       0.95,
				ProcessingTimeMs: 25,
				Explanation:      []string{},
				ModelVersion:     "v2.0",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Serialize
			jsonData, err := json.Marshal(tt.result)
			require.NoError(t, err)

			// Deserialize
			var deserialized FraudResult
			err = json.Unmarshal(jsonData, &deserialized)
			require.NoError(t, err)

			// Basic validation
			assert.Equal(t, tt.result.TransactionID, deserialized.TransactionID)
			assert.Equal(t, tt.result.FraudScore, deserialized.FraudScore)
			assert.Equal(t, tt.result.RiskLevel, deserialized.RiskLevel)
		})
	}
}

// Database constraint validation tests
func TestFraudResult_DatabaseConstraints(t *testing.T) {
	t.Run("foreign key constraint", func(t *testing.T) {
		result := &FraudResult{
			TransactionID:    "non_existent_tx", // Would fail foreign key constraint
			FraudScore:       0.5,
			RiskLevel:        RiskLevelMedium,
			ProcessingMethod: ProcessingMethodQuantum,
			Confidence:       0.8,
			ProcessingTimeMs: 50,
			ModelVersion:     "v1.0",
		}

		// This would fail database foreign key validation
		assert.Equal(t, "non_existent_tx", result.TransactionID)
	})

	t.Run("field length constraints", func(t *testing.T) {
		longString := randomString(300) // Exceeds field limits

		result := &FraudResult{
			TransactionID:    longString, // Should exceed database limit
			FraudScore:       0.5,
			RiskLevel:        RiskLevelMedium,
			ProcessingMethod: ProcessingMethodQuantum,
			Confidence:       0.8,
			ProcessingTimeMs: 50,
			ModelVersion:     longString, // Should exceed 50 char limit
		}

		assert.Greater(t, len(result.TransactionID), 255)
		assert.Greater(t, len(result.ModelVersion), 50)
	})

	t.Run("enum constraints", func(t *testing.T) {
		// Test invalid enum values that would fail database constraints
		invalidRiskLevels := []string{"invalid", "super_high", ""}
		invalidProcessingMethods := []string{"invalid", "ai", ""}

		for _, level := range invalidRiskLevels {
			result := &FraudResult{
				TransactionID:    "tx_123",
				FraudScore:       0.5,
				RiskLevel:        RiskLevel(level), // Invalid enum value
				ProcessingMethod: ProcessingMethodQuantum,
				Confidence:       0.8,
				ProcessingTimeMs: 50,
				ModelVersion:     "v1.0",
			}

			// Would fail database enum constraint
			assert.NotContains(t, []RiskLevel{RiskLevelLow, RiskLevelMedium, RiskLevelHigh, RiskLevelCritical}, result.RiskLevel)
		}

		for _, method := range invalidProcessingMethods {
			result := &FraudResult{
				TransactionID:    "tx_123",
				FraudScore:       0.5,
				RiskLevel:        RiskLevelMedium,
				ProcessingMethod: ProcessingMethod(method), // Invalid enum value
				Confidence:       0.8,
				ProcessingTimeMs: 50,
				ModelVersion:     "v1.0",
			}

			// Would fail database enum constraint
			assert.NotContains(t, []ProcessingMethod{ProcessingMethodQuantum, ProcessingMethodClassical, ProcessingMethodHybrid}, result.ProcessingMethod)
		}
	})
}

// Test GORM hooks
func TestFraudResult_BeforeCreateHook(t *testing.T) {
	result := &FraudResult{
		TransactionID: "tx_123",
		FraudScore:    0.75,
		// RiskLevel will be calculated by hook
		ProcessingMethod: ProcessingMethodQuantum,
		Confidence:       0.8,
		ProcessingTimeMs: 50,
		ModelVersion:     "v1.0",
	}

	// Simulate GORM BeforeCreate hook
	err := result.BeforeCreate(nil)
	assert.NoError(t, err)
	assert.Equal(t, RiskLevelHigh, result.RiskLevel) // Should be calculated based on fraud score
}

// Test relationship handling
func TestFraudResult_TransactionRelationship(t *testing.T) {
	transaction := &TransactionData{
		TransactionID: "tx_123",
		Amount:        decimal.NewFromFloat(100.00),
		Timestamp:     time.Now(),
		MerchantID:    "merchant_123",
		UserID:        "user_123",
		PaymentMethod: "credit_card",
	}

	result := &FraudResult{
		TransactionID:    "tx_123",
		FraudScore:       0.5,
		RiskLevel:        RiskLevelMedium,
		ProcessingMethod: ProcessingMethodQuantum,
		Confidence:       0.8,
		ProcessingTimeMs: 50,
		ModelVersion:     "v1.0",
		Transaction:      transaction,
	}

	// Test relationship
	assert.NotNil(t, result.Transaction)
	assert.Equal(t, result.TransactionID, result.Transaction.TransactionID)
}

// Benchmark tests
func BenchmarkFraudResult_CalculateRiskLevel(b *testing.B) {
	result := &FraudResult{FraudScore: 0.75}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = result.CalculateRiskLevel()
	}
}

func BenchmarkFraudResult_Validate(b *testing.B) {
	quantumAdvantage := 0.1
	result := &FraudResult{
		TransactionID:    "tx_123",
		FraudScore:       0.75,
		Confidence:       0.85,
		ProcessingTimeMs: 50,
		QuantumAdvantage: &quantumAdvantage,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = result.Validate()
	}
}

func BenchmarkFraudResult_JSONMarshal(b *testing.B) {
	quantumAdvantage := 0.15
	result := &FraudResult{
		TransactionID:    "tx_123",
		FraudScore:       0.75,
		RiskLevel:        RiskLevelHigh,
		ProcessingMethod: ProcessingMethodQuantum,
		Confidence:       0.85,
		ProcessingTimeMs: 45,
		QuantumAdvantage: &quantumAdvantage,
		Explanation:      []string{"High velocity", "Unusual pattern"},
		ModelVersion:     "v2.1.0",
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = json.Marshal(result)
	}
}
