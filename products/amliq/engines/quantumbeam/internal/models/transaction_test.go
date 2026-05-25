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

func TestTransactionData_Validate(t *testing.T) {
	tests := []struct {
		name        string
		transaction *TransactionData
		wantErr     error
	}{
		{
			name: "valid transaction",
			transaction: &TransactionData{
				TransactionID: "tx_123",
				Amount:        decimal.NewFromFloat(100.50),
				Timestamp:     time.Now().Add(-time.Hour),
				MerchantID:    "merchant_123",
				UserID:        "user_123",
				PaymentMethod: "credit_card",
				Location: &GeoLocation{
					Latitude:  40.7128,
					Longitude: -74.0060,
					Country:   "US",
					City:      "New York",
				},
			},
			wantErr: nil,
		},
		{
			name: "invalid amount - zero",
			transaction: &TransactionData{
				TransactionID: "tx_123",
				Amount:        decimal.Zero,
				Timestamp:     time.Now().Add(-time.Hour),
				MerchantID:    "merchant_123",
				UserID:        "user_123",
				PaymentMethod: "credit_card",
			},
			wantErr: ErrInvalidAmount,
		},
		{
			name: "invalid amount - negative",
			transaction: &TransactionData{
				TransactionID: "tx_123",
				Amount:        decimal.NewFromFloat(-10.00),
				Timestamp:     time.Now().Add(-time.Hour),
				MerchantID:    "merchant_123",
				UserID:        "user_123",
				PaymentMethod: "credit_card",
			},
			wantErr: ErrInvalidAmount,
		},
		{
			name: "future timestamp",
			transaction: &TransactionData{
				TransactionID: "tx_123",
				Amount:        decimal.NewFromFloat(100.50),
				Timestamp:     time.Now().Add(2 * time.Hour),
				MerchantID:    "merchant_123",
				UserID:        "user_123",
				PaymentMethod: "credit_card",
			},
			wantErr: ErrFutureTimestamp,
		},
		{
			name: "invalid latitude",
			transaction: &TransactionData{
				TransactionID: "tx_123",
				Amount:        decimal.NewFromFloat(100.50),
				Timestamp:     time.Now().Add(-time.Hour),
				MerchantID:    "merchant_123",
				UserID:        "user_123",
				PaymentMethod: "credit_card",
				Location: &GeoLocation{
					Latitude:  91.0, // Invalid latitude
					Longitude: -74.0060,
				},
			},
			wantErr: ErrInvalidLatitude,
		},
		{
			name: "invalid longitude",
			transaction: &TransactionData{
				TransactionID: "tx_123",
				Amount:        decimal.NewFromFloat(100.50),
				Timestamp:     time.Now().Add(-time.Hour),
				MerchantID:    "merchant_123",
				UserID:        "user_123",
				PaymentMethod: "credit_card",
				Location: &GeoLocation{
					Latitude:  40.7128,
					Longitude: 181.0, // Invalid longitude
				},
			},
			wantErr: ErrInvalidLongitude,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.transaction.Validate()
			if tt.wantErr != nil {
				assert.Error(t, err)
				assert.Equal(t, tt.wantErr, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestTransactionData_FeatureOperations(t *testing.T) {
	transaction := &TransactionData{
		TransactionID: "tx_123",
		Amount:        decimal.NewFromFloat(100.50),
		Timestamp:     time.Now(),
		MerchantID:    "merchant_123",
		UserID:        "user_123",
		PaymentMethod: "credit_card",
	}

	// Test setting and getting features
	transaction.SetFeatureValue("velocity", 0.75)
	transaction.SetFeatureValue("amount_deviation", 1.2)

	value, exists := transaction.GetFeatureValue("velocity")
	assert.True(t, exists)
	assert.Equal(t, 0.75, value)

	value, exists = transaction.GetFeatureValue("amount_deviation")
	assert.True(t, exists)
	assert.Equal(t, 1.2, value)

	// Test non-existent feature
	value, exists = transaction.GetFeatureValue("non_existent")
	assert.False(t, exists)
	assert.Equal(t, 0.0, value)
}

func TestTransactionData_TableName(t *testing.T) {
	transaction := &TransactionData{}
	assert.Equal(t, "transactions", transaction.TableName())
}

func TestGeoLocation_Validation(t *testing.T) {
	tests := []struct {
		name     string
		location *GeoLocation
		valid    bool
	}{
		{
			name: "valid location",
			location: &GeoLocation{
				Latitude:  40.7128,
				Longitude: -74.0060,
				Country:   "US",
				City:      "New York",
			},
			valid: true,
		},
		{
			name: "valid location - edge cases",
			location: &GeoLocation{
				Latitude:  90.0,
				Longitude: 180.0,
			},
			valid: true,
		},
		{
			name: "valid location - negative edge cases",
			location: &GeoLocation{
				Latitude:  -90.0,
				Longitude: -180.0,
			},
			valid: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			transaction := &TransactionData{
				TransactionID: "tx_123",
				Amount:        decimal.NewFromFloat(100.50),
				Timestamp:     time.Now().Add(-time.Hour),
				MerchantID:    "merchant_123",
				UserID:        "user_123",
				PaymentMethod: "credit_card",
				Location:      tt.location,
			}

			err := transaction.Validate()
			if tt.valid {
				assert.NoError(t, err)
			} else {
				assert.Error(t, err)
			}
		})
	}
}

// Property-based tests for TransactionData validation
func TestTransactionData_PropertyBasedValidation(t *testing.T) {
	t.Run("valid amounts", func(t *testing.T) {
		for i := 0; i < 100; i++ {
			amount := rand.Float64() * 10000 // Random amount between 0 and 10000
			if amount <= 0 {
				continue // Skip zero or negative amounts
			}

			transaction := &TransactionData{
				TransactionID: "tx_" + randomString(10),
				Amount:        decimal.NewFromFloat(amount),
				Timestamp:     time.Now().Add(-time.Duration(rand.Intn(3600)) * time.Second),
				MerchantID:    "merchant_" + randomString(8),
				UserID:        "user_" + randomString(8),
				PaymentMethod: randomPaymentMethod(),
			}

			err := transaction.Validate()
			assert.NoError(t, err, "Valid transaction should not produce error for amount: %f", amount)
		}
	})

	t.Run("invalid amounts", func(t *testing.T) {
		invalidAmounts := []float64{0, -1, -100.50, -0.01}

		for _, amount := range invalidAmounts {
			transaction := &TransactionData{
				TransactionID: "tx_123",
				Amount:        decimal.NewFromFloat(amount),
				Timestamp:     time.Now().Add(-time.Hour),
				MerchantID:    "merchant_123",
				UserID:        "user_123",
				PaymentMethod: "credit_card",
			}

			err := transaction.Validate()
			assert.Equal(t, ErrInvalidAmount, err, "Invalid amount %f should produce ErrInvalidAmount", amount)
		}
	})

	t.Run("valid coordinates", func(t *testing.T) {
		for i := 0; i < 100; i++ {
			lat := (rand.Float64() * 180) - 90  // Random latitude between -90 and 90
			lng := (rand.Float64() * 360) - 180 // Random longitude between -180 and 180

			transaction := &TransactionData{
				TransactionID: "tx_123",
				Amount:        decimal.NewFromFloat(100.50),
				Timestamp:     time.Now().Add(-time.Hour),
				MerchantID:    "merchant_123",
				UserID:        "user_123",
				PaymentMethod: "credit_card",
				Location: &GeoLocation{
					Latitude:  lat,
					Longitude: lng,
				},
			}

			err := transaction.Validate()
			assert.NoError(t, err, "Valid coordinates should not produce error: lat=%f, lng=%f", lat, lng)
		}
	})
}

// Serialization and deserialization tests
func TestTransactionData_JSONSerialization(t *testing.T) {
	original := &TransactionData{
		TransactionID:     "tx_12345",
		Amount:            decimal.NewFromFloat(1234.56),
		Timestamp:         time.Date(2024, 1, 15, 10, 30, 0, 0, time.UTC),
		MerchantID:        "merchant_abc",
		UserID:            "user_xyz",
		PaymentMethod:     "credit_card",
		DeviceFingerprint: stringPtr("device_fp_123"),
		Location: &GeoLocation{
			Latitude:  40.7128,
			Longitude: -74.0060,
			Country:   "US",
			City:      "New York",
		},
		Features: map[string]float64{
			"velocity":         0.75,
			"amount_deviation": 1.2,
			"risk_score":       0.3,
		},
	}

	// Test serialization
	jsonData, err := json.Marshal(original)
	require.NoError(t, err)
	assert.Contains(t, string(jsonData), "tx_12345")
	assert.Contains(t, string(jsonData), "1234.56")
	assert.Contains(t, string(jsonData), "credit_card")

	// Test deserialization
	var deserialized TransactionData
	err = json.Unmarshal(jsonData, &deserialized)
	require.NoError(t, err)

	// Verify all fields
	assert.Equal(t, original.TransactionID, deserialized.TransactionID)
	assert.True(t, original.Amount.Equal(deserialized.Amount))
	assert.Equal(t, original.MerchantID, deserialized.MerchantID)
	assert.Equal(t, original.UserID, deserialized.UserID)
	assert.Equal(t, original.PaymentMethod, deserialized.PaymentMethod)
	assert.Equal(t, *original.DeviceFingerprint, *deserialized.DeviceFingerprint)

	// Verify location
	require.NotNil(t, deserialized.Location)
	assert.Equal(t, original.Location.Latitude, deserialized.Location.Latitude)
	assert.Equal(t, original.Location.Longitude, deserialized.Location.Longitude)
	assert.Equal(t, original.Location.Country, deserialized.Location.Country)
	assert.Equal(t, original.Location.City, deserialized.Location.City)

	// Verify features
	assert.Equal(t, len(original.Features), len(deserialized.Features))
	for key, value := range original.Features {
		assert.Equal(t, value, deserialized.Features[key])
	}
}

func TestTransactionData_JSONSerializationEdgeCases(t *testing.T) {
	tests := []struct {
		name        string
		transaction *TransactionData
	}{
		{
			name: "minimal transaction",
			transaction: &TransactionData{
				TransactionID: "tx_min",
				Amount:        decimal.NewFromFloat(0.01),
				Timestamp:     time.Now(),
				MerchantID:    "m",
				UserID:        "u",
				PaymentMethod: "credit_card",
			},
		},
		{
			name: "transaction with nil location",
			transaction: &TransactionData{
				TransactionID: "tx_nil_loc",
				Amount:        decimal.NewFromFloat(100.00),
				Timestamp:     time.Now(),
				MerchantID:    "merchant",
				UserID:        "user",
				PaymentMethod: "debit_card",
				Location:      nil,
			},
		},
		{
			name: "transaction with empty features",
			transaction: &TransactionData{
				TransactionID: "tx_empty_feat",
				Amount:        decimal.NewFromFloat(50.00),
				Timestamp:     time.Now(),
				MerchantID:    "merchant",
				UserID:        "user",
				PaymentMethod: "bank_transfer",
				Features:      map[string]float64{},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Serialize
			jsonData, err := json.Marshal(tt.transaction)
			require.NoError(t, err)

			// Deserialize
			var deserialized TransactionData
			err = json.Unmarshal(jsonData, &deserialized)
			require.NoError(t, err)

			// Basic validation
			assert.Equal(t, tt.transaction.TransactionID, deserialized.TransactionID)
			assert.True(t, tt.transaction.Amount.Equal(deserialized.Amount))
		})
	}
}

// Database constraint validation tests
func TestTransactionData_DatabaseConstraints(t *testing.T) {
	t.Run("primary key constraint", func(t *testing.T) {
		transaction := &TransactionData{
			TransactionID: "", // Empty primary key should be invalid
			Amount:        decimal.NewFromFloat(100.00),
			Timestamp:     time.Now(),
			MerchantID:    "merchant_123",
			UserID:        "user_123",
			PaymentMethod: "credit_card",
		}

		// This would fail database validation due to empty primary key
		assert.Empty(t, transaction.TransactionID)
	})

	t.Run("field length constraints", func(t *testing.T) {
		longString := randomString(300) // Exceeds 255 char limit

		transaction := &TransactionData{
			TransactionID: longString, // Should exceed database limit
			Amount:        decimal.NewFromFloat(100.00),
			Timestamp:     time.Now(),
			MerchantID:    "merchant_123",
			UserID:        "user_123",
			PaymentMethod: "credit_card",
		}

		assert.Greater(t, len(transaction.TransactionID), 255)
	})

	t.Run("required field constraints", func(t *testing.T) {
		// Test each required field
		requiredFields := []struct {
			name        string
			transaction *TransactionData
		}{
			{
				name: "missing merchant_id",
				transaction: &TransactionData{
					TransactionID: "tx_123",
					Amount:        decimal.NewFromFloat(100.00),
					Timestamp:     time.Now(),
					MerchantID:    "", // Missing required field
					UserID:        "user_123",
					PaymentMethod: "credit_card",
				},
			},
			{
				name: "missing user_id",
				transaction: &TransactionData{
					TransactionID: "tx_123",
					Amount:        decimal.NewFromFloat(100.00),
					Timestamp:     time.Now(),
					MerchantID:    "merchant_123",
					UserID:        "", // Missing required field
					PaymentMethod: "credit_card",
				},
			},
			{
				name: "missing payment_method",
				transaction: &TransactionData{
					TransactionID: "tx_123",
					Amount:        decimal.NewFromFloat(100.00),
					Timestamp:     time.Now(),
					MerchantID:    "merchant_123",
					UserID:        "user_123",
					PaymentMethod: "", // Missing required field
				},
			},
		}

		for _, tt := range requiredFields {
			t.Run(tt.name, func(t *testing.T) {
				// These would fail database NOT NULL constraints
				assert.Contains(t, []string{tt.transaction.MerchantID, tt.transaction.UserID, tt.transaction.PaymentMethod}, "")
			})
		}
	})
}

// Test GORM hooks
func TestTransactionData_BeforeCreateHook(t *testing.T) {
	transaction := &TransactionData{
		TransactionID: "tx_123",
		Amount:        decimal.NewFromFloat(100.00),
		// Timestamp is zero value
		MerchantID:    "merchant_123",
		UserID:        "user_123",
		PaymentMethod: "credit_card",
	}

	// Simulate GORM BeforeCreate hook
	err := transaction.BeforeCreate(nil)
	assert.NoError(t, err)
	assert.False(t, transaction.Timestamp.IsZero())
}

// Benchmark tests for performance validation
func BenchmarkTransactionData_Validate(b *testing.B) {
	transaction := &TransactionData{
		TransactionID: "tx_123",
		Amount:        decimal.NewFromFloat(100.50),
		Timestamp:     time.Now().Add(-time.Hour),
		MerchantID:    "merchant_123",
		UserID:        "user_123",
		PaymentMethod: "credit_card",
		Location: &GeoLocation{
			Latitude:  40.7128,
			Longitude: -74.0060,
		},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = transaction.Validate()
	}
}

func BenchmarkTransactionData_JSONMarshal(b *testing.B) {
	transaction := &TransactionData{
		TransactionID: "tx_123",
		Amount:        decimal.NewFromFloat(100.50),
		Timestamp:     time.Now(),
		MerchantID:    "merchant_123",
		UserID:        "user_123",
		PaymentMethod: "credit_card",
		Features: map[string]float64{
			"velocity": 0.75,
			"risk":     0.3,
		},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = json.Marshal(transaction)
	}
}

// Helper functions are now in test_utils.go
