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

// Integration tests for cross-model relationships and complex scenarios

func TestCrossModelIntegration_UserAPIKeyFraudFlow(t *testing.T) {
	// Test complete flow: User -> APIKey -> Transaction -> FraudResult
	user := &User{
		UserID:    "user_integration_test",
		Email:     "integration@test.com",
		Role:      UserRoleEnterprise,
		FirstName: "Integration",
		LastName:  "Test",
		IsActive:  true,
	}

	// Create API key for user
	apiKey := &APIKey{
		KeyID:     "key_integration_test",
		UserID:    user.UserID,
		Name:      "Integration Test Key",
		UsageTier: PricingTierEnterprise,
		RateLimit: 10000,
		IsActive:  true,
		User:      user,
	}

	// Generate actual key
	key, err := apiKey.GenerateKey()
	require.NoError(t, err)
	assert.True(t, apiKey.ValidateKey(key))

	// Create transaction
	transaction := &TransactionData{
		TransactionID: "tx_integration_test",
		Amount:        decimal.NewFromFloat(1500.00),
		Timestamp:     time.Now().Add(-time.Minute),
		MerchantID:    "merchant_integration",
		UserID:        user.UserID,
		PaymentMethod: "credit_card",
		Location: &GeoLocation{
			Latitude:  40.7128,
			Longitude: -74.0060,
			Country:   "US",
			City:      "New York",
		},
		Features: map[string]float64{
			"velocity":         0.8,
			"amount_deviation": 2.1,
			"risk_score":       0.75,
		},
	}

	// Create fraud result
	quantumAdvantage := 0.12
	fraudResult := &FraudResult{
		TransactionID:    transaction.TransactionID,
		FraudScore:       0.75,
		RiskLevel:        RiskLevelHigh,
		ProcessingMethod: ProcessingMethodQuantum,
		Confidence:       0.88,
		ProcessingTimeMs: 45,
		QuantumAdvantage: &quantumAdvantage,
		Explanation:      []string{"High velocity detected", "Amount deviation above threshold"},
		ModelVersion:     "v2.1.0",
		Transaction:      transaction,
	}

	// Validate all models
	assert.NoError(t, user.Validate())
	assert.NoError(t, apiKey.Validate())
	assert.NoError(t, transaction.Validate())
	assert.NoError(t, fraudResult.Validate())

	// Test relationships
	assert.Equal(t, user.UserID, apiKey.UserID)
	assert.Equal(t, transaction.TransactionID, fraudResult.TransactionID)
	assert.True(t, fraudResult.IsHighRisk())
	assert.True(t, fraudResult.HasQuantumAdvantage())
	assert.True(t, user.CanAccessEnterprise())
	assert.True(t, apiKey.IsValid())

	// Test API key usage tracking
	initialCount := apiKey.RequestCount
	apiKey.IncrementUsage()
	apiKey.UpdateLastUsed()
	assert.Equal(t, initialCount+1, apiKey.RequestCount)
	assert.NotNil(t, apiKey.LastUsed)
}

