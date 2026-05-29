package auth

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"quantumbeam/internal/interfaces"
	"quantumbeam/internal/models"
)

// MockRateLimitService is a mock implementation of RateLimitService
type MockRateLimitService struct {
	mock.Mock
}

func (m *MockRateLimitService) CheckRateLimit(ctx context.Context, key string, limit int, window int) (*interfaces.RateLimitResult, error) {
	args := m.Called(ctx, key, limit, window)
	return args.Get(0).(*interfaces.RateLimitResult), args.Error(1)
}

func (m *MockRateLimitService) IncrementCounter(ctx context.Context, key string, window int) error {
	args := m.Called(ctx, key, window)
	return args.Error(0)
}

func (m *MockRateLimitService) GetRateLimitStatus(ctx context.Context, key string) (*interfaces.RateLimitStatus, error) {
	args := m.Called(ctx, key)
	return args.Get(0).(*interfaces.RateLimitStatus), args.Error(1)
}

func (m *MockRateLimitService) ResetRateLimit(ctx context.Context, key string) error {
	args := m.Called(ctx, key)
	return args.Error(0)
}

func setupTestDB(t *testing.T) *gorm.DB {
	// Use a per-test shared-cache DSN so every pooled connection sees the
	// same schema. With plain ":memory:" each connection gets its own
	// ephemeral DB and "no such table" errors appear non-deterministically.
	dsn := fmt.Sprintf("file:auth-%s-%d?mode=memory&cache=shared", t.Name(), time.Now().UnixNano())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)

	// Pin to a single connection — shared-cache is enough but pinning makes
	// the table visible to every async goroutine the service may spawn.
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)

	// Auto-migrate the schema
	err = db.AutoMigrate(&models.User{}, &models.APIKey{})
	require.NoError(t, err)

	return db
}

func setupTestRedis(t *testing.T) *redis.Client {
	// Use Redis mock or in-memory implementation for testing
	// For this test, we'll use a real Redis client with a test database
	client := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
		DB:   15, // Use test database
	})

	// Clear test database
	client.FlushDB(context.Background())

	return client
}

func createTestUser(t *testing.T, db *gorm.DB) *models.User {
	user := &models.User{
		UserID:    "test-user-123",
		Email:     "test@example.com",
		Role:      models.UserRoleDeveloper,
		IsActive:  true,
		CreatedAt: time.Now(),
	}

	err := db.Create(user).Error
	require.NoError(t, err)

	return user
}

func TestAPIKeyService_GenerateAPIKey(t *testing.T) {
	db := setupTestDB(t)
	redisClient := setupTestRedis(t)
	mockRateLimit := &MockRateLimitService{}

	service := NewAPIKeyService(&APIKeyConfig{
		DB:               db,
		RedisClient:      redisClient,
		RateLimitService: mockRateLimit,
	})

	user := createTestUser(t, db)

	tests := []struct {
		name        string
		userID      string
		tier        models.PricingTier
		keyName     string
		expectError bool
		errorMsg    string
	}{
		{
			name:        "Valid API key generation",
			userID:      user.UserID,
			tier:        models.PricingTierDeveloper,
			keyName:     "Test Key",
			expectError: false,
		},
		{
			name:        "Empty user ID",
			userID:      "",
			tier:        models.PricingTierDeveloper,
			keyName:     "Test Key",
			expectError: true,
			errorMsg:    "user ID cannot be empty",
		},
		{
			name:        "Empty key name",
			userID:      user.UserID,
			tier:        models.PricingTierDeveloper,
			keyName:     "",
			expectError: true,
			errorMsg:    "API key name cannot be empty",
		},
		{
			name:        "Invalid pricing tier",
			userID:      user.UserID,
			tier:        models.PricingTier("invalid"),
			keyName:     "Test Key",
			expectError: true,
			errorMsg:    "invalid pricing tier",
		},
		{
			name:        "Non-existent user",
			userID:      "non-existent-user",
			tier:        models.PricingTierDeveloper,
			keyName:     "Test Key",
			expectError: true,
			errorMsg:    "user not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()

			result, err := service.GenerateAPIKey(ctx, tt.userID, tt.tier, tt.keyName)

			if tt.expectError {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.errorMsg)
				assert.Nil(t, result)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, result)
				assert.NotEmpty(t, result.KeyID)
				assert.NotEmpty(t, result.Key)
				assert.Equal(t, tt.keyName, result.Name)
				assert.Equal(t, tt.tier, result.UsageTier)
				assert.True(t, len(result.Key) == 67) // qb_ + 64 hex chars
				assert.True(t, result.Key[:3] == "qb_")
			}
		})
	}
}

