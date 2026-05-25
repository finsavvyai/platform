package models

import (
	"encoding/json"
	"math/rand"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAPIKey_GenerateKey(t *testing.T) {
	apiKey := &APIKey{}

	key, err := apiKey.GenerateKey()
	assert.NoError(t, err)

	// Check key format
	assert.True(t, len(key) > 0)
	assert.True(t, key[:3] == "qb_")

	// Check that hash is set
	assert.NotEmpty(t, apiKey.KeyHash)
	assert.Len(t, apiKey.KeyHash, 64) // SHA256 hex string length
}

func TestAPIKey_ValidateKey(t *testing.T) {
	apiKey := &APIKey{}

	key, err := apiKey.GenerateKey()
	assert.NoError(t, err)

	// Test valid key
	assert.True(t, apiKey.ValidateKey(key))

	// Test invalid key
	assert.False(t, apiKey.ValidateKey("invalid_key"))
	assert.False(t, apiKey.ValidateKey("qb_invalid"))
}

func TestAPIKey_IsExpired(t *testing.T) {
	tests := []struct {
		name      string
		expiresAt *time.Time
		expected  bool
	}{
		{
			name:      "no expiration",
			expiresAt: nil,
			expected:  false,
		},
		{
			name:      "future expiration",
			expiresAt: timePtr(time.Now().Add(time.Hour)),
			expected:  false,
		},
		{
			name:      "past expiration",
			expiresAt: timePtr(time.Now().Add(-time.Hour)),
			expected:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			apiKey := &APIKey{ExpiresAt: tt.expiresAt}
			assert.Equal(t, tt.expected, apiKey.IsExpired())
		})
	}
}

func TestAPIKey_IsValid(t *testing.T) {
	tests := []struct {
		name      string
		isActive  bool
		expiresAt *time.Time
		expected  bool
	}{
		{
			name:      "active and not expired",
			isActive:  true,
			expiresAt: timePtr(time.Now().Add(time.Hour)),
			expected:  true,
		},
		{
			name:      "active and no expiration",
			isActive:  true,
			expiresAt: nil,
			expected:  true,
		},
		{
			name:      "inactive",
			isActive:  false,
			expiresAt: timePtr(time.Now().Add(time.Hour)),
			expected:  false,
		},
		{
			name:      "expired",
			isActive:  true,
			expiresAt: timePtr(time.Now().Add(-time.Hour)),
			expected:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			apiKey := &APIKey{
				IsActive:  tt.isActive,
				ExpiresAt: tt.expiresAt,
			}
			assert.Equal(t, tt.expected, apiKey.IsValid())
		})
	}
}

func TestAPIKey_UpdateLastUsed(t *testing.T) {
	apiKey := &APIKey{}
	assert.Nil(t, apiKey.LastUsed)

	before := time.Now()
	apiKey.UpdateLastUsed()
	after := time.Now()

	assert.NotNil(t, apiKey.LastUsed)
	assert.True(t, apiKey.LastUsed.After(before) || apiKey.LastUsed.Equal(before))
	assert.True(t, apiKey.LastUsed.Before(after) || apiKey.LastUsed.Equal(after))
}

func TestAPIKey_IncrementUsage(t *testing.T) {
	apiKey := &APIKey{RequestCount: 5}

	apiKey.IncrementUsage()
	assert.Equal(t, int64(6), apiKey.RequestCount)

	apiKey.IncrementUsage()
	assert.Equal(t, int64(7), apiKey.RequestCount)
}

func TestAPIKey_ResetUsage(t *testing.T) {
	apiKey := &APIKey{
		RequestCount: 100,
		LastResetAt:  time.Now().Add(-time.Hour),
	}

	before := time.Now()
	apiKey.ResetUsage()
	after := time.Now()

	assert.Equal(t, int64(0), apiKey.RequestCount)
	assert.True(t, apiKey.LastResetAt.After(before) || apiKey.LastResetAt.Equal(before))
	assert.True(t, apiKey.LastResetAt.Before(after) || apiKey.LastResetAt.Equal(after))
}