func TestPropertyBasedValidation_ComprehensiveScenarios(t *testing.T) {
	t.Run("random valid model generation", func(t *testing.T) {
		for i := 0; i < 200; i++ {
			// Generate random but valid models
			user := generateRandomValidUser()
			apiKey := generateRandomValidAPIKey(user.UserID)
			transaction := generateRandomValidTransaction(user.UserID)
			fraudResult := generateRandomValidFraudResult(transaction.TransactionID)

			// All should validate successfully
			assert.NoError(t, user.Validate(), "Random user should be valid: %+v", user)
			assert.NoError(t, apiKey.Validate(), "Random API key should be valid: %+v", apiKey)
			assert.NoError(t, transaction.Validate(), "Random transaction should be valid: %+v", transaction)
			assert.NoError(t, fraudResult.Validate(), "Random fraud result should be valid: %+v", fraudResult)

			// Test serialization round-trip
			testModelSerialization(t, user, &User{})
			testModelSerialization(t, apiKey, &APIKey{})
			testModelSerialization(t, transaction, &TransactionData{})
			testModelSerialization(t, fraudResult, &FraudResult{})
		}
	})

	t.Run("boundary value testing", func(t *testing.T) {
		// Test boundary values for all numeric fields
		boundaryTests := []struct {
			name  string
			value float64
			valid bool
		}{
			{"zero", 0.0, true},
			{"one", 1.0, true},
			{"just below one", 0.9999, true},
			{"just above zero", 0.0001, true},
			{"negative one", -1.0, true},
			{"just above negative one", -0.9999, true},
		}

		for _, tt := range boundaryTests {
			t.Run(tt.name, func(t *testing.T) {
				// Test fraud score boundaries (0 to 1)
				if tt.value >= 0 && tt.value <= 1 {
					fraudResult := &FraudResult{
						TransactionID:    "tx_boundary_test",
						FraudScore:       tt.value,
						Confidence:       0.5,
						ProcessingTimeMs: 50,
						ModelVersion:     "v1.0",
					}

					err := fraudResult.Validate()
					if tt.valid {
						assert.NoError(t, err, "Boundary value %f should be valid for fraud score", tt.value)
					}
				}

				// Test quantum advantage boundaries (range -1 to 1)
				if tt.value >= -1 && tt.value <= 1 {
					fraudResult := &FraudResult{
						TransactionID:    "tx_boundary_test",
						FraudScore:       0.5, // Valid fraud score
						Confidence:       0.5,
						ProcessingTimeMs: 50,
						ModelVersion:     "v1.0",
						QuantumAdvantage: &tt.value,
					}

					err := fraudResult.Validate()
					if tt.valid {
						assert.NoError(t, err, "Boundary value %f should be valid for quantum advantage", tt.value)
					}
				}
			})
		}
	})

	t.Run("concurrent model operations", func(t *testing.T) {
		// Test thread safety of model operations
		const numGoroutines = 10
		const operationsPerGoroutine = 50

		done := make(chan bool, numGoroutines)

		for i := 0; i < numGoroutines; i++ {
			go func(goroutineID int) {
				defer func() { done <- true }()

				for j := 0; j < operationsPerGoroutine; j++ {
					// Generate and validate models concurrently
					user := generateRandomValidUser()
					apiKey := generateRandomValidAPIKey(user.UserID)

					// Generate API key
					key, err := apiKey.GenerateKey()
					assert.NoError(t, err)
					assert.True(t, apiKey.ValidateKey(key))

					// Test validation
					assert.NoError(t, user.Validate())
					assert.NoError(t, apiKey.Validate())

					// Test serialization
					userData, err := json.Marshal(user)
					assert.NoError(t, err)
					var deserializedUser User
					assert.NoError(t, json.Unmarshal(userData, &deserializedUser))
				}
			}(i)
		}

		// Wait for all goroutines to complete
		for i := 0; i < numGoroutines; i++ {
			<-done
		}
	})
}

func TestAdvancedSerializationScenarios(t *testing.T) {
	t.Run("large data serialization", func(t *testing.T) {
		// Test serialization with large feature maps
		transaction := &TransactionData{
			TransactionID: "tx_large_features",
			Amount:        decimal.NewFromFloat(100.00),
			Timestamp:     time.Now(),
			MerchantID:    "merchant_123",
			UserID:        "user_123",
			PaymentMethod: "credit_card",
			Features:      make(map[string]float64),
		}

		// Add 1000 features
		for i := 0; i < 1000; i++ {
			transaction.Features[randomString(10)] = rand.Float64()
		}

		// Test serialization
		jsonData, err := json.Marshal(transaction)
		require.NoError(t, err)
		assert.Greater(t, len(jsonData), 10000) // Should be large

		// Test deserialization
		var deserialized TransactionData
		err = json.Unmarshal(jsonData, &deserialized)
		require.NoError(t, err)
		assert.Equal(t, len(transaction.Features), len(deserialized.Features))
	})

	t.Run("unicode and special characters", func(t *testing.T) {
		user := &User{
			UserID:    "user_unicode_test",
			Email:     "test@example.com",
			Role:      UserRoleDeveloper,
			FirstName: "José María",
			LastName:  "O'Connor-Smith",
			Company:   "Acme Corp™ & Associates (北京) 有限公司",
		}

		// Test serialization with unicode
		jsonData, err := json.Marshal(user)
		require.NoError(t, err)

		var deserialized User
		err = json.Unmarshal(jsonData, &deserialized)
		require.NoError(t, err)

		assert.Equal(t, user.FirstName, deserialized.FirstName)
		assert.Equal(t, user.LastName, deserialized.LastName)
		assert.Equal(t, user.Company, deserialized.Company)
	})

	t.Run("nested structure serialization", func(t *testing.T) {
		// Test complex nested structures
		user := &User{
			UserID: "user_nested_test",
			Email:  "nested@test.com",
			Role:   UserRoleEnterprise,
			APIKeys: []APIKey{
				{
					KeyID:     "key_1",
					UserID:    "user_nested_test",
					Name:      "Key 1",
					UsageTier: PricingTierDeveloper,
					RateLimit: 100,
				},
				{
					KeyID:     "key_2",
					UserID:    "user_nested_test",
					Name:      "Key 2",
					UsageTier: PricingTierGrowth,
					RateLimit: 1000,
				},
			},
		}

		jsonData, err := json.Marshal(user)
		require.NoError(t, err)

		var deserialized User
		err = json.Unmarshal(jsonData, &deserialized)
		require.NoError(t, err)

		assert.Len(t, deserialized.APIKeys, 2)
		assert.Equal(t, user.APIKeys[0].Name, deserialized.APIKeys[0].Name)
		assert.Equal(t, user.APIKeys[1].Name, deserialized.APIKeys[1].Name)
	})
}