func TestAPIKeyService_ValidateAPIKey(t *testing.T) {
	db := setupTestDB(t)
	redisClient := setupTestRedis(t)
	mockRateLimit := &MockRateLimitService{}

	service := NewAPIKeyService(&APIKeyConfig{
		DB:               db,
		RedisClient:      redisClient,
		RateLimitService: mockRateLimit,
	})

	user := createTestUser(t, db)
	ctx := context.Background()

	// Generate a valid API key
	keyResponse, err := service.GenerateAPIKey(ctx, user.UserID, models.PricingTierDeveloper, "Test Key")
	require.NoError(t, err)

	// Mock rate limit service
	mockRateLimit.On("CheckRateLimit", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return(&interfaces.RateLimitResult{
			Allowed:   true,
			Remaining: 99,
			ResetTime: time.Now().Add(time.Minute).Unix(),
		}, nil)

	tests := []struct {
		name        string
		apiKey      string
		expectError bool
		errorMsg    string
	}{
		{
			name:        "Valid API key",
			apiKey:      keyResponse.Key,
			expectError: false,
		},
		{
			name:        "Empty API key",
			apiKey:      "",
			expectError: true,
			errorMsg:    "API key cannot be empty",
		},
		{
			name:        "Invalid format",
			apiKey:      "invalid-key",
			expectError: true,
			errorMsg:    "invalid API key format",
		},
		{
			name:        "Non-existent key",
			apiKey:      "qb_" + "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
			expectError: true,
			errorMsg:    "invalid API key",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := service.ValidateAPIKey(ctx, tt.apiKey)

			if tt.expectError {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.errorMsg)
				assert.Nil(t, result)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, result)
				assert.Equal(t, keyResponse.KeyID, result.KeyID)
				assert.Equal(t, user.UserID, result.UserID)
				assert.True(t, result.IsValid())
			}
		})
	}
}

func TestAPIKeyService_RotateAPIKey(t *testing.T) {
	db := setupTestDB(t)
	redisClient := setupTestRedis(t)
	mockRateLimit := &MockRateLimitService{}

	service := NewAPIKeyService(&APIKeyConfig{
		DB:               db,
		RedisClient:      redisClient,
		RateLimitService: mockRateLimit,
	})

	user := createTestUser(t, db)
	ctx := context.Background()

	// Generate initial API key
	originalKey, err := service.GenerateAPIKey(ctx, user.UserID, models.PricingTierDeveloper, "Test Key")
	require.NoError(t, err)

	tests := []struct {
		name        string
		keyID       string
		expectError bool
		errorMsg    string
	}{
		{
			name:        "Valid key rotation",
			keyID:       originalKey.KeyID,
			expectError: false,
		},
		{
			name:        "Empty key ID",
			keyID:       "",
			expectError: true,
			errorMsg:    "key ID cannot be empty",
		},
		{
			name:        "Non-existent key ID",
			keyID:       "non-existent-key",
			expectError: true,
			errorMsg:    "API key not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := service.RotateAPIKey(ctx, tt.keyID)

			if tt.expectError {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.errorMsg)
				assert.Nil(t, result)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, result)
				assert.Equal(t, originalKey.KeyID, result.KeyID)
				assert.NotEqual(t, originalKey.Key, result.Key) // New key should be different
				assert.Equal(t, originalKey.Name, result.Name)
				assert.Equal(t, originalKey.UsageTier, result.UsageTier)

				// Verify old key is invalid and new key is valid
				_, err = service.ValidateAPIKey(ctx, originalKey.Key)
				assert.Error(t, err)

				mockRateLimit.On("CheckRateLimit", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
					Return(&interfaces.RateLimitResult{
						Allowed:   true,
						Remaining: 99,
						ResetTime: time.Now().Add(time.Minute).Unix(),
					}, nil)

				validatedKey, err := service.ValidateAPIKey(ctx, result.Key)
				assert.NoError(t, err)
				assert.NotNil(t, validatedKey)
			}
		})
	}
}