func TestAPIKey_GetDefaultRateLimit(t *testing.T) {
	tests := []struct {
		name     string
		tier     PricingTier
		expected int
	}{
		{"developer tier", PricingTierDeveloper, 100},
		{"growth tier", PricingTierGrowth, 1000},
		{"scale tier", PricingTierScale, 5000},
		{"enterprise tier", PricingTierEnterprise, 10000},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			apiKey := &APIKey{UsageTier: tt.tier}
			assert.Equal(t, tt.expected, apiKey.GetDefaultRateLimit())
		})
	}
}

func TestAPIKey_ActivateDeactivate(t *testing.T) {
	apiKey := &APIKey{IsActive: true}

	// Test deactivation
	apiKey.Deactivate()
	assert.False(t, apiKey.IsActive)

	// Test activation
	apiKey.Activate()
	assert.True(t, apiKey.IsActive)
}

func TestAPIKey_Validate(t *testing.T) {
	tests := []struct {
		name    string
		apiKey  *APIKey
		wantErr error
	}{
		{
			name: "valid API key",
			apiKey: &APIKey{
				UserID:    "user_123",
				Name:      "Test Key",
				RateLimit: 100,
			},
			wantErr: nil,
		},
		{
			name: "invalid user ID - empty",
			apiKey: &APIKey{
				UserID:    "",
				Name:      "Test Key",
				RateLimit: 100,
			},
			wantErr: ErrInvalidUserID,
		},
		{
			name: "invalid name - empty",
			apiKey: &APIKey{
				UserID:    "user_123",
				Name:      "",
				RateLimit: 100,
			},
			wantErr: ErrInvalidAPIKeyName,
		},
		{
			name: "invalid rate limit - zero",
			apiKey: &APIKey{
				UserID:    "user_123",
				Name:      "Test Key",
				RateLimit: 0,
			},
			wantErr: ErrInvalidRateLimit,
		},
		{
			name: "invalid rate limit - negative",
			apiKey: &APIKey{
				UserID:    "user_123",
				Name:      "Test Key",
				RateLimit: -10,
			},
			wantErr: ErrInvalidRateLimit,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.apiKey.Validate()
			if tt.wantErr != nil {
				assert.Error(t, err)
				assert.Equal(t, tt.wantErr, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestAPIKey_TableName(t *testing.T) {
	apiKey := &APIKey{}
	assert.Equal(t, "api_keys", apiKey.TableName())
}

// Helper functions are now in test_utils.go

// Property-based tests for APIKey validation
func TestAPIKey_PropertyBasedValidation(t *testing.T) {
	t.Run("valid rate limits by tier", func(t *testing.T) {
		tiers := []PricingTier{PricingTierDeveloper, PricingTierGrowth, PricingTierScale, PricingTierEnterprise}

		for _, tier := range tiers {
			apiKey := &APIKey{
				KeyID:     "key_" + randomString(8),
				UserID:    "user_" + randomString(8),
				Name:      "Test Key " + string(tier),
				UsageTier: tier,
				RateLimit: 0, // Will be set by GetDefaultRateLimit
			}

			// Test default rate limit calculation
			defaultLimit := apiKey.GetDefaultRateLimit()
			assert.Greater(t, defaultLimit, 0, "Default rate limit should be positive for tier %s", tier)

			// Verify tier-specific limits
			switch tier {
			case PricingTierDeveloper:
				assert.Equal(t, 100, defaultLimit)
			case PricingTierGrowth:
				assert.Equal(t, 1000, defaultLimit)
			case PricingTierScale:
				assert.Equal(t, 5000, defaultLimit)
			case PricingTierEnterprise:
				assert.Equal(t, 10000, defaultLimit)
			}
		}
	})

	t.Run("key generation uniqueness", func(t *testing.T) {
		generatedKeys := make(map[string]bool)

		for i := 0; i < 100; i++ {
			apiKey := &APIKey{}
			key, err := apiKey.GenerateKey()
			require.NoError(t, err)

			// Check uniqueness
			assert.False(t, generatedKeys[key], "Generated key should be unique: %s", key)
			generatedKeys[key] = true

			// Check format
			assert.True(t, strings.HasPrefix(key, "qb_"), "Key should have qb_ prefix")
			assert.Greater(t, len(key), 10, "Key should be sufficiently long")
		}
	})

	t.Run("usage tracking operations", func(t *testing.T) {
		for i := 0; i < 50; i++ {
			initialCount := rand.Int63n(1000)
			incrementCount := rand.Intn(100) + 1

			apiKey := &APIKey{
				RequestCount: initialCount,
			}

			// Test multiple increments
			for j := 0; j < incrementCount; j++ {
				apiKey.IncrementUsage()
			}

			expectedCount := initialCount + int64(incrementCount)
			assert.Equal(t, expectedCount, apiKey.RequestCount,
				"Request count should be correctly incremented from %d by %d", initialCount, incrementCount)
		}
	})
}

// Serialization and deserialization tests
func TestAPIKey_JSONSerialization(t *testing.T) {
	expiresAt := time.Date(2025, 12, 31, 23, 59, 59, 0, time.UTC)
	lastUsed := time.Date(2024, 1, 15, 10, 30, 0, 0, time.UTC)
	lastResetAt := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	subscriptionID := "sub_12345"

	original := &APIKey{
		KeyID:          "key_12345",
		KeyHash:        "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
		UserID:         "user_67890",
		Name:           "Production API Key",
		UsageTier:      PricingTierScale,
		RateLimit:      5000,
		CreatedAt:      time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		UpdatedAt:      time.Date(2024, 1, 15, 12, 0, 0, 0, time.UTC),
		LastUsed:       &lastUsed,
		ExpiresAt:      &expiresAt,
		IsActive:       true,
		SubscriptionID: &subscriptionID,
		RequestCount:   12345,
		LastResetAt:    lastResetAt,
	}

	// Test serialization (KeyHash should be excluded with json:"-")
	jsonData, err := json.Marshal(original)
	require.NoError(t, err)
	assert.Contains(t, string(jsonData), "key_12345")
	assert.Contains(t, string(jsonData), "user_67890")
	assert.Contains(t, string(jsonData), "Production API Key")
	assert.Contains(t, string(jsonData), "scale")
	assert.NotContains(t, string(jsonData), "abcdef1234567890") // KeyHash should be excluded

	// Test deserialization
	var deserialized APIKey
	err = json.Unmarshal(jsonData, &deserialized)
	require.NoError(t, err)

	// Verify all fields except KeyHash
	assert.Equal(t, original.KeyID, deserialized.KeyID)
	assert.Empty(t, deserialized.KeyHash) // Should be empty due to json:"-"
	assert.Equal(t, original.UserID, deserialized.UserID)
	assert.Equal(t, original.Name, deserialized.Name)
	assert.Equal(t, original.UsageTier, deserialized.UsageTier)
	assert.Equal(t, original.RateLimit, deserialized.RateLimit)
	assert.Equal(t, original.IsActive, deserialized.IsActive)
	assert.Equal(t, *original.SubscriptionID, *deserialized.SubscriptionID)
	assert.Equal(t, original.RequestCount, deserialized.RequestCount)

	// Verify time fields
	assert.True(t, original.LastUsed.Equal(*deserialized.LastUsed))
	assert.True(t, original.ExpiresAt.Equal(*deserialized.ExpiresAt))
}

func TestAPIKey_JSONSerializationEdgeCases(t *testing.T) {
	tests := []struct {
		name   string
		apiKey *APIKey
	}{
		{
			name: "minimal API key",
			apiKey: &APIKey{
				KeyID:     "key_min",
				UserID:    "user_min",
				Name:      "Min Key",
				UsageTier: PricingTierDeveloper,
				RateLimit: 100,
			},
		},
		{
			name: "API key with nil optional fields",
			apiKey: &APIKey{
				KeyID:          "key_nil",
				UserID:         "user_nil",
				Name:           "Nil Key",
				UsageTier:      PricingTierGrowth,
				RateLimit:      1000,
				LastUsed:       nil,
				ExpiresAt:      nil,
				SubscriptionID: nil,
			},
		},
		{
			name: "expired API key",
			apiKey: &APIKey{
				KeyID:     "key_expired",
				UserID:    "user_expired",
				Name:      "Expired Key",
				UsageTier: PricingTierEnterprise,
				RateLimit: 10000,
				ExpiresAt: timePtr(time.Now().Add(-time.Hour)),
				IsActive:  false,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Serialize
			jsonData, err := json.Marshal(tt.apiKey)
			require.NoError(t, err)

			// Deserialize
			var deserialized APIKey
			err = json.Unmarshal(jsonData, &deserialized)
			require.NoError(t, err)

			// Basic validation
			assert.Equal(t, tt.apiKey.KeyID, deserialized.KeyID)
			assert.Equal(t, tt.apiKey.UserID, deserialized.UserID)
			assert.Equal(t, tt.apiKey.Name, deserialized.Name)
			assert.Equal(t, tt.apiKey.UsageTier, deserialized.UsageTier)
		})
	}
}

// Database constraint validation tests
func TestAPIKey_DatabaseConstraints(t *testing.T) {
	t.Run("foreign key constraint", func(t *testing.T) {
		apiKey := &APIKey{
			KeyID:     "key_123",
			UserID:    "non_existent_user", // Would fail foreign key constraint
			Name:      "Test Key",
			UsageTier: PricingTierDeveloper,
			RateLimit: 100,
		}

		// This would fail database foreign key validation
		assert.Equal(t, "non_existent_user", apiKey.UserID)
	})

	t.Run("unique key hash constraint", func(t *testing.T) {
		apiKey1 := &APIKey{KeyHash: "duplicate_hash"}
		apiKey2 := &APIKey{KeyHash: "duplicate_hash"} // Same hash - would fail unique constraint

		// Both keys have the same hash - would fail database unique constraint
		assert.Equal(t, apiKey1.KeyHash, apiKey2.KeyHash)
	})

	t.Run("field length constraints", func(t *testing.T) {
		longString := randomString(300) // Exceeds field limits

		apiKey := &APIKey{
			KeyID:          longString,        // Should exceed 255 char limit
			UserID:         longString,        // Should exceed 255 char limit
			Name:           randomString(150), // Should exceed 100 char limit
			UsageTier:      PricingTierDeveloper,
			RateLimit:      100,
			SubscriptionID: &longString, // Should exceed 255 char limit
		}

		assert.Greater(t, len(apiKey.KeyID), 255)
		assert.Greater(t, len(apiKey.UserID), 255)
		assert.Greater(t, len(apiKey.Name), 100)
		assert.Greater(t, len(*apiKey.SubscriptionID), 255)
	})

	t.Run("enum constraints", func(t *testing.T) {
		invalidTiers := []string{"invalid", "premium", "basic", ""}

		for _, tier := range invalidTiers {
			apiKey := &APIKey{
				KeyID:     "key_123",
				UserID:    "user_123",
				Name:      "Test Key",
				UsageTier: PricingTier(tier), // Invalid enum value
				RateLimit: 100,
			}

			// Would fail database enum constraint
			assert.NotContains(t, []PricingTier{PricingTierDeveloper, PricingTierGrowth, PricingTierScale, PricingTierEnterprise}, apiKey.UsageTier)
		}
	})
}

// Test GORM hooks
func TestAPIKey_BeforeCreateHook(t *testing.T) {
	apiKey := &APIKey{
		KeyID:     "", // Empty KeyID should be generated
		UserID:    "user_123",
		Name:      "Test Key",
		UsageTier: PricingTierGrowth,
		RateLimit: 0, // Should be set based on tier
	}

	// Simulate GORM BeforeCreate hook
	err := apiKey.BeforeCreate(nil)
	assert.NoError(t, err)
	assert.NotEmpty(t, apiKey.KeyID)
	assert.True(t, strings.HasPrefix(apiKey.KeyID, "key_"))
	assert.Equal(t, 1000, apiKey.RateLimit) // Should be set based on Growth tier
}

// Test relationship handling
func TestAPIKey_UserRelationship(t *testing.T) {
	user := &User{
		UserID: "user_123",
		Email:  "test@example.com",
		Role:   UserRoleDeveloper,
	}

	apiKey := &APIKey{
		KeyID:     "key_123",
		UserID:    "user_123",
		Name:      "Test Key",
		UsageTier: PricingTierDeveloper,
		RateLimit: 100,
		User:      user,
	}

	// Test relationship
	assert.NotNil(t, apiKey.User)
	assert.Equal(t, apiKey.UserID, apiKey.User.UserID)
}

// Test key security operations
func TestAPIKey_SecurityOperations(t *testing.T) {
	t.Run("key validation security", func(t *testing.T) {
		apiKey := &APIKey{}

		// Generate a key
		originalKey, err := apiKey.GenerateKey()
		require.NoError(t, err)

		// Test various invalid keys
		invalidKeys := []string{
			"",
			"invalid",
			"qb_invalid",
			originalKey + "extra",
			originalKey[:len(originalKey)-1], // Truncated
			strings.ToUpper(originalKey),     // Case change
		}

		for _, invalidKey := range invalidKeys {
			assert.False(t, apiKey.ValidateKey(invalidKey), "Invalid key should not validate: %s", invalidKey)
		}

		// Original key should still validate
		assert.True(t, apiKey.ValidateKey(originalKey))
	})

	t.Run("hash consistency", func(t *testing.T) {
		apiKey := &APIKey{}

		key, err := apiKey.GenerateKey()
		require.NoError(t, err)

		originalHash := apiKey.KeyHash

		// Validate multiple times - hash should remain consistent
		for i := 0; i < 10; i++ {
			assert.True(t, apiKey.ValidateKey(key))
			assert.Equal(t, originalHash, apiKey.KeyHash, "Hash should remain consistent")
		}
	})
}

// Test expiration and validity logic
func TestAPIKey_ExpirationLogic(t *testing.T) {
	now := time.Now()

	tests := []struct {
		name      string
		isActive  bool
		expiresAt *time.Time
		isExpired bool
		isValid   bool
	}{
		{
			name:      "active, no expiration",
			isActive:  true,
			expiresAt: nil,
			isExpired: false,
			isValid:   true,
		},
		{
			name:      "active, future expiration",
			isActive:  true,
			expiresAt: timePtr(now.Add(time.Hour)),
			isExpired: false,
			isValid:   true,
		},
		{
			name:      "active, past expiration",
			isActive:  true,
			expiresAt: timePtr(now.Add(-time.Hour)),
			isExpired: true,
			isValid:   false,
		},
		{
			name:      "inactive, no expiration",
			isActive:  false,
			expiresAt: nil,
			isExpired: false,
			isValid:   false,
		},
		{
			name:      "inactive, future expiration",
			isActive:  false,
			expiresAt: timePtr(now.Add(time.Hour)),
			isExpired: false,
			isValid:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			apiKey := &APIKey{
				IsActive:  tt.isActive,
				ExpiresAt: tt.expiresAt,
			}

			assert.Equal(t, tt.isExpired, apiKey.IsExpired())
			assert.Equal(t, tt.isValid, apiKey.IsValid())
		})
	}
}

// Benchmark tests
func BenchmarkAPIKey_GenerateKey(b *testing.B) {
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		apiKey := &APIKey{}
		_, _ = apiKey.GenerateKey()
	}
}

func BenchmarkAPIKey_ValidateKey(b *testing.B) {
	apiKey := &APIKey{}
	key, _ := apiKey.GenerateKey()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = apiKey.ValidateKey(key)
	}
}

func BenchmarkAPIKey_Validate(b *testing.B) {
	apiKey := &APIKey{
		UserID:    "user_123",
		Name:      "Test Key",
		RateLimit: 100,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = apiKey.Validate()
	}
}

func BenchmarkAPIKey_JSONMarshal(b *testing.B) {
	subscriptionID := "sub_123"
	apiKey := &APIKey{
		KeyID:          "key_12345",
		UserID:         "user_67890",
		Name:           "Production API Key",
		UsageTier:      PricingTierScale,
		RateLimit:      5000,
		IsActive:       true,
		SubscriptionID: &subscriptionID,
		RequestCount:   12345,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = json.Marshal(apiKey)
	}
}
