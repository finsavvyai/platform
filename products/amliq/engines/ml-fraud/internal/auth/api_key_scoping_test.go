package auth

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"quantumbeam/internal/interfaces"
	"quantumbeam/internal/models"
)

// TestExpiredKeyRejected verifies ValidateAPIKey rejects a key with past ExpiresAt.
func TestExpiredKeyRejected(t *testing.T) {
	db := setupTestDB(t)
	redisClient := setupTestRedis(t)
	svc := NewAPIKeyService(&APIKeyConfig{
		DB: db, RedisClient: redisClient, RateLimitService: &MockRateLimitService{},
	})
	user := createTestUser(t, db)
	ctx := context.Background()

	keyResp, err := svc.GenerateAPIKey(ctx, user.UserID, models.PricingTierDeveloper, "Expiry Test Key")
	require.NoError(t, err)

	// Set ExpiresAt to the past directly in the database.
	past := time.Now().Add(-time.Hour)
	err = db.Model(&models.APIKey{}).
		Where("key_id = ?", keyResp.KeyID).
		Update("expires_at", past).Error
	require.NoError(t, err)

	// Clear Redis cache so the service reads the DB record.
	redisClient.FlushDB(ctx)

	_, err = svc.ValidateAPIKey(ctx, keyResp.Key)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "inactive or expired")
}

// TestRevokedKeyImmediatelyRejected verifies that after revocation a key
// cannot be used even within the same request context.
func TestRevokedKeyImmediatelyRejected(t *testing.T) {
	db := setupTestDB(t)
	redisClient := setupTestRedis(t)
	mockRL := &MockRateLimitService{}
	mockRL.On("CheckRateLimit",
		mock.Anything, mock.Anything, mock.Anything, mock.Anything,
	).Return(&interfaces.RateLimitResult{
		Allowed: true, Remaining: 99, ResetTime: time.Now().Add(time.Minute).Unix(),
	}, nil)

	svc := NewAPIKeyService(&APIKeyConfig{
		DB: db, RedisClient: redisClient, RateLimitService: mockRL,
	})
	user := createTestUser(t, db)
	ctx := context.Background()

	keyResp, err := svc.GenerateAPIKey(ctx, user.UserID, models.PricingTierGrowth, "Revoke Me")
	require.NoError(t, err)

	validKey, err := svc.ValidateAPIKey(ctx, keyResp.Key)
	require.NoError(t, err)
	assert.True(t, validKey.IsValid())

	err = svc.RevokeAPIKey(ctx, keyResp.KeyID)
	require.NoError(t, err)

	_, err = svc.ValidateAPIKey(ctx, keyResp.Key)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "inactive or expired")
}

// TestTierBasedRateLimits verifies each pricing tier returns the correct rate limit.
func TestTierBasedRateLimits(t *testing.T) {
	db := setupTestDB(t)
	redisClient := setupTestRedis(t)
	svc := NewAPIKeyService(&APIKeyConfig{
		DB: db, RedisClient: redisClient, RateLimitService: &MockRateLimitService{},
	})
	user := createTestUser(t, db)
	ctx := context.Background()

	tests := []struct {
		tier          models.PricingTier
		expectedLimit int
	}{
		{models.PricingTierDeveloper, 100},
		{models.PricingTierGrowth, 1000},
		{models.PricingTierScale, 5000},
		{models.PricingTierEnterprise, 10000},
	}

	for _, tt := range tests {
		t.Run(string(tt.tier), func(t *testing.T) {
			keyResp, err := svc.GenerateAPIKey(
				ctx, user.UserID, tt.tier,
				"key-"+string(tt.tier),
			)
			require.NoError(t, err)
			assert.Equal(t, tt.expectedLimit, keyResp.RateLimit)

			// Also verify the DB record has the correct rate limit.
			var dbKey models.APIKey
			err = db.Where("key_id = ?", keyResp.KeyID).First(&dbKey).Error
			require.NoError(t, err)
			assert.Equal(t, tt.expectedLimit, dbKey.RateLimit)
		})
	}
}

// TestRotationInvalidatesOldKey verifies the original key is rejected after rotation.
func TestRotationInvalidatesOldKey(t *testing.T) {
	db := setupTestDB(t)
	redisClient := setupTestRedis(t)
	mockRL := &MockRateLimitService{}
	mockRL.On("CheckRateLimit",
		mock.Anything, mock.Anything, mock.Anything, mock.Anything,
	).Return(&interfaces.RateLimitResult{
		Allowed: true, Remaining: 99, ResetTime: time.Now().Add(time.Minute).Unix(),
	}, nil)

	svc := NewAPIKeyService(&APIKeyConfig{
		DB: db, RedisClient: redisClient, RateLimitService: mockRL,
	})
	user := createTestUser(t, db)
	ctx := context.Background()

	original, err := svc.GenerateAPIKey(ctx, user.UserID, models.PricingTierDeveloper, "Rotate Test")
	require.NoError(t, err)

	rotated, err := svc.RotateAPIKey(ctx, original.KeyID)
	require.NoError(t, err)
	assert.NotEqual(t, original.Key, rotated.Key)
	assert.Equal(t, original.KeyID, rotated.KeyID)

	// Old key must fail.
	_, err = svc.ValidateAPIKey(ctx, original.Key)
	assert.Error(t, err, "old key should be rejected after rotation")

	// New key must succeed.
	validKey, err := svc.ValidateAPIKey(ctx, rotated.Key)
	assert.NoError(t, err)
	assert.NotNil(t, validKey)
	assert.Equal(t, original.KeyID, validKey.KeyID)
}

// TestModelIsValidCombinations unit-tests APIKey.IsValid() and IsExpired() directly.
func TestModelIsValidCombinations(t *testing.T) {
	past := time.Now().Add(-time.Hour)
	future := time.Now().Add(time.Hour)

	tests := []struct {
		name     string
		active   bool
		expires  *time.Time
		expected bool
	}{
		{"active+no_expiry", true, nil, true},
		{"active+future_expiry", true, &future, true},
		{"active+past_expiry", true, &past, false},
		{"inactive+no_expiry", false, nil, false},
		{"inactive+future_expiry", false, &future, false},
		{"inactive+past_expiry", false, &past, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			key := &models.APIKey{
				IsActive:  tt.active,
				ExpiresAt: tt.expires,
			}
			assert.Equal(t, tt.expected, key.IsValid())
		})
	}
}