func TestAPIKeyService_RevokeAPIKey(t *testing.T) {
	db := setupTestDB(t)
	redisClient := setupTestRedis(t)
	mockRateLimit := &MockRateLimitService{}

	service := NewAPIKeyService(&APIKeyConfig{
		DB:               db,
		RedisClient:      redisClient,
		RateLimitService: mockRateLimit,
	})

	user := createTestUser(t, db)
	ctx := context.Background()

	// Generate API key to revoke
	keyResponse, err := service.GenerateAPIKey(ctx, user.UserID, models.PricingTierDeveloper, "Test Key")
	require.NoError(t, err)

	tests := []struct {
		name        string
		keyID       string
		expectError bool
		errorMsg    string
	}{
		{
			name:        "Valid key revocation",
			keyID:       keyResponse.KeyID,
			expectError: false,
		},
		{
			name:        "Empty key ID",
			keyID:       "",
			expectError: true,
			errorMsg:    "key ID cannot be empty",
		},
		{
			name:        "Non-existent key ID",
			keyID:       "non-existent-key",
			expectError: true,
			errorMsg:    "API key not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := service.RevokeAPIKey(ctx, tt.keyID)

			if tt.expectError {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.errorMsg)
			} else {
				assert.NoError(t, err)

				// Verify key is no longer valid
				_, err = service.ValidateAPIKey(ctx, keyResponse.Key)
				assert.Error(t, err)
				assert.Contains(t, err.Error(), "inactive or expired")
			}
		})
	}
}

func TestAPIKeyService_ListAPIKeys(t *testing.T) {
	db := setupTestDB(t)
	redisClient := setupTestRedis(t)
	mockRateLimit := &MockRateLimitService{}

	service := NewAPIKeyService(&APIKeyConfig{
		DB:               db,
		RedisClient:      redisClient,
		RateLimitService: mockRateLimit,
	})

	user := createTestUser(t, db)
	ctx := context.Background()

	// Generate multiple API keys
	key1, err := service.GenerateAPIKey(ctx, user.UserID, models.PricingTierDeveloper, "Key 1")
	require.NoError(t, err)

	key2, err := service.GenerateAPIKey(ctx, user.UserID, models.PricingTierGrowth, "Key 2")
	require.NoError(t, err)

	tests := []struct {
		name         string
		userID       string
		expectError  bool
		errorMsg     string
		expectedKeys int
	}{
		{
			name:         "Valid user with keys",
			userID:       user.UserID,
			expectError:  false,
			expectedKeys: 2,
		},
		{
			name:        "Empty user ID",
			userID:      "",
			expectError: true,
			errorMsg:    "user ID cannot be empty",
		},
		{
			name:         "User with no keys",
			userID:       "user-with-no-keys",
			expectError:  false,
			expectedKeys: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := service.ListAPIKeys(ctx, tt.userID)

			if tt.expectError {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.errorMsg)
				assert.Nil(t, result)
			} else {
				assert.NoError(t, err)
				assert.Len(t, result, tt.expectedKeys)

				if tt.expectedKeys > 0 {
					// Verify keys are returned in correct order (newest first)
					assert.True(t, result[0].CreatedAt.After(result[1].CreatedAt) ||
						result[0].CreatedAt.Equal(result[1].CreatedAt))

					// Verify key IDs match
					keyIDs := make([]string, len(result))
					for i, key := range result {
						keyIDs[i] = key.KeyID
					}
					assert.Contains(t, keyIDs, key1.KeyID)
					assert.Contains(t, keyIDs, key2.KeyID)
				}
			}
		})
	}
}