func TestDatabaseConstraintValidation_Comprehensive(t *testing.T) {
	t.Run("cascade delete simulation", func(t *testing.T) {
		// Simulate what would happen with cascade deletes
		userID := "user_cascade_test"

		user := &User{
			UserID: userID,
			Email:  "cascade@test.com",
			Role:   UserRoleDeveloper,
		}

		apiKeys := []*APIKey{
			{
				KeyID:     "key_cascade_1",
				UserID:    userID,
				Name:      "Cascade Key 1",
				UsageTier: PricingTierDeveloper,
				RateLimit: 100,
			},
			{
				KeyID:     "key_cascade_2",
				UserID:    userID,
				Name:      "Cascade Key 2",
				UsageTier: PricingTierGrowth,
				RateLimit: 1000,
			},
		}

		// All should reference the same user
		for _, apiKey := range apiKeys {
			assert.Equal(t, userID, apiKey.UserID)
			assert.NoError(t, apiKey.Validate())
		}

		// If user is "deleted", API keys would become orphaned
		user.UserID = "different_user"
		for _, apiKey := range apiKeys {
			assert.NotEqual(t, user.UserID, apiKey.UserID)
		}
	})

	t.Run("unique constraint violations", func(t *testing.T) {
		// Test scenarios that would violate unique constraints
		email := "duplicate@test.com"

		users := []*User{
			{
				UserID: "user_1",
				Email:  email,
				Role:   UserRoleDeveloper,
			},
			{
				UserID: "user_2",
				Email:  email, // Duplicate email
				Role:   UserRoleViewer,
			},
		}

		// Both users have same email - would violate unique constraint
		assert.Equal(t, users[0].Email, users[1].Email)
		assert.NotEqual(t, users[0].UserID, users[1].UserID)
	})

	t.Run("foreign key constraint validation", func(t *testing.T) {
		// Test foreign key relationships
		validUserID := "valid_user_123"
		invalidUserID := "non_existent_user"

		validAPIKey := &APIKey{
			KeyID:     "key_valid_fk",
			UserID:    validUserID,
			Name:      "Valid FK Key",
			UsageTier: PricingTierDeveloper,
			RateLimit: 100,
		}

		invalidAPIKey := &APIKey{
			KeyID:     "key_invalid_fk",
			UserID:    invalidUserID, // Would fail FK constraint
			Name:      "Invalid FK Key",
			UsageTier: PricingTierDeveloper,
			RateLimit: 100,
		}

		// Both validate at model level, but would fail at DB level
		assert.NoError(t, validAPIKey.Validate())
		assert.NoError(t, invalidAPIKey.Validate())

		// The difference is in the UserID reference
		assert.Equal(t, validUserID, validAPIKey.UserID)
		assert.Equal(t, invalidUserID, invalidAPIKey.UserID)
	})
}

func TestModelPerformance_Benchmarks(t *testing.T) {
	t.Run("bulk validation performance", func(t *testing.T) {
		// Test performance with large numbers of models
		const numModels = 1000

		users := make([]*User, numModels)
		apiKeys := make([]*APIKey, numModels)
		transactions := make([]*TransactionData, numModels)
		fraudResults := make([]*FraudResult, numModels)

		// Generate models
		for i := 0; i < numModels; i++ {
			users[i] = generateRandomValidUser()
			apiKeys[i] = generateRandomValidAPIKey(users[i].UserID)
			transactions[i] = generateRandomValidTransaction(users[i].UserID)
			fraudResults[i] = generateRandomValidFraudResult(transactions[i].TransactionID)
		}

		// Time validation
		start := time.Now()
		for i := 0; i < numModels; i++ {
			assert.NoError(t, users[i].Validate())
			assert.NoError(t, apiKeys[i].Validate())
			assert.NoError(t, transactions[i].Validate())
			assert.NoError(t, fraudResults[i].Validate())
		}
		duration := time.Since(start)

		// Should complete within reasonable time (adjust threshold as needed)
		assert.Less(t, duration, 5*time.Second, "Bulk validation should complete quickly")
		t.Logf("Validated %d models in %v", numModels*4, duration)
	})
}

// Helper functions for generating random valid models

func generateRandomValidUser() *User {
	return &User{
		UserID:    "user_" + randomString(8),
		Email:     randomString(8) + "@example.com",
		Role:      randomUserRole(),
		FirstName: randomString(6),
		LastName:  randomString(8),
		Company:   randomString(10) + " Corp",
		IsActive:  rand.Float32() > 0.1, // 90% chance of being active
	}
}

func generateRandomValidAPIKey(userID string) *APIKey {
	return &APIKey{
		KeyID:        "key_" + randomString(8),
		UserID:       userID,
		Name:         "Test Key " + randomString(4),
		UsageTier:    randomPricingTier(),
		RateLimit:    []int{100, 1000, 5000, 10000}[rand.Intn(4)],
		IsActive:     rand.Float32() > 0.2, // 80% chance of being active
		RequestCount: rand.Int63n(10000),
	}
}

func generateRandomValidTransaction(userID string) *TransactionData {
	transaction := &TransactionData{
		TransactionID: "tx_" + randomString(10),
		Amount:        decimal.NewFromFloat(rand.Float64() * 10000), // 0 to 10000
		Timestamp:     time.Now().Add(-time.Duration(rand.Intn(3600)) * time.Second),
		MerchantID:    "merchant_" + randomString(6),
		UserID:        userID,
		PaymentMethod: randomPaymentMethod(),
		Features:      make(map[string]float64),
	}

	// Add random location 50% of the time
	if rand.Float32() > 0.5 {
		transaction.Location = &GeoLocation{
			Latitude:  (rand.Float64() * 180) - 90,  // -90 to 90
			Longitude: (rand.Float64() * 360) - 180, // -180 to 180
			Country:   randomString(2),
			City:      randomString(8),
		}
	}

	// Add random features
	numFeatures := rand.Intn(10) + 1
	for i := 0; i < numFeatures; i++ {
		transaction.Features[randomString(8)] = rand.Float64()
	}

	return transaction
}

func generateRandomValidFraudResult(transactionID string) *FraudResult {
	fraudResult := &FraudResult{
		TransactionID:    transactionID,
		FraudScore:       rand.Float64(), // 0 to 1
		RiskLevel:        randomRiskLevel(),
		ProcessingMethod: randomProcessingMethod(),
		Confidence:       rand.Float64(), // 0 to 1
		ProcessingTimeMs: rand.Int63n(1000),
		ModelVersion:     "v" + randomString(3),
	}

	// Add quantum advantage 30% of the time
	if rand.Float32() > 0.7 {
		advantage := (rand.Float64() * 2) - 1 // -1 to 1
		fraudResult.QuantumAdvantage = &advantage
	}

	// Add explanations
	numExplanations := rand.Intn(5) + 1
	for i := 0; i < numExplanations; i++ {
		fraudResult.AddExplanation("Explanation " + randomString(10))
	}

	return fraudResult
}

func testModelSerialization(t *testing.T, original interface{}, target interface{}) {
	jsonData, err := json.Marshal(original)
	require.NoError(t, err)

	err = json.Unmarshal(jsonData, target)
	require.NoError(t, err)
}
